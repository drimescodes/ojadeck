import React from 'react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error('Dashboard render error', error, info);
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div className="flex min-h-screen items-center justify-center bg-[#f7f3ea] px-4 py-10">
                <div className="w-full max-w-md rounded-[28px] border border-[#e7dfcf] bg-[#fffdf8] p-6 text-center shadow-[0_20px_60px_rgba(21,35,29,0.12)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                        OjaDeck
                    </div>
                    <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.05em] text-[#18231d]">
                        Something went wrong
                    </h1>
                    <p className="mt-3 text-sm leading-7 text-[#627168]">
                        Reload the dashboard. If it keeps happening, contact support before continuing.
                    </p>
                    <button
                        className="mt-6 rounded-2xl bg-[#153d32] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(21,61,50,0.18)] transition hover:bg-[#1b4a3d]"
                        onClick={() => window.location.reload()}
                    >
                        Reload Dashboard
                    </button>
                </div>
            </div>
        );
    }
}
