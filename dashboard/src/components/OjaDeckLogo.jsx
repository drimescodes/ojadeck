export default function OjaDeckLogo({ variant = 'badge', className, title = 'OjaDeck', ...props }) {
    const titled = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': 'true' };

    if (variant === 'compact') {
        return (
            <svg viewBox="0 0 40 40" fill="none" className={className} {...titled} {...props}>
                {title ? <title>{title}</title> : null}
                <defs>
                    <linearGradient id="ojadeck-badge-c" x1="6" y1="3" x2="34" y2="37" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#23b06f" />
                        <stop offset="1" stopColor="#126b45" />
                    </linearGradient>
                </defs>
                <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#ojadeck-badge-c)" />
                {/* roomy chat bubble + tail */}
                <path
                    d="M9 15a5 5 0 0 1 5-5h12a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5h-5.6l-5.2 4.35A.9.9 0 0 1 14 30V26a5 5 0 0 1-5-5v-6Z"
                    fill="#fff"
                />
                {/* dots — larger and wider for small-size legibility */}
                <circle cx="15" cy="18" r="2" fill="#159c62" />
                <circle cx="20" cy="18" r="2" fill="#159c62" />
                <circle cx="25" cy="18" r="2" fill="#159c62" />
            </svg>
        );
    }

    if (variant === 'mono') {
        return (
            <svg viewBox="0 0 40 40" fill="none" className={className} {...titled} {...props}>
                {title ? <title>{title}</title> : null}
                {/* fanned deck */}
                <rect x="13" y="8" width="14" height="21" rx="3" fill="currentColor" opacity="0.35" transform="rotate(-16 20 30)" />
                <rect x="13" y="8" width="14" height="21" rx="3" fill="currentColor" opacity="0.6" transform="rotate(16 20 30)" />
                {/* front card + chat tail */}
                <path
                    d="M13 11.2A3.2 3.2 0 0 1 16.2 8h7.6A3.2 3.2 0 0 1 27 11.2v14.6a3.2 3.2 0 0 1-3.2 3.2h-4.3l-4.9 4.1a.7.7 0 0 1-1.15-.54V29A3.2 3.2 0 0 1 13 25.8V11.2Z"
                    fill="currentColor"
                />
                {/* typing dots (knocked out) */}
                <circle cx="16.4" cy="18.4" r="1.5" fill="var(--ojadeck-dot, #fff)" />
                <circle cx="20" cy="18.4" r="1.5" fill="var(--ojadeck-dot, #fff)" />
                <circle cx="23.6" cy="18.4" r="1.5" fill="var(--ojadeck-dot, #fff)" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 40 40" fill="none" className={className} {...titled} {...props}>
            {title ? <title>{title}</title> : null}
            <defs>
                <linearGradient id="ojadeck-badge" x1="6" y1="3" x2="34" y2="37" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#23b06f" />
                    <stop offset="1" stopColor="#126b45" />
                </linearGradient>
            </defs>

            {/* rounded badge */}
            <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#ojadeck-badge)" />
            <rect x="1.5" y="1.5" width="37" height="37" rx="10.5" stroke="#fff" strokeOpacity="0.16" />

            {/* fanned deck of cards */}
            <rect x="13" y="9" width="14" height="20" rx="3" fill="#fff" opacity="0.4" transform="rotate(-16 20 29)" />
            <rect x="13" y="9" width="14" height="20" rx="3" fill="#fff" opacity="0.62" transform="rotate(16 20 29)" />

            {/* front card + downward chat tail = WhatsApp commerce */}
            <path
                d="M13 12.2A3.2 3.2 0 0 1 16.2 9h7.6A3.2 3.2 0 0 1 27 12.2v13.6a3.2 3.2 0 0 1-3.2 3.2h-4.1l-4.65 3.9a.7.7 0 0 1-1.15-.54V29A3.2 3.2 0 0 1 13 25.8V12.2Z"
                fill="#fff"
            />

            {/* typing dots */}
            <circle cx="16.4" cy="18.6" r="1.55" fill="#159c62" />
            <circle cx="20" cy="18.6" r="1.55" fill="#159c62" />
            <circle cx="23.6" cy="18.6" r="1.55" fill="#159c62" />
        </svg>
    );
}
