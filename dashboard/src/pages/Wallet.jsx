import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { api } from '../api';
import { queryKeys } from '../query';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export default function Wallet() {
    const [bankForm, setBankForm] = useState({ bankCode: '', accountNumber: '', accountName: '', bankName: '' });
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [pendingPayout, setPendingPayout] = useState(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const confirmingPayoutRef = useRef(false);
    const statusPollRef = useRef(null);
    const queryClient = useQueryClient();
    const {
        data: summary,
        isLoading: summaryLoading,
        dataUpdatedAt: summaryUpdatedAt,
    } = useQuery({
        queryKey: queryKeys.walletSummary,
        queryFn: api.getWalletSummary,
        refetchInterval: 5000,
    });
    const {
        data: ledger = [],
        isLoading: ledgerLoading,
        dataUpdatedAt: ledgerUpdatedAt,
    } = useQuery({
        queryKey: queryKeys.walletLedger,
        queryFn: api.getWalletLedger,
        refetchInterval: 5000,
    });
    const {
        data: payouts = [],
        isLoading: payoutsLoading,
        dataUpdatedAt: payoutsUpdatedAt,
    } = useQuery({
        queryKey: queryKeys.payouts,
        queryFn: api.getPayouts,
        refetchInterval: 5000,
    });
    const { data: banks = [] } = useQuery({
        queryKey: queryKeys.banks,
        queryFn: api.getBanks,
        staleTime: 24 * 60 * 60_000,
        gcTime: 24 * 60 * 60_000,
    });
    const loading = (summaryLoading || ledgerLoading || payoutsLoading) && !summary;
    const lastUpdatedAt = Math.max(summaryUpdatedAt, ledgerUpdatedAt, payoutsUpdatedAt);
    const lastUpdated = lastUpdatedAt ? new Date(lastUpdatedAt) : null;

    useBodyScrollLock(Boolean(pendingPayout));

    const selectedBank = useMemo(
        () => banks.find((bank) => bank.code === bankForm.bankCode),
        [banks, bankForm.bankCode]
    );

    const refetchWallet = async () => {
        await Promise.all([
            queryClient.refetchQueries({ queryKey: queryKeys.walletSummary }),
            queryClient.refetchQueries({ queryKey: queryKeys.walletLedger }),
            queryClient.refetchQueries({ queryKey: queryKeys.payouts }),
        ]);
        return queryClient.getQueryData(queryKeys.payouts) || [];
    };

    useEffect(() => {
        if (!summary?.payoutAccount) return;
        setBankForm({
            bankCode: summary.payoutAccount.bankCode,
            bankName: summary.payoutAccount.bankName,
            accountNumber: summary.payoutAccount.accountNumber,
            accountName: summary.payoutAccount.accountName,
        });
    }, [summary?.payoutAccount]);

    useEffect(() => {
        return () => {
            if (statusPollRef.current) clearTimeout(statusPollRef.current);
        };
    }, []);

    const waitForPayoutSettlement = async (payoutId) => {
        for (let attempt = 0; attempt < 8; attempt += 1) {
            await new Promise((resolve) => {
                statusPollRef.current = setTimeout(resolve, 1500);
            });
            const payoutData = await refetchWallet();
            const current = payoutData.find((payout) => payout.id === payoutId);
            if (current && current.status !== 'processing') return current;
        }
        return null;
    };

    const handleBankChange = (e) => {
        const { name, value } = e.target;
        setBankForm({ ...bankForm, [name]: value });
    };

    const handleBankSelect = (bank) => {
        setBankForm({
            ...bankForm,
            bankCode: bank.code,
            bankName: bank.name,
            accountName: '',
        });
    };

    const handleLookup = async () => {
        setBusy(true);
        setMessage('');
        try {
            const result = await api.lookupPayoutAccount({
                bankCode: bankForm.bankCode,
                accountNumber: bankForm.accountNumber,
            });
            setBankForm({
                ...bankForm,
                accountNumber: result.accountNumber,
                accountName: result.accountName,
                bankName: selectedBank?.name || bankForm.bankName,
            });
            setMessage('Account name verified.');
        } catch (err) {
            setMessage(err.message);
        } finally {
            setBusy(false);
        }
    };

    const handleSaveAccount = async () => {
        setBusy(true);
        setMessage('');
        try {
            await api.savePayoutAccount(bankForm);
            await refetchWallet();
            setMessage('Payout account saved.');
        } catch (err) {
            setMessage(err.message);
        } finally {
            setBusy(false);
        }
    };

    const handleCreatePayout = async () => {
        setBusy(true);
        setMessage('');
        try {
            const payout = await api.createPayout({ amount: Number(withdrawAmount) });
            setPendingPayout(payout);
            await refetchWallet();
        } catch (err) {
            setMessage(err.message);
        } finally {
            setBusy(false);
        }
    };

    const handleConfirmPayout = async () => {
        if (!pendingPayout || busy || confirmingPayoutRef.current) return;
        const payout = pendingPayout;
        confirmingPayoutRef.current = true;
        setPendingPayout(null);
        setBusy(true);
        setMessage('Submitting payout to Nomba...');
        try {
            await api.confirmPayout(payout.id);
            setWithdrawAmount('');
            await refetchWallet();
            const settled = await waitForPayoutSettlement(payout.id);
            if (settled?.status === 'success') {
                setMessage('Payout completed.');
            } else if (settled?.status === 'failed') {
                setMessage(settled.errorMessage || 'Payout failed.');
            } else {
                setMessage('Payout submitted to Nomba. Waiting for confirmation.');
            }
        } catch (err) {
            setMessage(err.message);
            await refetchWallet();
        } finally {
            confirmingPayoutRef.current = false;
            setBusy(false);
        }
    };

    const statCards = [
        { label: 'Available Balance', value: summary?.availableBalanceDisplay || '₦0' },
        { label: 'Lifetime Credits', value: summary?.lifetimeCreditsDisplay || '₦0' },
        { label: 'Max Withdrawal', value: summary?.maxWithdrawalAmountDisplay || '₦0' },
    ];
    const paymentNotifications = useMemo(
        () => ledger.filter((entry) => entry.type === 'order_paid').map(getPaymentNotification),
        [ledger]
    );

    if (loading) {
        return (
            <WalletSkeleton />
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                    Wallet
                </div>
                <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.05em] text-[#18231d]">
                    Merchant Balance & Payouts
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[#627168]">
                    Paid orders credit your OjaDeck balance. Withdrawals send live Nomba transfers to your saved bank account.
                </p>
                <div className="mt-3 text-xs font-semibold text-[#7b6b48]">
                    Auto-refreshing wallet data{lastUpdated ? ` - last updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}.
                </div>
            </div>

            {message && (
                <div className="rounded-2xl border border-[#e7dfcf] bg-[#fbf8f2] px-4 py-3 text-sm font-semibold text-[#294136]">
                    {message}
                </div>
            )}

            <section className="grid gap-4 md:grid-cols-3">
                {statCards.map((card) => (
                    <div key={card.label} className="rounded-[24px] border border-[#e7dfcf] bg-white px-5 py-5 shadow-[0_12px_30px_rgba(104,85,45,0.05)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                            {card.label}
                        </div>
                        <div className="mt-3 text-4xl font-extrabold tracking-[-0.05em] text-[#153d32]">
                            {card.value}
                        </div>
                    </div>
                ))}
            </section>

            <section className="rounded-[26px] border border-[#e7dfcf] bg-white p-5 shadow-[0_12px_30px_rgba(104,85,45,0.05)] md:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                            Payment Notifications
                        </div>
                        <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#18231d]">
                            Incoming Nomba payments
                        </h2>
                    </div>
                    <div className="text-xs font-semibold text-[#7b6b48]">
                        Updates auto-refresh with wallet data
                    </div>
                </div>

                <div className="mt-5 max-h-[360px] space-y-3 overflow-y-auto pr-1">
                    {paymentNotifications.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[#d9d1bf] bg-[#fbf8f2] px-4 py-5 text-sm leading-7 text-[#627168]">
                            No payment notifications yet. Paid orders will appear here after Nomba confirms checkout through the webhook.
                        </div>
                    ) : paymentNotifications.map((item) => (
                        <div key={item.id} className={`rounded-2xl border px-4 py-4 ${item.containerClass}`}>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex min-w-0 gap-3">
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${item.iconClass}`}>
                                        {item.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold text-[#18231d]">
                                            {item.title}
                                        </div>
                                        <p className="mt-1 text-sm leading-6 text-[#627168]">
                                            {item.description}
                                        </p>
                                        {item.meta && (
                                            <div className="mt-2 text-xs font-semibold text-[#7b6b48]">
                                                {item.meta}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="shrink-0 text-left sm:text-right">
                                    <div className="text-sm font-extrabold text-[#153d32]">
                                        {item.amount}
                                    </div>
                                    <div className="mt-1 text-xs font-semibold text-[#7b6b48]">
                                        {item.time}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-[26px] border border-[#e7dfcf] bg-white p-6 shadow-[0_12px_30px_rgba(104,85,45,0.05)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">Payout Account</div>
                    <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#18231d]">Bank details</h2>
                    <div className="mt-5 grid gap-4">
                        <BankSearchSelect
                            banks={banks}
                            value={bankForm.bankCode}
                            bankName={bankForm.bankName}
                            onSelect={handleBankSelect}
                        />
                        <input
                            className="w-full rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-4 py-3 text-sm text-[#18231d] outline-none focus:border-[#1f9d63] focus:ring-4 focus:ring-[#1f9d63]/10"
                            name="accountNumber"
                            value={bankForm.accountNumber}
                            onChange={handleBankChange}
                            placeholder="Account number"
                        />
                        <div className="grid gap-3 sm:grid-cols-2">
                            <button className="rounded-2xl border border-[#d8cfbc] bg-[#f8f4ec] px-4 py-3 text-sm font-semibold text-[#294136] disabled:opacity-60" disabled={busy || !bankForm.bankCode || !bankForm.accountNumber} onClick={handleLookup}>
                                Verify Account
                            </button>
                            <button className="rounded-2xl bg-[#153d32] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || !bankForm.accountName} onClick={handleSaveAccount}>
                                Save Account
                            </button>
                        </div>
                        <div className="rounded-2xl border border-[#eee5d4] bg-[#fbf8f2] px-4 py-3 text-sm leading-7 text-[#294136]">
                            <div className="font-semibold">{bankForm.accountName || 'No verified account yet'}</div>
                            <div className="text-[#627168]">{bankForm.bankName || 'Bank not selected'} {bankForm.accountNumber ? `- ${bankForm.accountNumber}` : ''}</div>
                        </div>
                    </div>
                </div>

                <div className="rounded-[26px] border border-[#e7dfcf] bg-white p-6 shadow-[0_12px_30px_rgba(104,85,45,0.05)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">Withdraw</div>
                    <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#18231d]">Send payout</h2>
                    <div className="mt-5 grid gap-4">
                        <input
                            className="w-full rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-4 py-3 text-sm text-[#18231d] outline-none focus:border-[#1f9d63] focus:ring-4 focus:ring-[#1f9d63]/10"
                            type="number"
                            min="1"
                            step="1"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            placeholder="Amount in naira"
                        />
                        <button className="rounded-2xl bg-[#153d32] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={busy || !withdrawAmount || !summary?.payoutAccount} onClick={handleCreatePayout}>
                            Review Withdrawal
                        </button>
                        <p className="text-xs leading-6 text-[#6d776f]">
                            Transfers are live. OjaDeck reserves an estimated Nomba transfer fee of {summary?.estimatedTransferFeeDisplay || '₦20'} so the balance reflects what can actually leave the wallet.
                        </p>
                    </div>
                </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
                <HistoryTable title="Payout History" rows={payouts} kind="payouts" />
                <HistoryTable title="Ledger Activity" rows={ledger} kind="ledger" />
            </section>

            {pendingPayout && typeof document !== 'undefined' && createPortal(
                <PayoutConfirmModal
                    payout={pendingPayout}
                    busy={busy}
                    onCancel={() => setPendingPayout(null)}
                    onConfirm={handleConfirmPayout}
                />,
                document.body
            )}
        </div>
    );
}

function WalletSkeleton() {
    return (
        <div className="space-y-8">
            <div>
                <div className="skeleton h-3 w-24 rounded-full" />
                <div className="skeleton mt-4 h-10 w-80 max-w-full rounded-2xl" />
                <div className="skeleton mt-4 h-4 w-full max-w-xl rounded-full" />
                <div className="skeleton mt-2 h-4 w-80 max-w-full rounded-full" />
            </div>

            <section className="grid gap-4 md:grid-cols-3">
                {[0, 1, 2].map((item) => (
                    <div key={item} className="rounded-[24px] border border-[#e7dfcf] bg-white px-5 py-5 shadow-[0_12px_30px_rgba(104,85,45,0.05)]">
                        <div className="skeleton h-3 w-32 rounded-full" />
                        <div className="skeleton mt-4 h-10 w-36 rounded-2xl" />
                    </div>
                ))}
            </section>

            <section className="rounded-[26px] border border-[#e7dfcf] bg-white p-5 shadow-[0_12px_30px_rgba(104,85,45,0.05)] md:p-6">
                <div className="skeleton h-3 w-44 rounded-full" />
                <div className="skeleton mt-4 h-8 w-64 rounded-2xl" />
                <div className="mt-5 grid gap-3">
                    {[0, 1, 2].map((item) => (
                        <div key={item} className="rounded-2xl border border-[#eee5d4] px-4 py-4">
                            <div className="flex gap-3">
                                <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
                                <div className="min-w-0 flex-1">
                                    <div className="skeleton h-4 w-44 rounded-full" />
                                    <div className="skeleton mt-3 h-3 w-full rounded-full" />
                                    <div className="skeleton mt-2 h-3 w-2/3 rounded-full" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
                {[0, 1].map((item) => (
                    <div key={item} className="rounded-[26px] border border-[#e7dfcf] bg-white p-6 shadow-[0_12px_30px_rgba(104,85,45,0.05)]">
                        <div className="skeleton h-3 w-32 rounded-full" />
                        <div className="skeleton mt-4 h-8 w-44 rounded-2xl" />
                        <div className="mt-5 space-y-4">
                            <div className="skeleton h-12 rounded-2xl" />
                            <div className="skeleton h-12 rounded-2xl" />
                            <div className="skeleton h-12 rounded-2xl" />
                        </div>
                    </div>
                ))}
            </section>
        </div>
    );
}

function formatEventTime(value) {
    if (!value) return 'Just now';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Just now';

    return date.toLocaleString([], {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getPaymentNotification(entry) {
    const common = {
        id: entry.id,
        amount: entry.amountDisplay,
        time: formatEventTime(entry.createdAt),
        meta: entry.metadata?.transactionRef || entry.reference,
    };

    return {
        ...common,
        icon: '✓',
        title: 'Checkout payment received',
        description: 'A signed Nomba webhook confirmed this order and credited the merchant wallet.',
        containerClass: 'border-emerald-200 bg-emerald-50/70',
        iconClass: 'bg-[#1f9d63] text-white',
    };
}

function BankSearchSelect({ banks, value, bankName, onSelect }) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const selectedBank = useMemo(
        () => banks.find((bank) => bank.code === value),
        [banks, value]
    );
    const selectedLabel = selectedBank?.name || bankName || '';
    const normalizedQuery = query.trim().toLowerCase();
    const filteredBanks = useMemo(() => {
        if (!normalizedQuery) return banks.slice(0, 40);

        return banks
            .filter((bank) => {
                const name = bank.name.toLowerCase();
                const code = bank.code.toLowerCase();
                return name.includes(normalizedQuery) || code.includes(normalizedQuery);
            })
            .slice(0, 40);
    }, [banks, normalizedQuery]);

    const chooseBank = (bank) => {
        onSelect(bank);
        setQuery('');
        setOpen(false);
    };

    return (
        <div className="relative" onBlur={() => setOpen(false)}>
            <div className={`flex items-center gap-2 rounded-2xl border bg-[#fffdf8] px-4 py-2.5 transition ${open ? 'border-[#1f9d63] ring-4 ring-[#1f9d63]/10' : 'border-[#d9d1bf]'}`}>
                <input
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#18231d] outline-none placeholder:text-[#8d8b80]"
                    value={open ? query : selectedLabel}
                    onFocus={() => setOpen(true)}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    placeholder={selectedLabel || 'Search bank'}
                />
                {value ? (
                    <span className="shrink-0 rounded-full bg-[#edf6f0] px-2.5 py-1 text-[11px] font-bold text-[#153d32]">
                        {value}
                    </span>
                ) : null}
            </div>

            {open && (
                <div
                    className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-[#e7dfcf] bg-white shadow-[0_18px_50px_rgba(21,35,29,0.14)]"
                    onMouseDown={(e) => e.preventDefault()}
                >
                    <div className="max-h-64 overflow-y-auto py-2">
                        {filteredBanks.length === 0 ? (
                            <div className="px-4 py-5 text-sm font-medium text-[#627168]">
                                No banks found.
                            </div>
                        ) : filteredBanks.map((bank) => (
                            <button
                                key={bank.code}
                                type="button"
                                className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-[#f7f1e5] ${bank.code === value ? 'bg-[#edf6f0] text-[#153d32]' : 'text-[#18231d]'}`}
                                onMouseDown={() => chooseBank(bank)}
                            >
                                <span className="min-w-0 truncate font-semibold">{bank.name}</span>
                                <span className="shrink-0 text-xs font-bold text-[#7b6b48]">{bank.code}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function PayoutConfirmModal({ payout, busy, onCancel, onConfirm }) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#15231d]/45 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[28px] border border-[#e8decc] bg-[#fffdf8] p-6 shadow-[0_24px_70px_rgba(21,35,29,0.18)] max-h-[calc(100dvh-2rem)] overflow-y-auto">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">Confirm Live Transfer</div>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#18231d]">{payout.amountDisplay}</h2>
                <p className="mt-3 text-sm leading-7 text-[#627168]">
                    Send this payout to {payout.accountName} at {payout.bankName}, account {payout.accountNumber}.
                </p>
                <div className="mt-4 rounded-2xl border border-[#eee5d4] bg-[#fbf8f2] px-4 py-3 text-sm leading-7 text-[#294136]">
                    Nomba transfer fees are reserved from the wallet when the payout is submitted. If Nomba returns a different charged amount, OjaDeck adjusts the ledger after confirmation.
                </div>
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button className="rounded-2xl border border-[#d8cfbc] bg-[#f8f4ec] px-5 py-3 text-sm font-semibold text-[#294136]" onClick={onCancel} disabled={busy}>
                        Cancel
                    </button>
                    <button className="rounded-2xl bg-[#153d32] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" onClick={onConfirm} disabled={busy}>
                        Confirm Transfer
                    </button>
                </div>
            </div>
        </div>
    );
}

function HistoryTable({ title, rows, kind }) {
    return (
        <div className="overflow-hidden rounded-[26px] border border-[#e7dfcf] bg-white shadow-[0_12px_30px_rgba(104,85,45,0.05)]">
            <div className="border-b border-[#eee5d4] px-5 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">{title}</div>
            </div>
            <div className="max-h-[360px] overflow-auto">
                {rows.length === 0 ? (
                    <div className="px-5 py-10 text-sm text-[#627168]">No records yet.</div>
                ) : rows.map((row) => (
                    <div key={row.id} className="border-b border-[#f1e9d8] px-5 py-4 last:border-b-0">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-sm font-semibold text-[#18231d]">
                                    {kind === 'payouts' ? row.status : row.type}
                                </div>
                                <div className="mt-1 text-xs leading-5 text-[#627168]">
                                    {kind === 'payouts'
                                        ? `${row.bankName} - ${row.accountNumber}`
                                        : row.reference}
                                </div>
                            </div>
                            <div className={`text-sm font-bold ${row.amount < 0 ? 'text-red-700' : 'text-[#153d32]'}`}>
                                {row.amountDisplay}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
