import { db } from "../db";
import { customers, sellers, orders, conversations, products } from "../db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import {
    generateAIResponse,
    parseOrderConfirmation,
    parseEscalation,
    cleanResponse,
    getOrCreateConversation,
    saveMessage,
    updateConversationState,
} from "./ai-engine";
import { getNombaAmountUnit, initiatePayment, verifyTransaction } from "./payment-provider";
import { creditOrderPayment } from "./wallet";
import { generateId, phoneFromWaId, formatNaira } from "../utils/helpers";
import logger from "../utils/logger";
import { resolve, sep } from "node:path";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer";
import { MessageMedia } from "whatsapp-web.js";
import type { Client } from "whatsapp-web.js";

interface SessionManager {
    getClient(sellerId: string): Client | null;
}

type OrderItem = { name: string; qty: number; price: number };
type OrderData = { items: OrderItem[]; total: number };
type ProductMedia = { name: string; imageUrl: string };
type CatalogueProduct = {
    id: string;
    name: string;
    price: number;
    imageUrl: string | null;
};

type OrderValidationResult =
    | { ok: true; orderData: OrderData; corrected: boolean; mediaProducts: ProductMedia[] }
    | { ok: false; message: string };

const REQUIRE_NOMBA_TRANSACTION_VERIFICATION = process.env.NOMBA_REQUIRE_TRANSACTION_VERIFICATION === "true";

let sessionManagerRef: SessionManager | null = null;

export function setSessionManager(sm: SessionManager): void {
    sessionManagerRef = sm;
}

function getVerificationStatus(verification: any): string | null {
    if (verification?.data?.success === true) {
        return "success";
    }

    const candidates = [
        verification?.data?.status,
        verification?.data?.transactionStatus,
        verification?.data?.paymentStatus,
        verification?.data?.message,
        verification?.data?.transactionDetails?.statusCode,
        verification?.data?.transaction?.status,
        verification?.data?.transaction?.transactionStatus,
        verification?.data?.transaction?.paymentStatus,
        verification?.status,
        verification?.transactionStatus,
    ];

    const status = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
    return status ? status.trim() : null;
}

function isSuccessfulVerificationStatus(status: string): boolean {
    return ["success", "successful", "paid", "completed", "approved", "payment successful"].includes(status.toLowerCase());
}

function normalizeProductName(name: string): string {
    return name
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b(\w{4,})s\b/g, "$1");
}

function findBestCatalogueProduct<T extends CatalogueProduct>(
    catalogue: T[],
    requestedName: string
): { product: T; ambiguous: false } | { product: null; ambiguous: true; matches: T[] } | null {
    const requested = normalizeProductName(requestedName);
    if (!requested) return null;

    const normalized = catalogue
        .map((product) => ({ product, name: normalizeProductName(product.name) }))
        .filter((entry) => entry.name.length > 0);

    const exact = normalized.find((entry) => entry.name === requested);
    if (exact) return { product: exact.product, ambiguous: false };

    const candidates = normalized
        .filter((entry) => requested.includes(entry.name) || entry.name.includes(requested))
        .sort((a, b) => b.name.length - a.name.length);

    if (candidates.length === 0) return null;

    const fullNameMentions = candidates.filter((entry) => requested.includes(entry.name));
    const bestFullNameMention = fullNameMentions[0];
    if (bestFullNameMention) {
        return { product: bestFullNameMention.product, ambiguous: false };
    }

    if (candidates.length > 1) {
        return { product: null, ambiguous: true, matches: candidates.map((entry) => entry.product) };
    }

    const bestCandidate = candidates[0];
    return bestCandidate ? { product: bestCandidate.product, ambiguous: false } : null;
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseQuantityToken(value: string): number | null {
    const normalized = value.toLowerCase();
    const wordNumbers: Record<string, number> = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
    };

    if (/^\d{1,2}$/.test(normalized)) return Number(normalized);
    return wordNumbers[normalized] ?? null;
}

function extractExplicitQuantityForProduct(customerMessage: string, productName: string): number | null {
    const message = normalizeProductName(customerMessage);
    const product = normalizeProductName(productName);
    if (!message || !product) return null;

    const qty = "(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)";
    const productPattern = escapeRegex(product);
    const patterns = [
        new RegExp(`\\b${qty}\\s+(?:pieces?\\s+of\\s+)?${productPattern}\\b`),
        new RegExp(`\\b${productPattern}\\s+(?:x\\s*)?${qty}\\b`),
    ];

    for (const pattern of patterns) {
        const match = message.match(pattern);
        const token = match?.[1];
        if (!token) continue;

        const parsed = parseQuantityToken(token);
        if (parsed && parsed >= 1 && parsed <= 99) return parsed;
    }

    return null;
}

function extractReferencedQuantity(customerMessage: string): number | null {
    const message = normalizeProductName(customerMessage);
    if (!message) return null;

    const qty = "(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)";
    const patterns = [
        new RegExp(`\\b(?:i\\s*(?:would|d|will)?\\s*)?(?:need|want|take|get|buy|order)\\s+${qty}\\b`),
        new RegExp(`\\b${qty}\\s+(?:of\\s+)?(?:those|that|it|them|this|one|ones)\\b`),
        new RegExp(`\\b(?:make\\s+it|just)\\s+${qty}\\b`),
    ];

    for (const pattern of patterns) {
        const match = message.match(pattern);
        const token = match?.[1];
        if (!token) continue;

        const parsed = parseQuantityToken(token);
        if (parsed && parsed >= 1 && parsed <= 99) return parsed;
    }

    return null;
}

function isResetOrderIntent(message: string): boolean {
    return /\b(cancel|start over|start again|fresh order|new order|reset|discard|forget it|change order|different order)\b/i.test(message);
}

function isResendPaymentIntent(message: string): boolean {
    return /\b(resend|send again|share again|link again|payment link|pay link)\b/i.test(message);
}

function isPaymentProgressIntent(message: string): boolean {
    return /\b(i paid|paid|done|completed|payment done|sent payment|made payment|successful)\b/i.test(message);
}

function isLikelyFreshOrderIntent(message: string): boolean {
    if (isPaymentProgressIntent(message) || isResendPaymentIntent(message)) return false;
    return isResetOrderIntent(message) || /\b(order|buy|get|want|need|take|another|instead|different|switch)\b/i.test(message);
}

function formatOrderItems(items: OrderItem[]): string {
    return items
        .map((item) => `• ${item.name} x${item.qty} — ${formatNaira(item.price * item.qty)}`)
        .join("\n");
}

function buildOrderConfirmationMessage(orderData: OrderData): string {
    return `Got it. I've confirmed your order:\n\n${formatOrderItems(orderData.items)}\n\nTotal: ${formatNaira(orderData.total)}`;
}

function resolveChromePath(): string | undefined {
    const configured = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
    if (configured) return configured;

    return [
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
    ].find((path) => existsSync(path));
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getLocalUploadPath(imageUrl: string): string | null {
    if (!imageUrl.startsWith("/uploads/")) return null;

    const uploadsDir = resolve(process.cwd(), "uploads");
    const imagePath = resolve(process.cwd(), imageUrl.slice(1));
    if (imagePath !== uploadsDir && !imagePath.startsWith(`${uploadsDir}${sep}`)) {
        logger.warn({ imageUrl }, "Rejected product image path outside uploads directory");
        return null;
    }

    return imagePath;
}

async function replyWithProductImage(
    msg: any,
    product: ProductMedia | null,
    caption?: string
): Promise<boolean> {
    if (!product?.imageUrl) return false;

    const imagePath = getLocalUploadPath(product.imageUrl);
    if (!imagePath) return false;

    try {
        const media = MessageMedia.fromFilePath(imagePath);
        await msg.reply(media, undefined, caption ? { caption } : undefined);
        return true;
    } catch (err: any) {
        logger.warn({ product: product.name, imageUrl: product.imageUrl, err: err.message }, "Failed to send product image");
        return false;
    }
}

async function buildReceiptImage(params: {
    businessName: string;
    customerName: string;
    amount: number;
    items: OrderItem[];
    transactionRef: string;
}): Promise<Buffer> {
    const rows = params.items
        .map((item) => `
            <div class="row">
                <div>
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>Qty ${item.qty}</span>
                </div>
                <b>${formatNaira(item.price * item.qty)}</b>
            </div>
        `)
        .join("");
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; width: 900px; min-height: 1100px; background: #f7f3ea; font-family: Inter, Arial, sans-serif; color: #18231d; }
    .receipt { width: 760px; margin: 70px auto; border: 1px solid #e7dfcf; border-radius: 42px; background: #fffdf8; padding: 54px; box-shadow: 0 28px 80px rgba(21, 35, 29, 0.14); }
    .kicker { color: #7b6b48; font-size: 22px; font-weight: 800; letter-spacing: 0.24em; text-transform: uppercase; }
    h1 { margin: 18px 0 12px; font-size: 60px; line-height: 1; letter-spacing: -0.06em; }
    .sub { color: #627168; font-size: 25px; line-height: 1.55; margin: 0 0 42px; }
    .amount { border-radius: 30px; background: #153d32; color: white; padding: 34px; margin-bottom: 34px; }
    .amount span { display: block; color: #cfe2d7; font-size: 21px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; }
    .amount b { display: block; margin-top: 10px; font-size: 70px; line-height: 1; letter-spacing: -0.06em; }
    .row { display: flex; align-items: flex-start; justify-content: space-between; gap: 28px; padding: 24px 0; border-bottom: 1px solid #eee5d4; }
    .row strong { display: block; font-size: 28px; line-height: 1.2; }
    .row span { display: block; color: #627168; font-size: 21px; margin-top: 8px; }
    .row b { font-size: 25px; white-space: nowrap; }
    .footer { margin-top: 38px; border-radius: 24px; background: #f7f3ea; padding: 24px; color: #294136; font-size: 20px; line-height: 1.55; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <section class="receipt">
    <div class="kicker">${escapeHtml(params.businessName)}</div>
    <h1>Payment confirmed</h1>
    <p class="sub">Thanks${params.customerName ? `, ${escapeHtml(params.customerName)}` : ""}. We received your payment and will get back to you shortly.</p>
    <div class="amount"><span>Amount paid</span><b>${formatNaira(params.amount)}</b></div>
    ${rows}
    <div class="footer"><strong>Reference:</strong><br />${escapeHtml(params.transactionRef)}</div>
  </section>
</body>
</html>`;

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: resolveChromePath(),
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 900, height: 1100, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: "networkidle0" });
        return Buffer.from(await page.screenshot({ type: "png" }));
    } finally {
        await browser.close();
    }
}

async function findMentionedProductWithImage(sellerId: string, message: string): Promise<ProductMedia | null> {
    const requested = normalizeProductName(message);
    if (!requested) return null;

    const catalogue = await db.query.products.findMany({
        where: and(eq(products.sellerId, sellerId), eq(products.inStock, true)),
    });

    const match = findBestCatalogueProduct(catalogue, requested);
    if (!match || match.ambiguous || !match.product.imageUrl) return null;
    return { name: match.product.name, imageUrl: match.product.imageUrl };
}

async function getLatestPendingOrder(conversationId: string) {
    return db.query.orders.findFirst({
        where: and(eq(orders.conversationId, conversationId), eq(orders.status, "pending")),
        orderBy: [desc(orders.createdAt)],
    });
}

async function cancelPendingOrders(conversationId: string, exceptOrderId?: string): Promise<void> {
    const filters = [
        eq(orders.conversationId, conversationId),
        eq(orders.status, "pending"),
    ];
    if (exceptOrderId) filters.push(ne(orders.id, exceptOrderId));

    await db
        .update(orders)
        .set({ status: "cancelled" })
        .where(and(...filters));
}

async function handlePendingPaymentMessage(
    conversation: { id: string; state: string },
    customerMessage: string,
    msg: any
): Promise<"handled" | "continue"> {
    if (conversation.state !== "awaiting_payment") return "continue";

    const pendingOrder = await getLatestPendingOrder(conversation.id);

    if (isResendPaymentIntent(customerMessage) && pendingOrder?.checkoutUrl) {
        const reply = `Here is your payment link again:\n\n${pendingOrder.checkoutUrl}\n\nAmount: ${formatNaira(pendingOrder.totalAmount)}`;
        await msg.reply(reply);
        await saveMessage(conversation.id, "assistant", reply);
        return "handled";
    }

    if (!isLikelyFreshOrderIntent(customerMessage)) return "continue";

    if (isResetOrderIntent(customerMessage) && !/\b(order|buy|get|want|need|take)\b/i.test(customerMessage)) {
        await cancelPendingOrders(conversation.id);
        await updateConversationState(conversation.id, "awaiting_order");
        const reply = "No problem, I've cancelled the pending payment link. What would you like to order now?";
        await msg.reply(reply);
        await saveMessage(conversation.id, "assistant", reply);
        return "handled";
    }

    logger.info({ conversationId: conversation.id }, "Customer may be replacing a pending order; keeping existing payment link until replacement validates");
    return "continue";
}

async function validateOrderAgainstCatalogue(
    sellerId: string,
    orderData: OrderData,
    customerMessage: string
): Promise<OrderValidationResult> {
    const catalogue = await db.query.products.findMany({
        where: and(eq(products.sellerId, sellerId), eq(products.inStock, true)),
    });

    if (catalogue.length === 0) {
        return {
            ok: false,
            message: "I can't create a checkout yet because there are no in-stock products in the catalogue.",
        };
    }

    const canonicalItems: OrderItem[] = [];
    const mediaProducts: ProductMedia[] = [];
    let corrected = false;

    for (const item of orderData.items) {
        const requestedName = normalizeProductName(String(item.name || ""));

        if (!requestedName) {
            return {
                ok: false,
                message: "I couldn't confirm that item. Please tell me the item and quantity again.",
            };
        }

        const match = findBestCatalogueProduct(catalogue, requestedName);
        if (match?.ambiguous) {
            const options = match.matches
                .slice(0, 5)
                .map((product) => `• ${product.name} — ${formatNaira(product.price)}`)
                .join("\n");
            return {
                ok: false,
                message: `I found a few similar items:\n\n${options}\n\nWhich exact one should I get for you?`,
            };
        }

        const matchedProduct = match?.product ?? null;

        if (!matchedProduct) {
            const available = catalogue.map((product) => `• ${product.name} — ${formatNaira(product.price)}`).join("\n");
            return {
                ok: false,
                message: `I can only create payment links for items in the catalogue right now.\n\nAvailable items:\n${available}\n\nWhich one should I get for you?`,
            };
        }

        const aiQty = Math.trunc(Number(item.qty));
        const explicitQty = extractExplicitQuantityForProduct(customerMessage, matchedProduct.name)
            ?? (orderData.items.length === 1 ? extractReferencedQuantity(customerMessage) : null);
        const qty = explicitQty ?? aiQty;

        if (!Number.isFinite(qty) || qty < 1 || qty > 99) {
            return {
                ok: false,
                message: "I couldn't confirm that quantity. Please tell me the item and quantity again.",
            };
        }

        if (matchedProduct.name !== item.name || matchedProduct.price !== item.price || qty !== item.qty) {
            corrected = true;
        }

        canonicalItems.push({
            name: matchedProduct.name,
            qty,
            price: matchedProduct.price,
        });

        if (matchedProduct.imageUrl && !mediaProducts.some((product) => product.imageUrl === matchedProduct.imageUrl)) {
            mediaProducts.push({ name: matchedProduct.name, imageUrl: matchedProduct.imageUrl });
        }
    }

    const total = canonicalItems.reduce((sum, item) => sum + item.price * item.qty, 0);
    if (total !== orderData.total) corrected = true;

    return { ok: true, orderData: { items: canonicalItems, total }, corrected, mediaProducts };
}

/**
 * Find or create a customer record for this phone + seller
 */
async function getOrCreateCustomer(
    phone: string,
    sellerId: string,
    contactName?: string
): Promise<{ id: string; name: string | null }> {
    const existing = await db.query.customers.findFirst({
        where: and(eq(customers.phone, phone), eq(customers.sellerId, sellerId)),
    });

    if (existing) return { id: existing.id, name: existing.name };

    const id = generateId();
    await db.insert(customers).values({
        id,
        sellerId,
        phone,
        name: contactName || null,
    });

    return { id, name: contactName || null };
}

/**
 * Handle an incoming WhatsApp message for a specific seller
 */
export async function handleIncomingMessage(
    sellerId: string,
    msg: any // whatsapp-web.js Message object
): Promise<void> {
    try {
        // Ignore group messages — only handle DMs
        if (msg.from.endsWith("@g.us")) return;

        // Ignore messages older than 60 seconds (prevents replay on restart)
        const messageAge = Date.now() / 1000 - msg.timestamp;
        if (messageAge > 60) return;

        // Ignore status broadcasts
        if (msg.from === "status@broadcast") return;

        let contact: any | null = null;
        try {
            contact = await msg.getContact();
        } catch {
            // ignore
        }

        const customerPhone = contact?.number
            ? `+${String(contact.number).replace(/\D/g, "")}`
            : phoneFromWaId(msg.from);
        const customerMessage = msg.body;

        if (!customerMessage || customerMessage.trim() === "") return;

        logger.info(
            { sellerId, from: customerPhone, preview: customerMessage.substring(0, 50) },
            "Incoming message"
        );

        const seller = await db.query.sellers.findFirst({
            where: eq(sellers.id, sellerId),
        });

        if (!seller) {
            throw new Error(`Seller ${sellerId} not found`);
        }

        // Get or create customer
        let contactName: string | undefined;
        if (contact) {
            contactName = contact.pushname || contact.name || undefined;
        }
        const customer = await getOrCreateCustomer(customerPhone, sellerId, contactName);

        // Get or create conversation
        const conversation = await getOrCreateConversation(customer.id, sellerId);

        // Save customer message
        await saveMessage(conversation.id, "customer", customerMessage);

        if (seller.autoReplyEnabled === false) {
            logger.info({ sellerId, from: customerPhone }, "Auto-replies paused, incoming message stored without response");
            return;
        }

        const pendingPaymentResult = await handlePendingPaymentMessage(conversation, customerMessage, msg);
        if (pendingPaymentResult === "handled") return;

        // Generate AI response
        const aiResponse = await generateAIResponse(sellerId, conversation.id, customerMessage);

        // Parse for order confirmation
        const orderData = parseOrderConfirmation(aiResponse);
        const escalation = parseEscalation(aiResponse);

        // Clean the response (remove system tags) before sending
        const cleanMsg = cleanResponse(aiResponse);

        if (orderData) {
            // ─── Order confirmed flow ────────────────────────────
            await handleOrderConfirmed(sellerId, { ...customer, phone: customerPhone }, conversation, orderData, customerMessage, msg, cleanMsg);
        } else if (escalation) {
            // ─── Escalation flow ─────────────────────────────────
            await handleEscalation(sellerId, { ...customer, phone: customerPhone }, escalation, msg, cleanMsg);
        } else {
            // ─── Normal response ─────────────────────────────────
            const mentionedProduct = await findMentionedProductWithImage(sellerId, customerMessage)
                || await findMentionedProductWithImage(sellerId, cleanMsg);
            const sentImage = await replyWithProductImage(msg, mentionedProduct, cleanMsg);
            if (!sentImage) {
                await msg.reply(cleanMsg);
            }
            await saveMessage(conversation.id, "assistant", cleanMsg);

            // Update state based on conversation context
            if (conversation.state === "idle" && customerMessage.toLowerCase().match(/order|buy|want|get/)) {
                await updateConversationState(conversation.id, "awaiting_order");
            }
        }
    } catch (error: any) {
        logger.error({ sellerId, err: error.message, stack: error.stack }, "Error handling incoming message");
        try {
            await msg.reply("Sorry, something went wrong. Please try again in a moment.");
        } catch {
            // Can't even reply — just log
        }
    }
}

/**
 * Handle order confirmation: create order, generate payment link
 */
async function handleOrderConfirmed(
    sellerId: string,
    customer: { id: string; name: string | null; phone: string },
    conversation: { id: string; state: string },
    orderData: OrderData,
    customerMessage: string,
    msg: any,
    cleanMsg: string
): Promise<void> {
    const validation = await validateOrderAgainstCatalogue(sellerId, orderData, customerMessage);
    if (!validation.ok) {
        await updateConversationState(conversation.id, "awaiting_order");
        await msg.reply(validation.message);
        await saveMessage(conversation.id, "assistant", validation.message);
        logger.warn({ sellerId, orderData }, "AI order confirmation rejected by catalogue validation");
        return;
    }

    const validatedOrder = validation.orderData;
    const confirmationMsg = buildOrderConfirmationMessage(validatedOrder);
    const orderId = generateId();
    const referenceSuffix = orderId.replace(/[^a-zA-Z0-9-]/g, "").substring(0, 8);
    const txnRef = `OJ-${Date.now()}-${referenceSuffix}`;

    // Create order record
    await db.insert(orders).values({
        id: orderId,
        conversationId: conversation.id,
        sellerId,
        customerId: customer.id,
        items: JSON.stringify(validatedOrder.items),
        totalAmount: validatedOrder.total,
        paymentReference: txnRef,
        status: "pending",
    });

    // Update conversation state
    await updateConversationState(conversation.id, "awaiting_payment", JSON.stringify(validatedOrder));

    try {
        // Generate payment link
        const checkoutUrl = await initiatePayment({
            amount: validatedOrder.total,
            email: `wa.${customer.phone.replace("+", "")}@customer.com`, // Payment providers usually require a valid email format
            transactionRef: txnRef,
            customerName: customer.name || "Customer",
            metadata: { orderId, sellerId, customerId: customer.id },
        });

        // Update order with checkout URL
        await db
            .update(orders)
            .set({ checkoutUrl })
            .where(eq(orders.id, orderId));

        await cancelPendingOrders(conversation.id, orderId);

        // Send AI message + payment link
        const primaryProductImage = validation.mediaProducts[0] || null;
        await replyWithProductImage(msg, primaryProductImage, primaryProductImage ? `${primaryProductImage.name}` : undefined);

        const paymentMsg = `${confirmationMsg}\n\nPay here: ${checkoutUrl}\n\nClick the link above to complete your payment of ${formatNaira(validatedOrder.total)}.`;
        await msg.reply(paymentMsg);
        await saveMessage(conversation.id, "assistant", paymentMsg);

        logger.info({ orderId, txnRef, total: validatedOrder.total, corrected: validation.corrected }, "Order created, payment link sent");
    } catch (error: any) {
        logger.error({ err: error.message }, "Failed to generate payment link");
        await db
            .update(orders)
            .set({ status: "failed" })
            .where(eq(orders.id, orderId));
        await msg.reply(
            `${cleanMsg || confirmationMsg}\n\nI had trouble generating the payment link. Let me connect you with the seller to complete this order.`
        );
        await saveMessage(conversation.id, "assistant", cleanMsg || confirmationMsg);
        await handleEscalation(sellerId, customer, "Payment link generation failed", msg, "");
    }
}

/**
 * Handle escalation: notify the seller on their personal number
 */
async function handleEscalation(
    sellerId: string,
    customer: { id: string; name: string | null; phone?: string },
    reason: string,
    msg: any,
    cleanMsg: string
): Promise<void> {
    if (cleanMsg) {
        await msg.reply(cleanMsg);
    }

    // Notify seller
    const seller = await db.query.sellers.findFirst({
        where: eq(sellers.id, sellerId),
    });

    if (seller?.personalPhone && sessionManagerRef) {
        const customerLine = customer.name || customer.phone || "Unknown";
        const sellerNotifyMsg = `🔔 *Customer needs attention*\n\nCustomer: ${customerLine}\nReason: ${reason}\n\nPlease check your business WhatsApp.`;

        try {
            const client = sessionManagerRef.getClient(sellerId);
            if (client) {
                const sellerWaId = seller.personalPhone.replace("+", "") + "@c.us";
                await client.sendMessage(sellerWaId, sellerNotifyMsg);
                try {
                    const contact = await msg.getContact();
                    await client.sendMessage(sellerWaId, contact);
                } catch (err: any) {
                    logger.warn({ err: err.message }, "Failed to send customer contact card for escalation");
                }
                logger.info({ sellerId, personalPhone: seller.personalPhone }, "Seller notified of escalation");
            }
        } catch (err: any) {
            logger.warn({ err: err.message }, "Failed to notify seller via WhatsApp");
        }
    }
}

/**
 * Handle successful payment webhook — send receipt to customer, notify seller
 */
export async function handlePaymentSuccess(
    transactionRef: string,
    amountPaid: number,
    options: { transactionId?: string | null; currency?: string | null } = {}
): Promise<void> {
    // Find the order
    const order = await db.query.orders.findFirst({
        where: eq(orders.paymentReference, transactionRef),
    });

    if (!order) {
        logger.warn({ transactionRef }, "Payment webhook received for unknown order");
        return;
    }

    if (order.status === "paid") {
        logger.info({ transactionRef }, "Duplicate payment webhook ignored");
        return;
    }

    const paidAmountKobo = getNombaAmountUnit() === "kobo"
        ? Math.round(Number(amountPaid))
        : Math.round(Number(amountPaid) * 100);

    if (paidAmountKobo !== order.totalAmount) {
        logger.warn({ transactionRef, paidAmountKobo, expectedAmountKobo: order.totalAmount }, "Payment amount mismatch");
        return;
    }

    if (options.currency && options.currency !== "NGN") {
        logger.warn({ transactionRef, currency: options.currency }, "Payment currency mismatch");
        return;
    }

    let verificationChecked = false;
    try {
        const verification = await verifyTransaction({
            transactionId: options.transactionId,
            orderReference: transactionRef,
        });
        const verificationStatus = getVerificationStatus(verification);

        if (!verificationStatus || !isSuccessfulVerificationStatus(verificationStatus)) {
            logger.warn({ transactionRef, transactionId: options.transactionId, verificationStatus }, "Nomba transaction verification did not return a success status");
            if (verificationStatus || REQUIRE_NOMBA_TRANSACTION_VERIFICATION) return;
        } else {
            verificationChecked = true;
            logger.info({ transactionRef, transactionId: options.transactionId, verificationStatus }, "Nomba transaction verification checked");
        }
    } catch (err: any) {
        logger.warn({ transactionRef, err: err.message }, "Nomba transaction verification failed");
        if (REQUIRE_NOMBA_TRANSACTION_VERIFICATION) return;
    }

    if (!verificationChecked && !REQUIRE_NOMBA_TRANSACTION_VERIFICATION) {
        logger.warn({ transactionRef }, "Continuing with signed webhook confirmation because mandatory transaction verification is disabled");
    }

    // Update order status
    await db
        .update(orders)
        .set({ status: "paid", paidAt: new Date() })
        .where(eq(orders.id, order.id));

    await creditOrderPayment({
        sellerId: order.sellerId,
        orderId: order.id,
        transactionRef,
        amount: order.totalAmount,
    });

    // Update conversation state
    if (order.conversationId) {
        await updateConversationState(order.conversationId, "completed");
    }

    // Get customer and seller info
    const customer = await db.query.customers.findFirst({
        where: eq(customers.id, order.customerId),
    });
    const seller = await db.query.sellers.findFirst({
        where: eq(sellers.id, order.sellerId),
    });

    if (!customer || !seller || !sessionManagerRef) return;

    const client = sessionManagerRef.getClient(order.sellerId);
    if (!client) return;

    const orderItems = JSON.parse(order.items) as { name: string; qty: number; price: number }[];
    const itemsList = orderItems.map((i) => `• ${i.name} x${i.qty}`).join("\n");

    // Send receipt to customer
    try {
        const customerWaId = customer.phone.replace("+", "") + "@c.us";
        const receiptMsg = `Payment confirmed.\n\nWe received your payment of ${formatNaira(order.totalAmount)}.\n\nOrder summary:\n${itemsList}\n\nWe'll get back to you shortly.`;
        try {
            const receiptImage = await buildReceiptImage({
                businessName: seller.businessName,
                customerName: customer.name || "",
                amount: order.totalAmount,
                items: orderItems,
                transactionRef,
            });
            const media = new MessageMedia("image/png", receiptImage.toString("base64"), `receipt-${transactionRef}.png`);
            await client.sendMessage(customerWaId, media, { caption: receiptMsg });
        } catch (err: any) {
            logger.warn({ orderId: order.id, err: err.message }, "Failed to generate or send receipt image; sending text receipt");
            await client.sendMessage(customerWaId, receiptMsg);
        }

        if (order.conversationId) {
            await saveMessage(order.conversationId, "assistant", receiptMsg);
        }
        logger.info({ orderId: order.id, customerId: customer.id }, "Payment receipt sent to customer");
    } catch (err: any) {
        logger.warn({ err: err.message }, "Failed to send receipt to customer");
    }

    // Notify seller on personal number
    try {
        if (seller.personalPhone) {
            const sellerWaId = seller.personalPhone.replace("+", "") + "@c.us";
            const notifyMsg = `New paid order.\n\nCustomer: ${customer.name || customer.phone}\nItems:\n${itemsList}\nAmount: ${formatNaira(order.totalAmount)}\nRef: ${transactionRef}`;
            await client.sendMessage(sellerWaId, notifyMsg);
            logger.info({ orderId: order.id, sellerId: seller.id }, "Paid order notification sent to seller");
        }
    } catch (err: any) {
        logger.warn({ err: err.message }, "Failed to notify seller of payment");
    }

    logger.info({ orderId: order.id, transactionRef }, "Payment processed successfully");
}
