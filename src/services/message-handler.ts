import { db } from "../db";
import { customers, sellers, orders, conversations } from "../db/schema";
import { eq, and } from "drizzle-orm";
import {
    generateAIResponse,
    parseOrderConfirmation,
    parseEscalation,
    cleanResponse,
    getOrCreateConversation,
    saveMessage,
    updateConversationState,
} from "./ai-engine";
import { initiatePayment } from "./payment-provider";
import { generateId, phoneFromWaId, formatNaira } from "../utils/helpers";
import logger from "../utils/logger";
import type { Client } from "whatsapp-web.js";

interface SessionManager {
    getClient(sellerId: string): Client | null;
}

let sessionManagerRef: SessionManager | null = null;

export function setSessionManager(sm: SessionManager): void {
    sessionManagerRef = sm;
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

        const customerPhone = phoneFromWaId(msg.from);
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
        try {
            const contact = await msg.getContact();
            contactName = contact.pushname || contact.name || undefined;
        } catch {
            // ignore
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

        // Generate AI response
        const aiResponse = await generateAIResponse(sellerId, conversation.id, customerMessage);

        // Parse for order confirmation
        const orderData = parseOrderConfirmation(aiResponse);
        const escalation = parseEscalation(aiResponse);

        // Clean the response (remove system tags) before sending
        const cleanMsg = cleanResponse(aiResponse);

        if (orderData) {
            // ─── Order confirmed flow ────────────────────────────
            await handleOrderConfirmed(sellerId, { ...customer, phone: customerPhone }, conversation, orderData, msg, cleanMsg);
        } else if (escalation) {
            // ─── Escalation flow ─────────────────────────────────
            await handleEscalation(sellerId, customer, escalation, msg, cleanMsg);
        } else {
            // ─── Normal response ─────────────────────────────────
            await msg.reply(cleanMsg);
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
    orderData: { items: { name: string; qty: number; price: number }[]; total: number },
    msg: any,
    cleanMsg: string
): Promise<void> {
    const orderId = generateId();
    const txnRef = `SQ_${Date.now()}_${orderId.substring(0, 8)}`;

    // Create order record
    await db.insert(orders).values({
        id: orderId,
        conversationId: conversation.id,
        sellerId,
        customerId: customer.id,
        items: JSON.stringify(orderData.items),
        totalAmount: orderData.total,
        paymentReference: txnRef,
        status: "pending",
    });

    // Update conversation state
    await updateConversationState(conversation.id, "awaiting_payment", JSON.stringify(orderData));

    try {
        // Generate payment link
        const checkoutUrl = await initiatePayment({
            amount: orderData.total,
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

        // Send AI message + payment link
        const paymentMsg = `${cleanMsg}\n\n💳 *Pay here:* ${checkoutUrl}\n\nClick the link above to complete your payment of ${formatNaira(orderData.total)}.`;
        await msg.reply(paymentMsg);
        await saveMessage(conversation.id, "assistant", paymentMsg);

        logger.info({ orderId, txnRef, total: orderData.total }, "Order created, payment link sent");
    } catch (error: any) {
        logger.error({ err: error.message }, "Failed to generate payment link");
        await msg.reply(
            `${cleanMsg}\n\n⚠️ I had trouble generating the payment link. Let me connect you with the seller to complete this order.`
        );
        await saveMessage(conversation.id, "assistant", cleanMsg);
        await handleEscalation(sellerId, { id: customer.id, name: customer.name }, "Payment link generation failed", msg, "");
    }
}

/**
 * Handle escalation: notify the seller on their personal number
 */
async function handleEscalation(
    sellerId: string,
    customer: { id: string; name: string | null },
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
        const sellerNotifyMsg = `🔔 *Customer needs attention*\n\nCustomer: ${customer.name || "Unknown"}\nReason: ${reason}\n\nPlease check your business WhatsApp.`;

        try {
            const client = sessionManagerRef.getClient(sellerId);
            if (client) {
                const sellerWaId = seller.personalPhone.replace("+", "") + "@c.us";
                await client.sendMessage(sellerWaId, sellerNotifyMsg);
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
    amountPaid: number
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

    // Update order status
    await db
        .update(orders)
        .set({ status: "paid", paidAt: new Date() })
        .where(eq(orders.id, order.id));

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
        const receiptMsg = `✅ *Payment Confirmed!*\n\nThank you for your payment of ${formatNaira(order.totalAmount)}.\n\n*Order Summary:*\n${itemsList}\n\n${seller.businessName} will process your order shortly. 🙏`;
        await client.sendMessage(customerWaId, receiptMsg);

        if (order.conversationId) {
            await saveMessage(order.conversationId, "assistant", receiptMsg);
        }
    } catch (err: any) {
        logger.warn({ err: err.message }, "Failed to send receipt to customer");
    }

    // Notify seller on personal number
    try {
        if (seller.personalPhone) {
            const sellerWaId = seller.personalPhone.replace("+", "") + "@c.us";
            const notifyMsg = `💰 *New Paid Order!*\n\nCustomer: ${customer.name || customer.phone}\nItems:\n${itemsList}\nAmount: ${formatNaira(order.totalAmount)}\nRef: ${transactionRef}`;
            await client.sendMessage(sellerWaId, notifyMsg);
        }
    } catch (err: any) {
        logger.warn({ err: err.message }, "Failed to notify seller of payment");
    }

    logger.info({ orderId: order.id, transactionRef }, "Payment processed successfully");
}
