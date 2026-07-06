import { Link } from 'react-router-dom';
import OjaDeckLogo from '../components/OjaDeckLogo';

const VISUALS = [
    {
        kicker: 'WhatsApp AI assistant',
        title: 'It replies, recommends, and sends the payment link',
        body: 'Customers ask in WhatsApp. OjaDeck answers with your catalogue, product photos, and a Nomba checkout preview they can trust.',
        image: '/landing/landing-chat.png',
        alt: 'OjaDeck WhatsApp assistant sending a Nomba checkout preview',
        wide: true,
        phone: true,
    },
    {
        kicker: 'Catalogue',
        title: 'Your products, priced and ready',
        body: 'Add names, prices, stock state, and photos once. The assistant only sells what is live.',
        image: '/landing/landing-catalogue.png',
        alt: 'OjaDeck merchant catalogue with food products and prices',
    },
    {
        kicker: 'Nomba checkout',
        title: 'Secure checkout without account-number back-and-forth',
        body: 'Each confirmed order gets a Nomba payment link. OjaDeck verifies the payment before marking the order as paid.',
        image: '/landing/landing-payments.png',
        alt: 'Nomba checkout and OjaDeck payment verification',
    },
    {
        kicker: 'Wallet & payouts',
        title: 'Track balance and cash out',
        body: 'Paid orders credit the wallet. Merchants see fees clearly and withdraw to a saved bank account.',
        image: '/landing/landing-wallet.png',
        alt: 'OjaDeck wallet balance and payout screen',
    },
];

const BIMPE = {
    name: 'Bímpé',
    description:
        'Celebration buddy for WhatsApp groups — automated birthday wishes, custom cards, flipbooks, and surprise voice calls. Trusted by 50+ groups.',
    whatsapp: 'https://wa.me/2348077826945',
};

export default function Landing() {
    return (
        <div className="min-h-screen text-[#18231d]">
            <SiteHeader />
            <main>
                <Hero />
                <HowItWorks />
                <ProductProof />
                <Businesses />
                <FinalCta />
            </main>
            <SiteFooter />
        </div>
    );
}

function SiteHeader() {
    return (
        <header className="sticky top-0 z-40 border-b border-[#e7dfcf]/80 bg-[#f7f3ea]/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 md:px-6">
                <Link to="/" className="flex items-center gap-2.5">
                    <OjaDeckLogo className="h-9 w-9 shrink-0" />
                    <span className="text-xl font-extrabold tracking-[-0.04em]">
                        Oja<span className="text-[#1f9d63]">Deck</span>
                    </span>
                </Link>
                <div className="flex items-center gap-2 sm:gap-3">
                    <a
                        href="#how"
                        className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-[#41544a] transition hover:text-[#153d32] sm:inline"
                    >
                        How it works
                    </a>
                    <Link
                        to="/login"
                        className="rounded-xl px-3 py-2 text-sm font-semibold text-[#41544a] transition hover:text-[#153d32]"
                    >
                        Log in
                    </Link>
                    <Link
                        to="/register"
                        className="rounded-xl bg-[#153d32] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(21,61,50,0.18)] transition hover:bg-[#1b4a3d]"
                    >
                        Get started
                    </Link>
                </div>
            </div>
        </header>
    );
}

function Hero() {
    return (
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 md:px-6 md:pb-24 md:pt-20">
            <div className="grid items-center gap-10 lg:grid-cols-[0.98fr_1.02fr] lg:gap-12">
                <div className="oja-rise">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#dfe7d9] bg-[#eef4ea] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6a4f]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#1f9d63]" />
                        AI WhatsApp commerce desk
                    </div>
                    <h1 className="mt-6 text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.055em] text-[#15221c] sm:text-6xl">
                        Run your WhatsApp store without living in the chat.
                    </h1>
                    <p className="mt-6 max-w-xl text-base leading-8 text-[#4c5c53] sm:text-lg">
                        OjaDeck answers customers, shares your catalogue, sends Nomba
                        checkout links, confirms payments, and tracks your money on the
                        WhatsApp number you already use.
                    </p>
                    <HeroFlow />
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                        <Link
                            to="/register"
                            className="rounded-2xl bg-[#153d32] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(21,61,50,0.22)] transition hover:bg-[#1b4a3d]"
                        >
                            Get started
                        </Link>
                        <a
                            href="#businesses"
                            className="rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-6 py-3.5 text-sm font-semibold text-[#294136] transition hover:border-[#c3b99f] hover:bg-[#fbf6ec]"
                        >
                            See live businesses
                        </a>
                    </div>
                    <p className="mt-6 text-sm text-[#6b756e]">
                        Built for Nigerian merchants · Payments secured by{' '}
                        <span className="font-semibold text-[#1a2a22]">Nomba</span>
                    </p>
                </div>

                <HeroVisual />
            </div>
        </section>
    );
}

const HERO_FLOW = ['Answers product questions', 'Creates checkout links', 'Tracks paid orders'];

function HeroFlow() {
    const last = HERO_FLOW.length - 1;
    return (
        <div className="mt-7 max-w-xl">
            <div className="hidden sm:block">
                <div className="flex items-center">
                    {HERO_FLOW.map((item, i) => (
                        <div key={item} className="contents">
                            <span className="h-3 w-3 shrink-0 rounded-full bg-[#1f9d63] ring-4 ring-[#1f9d63]/12" />
                            {i < last && (
                                <span className="mx-1.5 h-0 flex-1 border-t-2 border-dotted border-[#c7bca3]" />
                            )}
                        </div>
                    ))}
                </div>
                <div className="mt-3 flex gap-3">
                    {HERO_FLOW.map((item, i) => (
                        <span
                            key={item}
                            className={[
                                'flex-1 whitespace-nowrap text-[13px] font-bold leading-5 text-[#294136]',
                                i === 0 ? 'text-left' : i === last ? 'text-right' : 'text-center',
                            ].join(' ')}
                        >
                            {item}
                        </span>
                    ))}
                </div>
            </div>

            <div className="sm:hidden">
                {HERO_FLOW.map((item, i) => (
                    <div key={item} className="flex gap-3">
                        <div className="flex flex-col items-center">
                            <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-[#1f9d63] ring-4 ring-[#1f9d63]/12" />
                            {i < last && <span className="my-1 w-0 flex-1 border-l-2 border-dotted border-[#c7bca3]" />}
                        </div>
                        <span className="pb-4 text-sm font-bold leading-5 text-[#294136]">{item}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function HeroVisual() {
    return (
        <div className="oja-rise flex justify-center">
            <img
                src="/landing/landing-chat.png"
                alt="OjaDeck WhatsApp assistant sending a secure Nomba checkout preview"
                className="oja-float w-full max-w-[300px]"
            />
        </div>
    );
}

function HowItWorks() {
    const steps = [
        ['Add your catalogue', 'List products with prices, photos, and stock state.'],
        ['Connect WhatsApp', 'Scan once and keep selling on the number customers already know.'],
        ['Let AI reply', 'OjaDeck answers questions, confirms orders, and sends a Nomba checkout link.'],
        ['Get paid and withdraw', 'Paid orders credit the wallet, then you cash out to your bank.'],
    ];

    return (
        <section id="how" className="border-y border-[#e7dfcf] bg-[#fbf8f2]">
            <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
                <SectionHead
                    kicker="How it works"
                    title="From first message to money in the bank"
                    sub="Four steps to set up. After that, OjaDeck handles the front line while you run the business."
                />
                <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {steps.map(([title, body], i) => (
                        <li
                            key={title}
                            className="rounded-[24px] border border-[#e7dfcf] bg-white p-6 shadow-[0_12px_30px_rgba(104,85,45,0.05)]"
                        >
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#153d32] text-base font-extrabold text-[#9ae6b4]">
                                {i + 1}
                            </div>
                            <h3 className="mt-5 text-lg font-bold tracking-[-0.02em] text-[#18231d]">
                                {title}
                            </h3>
                            <p className="mt-2 text-sm leading-7 text-[#5f6f67]">{body}</p>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}

function ProductProof() {
    return (
        <section className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
            <SectionHead
                kicker="The product"
                title="Everything your store runs on"
                sub="The customer sees WhatsApp and Nomba. The merchant sees catalogue, orders, wallet, and payout controls."
            />
            <div className="mt-12 grid gap-5">
                {VISUALS.map((visual) => (
                    <VisualCard key={visual.title} visual={visual} />
                ))}
            </div>
        </section>
    );
}

function VisualCard({ visual }) {
    return (
        <article
            className={[
                'grid items-center gap-7 rounded-[28px] border border-[#e7dfcf] bg-[#fffdf8] p-5 shadow-[0_16px_44px_rgba(98,79,38,0.06)] md:p-7',
                visual.wide ? 'lg:grid-cols-[0.82fr_1.18fr]' : 'lg:grid-cols-[0.9fr_1.1fr]',
            ].join(' ')}
        >
            <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7b6b48]">
                    {visual.kicker}
                </div>
                <h3 className="mt-3 text-2xl font-extrabold tracking-[-0.035em] text-[#18231d] sm:text-[1.7rem]">
                    {visual.title}
                </h3>
                <p className="mt-3 max-w-md text-sm leading-7 text-[#5f6f67]">{visual.body}</p>
            </div>
            <img
                src={visual.image}
                alt={visual.alt}
                loading="lazy"
                className={
                    visual.phone
                        ? 'mx-auto w-full max-w-[280px]'
                        : 'w-full rounded-[24px] border border-[#e7dfcf] bg-[#fbf8f2] shadow-[0_18px_44px_rgba(100,78,38,0.08)]'
                }
            />
        </article>
    );
}

function Businesses() {
    return (
        <section id="businesses" className="border-y border-[#e7dfcf] bg-[#fbf8f2]">
            <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
                <SectionHead
                    kicker="On OjaDeck"
                    title="Businesses already selling with OjaDeck"
                    sub="Real merchants running their WhatsApp storefront on OjaDeck today."
                />
                <div className="mt-10 flex snap-x gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <BusinessCard business={BIMPE} />
                </div>
                <p className="mt-5 text-sm text-[#6b756e]">
                    Want to be featured here? Opt in from your dashboard after your first sale.
                </p>
            </div>
        </section>
    );
}

function BusinessCard({ business }) {
    return (
        <div className="w-full max-w-sm shrink-0 snap-start rounded-[26px] border border-[#e7dfcf] bg-white p-6 shadow-[0_16px_44px_rgba(98,79,38,0.06)]">
            <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#153d32] text-xl font-extrabold text-[#9ae6b4]">
                    {business.name.charAt(0)}
                </div>
                <div>
                    <div className="text-lg font-extrabold tracking-[-0.02em] text-[#18231d]">
                        {business.name}
                    </div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2f6a4f]">
                        Live on OjaDeck
                    </div>
                </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-[#5f6f67]">{business.description}</p>
            <a
                href={business.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#075E54] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a6f63]"
            >
                <span>Message on WhatsApp</span>
            </a>
        </div>
    );
}

function FinalCta() {
    return (
        <section className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
            <div className="overflow-hidden rounded-[32px] bg-[#153d32] px-6 py-12 text-center shadow-[0_28px_80px_rgba(21,61,50,0.24)] md:px-10 md:py-16">
                <h2 className="mx-auto max-w-2xl text-3xl font-extrabold leading-[1.05] tracking-[-0.045em] text-white sm:text-5xl">
                    Start selling on WhatsApp today
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-emerald-50/80">
                    Set up your catalogue, connect your number, and let OjaDeck handle
                    replies and payments.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <Link
                        to="/register"
                        className="rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-[#153d32] shadow-[0_16px_34px_rgba(0,0,0,0.2)] transition hover:bg-[#f2ede2]"
                    >
                        Get started
                    </Link>
                    <Link
                        to="/login"
                        className="rounded-2xl border border-white/25 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                        Log in
                    </Link>
                </div>
            </div>
        </section>
    );
}

function SiteFooter() {
    return (
        <footer className="border-t border-[#e7dfcf]">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-[#6b756e] md:flex-row md:px-6">
                <div className="flex items-center gap-2.5">
                    <OjaDeckLogo className="h-7 w-7" />
                    <span className="font-extrabold tracking-[-0.04em] text-[#18231d]">
                        Oja<span className="text-[#1f9d63]">Deck</span>
                    </span>
                </div>
                <p className="text-center">WhatsApp commerce for Nigerian merchants · Payments by Nomba</p>
                <p>© {new Date().getFullYear()} OjaDeck</p>
            </div>
        </footer>
    );
}

function SectionHead({ kicker, title, sub }) {
    return (
        <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7b6b48] sm:text-[13px]">
                {kicker}
            </div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.045em] text-[#15221c] sm:text-[2.75rem] sm:leading-[1.05]">
                {title}
            </h2>
            {sub && (
                <p className="mt-4 max-w-2xl text-[1.05rem] leading-8 text-[#4c5c53] sm:text-lg">
                    {sub}
                </p>
            )}
        </div>
    );
}
