import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { ledgerEntries, payouts } from "../db/schema";
import { fetchBanks, lookupBankAccount } from "../services/payment-provider";
import {
    confirmPayout,
    createPayoutRequest,
    getLatestPayoutAccount,
    getWalletSummary,
    savePayoutAccount,
} from "../services/wallet";
import { formatNaira } from "../utils/helpers";

const walletRouter = new Hono();

function toKobo(naira: unknown): number {
    return Math.round(Number(naira) * 100);
}

function formatLedgerEntry(entry: typeof ledgerEntries.$inferSelect) {
    return {
        ...entry,
        amountDisplay: formatNaira(entry.amount),
        metadata: entry.metadata ? JSON.parse(entry.metadata) : null,
    };
}

function formatPayout(payout: typeof payouts.$inferSelect) {
    return {
        ...payout,
        amountDisplay: formatNaira(payout.amount),
    };
}

walletRouter.get("/summary", async (c) => {
    const sellerId = c.get("sellerId" as never) as string;
    const summary = await getWalletSummary(sellerId);
    const payoutAccount = await getLatestPayoutAccount(sellerId);

    return c.json({
        ...summary,
        availableBalanceDisplay: formatNaira(summary.availableBalance),
        lifetimeCreditsDisplay: formatNaira(summary.lifetimeCredits),
        pendingPayoutsDisplay: formatNaira(summary.pendingPayouts),
        estimatedTransferFeeDisplay: formatNaira(summary.estimatedTransferFee),
        maxWithdrawalAmountDisplay: formatNaira(summary.maxWithdrawalAmount),
        payoutAccount,
    });
});

walletRouter.get("/ledger", async (c) => {
    const sellerId = c.get("sellerId" as never) as string;
    const rows = await db.query.ledgerEntries.findMany({
        where: eq(ledgerEntries.sellerId, sellerId),
        orderBy: [desc(ledgerEntries.createdAt)],
        limit: 50,
    });

    return c.json(rows.map(formatLedgerEntry));
});

walletRouter.get("/payouts", async (c) => {
    const sellerId = c.get("sellerId" as never) as string;
    const rows = await db.query.payouts.findMany({
        where: eq(payouts.sellerId, sellerId),
        orderBy: [desc(payouts.createdAt)],
        limit: 50,
    });

    return c.json(rows.map(formatPayout));
});

walletRouter.get("/banks", async (c) => {
    const banks = await fetchBanks();
    return c.json(banks);
});

walletRouter.post("/payout-account/lookup", async (c) => {
    const { accountNumber, bankCode } = await c.req.json();

    if (!accountNumber || !bankCode) {
        return c.json({ error: "accountNumber and bankCode are required" }, 400);
    }

    const result = await lookupBankAccount({
        accountNumber: String(accountNumber).replace(/\D/g, ""),
        bankCode: String(bankCode),
    });

    return c.json(result);
});

walletRouter.post("/payout-account", async (c) => {
    const sellerId = c.get("sellerId" as never) as string;
    const { bankCode, bankName, accountNumber } = await c.req.json();

    if (!bankCode || !bankName || !accountNumber) {
        return c.json({ error: "bankCode, bankName, and accountNumber are required" }, 400);
    }

    try {
        const verified = await lookupBankAccount({
            accountNumber: String(accountNumber).replace(/\D/g, ""),
            bankCode: String(bankCode),
        });

        const account = await savePayoutAccount({
            sellerId,
            bankCode: String(bankCode),
            bankName: String(bankName),
            accountNumber: verified.accountNumber,
            accountName: verified.accountName,
        });

        return c.json(account);
    } catch (err: any) {
        return c.json({ error: err.message }, 400);
    }
});

walletRouter.post("/payouts", async (c) => {
    const sellerId = c.get("sellerId" as never) as string;
    const { amount } = await c.req.json();
    const amountKobo = toKobo(amount);

    if (!Number.isFinite(amountKobo) || amountKobo < 100) {
        return c.json({ error: "amount must be at least ₦1" }, 400);
    }

    try {
        const payout = await createPayoutRequest(sellerId, amountKobo);
        return c.json(payout ? formatPayout(payout) : null, 201);
    } catch (err: any) {
        return c.json({ error: err.message }, 400);
    }
});

walletRouter.post("/payouts/:id/confirm", async (c) => {
    const sellerId = c.get("sellerId" as never) as string;
    const payoutId = c.req.param("id");

    try {
        const payout = await confirmPayout(sellerId, payoutId);
        return c.json(payout ? formatPayout(payout) : null);
    } catch (err: any) {
        return c.json({ error: err.message }, 400);
    }
});

export default walletRouter;
