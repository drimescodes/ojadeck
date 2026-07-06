import logger from "../utils/logger";

type NombaMode = "test" | "live";

const NOMBA_AMOUNT_UNIT = process.env.NOMBA_AMOUNT_UNIT || "naira";

interface InitiatePaymentParams {
    amount: number; // in kobo
    email: string;
    transactionRef: string;
    customerName?: string;
    callbackUrl?: string;
    metadata?: Record<string, any>;
}

interface NombaAuthResponse {
    code: string;
    description: string;
    data?: {
        access_token: string;
        expiresAt?: string;
    };
}

interface NombaCheckoutResponse {
    code: string;
    description: string;
    data?: {
        checkoutLink?: string;
        orderReference?: string;
    };
}

interface VerifyTransactionParams {
    transactionId?: string | null;
    orderReference?: string | null;
}

interface NombaBank {
    code: string;
    name: string;
}

interface LookupBankAccountParams {
    accountNumber: string;
    bankCode: string;
}

interface TransferToBankParams {
    amount: number; // kobo
    accountNumber: string;
    accountName: string;
    bankCode: string;
    merchantTxRef: string;
    narration?: string;
    senderName?: string;
}

interface CachedToken {
    value: string;
    expiresAt: number;
}

interface NombaConfig {
    mode: NombaMode;
    baseUrl: string;
    clientId: string;
    privateKey: string;
    parentAccountId: string;
    subAccountId: string;
}

let cachedToken: CachedToken | null = null;
const config = getNombaConfig();

function normalizeMode(value: string | undefined): NombaMode {
    const normalized = (value || "test").toLowerCase();

    if (normalized === "live" || normalized === "production" || normalized === "prod") {
        return "live";
    }

    return "test";
}

function cleanBaseUrl(value: string): string {
    return value.replace(/\/+$/, "");
}

function getNombaConfig(): NombaConfig {
    const mode = normalizeMode(process.env.NOMBA_MODE);
    const isLive = mode === "live";
    const prefix = isLive ? "NOMBA_LIVE" : "NOMBA_TEST";

    return {
        mode,
        baseUrl: cleanBaseUrl(
            process.env[`${prefix}_BASE_URL`]
                || (isLive ? "https://api.nomba.com" : "https://sandbox.nomba.com")
        ),
        clientId: process.env[`${prefix}_CLIENT_ID`] || "",
        privateKey: process.env[`${prefix}_PRIVATE_KEY`] || "",
        parentAccountId: process.env[`${prefix}_PARENT_ACCOUNT_ID`] || "",
        subAccountId: process.env[`${prefix}_SUB_ACCOUNT_ID`] || "",
    };
}

function requireNombaConfig(): void {
    const prefix = config.mode === "live" ? "NOMBA_LIVE" : "NOMBA_TEST";
    const missing = [
        [`${prefix}_CLIENT_ID`, config.clientId],
        [`${prefix}_PRIVATE_KEY`, config.privateKey],
        [`${prefix}_PARENT_ACCOUNT_ID`, config.parentAccountId],
    ].filter(([, value]) => !value).map(([name]) => name);

    if (missing.length > 0) {
        throw new Error(`Nomba is not configured. Missing: ${missing.join(", ")}`);
    }
}

function accountIdForApiCalls(): string {
    return config.subAccountId || config.parentAccountId;
}

function parentAccountIdForApiCalls(): string {
    return config.parentAccountId;
}

function amountForCheckout(kobo: number): string | number {
    if (NOMBA_AMOUNT_UNIT === "kobo") {
        return kobo;
    }

    return (kobo / 100).toFixed(2);
}

function amountForTransfer(kobo: number): string | number {
    if (NOMBA_AMOUNT_UNIT === "kobo") {
        return kobo;
    }

    return Number((kobo / 100).toFixed(2));
}

function nombaOperationSucceeded(response: Response, data: any): boolean {
    if (!response.ok) return false;

    const code = data?.code === undefined ? "" : String(data.code).toLowerCase();
    const status = data?.status;
    const description = data?.description === undefined ? "" : String(data.description).toLowerCase();
    const message = data?.message === undefined ? "" : String(data.message).toLowerCase();

    return code === "00"
        || code === "200"
        || status === true
        || description === "success"
        || message === "success";
}

function nombaLogSummary(data: any): Record<string, unknown> {
    return {
        code: data?.code,
        status: data?.status,
        description: data?.description,
        message: data?.message,
        requestId: data?.requestId || data?.data?.requestId,
    };
}

async function readJsonResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    try {
        return JSON.parse(text) as T;
    } catch {
        throw new Error(`Nomba returned a non-JSON response (${response.status}): ${text.substring(0, 300)}`);
    }
}

async function getAccessToken(): Promise<string> {
    requireNombaConfig();

    if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) {
        return cachedToken.value;
    }

    const response = await fetch(`${config.baseUrl}/v1/auth/token/issue`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            accountId: config.parentAccountId,
        },
        body: JSON.stringify({
            grant_type: "client_credentials",
            client_id: config.clientId,
            client_secret: config.privateKey,
        }),
    });

    const data = await readJsonResponse<NombaAuthResponse>(response);
    if (!response.ok || data.code !== "00" || !data.data?.access_token) {
        logger.error({ status: response.status, code: data.code, description: data.description }, "Nomba auth failed");
        throw new Error(`Nomba auth failed: ${data.description || response.statusText}`);
    }

    cachedToken = {
        value: data.data.access_token,
        expiresAt: data.data.expiresAt ? Date.parse(data.data.expiresAt) : Date.now() + 50 * 60_000,
    };

    return cachedToken.value;
}

/**
 * Initiate a Nomba Checkout order and return the hosted checkout link.
 */
export async function initiatePayment(params: InitiatePaymentParams): Promise<string> {
    const {
        amount,
        email,
        transactionRef,
        callbackUrl = `${process.env.APP_URL || "http://localhost:3000"}/payment/complete`,
    } = params;

    const token = await getAccessToken();
    const checkoutAmount = amountForCheckout(amount);

    logger.info({ transactionRef, amount, checkoutAmount, mode: config.mode }, "Creating Nomba checkout order");

    const response = await fetch(`${config.baseUrl}/v1/checkout/order`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            accountId: parentAccountIdForApiCalls(),
        },
        body: JSON.stringify({
            order: {
                orderReference: transactionRef,
                amount: checkoutAmount,
                currency: "NGN",
                customerEmail: email,
                callbackUrl,
                accountId: accountIdForApiCalls(),
            },
        }),
    });

    const data = await readJsonResponse<NombaCheckoutResponse>(response);
    if (!response.ok || data.code !== "00" || !data.data?.checkoutLink) {
        logger.error({ status: response.status, code: data.code, description: data.description }, "Nomba checkout creation failed");
        throw new Error(`Nomba checkout error: ${data.description || response.statusText}`);
    }

    logger.info({ checkoutUrl: data.data.checkoutLink, transactionRef }, "Nomba checkout link created");
    return data.data.checkoutLink;
}

/**
 * Verify a transaction with Nomba before marking an order as paid.
 */
export async function verifyTransaction(params: VerifyTransactionParams): Promise<any> {
    const token = await getAccessToken();

    if (!params.orderReference && !params.transactionId) {
        throw new Error("Cannot verify Nomba transaction without the required reference.");
    }

    const fetchVerification = async (kind: "orderReference" | "transactionId", reference: string): Promise<any> => {
        const url = kind === "orderReference"
            ? new URL(`${config.baseUrl}/v1/checkout/transaction`)
            : new URL(`${config.baseUrl}/v1/transactions/accounts/single`);

        if (kind === "orderReference") {
            url.searchParams.set("idType", "orderReference");
            url.searchParams.set("id", reference);
        } else {
            url.searchParams.set("transactionRef", reference);
        }

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                accountId: parentAccountIdForApiCalls(),
            },
        });

        const data = await readJsonResponse<any>(response);
        if (!response.ok || (data.code && data.code !== "00")) {
            logger.warn({ status: response.status, kind, nomba: nombaLogSummary(data) }, "Nomba transaction verification failed");
            throw new Error(`Nomba transaction verification failed: ${data.description || response.statusText}`);
        }

        return data;
    };

    if (params.orderReference) {
        try {
            return await fetchVerification("orderReference", params.orderReference);
        } catch (err) {
            if (!params.transactionId) throw err;
            logger.warn({ orderReference: params.orderReference, transactionId: params.transactionId }, "Retrying Nomba verification with transaction ID");
        }
    }

    return fetchVerification("transactionId", params.transactionId!);
}

export function getNombaAmountUnit(): string {
    return NOMBA_AMOUNT_UNIT;
}

export async function fetchBanks(): Promise<NombaBank[]> {
    const token = await getAccessToken();
    const response = await fetch(`${config.baseUrl}/v1/transfers/banks`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            accountId: parentAccountIdForApiCalls(),
        },
    });

    const data = await readJsonResponse<any>(response);
    if (!response.ok || (data.code && data.code !== "00")) {
        logger.warn({ status: response.status, nomba: nombaLogSummary(data) }, "Nomba bank list fetch failed");
        throw new Error(`Nomba bank list fetch failed: ${data.description || response.statusText}`);
    }

    const banks = data?.data?.banks || data?.data || [];
    return Array.isArray(banks)
        ? banks.map((bank: any) => ({
            code: String(bank.code || bank.bankCode || ""),
            name: String(bank.name || bank.bankName || ""),
        })).filter((bank) => bank.code && bank.name)
        : [];
}

export async function lookupBankAccount(params: LookupBankAccountParams): Promise<{ accountNumber: string; accountName: string; bankCode: string }> {
    const token = await getAccessToken();
    const response = await fetch(`${config.baseUrl}/v1/transfers/bank/lookup`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            accountId: parentAccountIdForApiCalls(),
        },
        body: JSON.stringify({
            accountNumber: params.accountNumber,
            bankCode: params.bankCode,
        }),
    });

    const data = await readJsonResponse<any>(response);
    if (!response.ok || (data.code && data.code !== "00")) {
        logger.warn({ status: response.status, nomba: nombaLogSummary(data) }, "Nomba bank account lookup failed");
        throw new Error(`Nomba bank account lookup failed: ${data.description || response.statusText}`);
    }

    const account = data?.data?.account || data?.data || {};
    const accountName = account.accountName || account.name || account.account_name;
    const accountNumber = account.accountNumber || account.number || params.accountNumber;

    if (!accountName) {
        throw new Error("Nomba bank account lookup did not return an account name.");
    }

    return {
        accountNumber: String(accountNumber),
        accountName: String(accountName),
        bankCode: params.bankCode,
    };
}

export async function transferToBank(params: TransferToBankParams): Promise<any> {
    const token = await getAccessToken();
    const subAccountId = config.subAccountId;
    if (!subAccountId) {
        throw new Error("Nomba sub-account ID is required for merchant payouts.");
    }

    const transferAmount = amountForTransfer(params.amount);
    logger.info({ merchantTxRef: params.merchantTxRef, amount: params.amount, transferAmount, mode: config.mode }, "Creating Nomba bank transfer");

    const response = await fetch(`${config.baseUrl}/v2/transfers/bank/${subAccountId}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            accountId: parentAccountIdForApiCalls(),
        },
        body: JSON.stringify({
            amount: transferAmount,
            accountNumber: params.accountNumber,
            accountName: params.accountName,
            bankCode: params.bankCode,
            merchantTxRef: params.merchantTxRef,
            senderName: params.senderName || "OjaDeck",
            narration: params.narration || "OjaDeck merchant payout",
        }),
    });

    const data = await readJsonResponse<any>(response);
    if (!nombaOperationSucceeded(response, data)) {
        logger.warn({ status: response.status, response: data }, "Nomba bank transfer failed");
        throw new Error(`Nomba bank transfer failed: ${data.description || response.statusText}`);
    }

    return data;
}
