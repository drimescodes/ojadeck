import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { serveStatic } from "hono/bun";
import logger from "./utils/logger";
import { migrate } from "./db/migrate";
import { SessionManager } from "./services/session-manager";
import { setSessionManager } from "./services/message-handler";
import { authMiddleware } from "./utils/auth";
import productsRouter from "./routes/products";
import ordersRouter from "./routes/orders";
import webhooksRouter from "./routes/webhooks";
import { createWhatsAppRoutes } from "./routes/whatsapp";
import jwt from "./utils/jwt";

// Import seller route handlers directly
import { db } from "./db";
import { sellers } from "./db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { generateId } from "./utils/helpers";

// ─── Initialize ──────────────────────────────────────────
logger.info("Starting OjaDeck WhatsApp commerce assistant...");
migrate();

const sessionManager = new SessionManager(2);
setSessionManager(sessionManager);

async function rehydrateLinkedSessions(): Promise<void> {
    const linkedSellers = await db.query.sellers.findMany({
        where: eq(sellers.whatsappConnected, true),
    });

    if (linkedSellers.length === 0) {
        logger.info("No linked WhatsApp sessions to rehydrate");
        return;
    }

    logger.info({ count: linkedSellers.length }, "Rehydrating linked WhatsApp sessions");

    for (const seller of linkedSellers) {
        try {
            await sessionManager.createSession(seller.id);
            logger.info({ sellerId: seller.id }, "Queued linked WhatsApp session for rehydration");
        } catch (err: any) {
            logger.error({ sellerId: seller.id, err: err.message }, "Failed to rehydrate linked WhatsApp session");
        }
    }
}

// ─── Hono App ────────────────────────────────────────────
const app = new Hono();

app.use("*", cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
}));
app.use("/api/*", honoLogger());

// ─── Public routes (no auth) ─────────────────────────────
app.get("/api/health", (c) => c.json({
    status: "ok",
    sessions: sessionManager.listSessions(),
    uptime: process.uptime(),
}));

app.post("/api/auth/register", async (c) => {
    const { email, password, businessName, personalPhone } = await c.req.json();
    if (!email || !password || !businessName) {
        return c.json({ error: "email, password, and businessName are required" }, 400);
    }
    const existing = await db.query.sellers.findFirst({ where: eq(sellers.email, email) });
    if (existing) return c.json({ error: "Email already registered" }, 409);

    const id = generateId();
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.insert(sellers).values({ id, email, password: hashedPassword, businessName, personalPhone: personalPhone || null });

    const token = jwt.sign({ sellerId: id, email });
    return c.json({ seller: { id, email, businessName, personalPhone, autoReplyEnabled: true }, token });
});

app.post("/api/auth/login", async (c) => {
    const { email, password } = await c.req.json();
    if (!email || !password) return c.json({ error: "email and password are required" }, 400);

    const seller = await db.query.sellers.findFirst({ where: eq(sellers.email, email) });
    if (!seller || !(await bcrypt.compare(password, seller.password))) {
        return c.json({ error: "Invalid credentials" }, 401);
    }

    const token = jwt.sign({ sellerId: seller.id, email: seller.email });
    return c.json({
        seller: {
            id: seller.id, email: seller.email, businessName: seller.businessName,
            personalPhone: seller.personalPhone, whatsappConnected: seller.whatsappConnected,
            autoReplyEnabled: seller.autoReplyEnabled,
        },
        token,
    });
});

// Payment webhooks (no auth)
app.route("/api/webhooks", webhooksRouter);

// ─── Protected routes (auth required) ───────────────────
const protectedApi = new Hono();
protectedApi.use("*", authMiddleware);

protectedApi.get("/sellers/me", async (c) => {
    const sellerId = c.get("sellerId" as never) as string;
    const seller = await db.query.sellers.findFirst({ where: eq(sellers.id, sellerId) });
    if (!seller) return c.json({ error: "Seller not found" }, 404);
    return c.json({
        id: seller.id, email: seller.email, businessName: seller.businessName,
        personalPhone: seller.personalPhone, whatsappConnected: seller.whatsappConnected,
        autoReplyEnabled: seller.autoReplyEnabled,
    });
});

protectedApi.put("/sellers/me", async (c) => {
    const sellerId = c.get("sellerId" as never) as string;
    const { businessName, personalPhone, autoReplyEnabled } = await c.req.json();
    await db.update(sellers).set({
        ...(businessName && { businessName }),
        ...(personalPhone !== undefined && { personalPhone }),
        ...(autoReplyEnabled !== undefined && { autoReplyEnabled }),
    }).where(eq(sellers.id, sellerId));
    return c.json({ success: true });
});

protectedApi.route("/products", productsRouter);
protectedApi.route("/orders", ordersRouter);
protectedApi.route("/whatsapp", createWhatsAppRoutes(sessionManager));
app.route("/api", protectedApi);

// ─── Serve dashboard static files ────────────────────────
app.use("/*", serveStatic({ root: "./dashboard/dist" }));
app.get("/*", serveStatic({ root: "./dashboard/dist", path: "index.html" }));

// ─── Bun.serve ──────────────────────────────────────────
const PORT = Number(process.env.PORT || 3000);
const wsClients = new Map<string, Set<any>>();

sessionManager.on("qr", ({ sellerId, qr }: { sellerId: string; qr: string }) => {
    broadcast(sellerId, { type: "qr", sellerId, qr });
});
sessionManager.on("ready", ({ sellerId }: { sellerId: string }) => {
    broadcast(sellerId, { type: "connected", sellerId });
});
sessionManager.on("authenticated", ({ sellerId }: { sellerId: string }) => {
    broadcast(sellerId, { type: "authenticated", sellerId });
});
sessionManager.on("disconnected", ({ sellerId, reason }: { sellerId: string; reason: string }) => {
    broadcast(sellerId, { type: "disconnected", sellerId, reason });
});
sessionManager.on("auth_failure", ({ sellerId, error }: { sellerId: string; error: string }) => {
    broadcast(sellerId, { type: "auth_failure", sellerId, error });
});
sessionManager.on("session_error", ({ sellerId, error }: { sellerId: string; error: string }) => {
    broadcast(sellerId, { type: "error", sellerId, error });
});

function broadcast(sellerId: string, data: any): void {
    const clients = wsClients.get(sellerId);
    if (!clients) return;
    const msg = JSON.stringify(data);
    clients.forEach((ws) => { try { ws.send(msg); } catch { } });
}

const server = Bun.serve<{ sellerId: string }>({
    port: PORT,
    fetch(req, server) {
        const url = new URL(req.url);
        if (url.pathname === "/ws") {
            const token = url.searchParams.get("token");
            if (!token) return new Response("Missing token", { status: 401 });
            const payload = jwt.verify(token);
            if (!payload?.sellerId) return new Response("Invalid token", { status: 401 });
            const upgraded = server.upgrade(req, { data: { sellerId: payload.sellerId } });
            if (upgraded) return undefined;
            return new Response("WebSocket upgrade failed", { status: 500 });
        }
        return app.fetch(req);
    },
    websocket: {
        open(ws) {
            const { sellerId } = ws.data;
            if (!wsClients.has(sellerId)) wsClients.set(sellerId, new Set());
            wsClients.get(sellerId)!.add(ws);
            const status = sessionManager.getStatus(sellerId);
            ws.send(JSON.stringify({ type: "status", sellerId, status }));
            const qr = sessionManager.getQR(sellerId);
            if (qr) ws.send(JSON.stringify({ type: "qr", sellerId, qr }));
        },
        message(ws, message) { },
        close(ws) {
            const { sellerId } = ws.data;
            wsClients.get(sellerId)?.delete(ws);
        },
    },
});

logger.info({ port: PORT }, `Server running on http://localhost:${PORT}`);
rehydrateLinkedSessions().catch((err: any) => {
    logger.error({ err: err.message }, "Failed during linked-session rehydration");
});

// ─── Graceful shutdown ───────────────────────────────────
let isShuttingDown = false;
async function gracefulShutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, "Shutting down gracefully...");
    try {
        await sessionManager.destroyAll();
        process.exit(0);
    } catch (err: any) {
        logger.error({ err: err.message }, "Error during shutdown");
        process.exit(1);
    }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("uncaughtException", (err) => {
    logger.fatal({ err: err.message, stack: err.stack }, "Uncaught exception");
    gracefulShutdown("uncaughtException");
});
process.on("unhandledRejection", (reason) => {
    logger.error({ reason: String(reason) }, "Unhandled rejection");
});
