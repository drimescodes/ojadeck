const API_BASE = '/api';

function getCookie(name) {
    return document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${name}=`))
        ?.split('=')
        .slice(1)
        .join('=') || '';
}

async function request(path, options = {}) {
    const isFormData = options.body instanceof FormData;
    const method = (options.method || 'GET').toUpperCase();
    const csrfToken = getCookie('ojadeck_csrf');
    const headers = {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        ...options.headers,
    };

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401 && path !== '/auth/login' && path !== '/auth/register') {
        localStorage.removeItem('seller');
        window.location.href = '/login';
        throw new Error('Session expired');
    }

    if (!res.ok) {
        const error = new Error(data.error || `Request failed: ${res.status}`);
        error.status = res.status;
        throw error;
    }

    return data;
}

export const api = {
    // Auth
    register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    getProfile: () => request('/sellers/me'),
    updateProfile: (data) => request('/sellers/me', { method: 'PUT', body: JSON.stringify(data) }),

    // Products
    getProducts: () => request('/products'),
    addProduct: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
    updateProduct: (id, data) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    uploadProductImage: (id, file) => {
        const body = new FormData();
        body.append('image', file);
        return request(`/products/${id}/image`, { method: 'POST', body });
    },
    deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

    // Orders
    getOrders: () => request('/orders'),
    getOrderStats: () => request('/orders/stats'),

    // Wallet
    getWalletSummary: () => request('/wallet/summary'),
    getWalletLedger: () => request('/wallet/ledger'),
    getPayouts: () => request('/wallet/payouts'),
    getBanks: () => request('/wallet/banks'),
    lookupPayoutAccount: (data) => request('/wallet/payout-account/lookup', { method: 'POST', body: JSON.stringify(data) }),
    savePayoutAccount: (data) => request('/wallet/payout-account', { method: 'POST', body: JSON.stringify(data) }),
    createPayout: (data) => request('/wallet/payouts', { method: 'POST', body: JSON.stringify(data) }),
    confirmPayout: (id) => request(`/wallet/payouts/${id}/confirm`, { method: 'POST' }),

    // WhatsApp
    connectWhatsApp: () => request('/whatsapp/connect', { method: 'POST' }),
    disconnectWhatsApp: () => request('/whatsapp/disconnect', { method: 'POST' }),
    getWhatsAppStatus: () => request('/whatsapp/status'),
    pauseWhatsAppBot: () => request('/whatsapp/pause', { method: 'POST' }),
    resumeWhatsAppBot: () => request('/whatsapp/resume', { method: 'POST' }),
};
