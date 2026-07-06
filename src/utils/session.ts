import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import jwt from "./jwt";

export const SESSION_COOKIE = "ojadeck_session";
export const CSRF_COOKIE = "ojadeck_csrf";
export const CSRF_HEADER = "x-csrf-token";

const SESSION_MAX_AGE_SECONDS = 72 * 60 * 60;

type SessionPayload = {
    sellerId: string;
    email?: string;
    csrf?: string;
};

function isLocalHost(host: string): boolean {
    return host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
}

function shouldUseSecureCookie(c: Context): boolean {
    const host = c.req.header("host") || "";
    if (process.env.SESSION_COOKIE_SECURE === "false") return false;
    if (process.env.SESSION_COOKIE_SECURE === "true") return true;
    return !isLocalHost(host);
}

function cookieOptions(c: Context, httpOnly: boolean) {
    return {
        httpOnly,
        secure: shouldUseSecureCookie(c),
        sameSite: "Lax" as const,
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
    };
}

export function createSession(c: Context, payload: Omit<SessionPayload, "csrf">): void {
    const csrf = crypto.randomUUID();
    const token = jwt.sign({ ...payload, csrf });

    setCookie(c, SESSION_COOKIE, token, cookieOptions(c, true));
    setCookie(c, CSRF_COOKIE, csrf, cookieOptions(c, false));
}

export function clearSession(c: Context): void {
    const secure = shouldUseSecureCookie(c);
    deleteCookie(c, SESSION_COOKIE, { path: "/", secure });
    deleteCookie(c, CSRF_COOKIE, { path: "/", secure });
}

export function getSessionPayload(c: Context): SessionPayload | null {
    const token = getCookie(c, SESSION_COOKIE);
    if (!token) return null;
    return jwt.verify(token) as SessionPayload | null;
}

export function verifyCsrf(c: Context, payload: SessionPayload): boolean {
    const method = c.req.method.toUpperCase();
    if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;

    const headerToken = c.req.header(CSRF_HEADER);
    const cookieToken = getCookie(c, CSRF_COOKIE);
    return Boolean(payload.csrf && headerToken && cookieToken && headerToken === cookieToken && headerToken === payload.csrf);
}

export function readCookie(cookieHeader: string | null, name: string): string | null {
    if (!cookieHeader) return null;

    for (const part of cookieHeader.split(";")) {
        const [rawKey, ...rawValue] = part.trim().split("=");
        if (rawKey === name) return decodeURIComponent(rawValue.join("="));
    }

    return null;
}

export function getSessionPayloadFromCookieHeader(cookieHeader: string | null): SessionPayload | null {
    const token = readCookie(cookieHeader, SESSION_COOKIE);
    if (!token) return null;
    return jwt.verify(token) as SessionPayload | null;
}
