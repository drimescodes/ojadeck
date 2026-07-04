import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: true,
            retry: 1,
        },
    },
});

export const queryKeys = {
    profile: ['profile'],
    products: ['products'],
    orders: ['orders'],
    orderStats: ['orders', 'stats'],
    whatsappStatus: ['whatsapp', 'status'],
    walletSummary: ['wallet', 'summary'],
    walletLedger: ['wallet', 'ledger'],
    payouts: ['wallet', 'payouts'],
    banks: ['wallet', 'banks'],
};
