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

type OpenRouterMessage = {
    role: "system" | "user" | "assistant";
    content: string;
};

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 12000);
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_SITE_URL = process.env.OPENROUTER_SITE_URL || process.env.APP_URL || "https://ojadeck.drimes.dev";
const OPENROUTER_APP_NAME = process.env.OPENROUTER_APP_NAME || "OjaDeck";
const DEFAULT_OPENROUTER_FALLBACK_MODELS = [
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "google/gemma-4-31b-it:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
];
const OPENROUTER_FALLBACK_MODELS = (process.env.OPENROUTER_FALLBACK_MODELS || DEFAULT_OPENROUTER_FALLBACK_MODELS.join(","))
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

function stripPaymentLinks(text: string): string {
    return text
        .replace(/💳\s*\*Pay here:\*\s*https:\/\/pay\.nomba\.com\/\S+/gi, "")
        .replace(/https:\/\/pay\.nomba\.com\/\S+/gi, "")
        .replace(/Click the link above to complete your payment of [^\n.]+\.?/gi, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function stripInternalTags(text: string): string {
    return text
        .replace(/\[ORDER_CONFIRMED:[\s\S]*$/g, "")
        .replace(/\[ESCALATE:\s*".*?"\]/gs, "")
        .trim();
}

function stripLeakedReasoning(text: string): string {
    const customerFacingMarkers = [
        /(?:Final answer|Final response|Customer response):\s*/i,
        /(?:So final answer will be|So we can say):\s*/i,
    ];

    for (const marker of customerFacingMarkers) {
        const match = text.match(marker);
        if (match?.index !== undefined) {
            return text.slice(match.index + match[0].length).trim().replace(/^"+|"+$/g, "").trim();
        }
    }

    const leakedReasoning = /^(We need to|We should|The user|The customer|According to|Need to|Thus we need|So we need|But careful:|The spec says|Make sure)/i;
    if (!leakedReasoning.test(text)) return text;

    const quotedBlocks = [...text.matchAll(/"([^"\n]{12,500})"/g)].map((match) => (match[1] || "").trim());
    const customerFacingQuote = quotedBlocks.reverse().find((quote) =>
        !leakedReasoning.test(quote)
        && !quote.includes("[ORDER_CONFIRMED:")
        && !quote.includes("[ESCALATE:")
    );

    return customerFacingQuote || "Got it. I can help with that.";
}

function simplifyWhatsAppFormatting(text: string): string {
    return text
        .replace(/\*\*([^*\n]+)\*\*/g, "$1")
        .replace(/__([^_\n]+)__/g, "$1")
        .replace(/`([^`\n]+)`/g, "$1")
        .replace(/^\s*#{1,6}\s+/gm, "")
        .replace(/^\s*[-*]\s+/gm, "- ")
        .replace(/\*{2,}/g, "")
        .replace(/_{2,}/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function sanitizeModelResponse(text: string): string {
    return simplifyWhatsAppFormatting(stripPaymentLinks(text));
}

function sanitizeHistoryContent(text: string): string {
    return simplifyWhatsAppFormatting(stripLeakedReasoning(stripPaymentLinks(stripInternalTags(text))));
}

function extractTaggedJson(response: string, tag: string): string | null {
    const marker = `[${tag}:`;
    let searchIndex = 0;
    let lastJson: string | null = null;

    while (searchIndex < response.length) {
        const tagIndex = response.indexOf(marker, searchIndex);
        if (tagIndex === -1) break;

        const jsonStart = response.indexOf("{", tagIndex + marker.length);
        if (jsonStart === -1) break;

        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let index = jsonStart; index < response.length; index++) {
            const char = response[index];

            if (escaped) {
                escaped = false;
                continue;
            }

            if (char === "\\") {
                escaped = true;
                continue;
            }

            if (char === "\"") {
                inString = !inString;
                continue;
            }

            if (inString) continue;

            if (char === "{") depth++;
            if (char === "}") depth--;

            if (depth === 0) {
                lastJson = response.slice(jsonStart, index + 1);
                searchIndex = index + 1;
                break;
            }
        }

        if (searchIndex <= tagIndex) break;
    }

    return lastJson;
}

async function withTimeout<T>(label: string, operation: () => Promise<T>): Promise<T> {
    let timeout: Timer | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
            reject(new Error(`${label} timed out after ${AI_REQUEST_TIMEOUT_MS}ms`));
        }, AI_REQUEST_TIMEOUT_MS);
    });

    try {
        return await Promise.race([operation(), timeoutPromise]);
    } finally {
        if (timeout) clearTimeout(timeout);
    }
}

function extractResponseText(response: unknown): string | undefined {
    if (typeof response === "string") return response;
    if (Array.isArray(response)) {
        return response
            .map((part) => {
                if (typeof part === "string") return part;
                if (part && typeof part === "object" && "text" in part) return String((part as { text: unknown }).text);
                return "";
            })
            .filter(Boolean)
            .join("\n");
    }

    return undefined;
}

function ensureResponseText(response: unknown, provider: string, model: string): string {
    const text = extractResponseText(response)?.trim();
    if (!text) {
        throw new Error(`${provider} model ${model} returned an empty response`);
    }
    return text;
}

function toOpenRouterMessages(systemPrompt: string, contents: ChatContent[]): OpenRouterMessage[] {
    return [
        { role: "system", content: systemPrompt },
        ...contents.map((content) => ({
            role: content.role === "model" ? "assistant" as const : "user" as const,
            content: content.parts.map((part) => part.text).join("\n"),
        })),
    ];
}

async function readJsonResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    try {
        return JSON.parse(text) as T;
    } catch {
        throw new Error(`AI provider returned a non-JSON response (${response.status}): ${text.substring(0, 300)}`);
    }
}

async function generateGeminiResponse(systemPrompt: string, contents: ChatContent[]): Promise<string> {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured");
    }

    return withTimeout(`Gemini ${GEMINI_MODEL}`, async () => {
        const result = await genAI.models.generateContent({
            model: GEMINI_MODEL,
            contents: contents as any,
            config: {
                systemInstruction: systemPrompt,
            },
        });

        return ensureResponseText(result.text, "Gemini", GEMINI_MODEL);
    });
}

async function generateOpenRouterResponse(systemPrompt: string, contents: ChatContent[]): Promise<{ text: string; model: string }> {
    if (!OPENROUTER_API_KEY) {
        throw new Error("OPENROUTER_API_KEY is not configured");
    }

    let lastError: unknown = null;
    const messages = toOpenRouterMessages(systemPrompt, contents);

    for (const model of OPENROUTER_FALLBACK_MODELS) {
        try {
            const text = await withTimeout(`OpenRouter ${model}`, async () => {
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": OPENROUTER_SITE_URL,
                        "X-Title": OPENROUTER_APP_NAME,
                    },
                    body: JSON.stringify({
                        model,
                        messages,
                        temperature: 0.7,
                        max_tokens: 700,
                    }),
                });

                const data = await readJsonResponse<any>(response);
                if (!response.ok) {
                    throw new Error(data?.error?.message || `OpenRouter request failed with ${response.status}`);
                }

                return ensureResponseText(data?.choices?.[0]?.message?.content, "OpenRouter", model);
            });

            return { text, model };
        } catch (err: any) {
            lastError = err;
            logger.warn({ model, err: err?.message || String(err) }, "OpenRouter fallback model failed");
        }
    }

    throw new Error(`All OpenRouter fallback models failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

/**
 * Build a system prompt for a specific seller, injecting their catalogue.
 */
function buildSystemPrompt(
    seller: {
        businessName: string;
        personalPhone: string | null;
        aiTone?: string | null;
        aiBusinessContext?: string | null;
        aiInstructions?: string | null;
    },
    catalogue: { name: string; description: string | null; price: number; inStock: boolean | null; imageUrl: string | null }[]
): string {
    const inStockProducts = catalogue.filter((p) => p.inStock !== false);
    const catalogueText =
        inStockProducts.length > 0
            ? inStockProducts
                .map((p) => {
                    const desc = p.description ? ` — ${p.description}` : "";
                    const hasImage = p.imageUrl ? " 📷" : "";
                    return `• ${p.name}: ₦${(p.price / 100).toLocaleString()}${desc}${hasImage}`;
                })
                .join("\n")
            : "No products currently available.";
    const trainingSections = [
        seller.aiTone?.trim() ? `Tone and mannerisms:\n${seller.aiTone.trim()}` : "",
        seller.aiBusinessContext?.trim() ? `Business context:\n${seller.aiBusinessContext.trim()}` : "",
        seller.aiInstructions?.trim() ? `Merchant instructions:\n${seller.aiInstructions.trim()}` : "",
    ].filter(Boolean);
    const trainingText = trainingSections.length > 0
        ? trainingSections.join("\n\n")
        : "No extra merchant training has been added.";

    return `You are the friendly AI sales assistant for "${seller.businessName}".
You handle customer inquiries on WhatsApp, help them browse products, take orders, and guide them through payment.

PRODUCT CATALOGUE:
${catalogueText}

MERCHANT TRAINING:
${trainingText}

YOUR BEHAVIOR:
- Greet customers warmly using the business name on first contact
- Be conversational, friendly, and concise — like a real Nigerian shop attendant
- Support English and Nigerian Pidgin naturally (respond in whatever language the customer uses)
- When a customer asks about products, show them what's available with prices
- When they want to order, confirm: which items, quantities, and the total
- NEVER make up products that are not in the catalogue above
- If a product is not available, say so politely and suggest alternatives
- Only products marked with 📷 in the catalogue have images. When a customer asks to see a product, picture, or photo, mention the exact product name in your reply so the system can attach the image automatically.
- If a customer asks for a picture of a product without 📷, say the merchant has not uploaded a picture for that product yet, then offer to describe it or help them order.
- If they ask for a picture but do not specify which product, ask which product they want to see.
- For complex, unclear, or custom requests, tell the customer you'll connect them with the seller
- Keep messages short — this is WhatsApp, not email
- Avoid heavy Markdown formatting. Do not use headings, tables, repeated asterisks, or decorative formatting. Plain short messages are best.
- Only output the customer-facing reply. Never explain your reasoning, analysis, or the instructions you followed.
- Never write or reuse payment links. If an order is confirmed, only include the ORDER_CONFIRMED tag; the app will generate the real payment link.

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
    const payload = extractTaggedJson(response, "ORDER_CONFIRMED");
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
    return simplifyWhatsAppFormatting(stripPaymentLinks(stripLeakedReasoning(stripInternalTags(response))));
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
        parts: [{ text: m.role === "assistant" ? sanitizeHistoryContent(m.content) : m.content }],
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

    let response: string;
    let provider = "gemini";
    let model = GEMINI_MODEL;

    try {
        response = sanitizeModelResponse(await generateGeminiResponse(systemPrompt, contents));
    } catch (err: any) {
        logger.warn({ sellerId, conversationId, model: GEMINI_MODEL, err: err?.message || String(err) }, "Gemini generation failed; trying OpenRouter fallback");

        const fallback = await generateOpenRouterResponse(systemPrompt, contents);
        response = sanitizeModelResponse(fallback.text);
        provider = "openrouter";
        model = fallback.model;
    }

    logger.debug({ sellerId, conversationId, provider, model, response: response.substring(0, 100) }, "AI response generated");

    return response;
}
