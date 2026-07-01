// Simple JWT utility using Bun's built-in crypto (no external dependency needed)
// For a hackathon, this is sufficient. In production, use a proper JWT library.

const SECRET = process.env.JWT_SECRET || "hackathon-ojadeck-secret-change-me";

function base64UrlEncode(data: string): string {
    return Buffer.from(data).toString("base64url");
}

function base64UrlDecode(data: string): string {
    return Buffer.from(data, "base64url").toString("utf-8");
}

async function createHmac(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
    return Buffer.from(signature).toString("base64url");
}

const jwt = {
    sign(payload: Record<string, any>, expiresInHours = 72): string {
        const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
        const now = Math.floor(Date.now() / 1000);
        const body = base64UrlEncode(
            JSON.stringify({
                ...payload,
                iat: now,
                exp: now + expiresInHours * 3600,
            })
        );

        // Synchronous HMAC using Bun's crypto
        const hmac = new Bun.CryptoHasher("sha256", SECRET);
        hmac.update(`${header}.${body}`);
        const sig = hmac.digest("base64url") as string;

        return `${header}.${body}.${sig}`;
    },

    verify(token: string): Record<string, any> | null {
        try {
            const [header, body, sig] = token.split(".");
            if (!header || !body || !sig) return null;

            // Verify signature
            const hmac = new Bun.CryptoHasher("sha256", SECRET);
            hmac.update(`${header}.${body}`);
            const expectedSig = hmac.digest("base64url") as string;

            if (sig !== expectedSig) return null;

            const payload = JSON.parse(base64UrlDecode(body));

            // Check expiration
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                return null;
            }

            return payload;
        } catch {
            return null;
        }
    },
};

export default jwt;
