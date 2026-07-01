import { Hono } from "hono";
import { handlePaymentSuccess } from "../services/message-handler";
import logger from "../utils/logger";

const webhooksRouter = new Hono();

// Payment webhook — receives payment notifications
webhooksRouter.post("/payments", async (c) => {
    try {
        const body = await c.req.json();

        logger.info(
            { event: body.Event, ref: body.TransactionRef },
            "Payment webhook received"
        );

        if (body.Event === "charge_successful" && body.Body?.transaction_status === "Success") {
            const txnRef = body.Body.transaction_ref || body.TransactionRef;
            const amount = body.Body.amount;

            await handlePaymentSuccess(txnRef, amount);

            logger.info({ txnRef, amount }, "Payment success processed");
        }

        return c.json({ received: true });
    } catch (err: any) {
        logger.error({ err: err.message }, "Webhook processing error");
        // Still return 200 to prevent repeated delivery during provider retries.
        return c.json({ received: true, error: "processing_error" });
    }
});

export default webhooksRouter;
