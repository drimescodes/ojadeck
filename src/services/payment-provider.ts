import logger from "../utils/logger";

const PAYMENT_PROVIDER_SECRET_KEY = process.env.PAYMENT_PROVIDER_SECRET_KEY || "";
const PAYMENT_PROVIDER_BASE_URL = process.env.PAYMENT_PROVIDER_BASE_URL || "";

interface InitiatePaymentParams {
    amount: number; // in kobo
    email: string;
    transactionRef: string;
    customerName?: string;
    callbackUrl?: string;
    metadata?: Record<string, any>;
}

interface PaymentProviderResponse {
    status: number;
    message: string;
    data: {
        checkout_url: string;
        transaction_ref: string;
        transaction_amount: number;
    };
}

/**
 * Initiate a payment transaction via the configured payment provider.
 * Returns the checkout URL where the customer can pay.
 *
 * This scaffold keeps a provider-neutral shape. The Nomba-specific client should
 * replace this during the official build sprint once sandbox credentials and
 * webhook signing details are available.
 */
export async function initiatePayment(params: InitiatePaymentParams): Promise<string> {
    const {
        amount,
        email,
        transactionRef,
        customerName = "Customer",
        callbackUrl = `${process.env.APP_URL || "http://localhost:3000"}/api/webhooks/payments`,
        metadata = {},
    } = params;

    if (!PAYMENT_PROVIDER_SECRET_KEY || !PAYMENT_PROVIDER_BASE_URL) {
        throw new Error("Payment provider is not configured yet.");
    }

    logger.info({ transactionRef, amount, email }, "Initiating payment");

    const response = await fetch(`${PAYMENT_PROVIDER_BASE_URL}/transaction/initiate`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${PAYMENT_PROVIDER_SECRET_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            amount,
            email,
            currency: "NGN",
            initiate_type: "inline",
            transaction_ref: transactionRef,
            customer_name: customerName,
            callback_url: callbackUrl,
            payment_channels: ["card", "bank", "ussd", "transfer"],
            metadata,
            pass_charge: false,
        }),
    });

    const data = (await response.json()) as PaymentProviderResponse;

    if (data.status !== 200) {
        logger.error({ status: data.status, message: data.message }, "Payment initiation failed");
        throw new Error(`Payment provider error: ${data.message}`);
    }

    logger.info({ checkoutUrl: data.data.checkout_url, transactionRef }, "Payment link created");
    return data.data.checkout_url;
}

/**
 * Verify a transaction by its reference
 */
export async function verifyTransaction(transactionRef: string): Promise<any> {
    if (!PAYMENT_PROVIDER_SECRET_KEY || !PAYMENT_PROVIDER_BASE_URL) {
        throw new Error("Payment provider is not configured yet.");
    }

    const response = await fetch(`${PAYMENT_PROVIDER_BASE_URL}/transaction/verify/${transactionRef}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${PAYMENT_PROVIDER_SECRET_KEY}`,
        },
    });

    return response.json();
}
