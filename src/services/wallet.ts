import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { ledgerEntries, payoutAccounts, payouts } from "../db/schema";
import { generateId } from "../utils/helpers";
import { transferToBank } from "./payment-provider";
import logger from "../utils/logger";

type LedgerType = "order_paid" | "payout_requested" | "payout_failed" | "manual_adjustment";

export async function createLedgerEntry(params: {
    sellerId: string;
    type: LedgerType;
    amount: number;
    reference: string;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    const existing = await db.query.ledgerEntries.findFirst({
        where: eq(ledgerEntries.reference, params.reference),
    });

    if (existing) return;

    await db.insert(ledgerEntries).values({
        id: generateId(),
        sellerId: params.sellerId,
        type: params.type,
        amount: params.amount,
        reference: params.reference,
        status: "posted",
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    });
}

export async function creditOrderPayment(params: {
    sellerId: string;
    orderId: string;
    transactionRef: string;
    amount: number;
}): Promise<void> {
    await createLedgerEntry({
        sellerId: params.sellerId,
        type: "order_paid",
        amount: params.amount,
        reference: `order:${params.orderId}`,
        metadata: {
            orderId: params.orderId,
            transactionRef: params.transactionRef,
        },
    });
}

export async function getWalletSummary(sellerId: string): Promise<{
    availableBalance: number;
    lifetimeCredits: number;
    pendingPayouts: number;
}> {
    const entries = await db.query.ledgerEntries.findMany({
        where: and(eq(ledgerEntries.sellerId, sellerId), eq(ledgerEntries.status, "posted")),
    });

    const availableBalance = entries.reduce((sum, entry) => sum + entry.amount, 0);
    const lifetimeCredits = entries
        .filter((entry) => entry.type === "order_paid" || (entry.type === "manual_adjustment" && entry.amount > 0))
        .reduce((sum, entry) => sum + entry.amount, 0);
    const pendingPayoutRows = await db.query.payouts.findMany({
        where: eq(payouts.sellerId, sellerId),
    });
    const pendingPayouts = pendingPayoutRows
        .filter((payout) => payout.status === "pending_confirmation" || payout.status === "processing")
        .reduce((sum, payout) => sum + payout.amount, 0);

    return { availableBalance, lifetimeCredits, pendingPayouts };
}

export async function getLatestPayoutAccount(sellerId: string) {
    return db.query.payoutAccounts.findFirst({
        where: eq(payoutAccounts.sellerId, sellerId),
        orderBy: [desc(payoutAccounts.updatedAt), desc(payoutAccounts.createdAt)],
    });
}

export async function savePayoutAccount(params: {
    sellerId: string;
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
}) {
    const existing = await getLatestPayoutAccount(params.sellerId);
    const values = {
        bankCode: params.bankCode,
        bankName: params.bankName,
        accountNumber: params.accountNumber,
        accountName: params.accountName,
        updatedAt: new Date(),
    };

    if (existing) {
        await db
            .update(payoutAccounts)
            .set(values)
            .where(eq(payoutAccounts.id, existing.id));
        return { ...existing, ...values };
    }

    const id = generateId();
    await db.insert(payoutAccounts).values({
        id,
        sellerId: params.sellerId,
        ...values,
    });

    return { id, sellerId: params.sellerId, ...values };
}

export async function createPayoutRequest(sellerId: string, amount: number) {
    if (!Number.isFinite(amount) || amount < 100) {
        throw new Error("Withdrawal amount must be at least ₦1.");
    }

    const account = await getLatestPayoutAccount(sellerId);
    if (!account) {
        throw new Error("Add a payout bank account before withdrawing.");
    }

    const summary = await getWalletSummary(sellerId);
    if (summary.availableBalance < amount) {
        throw new Error("Insufficient available balance.");
    }

    const id = generateId();
    const merchantTxRef = `OJ-PAYOUT-${Date.now()}-${id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}`;

    await db.insert(payouts).values({
        id,
        sellerId,
        payoutAccountId: account.id,
        amount,
        status: "pending_confirmation",
        merchantTxRef,
        bankCode: account.bankCode,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
    });

    return db.query.payouts.findFirst({ where: eq(payouts.id, id) });
}

function extractTransferStatus(response: any): string {
    return String(
        response?.data?.status
        || response?.data?.transactionStatus
        || response?.data?.transferStatus
        || response?.data?.transaction?.status
        || response?.data?.transaction?.transactionStatus
        || response?.status
        || "processing"
    );
}

function extractTransferId(response: any): string | null {
    const id = response?.data?.transactionId
        || response?.data?.transferId
        || response?.data?.id
        || response?.data?.transaction?.transactionId;
    return id ? String(id) : null;
}

export async function confirmPayout(sellerId: string, payoutId: string) {
    const payout = await db.query.payouts.findFirst({
        where: and(eq(payouts.id, payoutId), eq(payouts.sellerId, sellerId)),
    });

    if (!payout) throw new Error("Payout not found.");
    if (payout.status !== "pending_confirmation") {
        throw new Error("Only pending payouts can be confirmed.");
    }

    const summary = await getWalletSummary(sellerId);
    if (summary.availableBalance < payout.amount) {
        throw new Error("Insufficient available balance.");
    }

    const claimed = await db
        .update(payouts)
        .set({ status: "processing", updatedAt: new Date(), confirmedAt: new Date() })
        .where(and(
            eq(payouts.id, payout.id),
            eq(payouts.sellerId, sellerId),
            eq(payouts.status, "pending_confirmation")
        ))
        .returning({ id: payouts.id });

    if (claimed.length === 0) {
        throw new Error("Payout is already being processed.");
    }

    await createLedgerEntry({
        sellerId,
        type: "payout_requested",
        amount: -payout.amount,
        reference: `payout:${payout.id}:debit`,
        metadata: { payoutId: payout.id, merchantTxRef: payout.merchantTxRef },
    });

    try {
        const response = await transferToBank({
            amount: payout.amount,
            accountNumber: payout.accountNumber,
            accountName: payout.accountName,
            bankCode: payout.bankCode,
            merchantTxRef: payout.merchantTxRef,
            narration: "OjaDeck merchant payout",
        });
        const nombaStatus = extractTransferStatus(response);
        const normalizedStatus = nombaStatus.toUpperCase();
        const finalStatus = normalizedStatus === "SUCCESS" ? "success" : "processing";

        await db
            .update(payouts)
            .set({
                status: finalStatus,
                nombaStatus,
                nombaTransferId: extractTransferId(response),
                updatedAt: new Date(),
            })
            .where(eq(payouts.id, payout.id));

        logger.info({ payoutId: payout.id, merchantTxRef: payout.merchantTxRef, nombaStatus }, "Payout transfer submitted");
    } catch (err: any) {
        await createLedgerEntry({
            sellerId,
            type: "payout_failed",
            amount: payout.amount,
            reference: `payout:${payout.id}:reversal`,
            metadata: { payoutId: payout.id, merchantTxRef: payout.merchantTxRef, error: err.message },
        });

        await db
            .update(payouts)
            .set({
                status: "failed",
                errorMessage: err.message,
                updatedAt: new Date(),
            })
            .where(eq(payouts.id, payout.id));

        throw err;
    }

    return db.query.payouts.findFirst({ where: eq(payouts.id, payout.id) });
}

export async function markPayoutSuccessFromWebhook(params: {
    merchantTxRef: string;
    nombaStatus?: string | null;
    nombaTransferId?: string | null;
}) {
    const payout = await db.query.payouts.findFirst({
        where: eq(payouts.merchantTxRef, params.merchantTxRef),
    });

    if (!payout) {
        logger.warn({ merchantTxRef: params.merchantTxRef }, "Payout webhook received for unknown transfer reference");
        return;
    }

    await db
        .update(ledgerEntries)
        .set({ status: "void" })
        .where(and(
            eq(ledgerEntries.sellerId, payout.sellerId),
            eq(ledgerEntries.reference, `payout:${payout.id}:reversal`)
        ));

    await db
        .update(payouts)
        .set({
            status: "success",
            nombaStatus: params.nombaStatus || "SUCCESS",
            nombaTransferId: params.nombaTransferId || payout.nombaTransferId,
            errorMessage: null,
            updatedAt: new Date(),
        })
        .where(eq(payouts.id, payout.id));

    logger.info({ payoutId: payout.id, merchantTxRef: payout.merchantTxRef }, "Payout success webhook processed");
}
