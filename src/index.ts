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
import walletRouter from "./routes/wallet";
import webhooksRouter from "./routes/webhooks";
import { createWhatsAppRoutes } from "./routes/whatsapp";
import { clearSession, createSession, getSessionPayloadFromCookieHeader } from "./utils/session";

// Import seller route handlers directly
import { db } from "./db";
import { sellers } from "./db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { generateId } from "./utils/helpers";

// ─── Initialize ──────────────────────────────────────────
logger.info("Starting OjaDeck WhatsApp commerce assistant...");
migrate();

const sessionManager = new SessionManager();
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
    sessionCount: sessionManager.listSessions().length,
    uptime: process.uptime(),
}));

app.get("/payment/complete", (c) => {
    const escapeHtml = (value: string) => value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const orderReference = c.req.query("orderReference");
    const safeOrderReference = orderReference ? escapeHtml(orderReference) : "";
    return c.html(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Payment received - OjaDeck</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 24px 16px; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f3ea; color: #18231d; overflow-x: hidden; }
    main { width: min(100%, 480px); border: 1px solid #e7dfcf; border-radius: 24px; background: #fffdf8; padding: clamp(22px, 7vw, 32px); box-shadow: 0 18px 50px rgba(21, 35, 29, 0.12); }
    .kicker { color: #7b6b48; font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; }
    h1 { margin: 12px 0; font-size: clamp(28px, 9vw, 32px); line-height: 1.05; }
    p { margin: 0; color: #627168; line-height: 1.7; }
    .ref { margin-top: 20px; padding: 12px 14px; border-radius: 14px; background: #f7f3ea; color: #294136; font-size: 13px; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main>
    <div class="kicker">OjaDeck</div>
    <h1>Payment received</h1>
    <p>Your payment has been received. You can return to WhatsApp; the merchant will process your order shortly.</p>
    ${safeOrderReference ? `<div class="ref">Reference: ${safeOrderReference}</div>` : ""}
  </main>
</body>
</html>`);
});

app.post("/api/auth/register", async (c) => {
    const { email, password, businessName, personalPhone } = await c.req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail || !password || !businessName) {
        return c.json({ error: "email, password, and businessName are required" }, 400);
    }

    if (String(password).length < 8) {
        return c.json({ error: "password must be at least 8 characters" }, 400);
    }

    const existing = await db.query.sellers.findFirst({ where: eq(sellers.email, normalizedEmail) });
    if (existing) return c.json({ error: "Email already registered" }, 409);

    const id = generateId();
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.insert(sellers).values({ id, email: normalizedEmail, password: hashedPassword, businessName, personalPhone: personalPhone || null });

    createSession(c, { sellerId: id, email: normalizedEmail });
    return c.json({
        seller: {
            id,
            email: normalizedEmail,
            businessName,
            personalPhone,
            autoReplyEnabled: true,
            aiTone: null,
            aiBusinessContext: null,
            aiInstructions: null,
        },
    });
});

app.post("/api/auth/login", async (c) => {
    const { email, password } = await c.req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail || !password) return c.json({ error: "email and password are required" }, 400);

    const seller = await db.query.sellers.findFirst({ where: eq(sellers.email, normalizedEmail) });
    if (!seller || !(await bcrypt.compare(password, seller.password))) {
        return c.json({ error: "Invalid credentials" }, 401);
    }

    createSession(c, { sellerId: seller.id, email: seller.email });
    return c.json({
        seller: {
            id: seller.id, email: seller.email, businessName: seller.businessName,
            personalPhone: seller.personalPhone, whatsappConnected: seller.whatsappConnected,
            autoReplyEnabled: seller.autoReplyEnabled,
            aiTone: seller.aiTone,
            aiBusinessContext: seller.aiBusinessContext,
            aiInstructions: seller.aiInstructions,
        },
    });
});

app.post("/api/auth/logout", (c) => {
    clearSession(c);
    return c.json({ success: true });
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
        aiTone: seller.aiTone,
        aiBusinessContext: seller.aiBusinessContext,
        aiInstructions: seller.aiInstructions,
    });
});

protectedApi.put("/sellers/me", async (c) => {
    const sellerId = c.get("sellerId" as never) as string;
    const { businessName, personalPhone, autoReplyEnabled, aiTone, aiBusinessContext, aiInstructions } = await c.req.json();
    await db.update(sellers).set({
        ...(businessName && { businessName }),
        ...(personalPhone !== undefined && { personalPhone }),
        ...(autoReplyEnabled !== undefined && { autoReplyEnabled }),
        ...(aiTone !== undefined && { aiTone: aiTone?.trim() || null }),
        ...(aiBusinessContext !== undefined && { aiBusinessContext: aiBusinessContext?.trim() || null }),
        ...(aiInstructions !== undefined && { aiInstructions: aiInstructions?.trim() || null }),
    }).where(eq(sellers.id, sellerId));
    return c.json({ success: true });
});

protectedApi.route("/products", productsRouter);
protectedApi.route("/orders", ordersRouter);
protectedApi.route("/wallet", walletRouter);
protectedApi.route("/whatsapp", createWhatsAppRoutes(sessionManager));
app.route("/api", protectedApi);

// ─── Uploaded product media ─────────────────────────────
app.use("/uploads/*", serveStatic({ root: "./" }));

// ─── Hosted demo media ──────────────────────────────────
app.use("/demo-media/*", serveStatic({ root: "./" }));

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
            const payload = getSessionPayloadFromCookieHeader(req.headers.get("cookie"));
            if (!payload?.sellerId) return new Response("Authentication required", { status: 401 });
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
