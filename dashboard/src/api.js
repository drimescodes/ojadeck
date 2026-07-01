const API_BASE = '/api';

async function request(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
    };

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await res.json();

    if (res.status === 401 && path !== '/auth/login' && path !== '/auth/register') {
        localStorage.removeItem('token');
        localStorage.removeItem('seller');
        window.location.href = '/login';
        throw new Error('Session expired');
    }

    if (!res.ok) {
        throw new Error(data.error || `Request failed: ${res.status}`);
    }

    return data;
}

export const api = {
    // Auth
    register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    getProfile: () => request('/sellers/me'),
    updateProfile: (data) => request('/sellers/me', { method: 'PUT', body: JSON.stringify(data) }),

    // Products
    getProducts: () => request('/products'),
    addProduct: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
    updateProduct: (id, data) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

    // Orders
    getOrders: () => request('/orders'),
    getOrderStats: () => request('/orders/stats'),

    // WhatsApp
    connectWhatsApp: () => request('/whatsapp/connect', { method: 'POST' }),
    disconnectWhatsApp: () => request('/whatsapp/disconnect', { method: 'POST' }),
    getWhatsAppStatus: () => request('/whatsapp/status'),
    pauseWhatsAppBot: () => request('/whatsapp/pause', { method: 'POST' }),
    resumeWhatsAppBot: () => request('/whatsapp/resume', { method: 'POST' }),
};
