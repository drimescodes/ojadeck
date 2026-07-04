import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { queryKeys } from '../query';

export default function Dashboard() {
    const { data: stats } = useQuery({
        queryKey: queryKeys.orderStats,
        queryFn: api.getOrderStats,
    });
    const { data: profile } = useQuery({
        queryKey: queryKeys.whatsappStatus,
        queryFn: api.getWhatsAppStatus,
        refetchInterval: 15000,
    });
    const seller = JSON.parse(localStorage.getItem('seller') || '{}');

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
                    <div className="mt-4 flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${profile?.status === 'connected' ? 'bg-[#1f9d63]' : 'bg-[#b88427]'}`} />
                        <div className="text-lg font-semibold text-[#1a2a22]">
                            {profile?.status === 'connected'
                                ? (profile?.autoReplyEnabled === false ? 'Connected, auto-replies paused' : 'Connected and live')
                                : 'Not connected'}
                        </div>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[#627168]">
                        {profile?.status === 'connected'
                            ? profile?.autoReplyEnabled === false
                                ? 'Customers can still message the number, but the assistant is currently silent until you resume it.'
                                : 'Customers can message your number right now and receive automated product and payment guidance.'
                            : 'Connect your business number to activate WhatsApp sales flows and payment-link delivery.'}
                    </p>
                </div>
            </section>

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
                        Quick Start
                    </div>
                    <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#18231d]">
                        Next operator steps
                    </h2>
                    <ol className="mt-5 space-y-4">
                        {[
                            'Add products with clean names, prices, and stock states.',
                            'Keep WhatsApp linked and test a full customer chat from greeting to payment.',
                            'Pause auto-replies only when you want to take over manually.',
                        ].map((item, index) => (
                            <li key={item} className="flex gap-4 rounded-2xl border border-[#efe8d8] bg-[#fffcf6] px-4 py-4">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#153d32] text-sm font-bold text-white">
                                    {index + 1}
                                </div>
                                <p className="text-sm leading-7 text-[#31453b]">{item}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>
        </div>
    );
}
