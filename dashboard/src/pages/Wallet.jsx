import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

export default function Wallet() {
    const [summary, setSummary] = useState(null);
    const [ledger, setLedger] = useState([]);
    const [payouts, setPayouts] = useState([]);
    const [banks, setBanks] = useState([]);
    const [bankForm, setBankForm] = useState({ bankCode: '', accountNumber: '', accountName: '', bankName: '' });
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [pendingPayout, setPendingPayout] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    const selectedBank = useMemo(
        () => banks.find((bank) => bank.code === bankForm.bankCode),
        [banks, bankForm.bankCode]
    );

    const loadWallet = async () => {
        const [summaryData, ledgerData, payoutData] = await Promise.all([
            api.getWalletSummary(),
            api.getWalletLedger(),
            api.getPayouts(),
        ]);
        setSummary(summaryData);
        setLedger(ledgerData);
        setPayouts(payoutData);
        if (summaryData.payoutAccount) {
            setBankForm({
                bankCode: summaryData.payoutAccount.bankCode,
                bankName: summaryData.payoutAccount.bankName,
                accountNumber: summaryData.payoutAccount.accountNumber,
                accountName: summaryData.payoutAccount.accountName,
            });
        }
    };

    useEffect(() => {
        Promise.all([
            loadWallet(),
            api.getBanks().then(setBanks).catch(() => setBanks([])),
        ])
            .catch((err) => setMessage(err.message))
            .finally(() => setLoading(false));
    }, []);

    const handleBankChange = (e) => {
        const { name, value } = e.target;
        if (name === 'bankCode') {
            const bank = banks.find((item) => item.code === value);
            setBankForm({ ...bankForm, bankCode: value, bankName: bank?.name || '', accountName: '' });
            return;
        }
        setBankForm({ ...bankForm, [name]: value });
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
            await loadWallet();
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
            await loadWallet();
        } catch (err) {
            setMessage(err.message);
        } finally {
            setBusy(false);
        }
    };

    const handleConfirmPayout = async () => {
        if (!pendingPayout) return;
        setBusy(true);
        setMessage('');
        try {
            await api.confirmPayout(pendingPayout.id);
            setPendingPayout(null);
            setWithdrawAmount('');
            await loadWallet();
            setMessage('Payout submitted to Nomba.');
        } catch (err) {
            setMessage(err.message);
            await loadWallet();
        } finally {
            setBusy(false);
        }
    };

    const statCards = [
        { label: 'Available Balance', value: summary?.availableBalanceDisplay || '₦0' },
        { label: 'Lifetime Credits', value: summary?.lifetimeCreditsDisplay || '₦0' },
        { label: 'Reserved Payouts', value: summary?.pendingPayoutsDisplay || '₦0' },
    ];

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#d9d1bf] border-t-[#153d32]" />
            </div>
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

            <section className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-[26px] border border-[#e7dfcf] bg-white p-6 shadow-[0_12px_30px_rgba(104,85,45,0.05)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">Payout Account</div>
                    <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#18231d]">Bank details</h2>
                    <div className="mt-5 grid gap-4">
                        <select
                            className="w-full rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-4 py-3 text-sm text-[#18231d] outline-none focus:border-[#1f9d63] focus:ring-4 focus:ring-[#1f9d63]/10"
                            name="bankCode"
                            value={bankForm.bankCode}
                            onChange={handleBankChange}
                        >
                            <option value="">Select bank</option>
                            {banks.map((bank) => (
                                <option key={bank.code} value={bank.code}>{bank.name}</option>
                            ))}
                        </select>
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
                            Transfers are live. You will confirm before money is sent.
                        </p>
                    </div>
                </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
                <HistoryTable title="Payout History" rows={payouts} kind="payouts" />
                <HistoryTable title="Ledger Activity" rows={ledger} kind="ledger" />
            </section>

            {pendingPayout && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#15231d]/45 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-[28px] border border-[#e8decc] bg-[#fffdf8] p-6 shadow-[0_24px_70px_rgba(21,35,29,0.18)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">Confirm Live Transfer</div>
                        <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#18231d]">{pendingPayout.amountDisplay}</h2>
                        <p className="mt-3 text-sm leading-7 text-[#627168]">
                            Send this payout to {pendingPayout.accountName} at {pendingPayout.bankName}, account {pendingPayout.accountNumber}.
                        </p>
                        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button className="rounded-2xl border border-[#d8cfbc] bg-[#f8f4ec] px-5 py-3 text-sm font-semibold text-[#294136]" onClick={() => setPendingPayout(null)} disabled={busy}>
                                Cancel
                            </button>
                            <button className="rounded-2xl bg-[#153d32] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" onClick={handleConfirmPayout} disabled={busy}>
                                Confirm Transfer
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
