import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export default function Register() {
    const [form, setForm] = useState({ email: '', password: '', businessName: '', personalPhone: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const data = await api.register(form);
            localStorage.setItem('seller', JSON.stringify(data.seller));
            queryClient.clear();
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center px-4 py-8">
            <div className="grid w-full max-w-6xl overflow-hidden rounded-[34px] border border-[#e4dccb] bg-[#fffdf8]/96 shadow-[0_32px_110px_rgba(92,70,32,0.12)] backdrop-blur lg:grid-cols-[0.92fr_1.08fr]">
                <div className="hidden bg-[#ede5d6] p-10 lg:flex lg:flex-col">
                    <div className="inline-flex w-fit items-center rounded-full border border-[#d7ccb7] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#385347]">
                        Commerce Setup
                    </div>
                    <h1 className="mt-8 max-w-lg text-5xl font-extrabold leading-[1.02] tracking-[-0.06em] text-[#143a2f]">
                        Turn a WhatsApp number into a payment-ready sales desk.
                    </h1>
                    <p className="mt-6 max-w-lg text-base leading-8 text-[#54655d]">
                        Create your merchant workspace, plug in your catalogue, and let the bot handle routine product questions while you focus on closing.
                    </p>
                    <div className="mt-auto space-y-4 pt-12">
                        <div className="rounded-[24px] border border-white/80 bg-white/80 p-5 shadow-sm">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7b6b48]">What you get</div>
                            <ul className="mt-3 space-y-3 text-sm leading-7 text-[#31453b]">
                                <li>AI replies tuned to your catalogue</li>
                                <li>Payment-link generation inside chat</li>
                                <li>Manual pause and unlink controls for the merchant</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="p-6 sm:p-8 lg:p-10">
                    <div className="mx-auto w-full max-w-md">
                        <div className="inline-flex items-center rounded-full border border-[#d8cfbc] bg-[#f4efe5] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#385347]">
                            OjaDeck
                        </div>
                        <h2 className="mt-6 text-4xl font-extrabold tracking-[-0.05em] text-[#18231d]">
                            Create your account
                        </h2>
                        <p className="mt-3 text-sm leading-7 text-[#5f6f67]">
                            Set up your merchant profile and connect the bot to your business WhatsApp.
                        </p>

                        {error && (
                            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-[#294136]">Business Name</label>
                                <input
                                    type="text"
                                    name="businessName"
                                    className="w-full rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-4 py-3 text-sm text-[#18231d] outline-none transition placeholder:text-[#8b8f83] focus:border-[#1f9d63] focus:ring-4 focus:ring-[#1f9d63]/10"
                                    value={form.businessName}
                                    onChange={handleChange}
                                    placeholder="e.g. Ada's Kitchen"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-[#294136]">Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    className="w-full rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-4 py-3 text-sm text-[#18231d] outline-none transition placeholder:text-[#8b8f83] focus:border-[#1f9d63] focus:ring-4 focus:ring-[#1f9d63]/10"
                                    value={form.email}
                                    onChange={handleChange}
                                    placeholder="you@business.com"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-[#294136]">Password</label>
                                <input
                                    type="password"
                                    name="password"
                                    className="w-full rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-4 py-3 text-sm text-[#18231d] outline-none transition placeholder:text-[#8b8f83] focus:border-[#1f9d63] focus:ring-4 focus:ring-[#1f9d63]/10"
                                    value={form.password}
                                    onChange={handleChange}
                                    placeholder="Minimum 8 characters"
                                    required
                                    minLength={8}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-[#294136]">Personal WhatsApp Number</label>
                                <input
                                    type="tel"
                                    name="personalPhone"
                                    className="w-full rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-4 py-3 text-sm text-[#18231d] outline-none transition placeholder:text-[#8b8f83] focus:border-[#1f9d63] focus:ring-4 focus:ring-[#1f9d63]/10"
                                    value={form.personalPhone}
                                    onChange={handleChange}
                                    placeholder="+234..."
                                />
                                <p className="text-xs leading-6 text-[#6d776f]">
                                    Used for merchant alerts and escalations when the bot needs human attention.
                                </p>
                            </div>
                            <button
                                type="submit"
                                className="w-full rounded-2xl bg-[#153d32] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(21,61,50,0.18)] transition hover:bg-[#1b4a3d] disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={loading}
                            >
                                {loading ? 'Creating account...' : 'Create Account'}
                            </button>
                        </form>

                        <div className="mt-6 text-sm text-[#64746d]">
                            Already have an account?{' '}
                            <Link className="font-semibold text-[#1f9d63] hover:text-[#14724a]" to="/login">
                                Sign In
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
