import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { queryKeys } from '../query';

export default function Settings() {
    const queryClient = useQueryClient();
    const [form, setForm] = useState({
        businessName: '',
        personalPhone: '',
        aiTone: '',
        aiBusinessContext: '',
        aiInstructions: '',
    });
    const [saved, setSaved] = useState(false);
    const { data: profile } = useQuery({
        queryKey: queryKeys.profile,
        queryFn: api.getProfile,
    });
    const updateProfileMutation = useMutation({
        mutationFn: api.updateProfile,
    });

    useEffect(() => {
        if (!profile) return;
        setForm({
            businessName: profile.businessName || '',
            personalPhone: profile.personalPhone || '',
            aiTone: profile.aiTone || '',
            aiBusinessContext: profile.aiBusinessContext || '',
            aiInstructions: profile.aiInstructions || '',
        });
    }, [profile]);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSave = async (e) => {
        e.preventDefault();
        setSaved(false);

        try {
            await updateProfileMutation.mutateAsync(form);
            queryClient.setQueryData(queryKeys.profile, (current) => ({
                ...current,
                ...form,
            }));
            const seller = JSON.parse(localStorage.getItem('seller') || '{}');
            seller.businessName = form.businessName;
            seller.personalPhone = form.personalPhone;
            localStorage.setItem('seller', JSON.stringify(seller));
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            alert(err.message);
        }
    };

    const loading = updateProfileMutation.isPending;

    return (
        <div className="space-y-8">
            <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                    Settings
                </div>
                <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.05em] text-[#18231d]">
                    Business Profile
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[#627168]">
                    Configure how the assistant introduces the business and where merchant notifications should go.
                </p>
            </div>

            <div className="max-w-3xl rounded-[28px] border border-[#e7dfcf] bg-white p-6 shadow-[0_12px_30px_rgba(104,85,45,0.05)] md:p-7">
                <form onSubmit={handleSave} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-[#294136]">Business Name</label>
                        <input
                            className="w-full rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-4 py-3 text-sm text-[#18231d] outline-none transition placeholder:text-[#8b8f83] focus:border-[#1f9d63] focus:ring-4 focus:ring-[#1f9d63]/10"
                            name="businessName"
                            value={form.businessName}
                            onChange={handleChange}
                            placeholder="Your business name"
                        />
                        <p className="text-xs leading-6 text-[#6d776f]">
                            This is the business identity the assistant uses in first-contact replies.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-[#294136]">Personal WhatsApp Number</label>
                        <input
                            className="w-full rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-4 py-3 text-sm text-[#18231d] outline-none transition placeholder:text-[#8b8f83] focus:border-[#1f9d63] focus:ring-4 focus:ring-[#1f9d63]/10"
                            name="personalPhone"
                            value={form.personalPhone}
                            onChange={handleChange}
                            placeholder="+234..."
                        />
                        <p className="text-xs leading-6 text-[#6d776f]">
                            Used for merchant notifications and escalation alerts when the bot hands a conversation back to you.
                        </p>
                    </div>
                    <div className="border-t border-[#eee5d4] pt-6">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                            Train AI
                        </div>
                        <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#18231d]">
                            Assistant style and business context
                        </h2>
                        <p className="mt-2 text-sm leading-7 text-[#627168]">
                            Shape how the assistant sounds, what it knows about the business, and the rules it should follow.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-[#294136]">Tone and Mannerisms</label>
                        <textarea
                            className="min-h-28 w-full resize-y rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-4 py-3 text-sm leading-7 text-[#18231d] outline-none transition placeholder:text-[#8b8f83] focus:border-[#1f9d63] focus:ring-4 focus:ring-[#1f9d63]/10"
                            name="aiTone"
                            value={form.aiTone}
                            onChange={handleChange}
                            maxLength={1200}
                            placeholder="e.g. Warm, confident, a little playful. Use Nigerian Pidgin only when the customer does."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-[#294136]">Business Context</label>
                        <textarea
                            className="min-h-32 w-full resize-y rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-4 py-3 text-sm leading-7 text-[#18231d] outline-none transition placeholder:text-[#8b8f83] focus:border-[#1f9d63] focus:ring-4 focus:ring-[#1f9d63]/10"
                            name="aiBusinessContext"
                            value={form.aiBusinessContext}
                            onChange={handleChange}
                            maxLength={2000}
                            placeholder="e.g. We deliver within Lagos, pickup is available in Yaba, and same-day delivery closes by 4pm."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-[#294136]">Rules and Preferences</label>
                        <textarea
                            className="min-h-32 w-full resize-y rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-4 py-3 text-sm leading-7 text-[#18231d] outline-none transition placeholder:text-[#8b8f83] focus:border-[#1f9d63] focus:ring-4 focus:ring-[#1f9d63]/10"
                            name="aiInstructions"
                            value={form.aiInstructions}
                            onChange={handleChange}
                            maxLength={2000}
                            placeholder="e.g. Always ask for delivery area before promising delivery. Escalate custom bulk requests."
                        />
                    </div>
                    <button
                        type="submit"
                        className="rounded-2xl bg-[#153d32] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(21,61,50,0.18)] transition hover:bg-[#1b4a3d] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={loading}
                    >
                        {loading ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
                    </button>
                </form>
            </div>
        </div>
    );
}
