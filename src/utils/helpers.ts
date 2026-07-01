import { nanoid } from "nanoid";

/**
 * Generate a unique ID for database records
 */
export function generateId(): string {
    return nanoid(21);
}

/**
 * Format amount from kobo to Naira display string
 */
export function formatNaira(kobo: number): string {
    return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

/**
 * Extract phone number from WhatsApp ID
 * e.g. "2349012345678@c.us" → "+2349012345678"
 */
export function phoneFromWaId(waId: string): string {
    const match = waId.match(/^(\d+)(?::\d+)?@/);
    return match ? `+${match[1]}` : waId;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
