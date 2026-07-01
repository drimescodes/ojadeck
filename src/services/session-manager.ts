import { Client, LocalAuth } from "whatsapp-web.js";
import { EventEmitter } from "events";
import { db } from "../db";
import { sellers } from "../db/schema";
import { eq } from "drizzle-orm";
import { handleIncomingMessage } from "./message-handler";
import logger from "../utils/logger";
import { sleep } from "../utils/helpers";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";

interface Session {
    client: Client;
    status: "initializing" | "qr_ready" | "authenticated" | "connected" | "disconnected" | "error";
    qrCode: string | null;
    error: string | null;
    progress: string | null;
    updatedAt: string;
}

export interface SessionSnapshot {
    status: Session["status"] | "none";
    qr: string | null;
    error: string | null;
    progress: string | null;
    updatedAt: string | null;
}

export class SessionManager extends EventEmitter {
    private sessions: Map<string, Session> = new Map();
    private intentionallyClosingSessions: Set<string> = new Set();
    private preserveLinkedSessions: Set<string> = new Set();
    private reconnectingSessions: Set<string> = new Set();
    private maxSessions: number;
    private authBasePath: string;

    constructor(maxSessions = 2) {
        super();
        this.maxSessions = maxSessions;
        this.authBasePath = path.join(process.cwd(), "data", ".wwebjs_auth");

        const healthMonitor = setInterval(() => {
            this.monitorSessionHealth().catch((err: any) => {
                logger.warn({ err: err?.message || String(err) }, "Session health monitor failed");
            });
        }, Number(process.env.WA_HEALTHCHECK_INTERVAL_MS || 30000));

        if (typeof (healthMonitor as any).unref === "function") {
            (healthMonitor as any).unref();
        }
    }

    private getPuppeteerConfig() {
        const isProduction = process.env.NODE_ENV === "production";
        const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
            || this.findInstalledBrowserPath()
            || (isProduction ? "/usr/bin/google-chrome-stable" : undefined);
        const headlessMode = process.env.WA_HEADLESS === "false" ? false : "new";
        const authTimeoutMs = Number(process.env.WA_AUTH_TIMEOUT_MS || 180000);
        const qrMaxRetries = Number(process.env.WA_QR_MAX_RETRIES || 8);
        const protocolTimeout = Number(process.env.WA_PROTOCOL_TIMEOUT_MS || 300000);

        logger.info({
            executablePath: executablePath || "default",
            headlessMode,
            authTimeoutMs,
            qrMaxRetries,
            protocolTimeout,
            runtime: typeof Bun !== "undefined" ? `bun-${Bun.version}` : `node-${process.version}`,
        }, "Preparing WhatsApp client config");

        return {
            authTimeoutMs,
            qrMaxRetries,
            puppeteer: {
                ...(executablePath ? { executablePath } : {}),
                headless: headlessMode as any,
                protocolTimeout,
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-crash-reporter",
                    "--disable-crashpad",
                    "--no-zygote",
                    "--disable-extensions",
                    "--disable-background-networking",
                    "--disable-background-timer-throttling",
                    "--disable-renderer-backgrounding",
                    "--disable-features=Translate,BackForwardCache,site-per-process",
                    "--no-first-run",
                    "--no-default-browser-check",
                ],
            },
        };
    }

    private findInstalledBrowserPath(): string | undefined {
        const candidates = [
            "/usr/bin/google-chrome-stable",
            "/usr/bin/google-chrome",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/snap/bin/chromium",
        ];

        return candidates.find((candidate) => existsSync(candidate));
    }

    private updateSessionState(
        sellerId: string,
        status: Session["status"],
        overrides: Partial<Pick<Session, "qrCode" | "error" | "progress">> = {}
    ): void {
        const session = this.sessions.get(sellerId);
        if (!session) return;

        session.status = status;
        if (overrides.qrCode !== undefined) session.qrCode = overrides.qrCode;
        if (overrides.error !== undefined) session.error = overrides.error;
        if (overrides.progress !== undefined) session.progress = overrides.progress;
        session.updatedAt = new Date().toISOString();
    }

    private async getClientHealth(
        sellerId: string,
        client: Client
    ): Promise<{ healthy: boolean; reason?: string }> {
        try {
            const browser = await (client as any).pupBrowser;
            const page = await (client as any).pupPage;

            if (!browser) {
                return { healthy: false, reason: "WhatsApp browser process is missing." };
            }

            if (typeof browser.isConnected === "function" && !browser.isConnected()) {
                return { healthy: false, reason: "WhatsApp browser process is no longer connected." };
            }

            if (page && typeof page.isClosed === "function" && page.isClosed()) {
                return { healthy: false, reason: "WhatsApp page was closed." };
            }

            const state = await Promise.race([
                client.getState(),
                new Promise<string>((_, reject) =>
                    setTimeout(() => reject(new Error("Timed out while checking WhatsApp state.")), 10000)
                ),
            ]);

            if (!state) {
                return { healthy: false, reason: "WhatsApp state is unavailable." };
            }

            const normalizedState = String(state).toUpperCase();
            if (normalizedState === "CONNECTED" || normalizedState === "OPENING" || normalizedState === "PAIRING") {
                return { healthy: true };
            }

            return {
                healthy: false,
                reason: `WhatsApp state is ${normalizedState}.`,
            };
        } catch (err: any) {
            return {
                healthy: false,
                reason: err?.message || "Failed to inspect WhatsApp client health.",
            };
        }
    }

    private async monitorSessionHealth(): Promise<void> {
        const sessions = Array.from(this.sessions.entries());
        for (const [sellerId, session] of sessions) {
            if (session.status !== "connected") continue;
            if (this.reconnectingSessions.has(sellerId)) continue;

            const health = await this.getClientHealth(sellerId, session.client);
            if (!health.healthy) {
                logger.warn({ sellerId, reason: health.reason }, "Connected session failed health check");
                await this.handleUnexpectedDisconnect(
                    sellerId,
                    session.client,
                    health.reason || "WhatsApp session became unhealthy."
                );
            }
        }
    }

    private async handleUnexpectedDisconnect(sellerId: string, client: Client, reason: string): Promise<void> {
        if (!this.sessions.has(sellerId)) return;
        if (this.reconnectingSessions.has(sellerId)) return;

        this.updateSessionState(sellerId, "disconnected", {
            error: reason || null,
            progress: `WhatsApp disconnected: ${reason || "unknown reason"}`,
        });
        this.emit("disconnected", { sellerId, reason });
        logger.warn({ sellerId, reason }, "WhatsApp client disconnected unexpectedly");

        this.reconnectingSessions.add(sellerId);
        try {
            await this.attemptReconnect(sellerId, client);
        } finally {
            this.reconnectingSessions.delete(sellerId);
        }
    }

    private getAuthSessionPath(sellerId: string): string {
        return path.join(this.authBasePath, `session-${sellerId}`);
    }

    private async clearAuthCache(sellerId: string): Promise<void> {
        const cacheDir = this.getAuthSessionPath(sellerId);
        await fs.rm(cacheDir, { recursive: true, force: true });
        logger.warn({ sellerId, cacheDir }, "Auth cache cleared");
    }

    private async cleanupClientResources(sellerId: string, client: Client, context: string): Promise<void> {
        const rawClient = client as any;
        const page = rawClient.pupPage;
        const browser = rawClient.pupBrowser;
        const browserProcess = typeof browser?.process === "function" ? browser.process() : null;
        const browserPid = browserProcess?.pid;

        try {
            if (page && typeof page.isClosed === "function" && !page.isClosed()) {
                await page.close().catch(() => { });
            }
        } catch (err: any) {
            logger.warn({ sellerId, err: err?.message, context }, "Failed to close WhatsApp page during cleanup");
        }

        try {
            if (browser) {
                await browser.close();
            }
        } catch (err: any) {
            logger.warn({ sellerId, err: err?.message, context }, "Failed to close WhatsApp browser during cleanup");
        }

        try {
            await client.destroy();
        } catch (err: any) {
            logger.warn({ sellerId, err: err?.message, context }, "Failed to destroy WhatsApp client during cleanup");
        }

        if (browserPid) {
            try {
                process.kill(browserPid, 0);
                process.kill(browserPid, "SIGKILL");
                logger.warn({ sellerId, browserPid, context }, "Killed lingering WhatsApp browser process");
            } catch {
                // Browser process already exited.
            }
        }
    }

    private isCurrentClient(sellerId: string, client: Client): boolean {
        return this.sessions.get(sellerId)?.client === client;
    }

    private buildClient(sellerId: string): Client {
        const clientConfig = this.getPuppeteerConfig();
        return new Client({
            authStrategy: new LocalAuth({
                clientId: sellerId,
                dataPath: this.authBasePath,
            }),
            ...clientConfig,
        });
    }

    private bindClientEvents(sellerId: string, client: Client): void {
        client.on("qr", (qr: string) => {
            if (!this.isCurrentClient(sellerId, client)) return;

            this.updateSessionState(sellerId, "qr_ready", {
                qrCode: qr,
                error: null,
                progress: "QR code ready. Scan with WhatsApp Linked Devices.",
            });
            this.emit("qr", { sellerId, qr });
            logger.info({ sellerId }, "QR code received — waiting for scan");
        });

        client.on("authenticated", () => {
            if (!this.isCurrentClient(sellerId, client)) return;

            this.updateSessionState(sellerId, "authenticated", {
                qrCode: null,
                error: null,
                progress: "WhatsApp authenticated. Finalizing session.",
            });
            this.emit("authenticated", { sellerId });
            logger.info({ sellerId }, "Session authenticated");
        });

        client.on("ready", async () => {
            if (!this.isCurrentClient(sellerId, client)) return;

            this.updateSessionState(sellerId, "connected", {
                error: null,
                progress: "WhatsApp connected successfully.",
            });
            this.emit("ready", { sellerId });
            logger.info({ sellerId }, "WhatsApp client ready");

            try {
                await db
                    .update(sellers)
                    .set({ whatsappConnected: true })
                    .where(eq(sellers.id, sellerId));
            } catch (err: any) {
                logger.warn({ err: err.message }, "Failed to update seller connected status");
            }
        });

        client.on("message", async (msg: any) => {
            if (!this.isCurrentClient(sellerId, client)) return;
            await handleIncomingMessage(sellerId, msg);
        });

        client.on("disconnected", async (reason: string) => {
            if (!this.isCurrentClient(sellerId, client)) return;

            const wasIntentional = this.intentionallyClosingSessions.has(sellerId);
            const preserveLink = this.preserveLinkedSessions.has(sellerId);
            if (wasIntentional) {
                this.updateSessionState(sellerId, "disconnected", {
                    error: reason || null,
                    progress: preserveLink
                        ? "WhatsApp session closed locally for backend restart."
                        : "WhatsApp was unlinked from this dashboard.",
                });
                this.emit("disconnected", { sellerId, reason });
                logger.warn({ sellerId, reason }, "WhatsApp client disconnected");

                try {
                    if (!preserveLink) {
                        await db
                            .update(sellers)
                            .set({ whatsappConnected: false })
                            .where(eq(sellers.id, sellerId));
                    }
                } catch {
                    // ignore
                }

                this.intentionallyClosingSessions.delete(sellerId);
                this.preserveLinkedSessions.delete(sellerId);
                return;
            }

            await this.handleUnexpectedDisconnect(sellerId, client, reason || "unknown reason");
        });

        client.on("auth_failure", (error: any) => {
            if (!this.isCurrentClient(sellerId, client)) return;

            const errorMessage = error?.message || "Unknown auth error";
            this.updateSessionState(sellerId, "error", {
                error: errorMessage,
                qrCode: null,
                progress: "Authentication failed before WhatsApp session became ready.",
            });
            this.emit("auth_failure", { sellerId, error: errorMessage });
            logger.error({ sellerId, err: errorMessage }, "Authentication failed");
        });

        client.on("loading_screen", (percent: string, message: string) => {
            if (!this.isCurrentClient(sellerId, client)) return;

            const progress = `Loading WhatsApp Web: ${percent}%${message ? ` (${message})` : ""}`;
            this.updateSessionState(sellerId, "initializing", { progress });
            logger.info({ sellerId, percent, message }, "WhatsApp loading screen update");
        });

        client.on("change_state", (state: string) => {
            if (!this.isCurrentClient(sellerId, client)) return;

            const progress = `WhatsApp state changed: ${state}`;
            this.updateSessionState(sellerId, "initializing", { progress });
            logger.info({ sellerId, state }, "WhatsApp state changed");
        });
    }

    private async startFreshQrAttempt(sellerId: string, client: Client): Promise<boolean> {
        await this.cleanupClientResources(sellerId, client, "fresh-qr-attempt");

        try {
            await this.clearAuthCache(sellerId);
        } catch (clearError: any) {
            logger.warn({ sellerId, err: clearError?.message }, "Failed to clear auth cache after final initialization failure");
        }

        this.updateSessionState(sellerId, "initializing", {
            error: null,
            qrCode: null,
            progress: "Previous session was marked stale and cleared. Generating a fresh QR code now.",
        });

        try {
            const replacementClient = this.buildClient(sellerId);
            this.bindClientEvents(sellerId, replacementClient);
            const session = this.sessions.get(sellerId);
            if (session) {
                session.client = replacementClient;
            }

            await this.clearSingletonLocks(sellerId);
            const initTimeoutMs = Number(process.env.WA_INIT_TIMEOUT_MS || 120000);
            await Promise.race([
                replacementClient.initialize(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Fresh QR initialization timed out after ${Math.round(initTimeoutMs / 1000)}s.`)), initTimeoutMs)
                ),
            ]);
            logger.info({ sellerId }, "Fresh QR initialization started successfully");
            return true;
        } catch (err: any) {
            const errorMessage = String(err?.message || "Fresh QR initialization failed");
            logger.error({ sellerId, err: errorMessage }, "Fresh QR initialization failed");
            this.updateSessionState(sellerId, "error", {
                error: [
                    "WhatsApp session could not be restored and the fresh QR attempt also failed.",
                    "Please click Connect WhatsApp again.",
                    "If an old linked device still appears on your phone, remove it from Linked Devices before trying again.",
                ].join(" "),
                qrCode: null,
                progress: "Fresh QR generation failed after stale-session reset.",
            });
            this.emit("session_error", { sellerId, error: errorMessage });
            return false;
        }
    }

    private async initializeClientWithRecovery(sellerId: string, client: Client): Promise<void> {
        const maxRetries = 4;
        let executionContextFailureCount = 0;
        let currentClient = client;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            this.updateSessionState(sellerId, "initializing", {
                error: null,
                progress: `Starting WhatsApp Web session (attempt ${attempt}/${maxRetries})`,
            });

            try {
                await this.clearSingletonLocks(sellerId);
                const initTimeoutMs = Number(process.env.WA_INIT_TIMEOUT_MS || 120000);
                await Promise.race([
                    currentClient.initialize(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`WhatsApp initialization timed out after ${Math.round(initTimeoutMs / 1000)}s without QR or ready event.`)), initTimeoutMs)
                    ),
                ]);
                logger.info({ sellerId, attempt }, "Client initialization started successfully");
                return;
            } catch (err: any) {
                const errorMessage = String(err?.message || "Client initialization failed");
                const isExecutionContextError = /Execution context was destroyed|Runtime\.callFunctionOn/i.test(errorMessage);
                if (isExecutionContextError) {
                    executionContextFailureCount += 1;
                }

                await this.cleanupClientResources(sellerId, currentClient, `initialize-attempt-${attempt}`);

                this.updateSessionState(sellerId, "error", {
                    error: errorMessage,
                    qrCode: null,
                    progress: `Initialization failed on attempt ${attempt}/${maxRetries}`,
                });

                logger.warn({
                    sellerId,
                    attempt,
                    err: errorMessage,
                    executionContextFailureCount,
                }, "Initialization attempt failed");

                // Preserve LocalAuth data on generic init timeouts so backend restarts
                // don't force a fresh QR scan. Only wipe auth state for repeated
                // execution-context failures, which more strongly suggests corruption.
                if (isExecutionContextError && executionContextFailureCount >= 2) {
                    try {
                        await this.clearAuthCache(sellerId);
                    } catch (clearError: any) {
                        logger.warn({ sellerId, err: clearError?.message }, "Failed to clear auth cache during retry");
                    }
                }

                if (attempt < maxRetries) {
                    const replacementClient = this.buildClient(sellerId);
                    this.bindClientEvents(sellerId, replacementClient);
                    const session = this.sessions.get(sellerId);
                    if (session) {
                        session.client = replacementClient;
                    }
                    currentClient = replacementClient;
                }

                if (attempt < maxRetries) {
                    const waitSeconds = Math.min(30, 10 + attempt * 5);
                    logger.info({ sellerId, attempt, waitSeconds }, "Waiting before initialization retry");
                    await sleep(waitSeconds * 1000);
                }
            }
        }

        const finalError = this.sessions.get(sellerId)?.error || "Client initialization failed";

        const restarted = await this.startFreshQrAttempt(sellerId, currentClient);
        if (!restarted) {
            this.emit("session_error", { sellerId, error: finalError });
        }
    }

    /**
     * Create and initialize a WhatsApp session for a seller
     */
    async createSession(sellerId: string): Promise<SessionSnapshot> {
        if (this.sessions.has(sellerId)) {
            const existing = this.sessions.get(sellerId)!;
            if (existing.status === "connected") {
                logger.info({ sellerId }, "Session already connected");
                return this.getSessionSnapshot(sellerId);
            }
            // Destroy stale session before recreating
            await this.destroySession(sellerId);
        }

        if (this.sessions.size >= this.maxSessions) {
            throw new Error(`Max sessions (${this.maxSessions}) reached. Disconnect another seller first.`);
        }

        logger.info({ sellerId }, "Creating WhatsApp session");

        // Clear singleton locks before initializing (from birthday bot pattern)
        await this.clearSingletonLocks(sellerId);

        const client = this.buildClient(sellerId);

        const session: Session = {
            client,
            status: "initializing",
            qrCode: null,
            error: null,
            progress: "Preparing browser session",
            updatedAt: new Date().toISOString(),
        };

        this.sessions.set(sellerId, session);
        this.bindClientEvents(sellerId, client);

        this.initializeClientWithRecovery(sellerId, client).catch((err: any) => {
            const errorMessage = String(err?.message || "Client initialization failed");
            this.updateSessionState(sellerId, "error", {
                error: errorMessage,
                qrCode: null,
                progress: "Unexpected initialization error.",
            });
            this.emit("session_error", { sellerId, error: errorMessage });
        });

        return this.getSessionSnapshot(sellerId);
    }

    /**
     * Destroy a session and cleanup
     */
    async destroySession(sellerId: string, options?: { clearAuth?: boolean; preserveLink?: boolean }): Promise<void> {
        const session = this.sessions.get(sellerId);
        if (!session) return;
        const clearAuth = options?.clearAuth === true;
        const preserveLink = options?.preserveLink === true;

        this.intentionallyClosingSessions.add(sellerId);
        if (preserveLink) {
            this.preserveLinkedSessions.add(sellerId);
        }

        try {
            await this.cleanupClientResources(sellerId, session.client, clearAuth ? "unlink" : "destroy-session");
        } catch (err: any) {
            logger.warn({ sellerId, err: err.message }, "Error destroying session");
        }

        this.sessions.delete(sellerId);
        this.intentionallyClosingSessions.delete(sellerId);
        this.preserveLinkedSessions.delete(sellerId);

        if (clearAuth) {
            try {
                await this.clearAuthCache(sellerId);
            } catch (err: any) {
                logger.warn({ sellerId, err: err.message }, "Failed to clear auth cache during unlink");
            }
        }

        // Update seller record
        if (!preserveLink) {
            try {
                await db
                    .update(sellers)
                    .set({ whatsappConnected: false })
                    .where(eq(sellers.id, sellerId));
            } catch {
                // ignore
            }
        }

        logger.info({ sellerId, clearAuth, preserveLink }, clearAuth ? "Session unlinked" : "Session destroyed");
    }

    /**
     * Get client instance for a seller
     */
    getClient(sellerId: string): Client | null {
        const session = this.sessions.get(sellerId);
        return session?.status === "connected" ? session.client : null;
    }

    /**
     * Get session status for a seller
     */
    getStatus(sellerId: string): Session["status"] | "none" {
        return this.sessions.get(sellerId)?.status || "none";
    }

    /**
     * Get current QR code for a seller (if available)
     */
    getQR(sellerId: string): string | null {
        return this.sessions.get(sellerId)?.qrCode || null;
    }

    getSessionSnapshot(sellerId: string): SessionSnapshot {
        const session = this.sessions.get(sellerId);
        if (!session) {
            return {
                status: "none",
                qr: null,
                error: null,
                progress: null,
                updatedAt: null,
            };
        }

        return {
            status: session.status,
            qr: session.qrCode,
            error: session.error,
            progress: session.progress,
            updatedAt: session.updatedAt,
        };
    }

    async getSessionSnapshotWithHealthCheck(sellerId: string): Promise<SessionSnapshot> {
        const session = this.sessions.get(sellerId);
        if (!session) {
            return this.getSessionSnapshot(sellerId);
        }

        if (session.status === "connected" && !this.reconnectingSessions.has(sellerId)) {
            const health = await this.getClientHealth(sellerId, session.client);
            if (!health.healthy) {
                logger.warn({ sellerId, reason: health.reason }, "Session status check detected unhealthy client");
                await this.handleUnexpectedDisconnect(
                    sellerId,
                    session.client,
                    health.reason || "WhatsApp session became unhealthy."
                );
            }
        }

        return this.getSessionSnapshot(sellerId);
    }

    /**
     * List all active sessions
     */
    listSessions(): { sellerId: string; status: Session["status"]; error: string | null; progress: string | null; updatedAt: string }[] {
        return Array.from(this.sessions.entries()).map(([sellerId, session]) => ({
            sellerId,
            status: session.status,
            error: session.error,
            progress: session.progress,
            updatedAt: session.updatedAt,
        }));
    }

    /**
     * Attempt to reconnect a disconnected session with backoff
     */
    private async attemptReconnect(sellerId: string, client: Client): Promise<void> {
        const maxRetries = 3;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const waitSeconds = Math.min(30, 10 + attempt * 5);
            logger.info({ sellerId, attempt, waitSeconds }, "Waiting before reconnect attempt");
            await sleep(waitSeconds * 1000);

            // Check if session was manually destroyed while we were waiting
            if (!this.sessions.has(sellerId)) return;

            try {
                await this.cleanupClientResources(sellerId, client, `reconnect-attempt-${attempt}`);
                const replacementClient = this.buildClient(sellerId);
                this.bindClientEvents(sellerId, replacementClient);
                const session = this.sessions.get(sellerId);
                if (!session) return;
                session.client = replacementClient;

                await this.clearSingletonLocks(sellerId);
                this.updateSessionState(sellerId, "initializing", {
                    error: null,
                    progress: `Attempting reconnect ${attempt}/${maxRetries}`,
                });
                await this.initializeClientWithRecovery(sellerId, replacementClient);
                logger.info({ sellerId, attempt }, "Reconnected successfully");
                return;
            } catch (err: any) {
                const errorMessage = err?.message || "Reconnect attempt failed";
                this.updateSessionState(sellerId, "error", {
                    error: errorMessage,
                    progress: `Reconnect failed on attempt ${attempt}/${maxRetries}`,
                });
                logger.warn({ sellerId, attempt, err: errorMessage }, "Reconnect attempt failed");
            }
        }

        logger.error({ sellerId }, "All reconnect attempts failed — session removed");
        this.sessions.delete(sellerId);
        this.emit("reconnect_failed", { sellerId });
    }

    /**
     * Clear Chrome singleton locks (from birthday bot pattern)
     */
    private async clearSingletonLocks(sellerId: string): Promise<void> {
        const sessionPath = path.join(this.authBasePath, `session-${sellerId}`);
        const lockFiles = ["SingletonLock", "SingletonCookie", "SingletonSocket"];

        for (const lockFile of lockFiles) {
            try {
                await fs.unlink(path.join(sessionPath, lockFile));
                logger.debug({ sellerId, lockFile }, "Cleared singleton lock");
            } catch {
                // File doesn't exist — fine
            }
        }
    }

    /**
     * Destroy all sessions (for graceful shutdown)
     */
    async destroyAll(): Promise<void> {
        const ids = Array.from(this.sessions.keys());
        for (const id of ids) {
            await this.destroySession(id, { preserveLink: true });
        }
        logger.info("All sessions destroyed");
    }
}
