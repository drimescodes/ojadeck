import { useEffect } from 'react';

export function useBodyScrollLock(locked) {
    useEffect(() => {
        if (!locked || typeof document === 'undefined') return undefined;

        const bodyOverflow = document.body.style.overflow;
        const bodyPaddingRight = document.body.style.paddingRight;
        const htmlOverflow = document.documentElement.style.overflow;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }

        return () => {
            document.body.style.overflow = bodyOverflow;
            document.body.style.paddingRight = bodyPaddingRight;
            document.documentElement.style.overflow = htmlOverflow;
        };
    }, [locked]);
}
