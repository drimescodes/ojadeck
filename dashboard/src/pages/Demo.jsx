import { Link } from 'react-router-dom';
import OjaDeckLogo from '../components/OjaDeckLogo';

const demoVideoUrl = '/demo-media/ojadeck-demo.mp4';

export default function Demo() {
    return (
        <div className="min-h-screen bg-[#f7f3ea] text-[#18231d]">
            <header className="border-b border-[#e7dfcf] bg-[#f7f3ea]/95">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
                    <Link to="/" className="flex items-center gap-2.5">
                        <OjaDeckLogo className="h-9 w-9 shrink-0" />
                        <span className="text-xl font-extrabold tracking-[-0.04em]">
                            Oja<span className="text-[#1f9d63]">Deck</span>
                        </span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Link
                            to="/login"
                            className="rounded-xl px-3 py-2 text-sm font-semibold text-[#41544a] transition hover:text-[#153d32]"
                        >
                            Log in
                        </Link>
                        <Link
                            to="/dashboard"
                            className="rounded-xl bg-[#153d32] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(21,61,50,0.18)] transition hover:bg-[#1b4a3d]"
                        >
                            Open app
                        </Link>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
                <section className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
                    <div>
                        <div className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#7b6b48]">
                            Hackathon demo
                        </div>
                        <h1 className="mt-4 max-w-xl text-4xl font-black leading-[0.95] tracking-[-0.06em] text-[#18231d] md:text-6xl">
                            Watch OjaDeck run a WhatsApp sale end to end.
                        </h1>
                        <p className="mt-5 max-w-xl text-base leading-8 text-[#627168] md:text-lg">
                            The demo follows a merchant from catalogue setup to AI-assisted WhatsApp selling, Nomba checkout, signed payment confirmation, wallet credit, and payout.
                        </p>
                        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                            <Link
                                to="/register"
                                className="inline-flex items-center justify-center rounded-2xl bg-[#153d32] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(21,61,50,0.2)] transition hover:bg-[#1b4a3d]"
                            >
                                Create test merchant
                            </Link>
                            <a
                                href={demoVideoUrl}
                                download
                                className="inline-flex items-center justify-center rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-5 py-3 text-sm font-semibold text-[#294136] transition hover:border-[#b8ad98]"
                            >
                                Download video
                            </a>
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-[#e7dfcf] bg-[#fffdf8] p-3 shadow-[0_24px_70px_rgba(21,35,29,0.14)]">
                        <video
                            className="aspect-video w-full rounded-[20px] bg-[#15231d] object-cover"
                            controls
                            playsInline
                            preload="metadata"
                            poster="/og-image.jpg"
                        >
                            <source src={demoVideoUrl} type="video/mp4" />
                            Your browser cannot play this video. Use the download link below.
                        </video>
                    </div>
                </section>

                <section className="mt-8 grid gap-3 md:grid-cols-3">
                    {[
                        ['01', 'WhatsApp storefront', 'Customers chat normally while the assistant uses the merchant catalogue and tone settings.'],
                        ['02', 'Nomba payment path', 'Confirmed orders become hosted checkout links, then signed webhooks update the order and wallet.'],
                        ['03', 'Merchant payout', 'The wallet shows available balance, fees, ledger activity, and live transfer submission.'],
                    ].map(([num, title, body]) => (
                        <article key={num} className="rounded-[22px] border border-[#e7dfcf] bg-[#fffdf8] p-5">
                            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7b6b48]">{num}</div>
                            <h2 className="mt-3 text-xl font-extrabold tracking-[-0.04em] text-[#18231d]">{title}</h2>
                            <p className="mt-2 text-sm leading-7 text-[#627168]">{body}</p>
                        </article>
                    ))}
                </section>
            </main>
        </div>
    );
}
