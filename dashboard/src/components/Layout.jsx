import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import OjaDeckLogo from './OjaDeckLogo';

export default function Layout({ children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const seller = JSON.parse(localStorage.getItem('seller') || '{}');

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('seller');
        navigate('/login');
    };

    const navItems = [
        { to: '/', label: 'Dashboard', kicker: 'Overview' },
        { to: '/whatsapp', label: 'WhatsApp', kicker: 'Channel' },
        { to: '/catalogue', label: 'Catalogue', kicker: 'Products' },
        { to: '/orders', label: 'Orders', kicker: 'Sales' },
        { to: '/wallet', label: 'Wallet', kicker: 'Payouts' },
        { to: '/settings', label: 'Settings', kicker: 'Profile' },
    ];

    return (
        <div className="min-h-screen bg-transparent">
            <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col gap-6 px-4 py-4 md:px-6 lg:flex-row lg:gap-8 lg:px-8 lg:py-6">
                <aside className="w-full shrink-0 rounded-[28px] border border-white/70 bg-[#143a2f] text-white shadow-[0_24px_80px_rgba(20,58,47,0.22)] lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-[310px] lg:overflow-y-auto lg:[scrollbar-width:none] lg:[-ms-overflow-style:none] lg:[&::-webkit-scrollbar]:hidden">
                    <div className="flex min-h-full flex-col p-5 md:p-6">
                        <div className="mb-8">
                            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/85">
                                OjaDeck
                            </div>
                            <div className="mt-5 flex items-center gap-3">
                                <OjaDeckLogo className="h-11 w-11 shrink-0 drop-shadow-[0_6px_16px_rgba(0,0,0,0.28)]" />
                                <div className="text-2xl font-extrabold tracking-[-0.04em] text-white">
                                    Oja<span className="text-[#9ae6b4]">Deck</span>
                                </div>
                            </div>
                            <p className="mt-2 max-w-[18rem] text-sm leading-6 text-emerald-50/72">
                                WhatsApp commerce control deck for everyday merchants.
                            </p>
                        </div>

                        <nav className="grid gap-2 md:grid-cols-2 lg:grid-cols-1">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.to === '/'}
                                    className={({ isActive }) =>
                                        [
                                            'group rounded-2xl border px-4 py-3 transition',
                                            isActive
                                                ? 'border-white/20 bg-white text-[#143a2f] shadow-[0_14px_34px_rgba(255,255,255,0.18)]'
                                                : 'border-white/10 bg-white/5 text-emerald-50/78 hover:border-white/18 hover:bg-white/10 hover:text-white',
                                        ].join(' ')
                                    }
                                >
                                    {({ isActive }) => (
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-current/60">
                                                    {item.kicker}
                                                </div>
                                                <div className="mt-1 text-sm font-semibold tracking-[-0.02em]">
                                                    {item.label}
                                                </div>
                                            </div>
                                            <div
                                                className={[
                                                    'h-2.5 w-2.5 rounded-full transition',
                                                    isActive ? 'bg-[#22c55e]' : 'bg-white/20 group-hover:bg-white/35',
                                                ].join(' ')}
                                            />
                                        </div>
                                    )}
                                </NavLink>
                            ))}
                        </nav>

                        <div className="mt-6 rounded-[24px] border border-white/10 bg-black/10 p-4">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-100/60">
                                Workspace
                            </div>
                            <div className="mt-2 text-base font-semibold text-white">
                                {seller.businessName || 'My Business'}
                            </div>
                            <p className="mt-1 text-sm leading-6 text-emerald-50/70">
                                Track messages, collect payments, and pause automation without unlinking the channel.
                            </p>
                        </div>

                        <div className="mt-auto pt-6">
                            <button
                                className="flex w-full items-center justify-between rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-emerald-50/85 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                                onClick={handleLogout}
                            >
                                <span>Log out</span>
                                <span className="text-xs uppercase tracking-[0.18em] text-emerald-100/55">Exit</span>
                            </button>
                        </div>
                    </div>
                </aside>

                <main className="min-w-0 flex-1">
                    <div className="rounded-[30px] border border-[#e7e0d0] bg-[#fffdf8]/96 p-5 shadow-[0_24px_80px_rgba(100,78,38,0.08)] backdrop-blur md:p-7 lg:min-h-[calc(100vh-3rem)] lg:p-8">
                        <div key={location.pathname} className="route-surface">
                            {children}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
