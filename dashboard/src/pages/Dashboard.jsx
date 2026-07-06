import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { queryKeys } from '../query';
import { QueryError } from '../components/ui';

export default function Dashboard() {
    const { data: stats, isError: statsError } = useQuery({
        queryKey: queryKeys.orderStats,
        queryFn: api.getOrderStats,
    });
    const { data: waStatus, isError: waStatusError } = useQuery({
        queryKey: queryKeys.whatsappStatus,
        queryFn: api.getWhatsAppStatus,
        refetchInterval: 15000,
    });
    const { data: profile } = useQuery({
        queryKey: queryKeys.profile,
        queryFn: api.getProfile,
    });
    const { data: products = [] } = useQuery({
        queryKey: queryKeys.products,
        queryFn: api.getProducts,
    });
    const { data: payouts = [] } = useQuery({
        queryKey: queryKeys.payouts,
        queryFn: api.getPayouts,
    });
    const seller = JSON.parse(localStorage.getItem('seller') || '{}');
    const hasSellableProduct = products.some((product) => product.inStock && product.price > 0);
    const whatsappReady = waStatus?.status === 'connected' && waStatus?.autoReplyEnabled !== false;
    const hasAiTraining = Boolean(profile?.aiTone || profile?.aiBusinessContext || profile?.aiInstructions);
    const hasTrackedOrder = Number(stats?.totalOrders || 0) > 0;
    const hasPaidOrder = Number(stats?.paidCount || 0) > 0;
    const hasPayout = payouts.some((payout) => ['processing', 'success'].includes(payout.status));

    const statCards = [
        {
            label: 'Total Orders',
            value: stats?.totalOrders ?? '—',
            tone: 'text-[#153d32]',
            hint: 'All conversations that converted into tracked orders',
        },
        {
            label: 'Paid Orders',
            value: stats?.paidCount ?? '—',
            tone: 'text-[#1f9d63]',
            hint: 'Orders confirmed by payment events',
        },
        {
            label: 'Pending',
            value: stats?.pendingCount ?? '—',
            tone: 'text-[#b88427]',
            hint: 'Customers still sitting on a payment link',
        },
        {
            label: 'Revenue',
            value: stats?.totalRevenueDisplay ?? '₦0',
            tone: 'text-[#153d32]',
            hint: 'Gross paid volume processed through the bot',
        },
    ];
    const launchChecklist = [
        {
            label: 'Add product',
            hint: 'One in-stock item with a live price.',
            done: hasSellableProduct,
            to: '/dashboard/catalogue',
        },
        {
            label: 'Connect WhatsApp',
            hint: 'Linked number with auto-replies active.',
            done: whatsappReady,
            to: '/dashboard/whatsapp',
        },
        {
            label: 'Train AI',
            hint: 'Tone, context, or rules saved.',
            done: hasAiTraining,
            to: '/dashboard/settings',
        },
        {
            label: 'Send test chat',
            hint: 'Customer chat creates a tracked order.',
            done: hasTrackedOrder,
            to: '/dashboard/orders',
        },
        {
            label: 'Receive payment',
            hint: 'Paid order credits the wallet.',
            done: hasPaidOrder,
            to: '/dashboard/wallet',
        },
        {
            label: 'Withdraw payout',
            hint: 'Live transfer submitted to bank.',
            done: hasPayout,
            to: '/dashboard/wallet',
        },
    ];

    return (
        <div className="space-y-8">
            <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
                <div className="rounded-[28px] bg-[#153d32] px-6 py-7 text-white shadow-[0_20px_60px_rgba(21,61,50,0.18)] md:px-8 md:py-8">
                    <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100/80">
                        Operations Snapshot
                    </div>
                    <h1 className="mt-5 text-4xl font-extrabold tracking-[-0.05em] md:text-5xl">
                        Welcome, {seller.businessName || 'Business'}
                    </h1>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50/76 md:text-base">
                        Your merchant cockpit shows live WhatsApp availability, payment conversion, and whether the bot is currently handling customer conversations automatically.
                    </p>
                </div>

                <div className="rounded-[28px] border border-[#e6decd] bg-[#fbf8f2] p-6 shadow-[0_16px_44px_rgba(98,79,38,0.06)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7a6b4a]">
                        WhatsApp Status
                    </div>
                    {waStatusError ? (
                        <div className="mt-4">
                            <QueryError message="Could not refresh WhatsApp status. The bot may still be running." />
                        </div>
                    ) : null}
                    <div className="mt-4 flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${waStatus?.status === 'connected' ? 'bg-[#1f9d63]' : 'bg-[#b88427]'}`} />
                        <div className="text-lg font-semibold text-[#1a2a22]">
                            {waStatus?.status === 'connected'
                                ? (waStatus?.autoReplyEnabled === false ? 'Connected, auto-replies paused' : 'Connected and live')
                                : 'Not connected'}
                        </div>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[#627168]">
                        {waStatus?.status === 'connected'
                            ? waStatus?.autoReplyEnabled === false
                                ? 'Customers can still message the number, but the assistant is currently silent until you resume it.'
                                : 'Customers can message your number right now and receive automated product and payment guidance.'
                            : 'Connect your business number to activate WhatsApp sales flows and payment-link delivery.'}
                    </p>
                </div>
            </section>

            {statsError ? (
                <QueryError message="Could not load order metrics. Refresh to try again." />
            ) : null}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {statCards.map((card) => (
                    <div key={card.label} className="rounded-[24px] border border-[#e7dfcf] bg-white px-5 py-5 shadow-[0_12px_30px_rgba(104,85,45,0.05)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                            {card.label}
                        </div>
                        <div className={`mt-3 text-4xl font-extrabold tracking-[-0.05em] ${card.tone}`}>
                            {card.value}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#6b756e]">
                            {card.hint}
                        </p>
                    </div>
                ))}
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-[26px] border border-[#e7dfcf] bg-[#fffdf8] p-6 shadow-[0_12px_28px_rgba(104,85,45,0.05)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                        Sales Loop
                    </div>
                    <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#18231d]">
                        What the assistant is built to do
                    </h2>
                    <div className="mt-5 grid gap-3">
                        {[
                            'Answer product questions using your catalogue',
                            'Guide customers through order confirmation',
                            'Send payment links directly in chat',
                            'Escalate edge cases back to you when needed',
                        ].map((item) => (
                            <div key={item} className="flex items-start gap-3 rounded-2xl bg-[#f5f0e5] px-4 py-3">
                                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[#1f9d63]" />
                                <p className="text-sm leading-7 text-[#31453b]">{item}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-[26px] border border-[#e7dfcf] bg-white p-6 shadow-[0_12px_28px_rgba(104,85,45,0.05)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                        Launch Checklist
                    </div>
                    <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#18231d]">
                        Judge-ready path
                    </h2>
                    <div className="mt-5 grid gap-3">
                        {launchChecklist.map((item) => (
                            <ChecklistItem key={item.label} item={item} />
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}

function ChecklistItem({ item }) {
    return (
        <Link
            to={item.to}
            className="flex items-center gap-3 rounded-2xl border border-[#efe8d8] bg-[#fffcf6] px-4 py-3 transition hover:border-[#d8cfbc] hover:bg-[#fbf6ec]"
        >
            <div
                className={[
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold',
                    item.done ? 'bg-[#1f9d63] text-white' : 'bg-[#f0e4cc] text-[#7b6b48]',
                ].join(' ')}
            >
                {item.done ? '✓' : '•'}
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-[#18231d]">{item.label}</div>
                <div className="mt-0.5 text-xs leading-5 text-[#6b756e]">{item.hint}</div>
            </div>
            <div className="text-xs font-bold text-[#7b6b48]">Open</div>
        </Link>
    );
}
