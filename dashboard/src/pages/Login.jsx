import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import OjaDeckLogo from '../components/OjaDeckLogo';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const data = await api.login({ email, password });
            localStorage.removeItem('token');
            localStorage.setItem('seller', JSON.stringify(data.seller));
            queryClient.clear();
            navigate('/');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center px-4 py-8">
            <div className="grid w-full max-w-6xl overflow-hidden rounded-[34px] border border-[#e4dccb] bg-[#fffdf8]/96 shadow-[0_32px_110px_rgba(92,70,32,0.12)] backdrop-blur lg:grid-cols-[1.1fr_0.9fr]">
                <div className="hidden bg-[#143a2f] p-10 text-white lg:flex lg:flex-col">
                    <div className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/80">
                        Merchant Console
                    </div>
                    <h1 className="mt-8 max-w-lg text-5xl font-extrabold leading-[1.02] tracking-[-0.06em]">
                        Keep sales moving while the bot handles the front line.
                    </h1>
                    <p className="mt-6 max-w-lg text-base leading-8 text-emerald-50/76">
                        Connect your business WhatsApp, publish your catalogue, collect payments, and step in only when a conversation needs you.
                    </p>
                    <div className="mt-auto grid gap-4 pt-12">
                        <div className="rounded-[24px] border border-white/10 bg-white/6 p-5">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100/60">Channel</div>
                            <div className="mt-2 text-xl font-semibold">WhatsApp-native selling</div>
                            <p className="mt-2 text-sm leading-7 text-emerald-50/72">
                                Customers stay in chat. Merchants keep a clear operational view.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-[20px] border border-white/10 bg-black/10 p-4">
                                <div className="text-2xl font-bold text-[#9ae6b4]">AI</div>
                                <div className="mt-1 text-sm text-emerald-50/70">Guided conversations</div>
                            </div>
                            <div className="rounded-[20px] border border-white/10 bg-black/10 p-4">
                                <div className="text-2xl font-bold text-[#e7c06d]">Pay</div>
                                <div className="mt-1 text-sm text-emerald-50/70">Checkout links</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 sm:p-8 lg:p-10">
                    <div className="mx-auto w-full max-w-md">
                        <div className="flex items-center gap-3">
                            <OjaDeckLogo className="h-10 w-10 shrink-0" />
                            <div className="text-2xl font-extrabold tracking-[-0.04em] text-[#18231d]">
                                Oja<span className="text-[#1f9d63]">Deck</span>
                            </div>
                        </div>
                        <h2 className="mt-6 text-4xl font-extrabold tracking-[-0.05em] text-[#18231d]">
                            Welcome back
                        </h2>
                        <p className="mt-3 text-sm leading-7 text-[#5f6f67]">
                            Sign in to manage your WhatsApp sales assistant, catalogue, and payment flow.
                        </p>

                        {error && (
                            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-[#294136]">Email</label>
                                <input
                                    type="email"
                                    className="w-full rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-4 py-3 text-sm text-[#18231d] outline-none transition placeholder:text-[#8b8f83] focus:border-[#1f9d63] focus:ring-4 focus:ring-[#1f9d63]/10"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@business.com"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-[#294136]">Password</label>
                                <input
                                    type="password"
                                    className="w-full rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-4 py-3 text-sm text-[#18231d] outline-none transition placeholder:text-[#8b8f83] focus:border-[#1f9d63] focus:ring-4 focus:ring-[#1f9d63]/10"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full rounded-2xl bg-[#153d32] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(21,61,50,0.18)] transition hover:bg-[#1b4a3d] disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={loading}
                            >
                                {loading ? 'Signing in...' : 'Sign In'}
                            </button>
                        </form>

                        <div className="mt-6 text-sm text-[#64746d]">
                            Don&apos;t have an account?{' '}
                            <Link className="font-semibold text-[#1f9d63] hover:text-[#14724a]" to="/register">
                                Register
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
