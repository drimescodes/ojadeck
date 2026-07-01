import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Settings() {
    const [form, setForm] = useState({ businessName: '', personalPhone: '' });
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        api.getProfile().then((data) => {
            setForm({ businessName: data.businessName || '', personalPhone: data.personalPhone || '' });
        }).catch(() => { });
    }, []);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setSaved(false);

        try {
            await api.updateProfile(form);
            const seller = JSON.parse(localStorage.getItem('seller') || '{}');
            seller.businessName = form.businessName;
            seller.personalPhone = form.personalPhone;
            localStorage.setItem('seller', JSON.stringify(seller));
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

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

            <div className="max-w-2xl rounded-[28px] border border-[#e7dfcf] bg-white p-6 shadow-[0_12px_30px_rgba(104,85,45,0.05)] md:p-7">
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
