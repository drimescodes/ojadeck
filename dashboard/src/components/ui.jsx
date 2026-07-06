export const inputClassName = 'w-full rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-4 py-3 text-sm text-[#18231d] outline-none transition placeholder:text-[#8b8f83] focus:border-[#1f9d63] focus:ring-4 focus:ring-[#1f9d63]/10';
export const primaryButtonClassName = 'rounded-2xl bg-[#153d32] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(21,61,50,0.18)] transition hover:bg-[#1b4a3d] disabled:cursor-not-allowed disabled:opacity-60';
export const secondaryButtonClassName = 'rounded-2xl border border-[#d8cfbc] bg-[#f8f4ec] px-5 py-3 text-sm font-semibold text-[#294136] transition hover:border-[#b8ac95] hover:bg-[#f1ebdf] disabled:cursor-not-allowed disabled:opacity-60';

const badgeTones = {
    success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    warn: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    danger: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    muted: 'bg-slate-50 text-slate-600 ring-1 ring-slate-200',
};

export function Badge({ tone = 'muted', children }) {
    return (
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${badgeTones[tone] || badgeTones.muted}`}>
            {children}
        </span>
    );
}

export function QueryError({ message = 'Could not load this view. Please retry.' }) {
    return (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {message}
        </div>
    );
}
