import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { queryKeys } from '../query';

export default function Orders() {
    const { data: orders = [], isLoading } = useQuery({
        queryKey: queryKeys.orders,
        queryFn: api.getOrders,
    });
    const loading = isLoading && orders.length === 0;

    const formatDate = (timestamp) => {
        if (!timestamp) return '—';
        const d = new Date(typeof timestamp === 'number' ? timestamp * 1000 : timestamp);
        return d.toLocaleDateString('en-NG', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };
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
                <div className="overflow-hidden rounded-[28px] border border-[#e7dfcf] bg-white shadow-[0_12px_30px_rgba(104,85,45,0.05)]">
                    <div className="overflow-x-auto">
                        <table className="min-w-[1160px] divide-y divide-[#eee5d4]">
                            <thead className="bg-[#f7f1e4]">
                                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                                    <th className="px-5 py-4">Customer</th>
                                    <th className="px-5 py-4">Items</th>
                                    <th className="px-5 py-4">Amount</th>
                                    <th className="px-5 py-4">Status</th>
                                    <th className="px-5 py-4">Order Tracker</th>
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
                                            <OrderTracker order={order} />
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
            )}
        </div>
    );
}

function OrdersSkeleton() {
    return (
        <div className="space-y-5">
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

function getTrackerSteps(order) {
    const paid = order.status === 'paid';
    const cancelled = order.status === 'cancelled';
    const failed = order.status === 'failed';
    const hasCheckout = Boolean(order.checkoutUrl);

    return [
        {
            label: 'Captured',
            state: 'done',
        },
        {
            label: 'Link sent',
            state: hasCheckout ? 'done' : failed ? 'failed' : 'pending',
        },
        {
            label: paid ? 'Paid' : cancelled ? 'Cancelled' : failed ? 'Failed' : 'Awaiting pay',
            state: paid ? 'done' : cancelled ? 'muted' : failed ? 'failed' : 'pending',
        },
        {
            label: 'Wallet credited',
            state: paid ? 'done' : cancelled ? 'muted' : failed ? 'failed' : 'pending',
        },
    ];
}

function OrderTracker({ order }) {
    const steps = getTrackerSteps(order);

    return (
        <div className="min-w-[420px]">
            <div className="flex items-start">
                {steps.map((step, index) => (
                    <div key={`${step.label}-${index}`} className="flex min-w-0 flex-1 items-start">
                        <div className="flex min-w-0 flex-col items-center text-center">
                            <div
                                className={[
                                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ring-4',
                                    step.state === 'done'
                                        ? 'bg-[#1f9d63] text-white ring-emerald-100'
                                        : step.state === 'failed'
                                            ? 'bg-red-600 text-white ring-red-100'
                                            : step.state === 'muted'
                                                ? 'bg-slate-300 text-slate-700 ring-slate-100'
                                                : 'bg-[#f4dfaa] text-[#7b5f22] ring-[#fbf3df]',
                                ].join(' ')}
                            >
                                {step.state === 'done' ? '✓' : step.state === 'failed' ? '!' : index + 1}
                            </div>
                            <div className="mt-2 w-24 text-[11px] font-bold leading-4 text-[#294136]">
                                {step.label}
                            </div>
                        </div>
                        {index < steps.length - 1 && (
                            <div
                                className={[
                                    'mx-1 mt-3 h-0.5 min-w-8 flex-1 rounded-full',
                                    steps[index + 1].state === 'done'
                                        ? 'bg-[#1f9d63]'
                                        : step.state === 'failed' || steps[index + 1].state === 'failed'
                                            ? 'bg-red-200'
                                            : 'bg-[#e8dcc5]',
                                ].join(' ')}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
