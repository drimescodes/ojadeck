import type { Context, Next } from "hono";
import { getSessionPayload, verifyCsrf } from "./session";

/**
 * Auth middleware — validates JWT and sets sellerId on context
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
    const payload = getSessionPayload(c);

    if (!payload || !payload.sellerId) {
        return c.json({ error: "Authentication required" }, 401);
    }

    if (!verifyCsrf(c, payload)) {
        return c.json({ error: "CSRF verification failed" }, 403);
    }

    c.set("sellerId" as never, payload.sellerId as never);
    await next();
}
