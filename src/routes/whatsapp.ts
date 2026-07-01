import { Hono } from "hono";
import type { SessionManager } from "../services/session-manager";
import logger from "../utils/logger";
import { db } from "../db";
import { sellers } from "../db/schema";
import { eq } from "drizzle-orm";

/**
 * WhatsApp session routes — connect/disconnect/status
 */
export function createWhatsAppRoutes(sessionManager: SessionManager): Hono {
    const router = new Hono();

    // Start a WhatsApp session (triggers QR code generation)
    router.post("/connect", async (c) => {
        const sellerId = c.get("sellerId" as never) as string;

        try {
            const session = await sessionManager.createSession(sellerId);
            return c.json({
                message: "Session initializing. Poll status to receive the QR code.",
                ...session,
            });
        } catch (err: any) {
            logger.error({ sellerId, err: err.message }, "Session creation failed");
            return c.json({ error: err.message }, 400);
        }
    });

    // Disconnect WhatsApp session
    router.post("/disconnect", async (c) => {
        const sellerId = c.get("sellerId" as never) as string;

        await sessionManager.destroySession(sellerId, { clearAuth: true });
        return c.json({
            message: "WhatsApp unlinked. Reconnecting will require scanning a fresh QR code.",
        });
    });

    // Get session status
    router.get("/status", async (c) => {
        const sellerId = c.get("sellerId" as never) as string;
        const seller = await db.query.sellers.findFirst({
            where: eq(sellers.id, sellerId),
        });

        return c.json({
            ...await sessionManager.getSessionSnapshotWithHealthCheck(sellerId),
            autoReplyEnabled: seller?.autoReplyEnabled !== false,
        });
    });

    router.post("/pause", async (c) => {
        const sellerId = c.get("sellerId" as never) as string;
        await db
            .update(sellers)
            .set({ autoReplyEnabled: false })
            .where(eq(sellers.id, sellerId));

        return c.json({ message: "AI auto-replies paused", autoReplyEnabled: false });
    });

    router.post("/resume", async (c) => {
        const sellerId = c.get("sellerId" as never) as string;
        await db
            .update(sellers)
            .set({ autoReplyEnabled: true })
            .where(eq(sellers.id, sellerId));

        return c.json({ message: "AI auto-replies resumed", autoReplyEnabled: true });
    });

    // List all active sessions (admin/debug)
    router.get("/sessions", async (c) => {
        return c.json(sessionManager.listSessions());
    });

    return router;
}

/**
 * Set up WebSocket handler for QR code streaming
 */
export function setupWebSocket(
    sessionManager: SessionManager,
    server: any
): void {
    // Track connected WS clients by sellerId
    const wsClients = new Map<string, Set<any>>();

    server.upgrade = (req: any) => {
        const url = new URL(req.url, `http://localhost`);
        if (url.pathname === "/ws") return true;
        return false;
    };

    // Listen for session manager events and broadcast
    sessionManager.on("qr", ({ sellerId, qr }) => {
        const clients = wsClients.get(sellerId);
        if (clients) {
            const msg = JSON.stringify({ type: "qr", sellerId, qr });
            clients.forEach((ws) => {
                try {
                    ws.send(msg);
                } catch { }
            });
        }
    });

    sessionManager.on("ready", ({ sellerId }) => {
        const clients = wsClients.get(sellerId);
        if (clients) {
            const msg = JSON.stringify({ type: "connected", sellerId });
            clients.forEach((ws) => {
                try {
                    ws.send(msg);
                } catch { }
            });
        }
    });

    sessionManager.on("authenticated", ({ sellerId }) => {
        const clients = wsClients.get(sellerId);
        if (clients) {
            const msg = JSON.stringify({ type: "authenticated", sellerId });
            clients.forEach((ws) => {
                try {
                    ws.send(msg);
                } catch { }
            });
        }
    });

    sessionManager.on("disconnected", ({ sellerId, reason }) => {
        const clients = wsClients.get(sellerId);
        if (clients) {
            const msg = JSON.stringify({ type: "disconnected", sellerId, reason });
            clients.forEach((ws) => {
                try {
                    ws.send(msg);
                } catch { }
            });
        }
    });

    sessionManager.on("auth_failure", ({ sellerId, error }) => {
        const clients = wsClients.get(sellerId);
        if (clients) {
            const msg = JSON.stringify({ type: "auth_failure", sellerId, error });
            clients.forEach((ws) => {
                try {
                    ws.send(msg);
                } catch { }
            });
        }
    });

    logger.info("WebSocket handler configured for QR streaming");

    // Return the WebSocket handler for Bun.serve
    return {
        wsClients,
        handleOpen(ws: any, sellerId: string) {
            if (!wsClients.has(sellerId)) {
                wsClients.set(sellerId, new Set());
            }
            wsClients.get(sellerId)!.add(ws);

            // Send current QR if available
            const qr = sessionManager.getQR(sellerId);
            if (qr) {
                ws.send(JSON.stringify({ type: "qr", sellerId, qr }));
            }

            // Send current status
            const status = sessionManager.getStatus(sellerId);
            ws.send(JSON.stringify({ type: "status", sellerId, status }));
        },
        handleClose(ws: any, sellerId: string) {
            wsClients.get(sellerId)?.delete(ws);
        },
    } as any;
}
