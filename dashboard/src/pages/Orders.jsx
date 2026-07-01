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
                <div className="flex justify-center py-16">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#d9d1bf] border-t-[#153d32]" />
                </div>
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
                        <table className="min-w-full divide-y divide-[#eee5d4]">
                            <thead className="bg-[#f7f1e4]">
                                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                                    <th className="px-5 py-4">Customer</th>
                                    <th className="px-5 py-4">Items</th>
                                    <th className="px-5 py-4">Amount</th>
                                    <th className="px-5 py-4">Status</th>
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
                                            <span
                                                className={[
                                                    'rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
                                                    order.status === 'paid'
                                                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                                        : order.status === 'pending'
                                                            ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                                                            : 'bg-red-50 text-red-700 ring-1 ring-red-200',
                                                ].join(' ')}
                                            >
                                                {order.status}
                                            </span>
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
