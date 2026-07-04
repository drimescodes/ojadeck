import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Orders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getOrders()
            .then(setOrders)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const formatDate = (timestamp) => {
        if (!timestamp) return '—';
        const d = new Date(typeof timestamp === 'number' ? timestamp * 1000 : timestamp);
        return d.toLocaleDateString('en-NG', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };
    const recentActivity = orders.slice(0, 4).map((order) => getOrderActivity(order, formatDate));

    return (
        <div className="space-y-8">
            <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                    Orders
                </div>
                <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.05em] text-[#18231d]">
                    Order Stream
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[#627168]">
                    Every order confirmed by the assistant appears here with payment status, customer details, and timing.
                </p>
            </div>

            {loading ? (
                <OrdersSkeleton />
            ) : orders.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-[#d8cfbc] bg-[#fbf8f2] px-6 py-16 text-center">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">No Orders Yet</div>
                    <h3 className="mt-4 text-3xl font-bold tracking-[-0.04em] text-[#1a2a22]">Waiting for your first sale</h3>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[#627168]">
                        Orders will land here when customers move from product chat to payment through WhatsApp.
                    </p>
                </div>
            ) : (
                <>
                    <section className="rounded-[26px] border border-[#e7dfcf] bg-white p-5 shadow-[0_12px_30px_rgba(104,85,45,0.05)] md:p-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                                    Recent Activity
                                </div>
                                <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#18231d]">
                                    Payment path visibility
                                </h2>
                            </div>
                            <p className="max-w-sm text-sm leading-6 text-[#627168]">
                                Each order shows the Nomba path from checkout link to signed webhook confirmation.
                            </p>
                        </div>

                        <div className="mt-5 grid gap-3 lg:grid-cols-2">
                            {recentActivity.map((activity) => (
                                <div key={activity.id} className={`rounded-2xl border px-4 py-4 ${activity.containerClass}`}>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex min-w-0 gap-3">
                                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${activity.iconClass}`}>
                                                {activity.icon}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold text-[#18231d]">{activity.title}</div>
                                                <p className="mt-1 text-sm leading-6 text-[#627168]">{activity.description}</p>
                                                <div className="mt-2 text-xs font-semibold text-[#7b6b48]">
                                                    {activity.customer} · {activity.time}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-sm font-extrabold text-[#153d32]">
                                            {activity.amount}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="overflow-hidden rounded-[28px] border border-[#e7dfcf] bg-white shadow-[0_12px_30px_rgba(104,85,45,0.05)]">
                        <div className="overflow-x-auto">
                            <table className="min-w-[1120px] divide-y divide-[#eee5d4]">
                                <thead className="bg-[#f7f1e4]">
                                    <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                                        <th className="px-5 py-4">Customer</th>
                                        <th className="px-5 py-4">Items</th>
                                        <th className="px-5 py-4">Amount</th>
                                        <th className="px-5 py-4">Status</th>
                                        <th className="px-5 py-4">Payment Timeline</th>
                                        <th className="px-5 py-4">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#f1e9d8]">
                                    {orders.map((order) => (
                                        <tr key={order.id} className="align-top">
                                            <td className="px-5 py-4">
                                                <div className="font-semibold text-[#18231d]">{order.customer.name}</div>
                                                <div className="mt-1 text-sm text-[#6b756e]">{order.customer.phone}</div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="space-y-1">
                                                    {order.items.map((item, i) => (
                                                        <div key={i} className="text-sm leading-6 text-[#31453b]">
                                                            {item.name} ×{item.qty}
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-base font-bold text-[#153d32]">
                                                {order.totalDisplay}
                                            </td>
                                            <td className="px-5 py-4">
                                                <StatusPill status={order.status} />
                                            </td>
                                            <td className="px-5 py-4">
                                                <PaymentTimeline order={order} formatDate={formatDate} />
                                            </td>
                                            <td className="px-5 py-4 text-sm text-[#6b756e]">
                                                {formatDate(order.createdAt)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function OrdersSkeleton() {
    return (
        <div className="space-y-5">
            <section className="rounded-[26px] border border-[#e7dfcf] bg-white p-5 shadow-[0_12px_30px_rgba(104,85,45,0.05)] md:p-6">
                <div className="skeleton h-3 w-32 rounded-full" />
                <div className="skeleton mt-3 h-7 w-64 rounded-xl" />
                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    {[0, 1, 2, 3].map((item) => (
                        <div key={item} className="rounded-2xl border border-[#eee5d4] px-4 py-4">
                            <div className="flex gap-3">
                                <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
                                <div className="min-w-0 flex-1">
                                    <div className="skeleton h-4 w-40 rounded-full" />
                                    <div className="skeleton mt-3 h-3 w-full rounded-full" />
                                    <div className="skeleton mt-2 h-3 w-2/3 rounded-full" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <div className="overflow-hidden rounded-[28px] border border-[#e7dfcf] bg-white shadow-[0_12px_30px_rgba(104,85,45,0.05)]">
                <div className="grid grid-cols-5 gap-4 bg-[#f7f1e4] px-5 py-4">
                    {[0, 1, 2, 3, 4].map((item) => (
                        <div key={item} className="skeleton h-3 rounded-full" />
                    ))}
                </div>
                <div className="divide-y divide-[#f1e9d8]">
                    {[0, 1, 2, 3].map((row) => (
                        <div key={row} className="grid grid-cols-5 gap-4 px-5 py-5">
                            <div className="space-y-2">
                                <div className="skeleton h-4 w-28 rounded-full" />
                                <div className="skeleton h-3 w-20 rounded-full" />
                            </div>
                            <div className="space-y-2">
                                <div className="skeleton h-3 w-32 rounded-full" />
                                <div className="skeleton h-3 w-24 rounded-full" />
                            </div>
                            <div className="skeleton h-5 w-20 rounded-full" />
                            <div className="skeleton h-6 w-16 rounded-full" />
                            <div className="space-y-2">
                                <div className="skeleton h-3 w-44 rounded-full" />
                                <div className="skeleton h-3 w-36 rounded-full" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function StatusPill({ status }) {
    return (
        <span
            className={[
                'rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
                status === 'paid'
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                    : status === 'pending'
                        ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                        : status === 'cancelled'
                            ? 'bg-slate-50 text-slate-600 ring-1 ring-slate-200'
                            : 'bg-red-50 text-red-700 ring-1 ring-red-200',
            ].join(' ')}
        >
            {status}
        </span>
    );
}

function getTimelineSteps(order, formatDate) {
    const paid = order.status === 'paid';
    const cancelled = order.status === 'cancelled';
    const failed = order.status === 'failed';

    return [
        {
            label: 'Order created',
            detail: 'Assistant captured customer intent',
            state: 'done',
            time: formatDate(order.createdAt),
        },
        {
            label: 'Checkout link',
            detail: order.checkoutUrl ? 'Nomba Checkout link sent' : 'Payment link not available',
            state: order.checkoutUrl ? 'done' : failed ? 'failed' : 'pending',
            time: order.checkoutUrl ? formatDate(order.createdAt) : null,
        },
        {
            label: paid ? 'Webhook verified' : cancelled ? 'Order cancelled' : failed ? 'Payment failed' : 'Awaiting payment',
            detail: paid
                ? 'Signature, amount, and reference matched'
                : cancelled
                    ? 'Old pending link was replaced'
                    : failed
                        ? 'Checkout could not complete'
                        : 'Waiting for Nomba payment event',
            state: paid ? 'done' : cancelled ? 'muted' : failed ? 'failed' : 'pending',
            time: paid ? formatDate(order.paidAt) : null,
        },
        {
            label: 'Wallet credit',
            detail: paid ? 'Merchant balance updated' : 'Posts after paid webhook',
            state: paid ? 'done' : cancelled ? 'muted' : failed ? 'failed' : 'pending',
            time: paid ? formatDate(order.paidAt) : null,
        },
    ];
}

function PaymentTimeline({ order, formatDate }) {
    const steps = getTimelineSteps(order, formatDate);

    return (
        <div className="min-w-[280px] space-y-2">
            {steps.map((step) => (
                <div key={step.label} className="flex items-start gap-2">
                    <div
                        className={[
                            'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                            step.state === 'done'
                                ? 'bg-[#1f9d63]'
                                : step.state === 'failed'
                                    ? 'bg-red-500'
                                    : step.state === 'muted'
                                        ? 'bg-slate-300'
                                        : 'bg-[#d2bd87]',
                        ].join(' ')}
                    />
                    <div>
                        <div className="text-xs font-bold text-[#294136]">{step.label}</div>
                        <div className="mt-0.5 text-xs leading-5 text-[#6b756e]">
                            {step.detail}{step.time ? ` · ${step.time}` : ''}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function getOrderActivity(order, formatDate) {
    if (order.status === 'paid') {
        return {
            id: `${order.id}-paid`,
            icon: '✓',
            title: 'Payment confirmed',
            description: 'Signed Nomba webhook matched this order and credited the merchant wallet.',
            customer: order.customer.name,
            amount: order.totalDisplay,
            time: formatDate(order.paidAt),
            containerClass: 'border-emerald-200 bg-emerald-50/70',
            iconClass: 'bg-[#1f9d63] text-white',
        };
    }

    if (order.status === 'pending') {
        return {
            id: `${order.id}-pending`,
            icon: '↗',
            title: 'Checkout link active',
            description: order.checkoutUrl ? 'Customer has a Nomba Checkout link and payment is still pending.' : 'Order is pending checkout link creation.',
            customer: order.customer.name,
            amount: order.totalDisplay,
            time: formatDate(order.createdAt),
            containerClass: 'border-amber-200 bg-amber-50/70',
            iconClass: 'bg-[#b88427] text-white',
        };
    }

    if (order.status === 'cancelled') {
        return {
            id: `${order.id}-cancelled`,
            icon: '×',
            title: 'Pending link cancelled',
            description: 'A newer order replaced this pending checkout link in the conversation.',
            customer: order.customer.name,
            amount: order.totalDisplay,
            time: formatDate(order.createdAt),
            containerClass: 'border-slate-200 bg-slate-50',
            iconClass: 'bg-slate-500 text-white',
        };
    }

    return {
        id: `${order.id}-failed`,
        icon: '!',
        title: 'Checkout failed',
        description: 'OjaDeck could not complete the payment-link flow for this order.',
        customer: order.customer.name,
        amount: order.totalDisplay,
        time: formatDate(order.createdAt),
        containerClass: 'border-red-200 bg-red-50/70',
        iconClass: 'bg-red-600 text-white',
    };
}
