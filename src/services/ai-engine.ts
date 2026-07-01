import { GoogleGenAI } from "@google/genai";
import { db } from "../db";
import { sellers, products, messages, conversations } from "../db/schema";
import { eq, desc, and } from "drizzle-orm";
import { generateId } from "../utils/helpers";
import logger from "../utils/logger";

type ChatContent = {
    role: "user" | "model";
    parts: { text: string }[];
};

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

/**
 * Build a system prompt for a specific seller, injecting their catalogue.
 */
function buildSystemPrompt(
    seller: { businessName: string; personalPhone: string | null },
    catalogue: { name: string; description: string | null; price: number; inStock: boolean | null }[]
): string {
    const inStockProducts = catalogue.filter((p) => p.inStock !== false);
    const catalogueText =
        inStockProducts.length > 0
            ? inStockProducts
                .map((p) => {
                    const desc = p.description ? ` — ${p.description}` : "";
                    return `• ${p.name}: ₦${(p.price / 100).toLocaleString()}${desc}`;
                })
                .join("\n")
            : "No products currently available.";

    return `You are the friendly AI sales assistant for "${seller.businessName}".
You handle customer inquiries on WhatsApp, help them browse products, take orders, and guide them through payment.

PRODUCT CATALOGUE:
${catalogueText}

YOUR BEHAVIOR:
- Greet customers warmly using the business name on first contact
- Be conversational, friendly, and concise — like a real Nigerian shop attendant
- Support English and Nigerian Pidgin naturally (respond in whatever language the customer uses)
- When a customer asks about products, show them what's available with prices
- When they want to order, confirm: which items, quantities, and the total
- NEVER make up products that are not in the catalogue above
- If a product is not available, say so politely and suggest alternatives
- For complex, unclear, or custom requests, tell the customer you'll connect them with the seller
- Keep messages short — this is WhatsApp, not email

ORDER CONFIRMATION:
When the customer explicitly confirms they want to proceed with an order, you MUST include this exact tag at the END of your message (the system parses this automatically):
[ORDER_CONFIRMED: {"items": [{"name": "Product Name", "qty": 1, "price": 5000}], "total": 5000}]
- "price" is per unit in kobo (₦50 = 5000 kobo)
- "total" is the grand total in kobo
- Only include this tag when the customer has clearly confirmed the order

ESCALATION:
When the customer request is something you can't handle (custom order, complaint, specific question about delivery, etc.), include this tag:
[ESCALATE: "reason for escalation"]

Do NOT include any internal notes, metadata, or system text in your visible message. The tags above are the only exceptions.`;
}

/**
 * Parse order confirmation from AI response
 */
export function parseOrderConfirmation(
    response: string
): { items: { name: string; qty: number; price: number }[]; total: number } | null {
    const match = response.match(/\[ORDER_CONFIRMED:\s*(\{.*\})\]/s);
    const payload = match?.[1];
    if (!payload) return null;
    try {
        return JSON.parse(payload);
    } catch {
        logger.warn({ raw: payload }, "Failed to parse ORDER_CONFIRMED JSON");
        return null;
    }
}

/**
 * Parse escalation from AI response
 */
export function parseEscalation(response: string): string | null {
    const match = response.match(/\[ESCALATE:\s*"(.+?)"\]/s);
    return match?.[1] ?? null;
}

type ConversationState = "idle" | "awaiting_order" | "awaiting_payment" | "completed" | "escalated";

/**
 * Clean AI response by removing system tags before sending to customer
 */
export function cleanResponse(response: string): string {
    return response
        .replace(/\[ORDER_CONFIRMED:\s*\{.*\}\]/s, "")
        .replace(/\[ESCALATE:\s*".*?"\]/s, "")
        .trim();
}

/**
 * Get or create a conversation for a customer-seller pair
 */
export async function getOrCreateConversation(
    customerId: string,
    sellerId: string
): Promise<{ id: string; state: ConversationState }> {
    const existing = await db.query.conversations.findFirst({
        where: and(eq(conversations.customerId, customerId), eq(conversations.sellerId, sellerId)),
        orderBy: [desc(conversations.createdAt)],
    });

    // Reuse existing conversation unless it's completed
    if (existing && existing.state !== "completed") {
        return { id: existing.id, state: existing.state };
    }

    const id = generateId();
    await db.insert(conversations).values({
        id,
        customerId,
        sellerId,
        state: "idle",
    });

    return { id, state: "idle" };
}

/**
 * Load conversation history for context
 */
async function loadHistory(conversationId: string, limit = 20): Promise<ChatContent[]> {
    const rows = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversationId),
        orderBy: [desc(messages.createdAt)],
        limit,
    });

    // Reverse so oldest first
    rows.reverse();

    return rows.map((m) => ({
        role: m.role === "customer" ? "user" : "model",
        parts: [{ text: m.content }],
    }));
}

/**
 * Save a message to the conversation
 */
export async function saveMessage(
    conversationId: string,
    role: "customer" | "assistant" | "system",
    content: string
): Promise<void> {
    await db.insert(messages).values({
        id: generateId(),
        conversationId,
        role,
        content,
    });
}

/**
 * Update conversation state
 */
export async function updateConversationState(
    conversationId: string,
    state: ConversationState,
    orderSummary?: string
): Promise<void> {
    await db
        .update(conversations)
        .set({
            state,
            currentOrderSummary: orderSummary ?? undefined,
            updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversationId));
}

/**
 * Generate an AI response for a customer message
 */
export async function generateAIResponse(
    sellerId: string,
    conversationId: string,
    customerMessage: string
): Promise<string> {
    // Load seller + catalogue
    const seller = await db.query.sellers.findFirst({
        where: eq(sellers.id, sellerId),
    });

    if (!seller) throw new Error(`Seller ${sellerId} not found`);

    const catalogue = await db.query.products.findMany({
        where: eq(products.sellerId, sellerId),
    });

    const systemPrompt = buildSystemPrompt(seller, catalogue);

    // Load conversation history
    const history = await loadHistory(conversationId);
    const contents: ChatContent[] = [
        ...history,
        {
            role: "user",
            parts: [{ text: customerMessage }],
        },
    ];

    const result = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: contents as any,
        config: {
            systemInstruction: systemPrompt,
        },
    });

    const response = result.text || "";

    logger.debug({ sellerId, conversationId, response: response.substring(0, 100) }, "AI response generated");

    return response;
}
