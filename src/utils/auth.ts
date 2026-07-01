import type { Context, Next } from "hono";
import jwt from "./jwt";

/**
 * Auth middleware — validates JWT and sets sellerId on context
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return c.json({ error: "Authorization header required" }, 401);
    }

    const token = authHeader.substring(7);
    const payload = jwt.verify(token);

    if (!payload || !payload.sellerId) {
        return c.json({ error: "Invalid or expired token" }, 401);
    }

    c.set("sellerId" as never, payload.sellerId as never);
    await next();
}
