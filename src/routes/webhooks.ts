import { Hono } from "hono";
import { handlePaymentSuccess } from "../services/message-handler";
import logger from "../utils/logger";
import crypto from "node:crypto";

const webhooksRouter = new Hono();
const NOMBA_WEBHOOK_SECRET = process.env.NOMBA_WEBHOOK_SECRET || "";

function safeString(value: unknown): string {
    if (value === null || value === undefined) return "";
    return String(value);
}

function generateNombaSignature(body: any, timestamp: string): string {
    const merchant = body?.data?.merchant || {};
    const transaction = body?.data?.transaction || {};
    let responseCode = safeString(transaction.responseCode);
    if (responseCode === "null") responseCode = "";

    const hashingPayload = [
        safeString(body?.event_type),
        safeString(body?.requestId),
        safeString(merchant.userId),
        safeString(merchant.walletId),
        safeString(transaction.transactionId),
        safeString(transaction.type),
        safeString(transaction.time),
        responseCode,
        timestamp,
    ].join(":");

    return crypto.createHmac("sha256", NOMBA_WEBHOOK_SECRET).update(hashingPayload).digest("base64");
}

function signaturesMatch(expected: string, actual: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);
    return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function verifyNombaWebhook(body: any, signature: string | undefined, timestamp: string | undefined): boolean {
    if (!NOMBA_WEBHOOK_SECRET) {
        logger.warn("NOMBA_WEBHOOK_SECRET is not configured; rejecting webhook");
        return false;
    }

    if (!signature || !timestamp) return false;

    const expected = generateNombaSignature(body, timestamp);
    return signaturesMatch(expected.toLowerCase(), signature.toLowerCase());
}

// Payment webhook — receives payment notifications
webhooksRouter.post("/payments", async (c) => {
    try {
        const body = await c.req.json();
        const signature = c.req.header("nomba-signature");
        const timestamp = c.req.header("nomba-timestamp");

        if (!verifyNombaWebhook(body, signature, timestamp)) {
            logger.warn({ event: body?.event_type, requestId: body?.requestId }, "Rejected invalid Nomba webhook signature");
            return c.json({ received: false, error: "invalid_signature" }, 401);
        }

        logger.info(
            { event: body.event_type, requestId: body.requestId },
            "Nomba webhook received"
        );

        if (body.event_type === "payment_success") {
            const txnRef = body.data?.order?.orderReference;
            const amount = body.data?.order?.amount ?? body.data?.transaction?.transactionAmount;
            const currency = body.data?.order?.currency;
            const transactionId = body.data?.transaction?.transactionId;

            if (!txnRef || amount === undefined) {
                logger.warn({ requestId: body.requestId, transactionId }, "Payment webhook missing order reference or amount");
                return c.json({ received: true, ignored: "missing_order_reference" });
            }

            await handlePaymentSuccess(txnRef, Number(amount), { transactionId, currency });

            logger.info({ txnRef, amount, transactionId }, "Payment success processed");
        }

        return c.json({ received: true });
    } catch (err: any) {
        logger.error({ err: err.message }, "Webhook processing error");
        // Still return 200 to prevent repeated delivery during provider retries.
        return c.json({ received: true, error: "processing_error" });
    }
});

export default webhooksRouter;
