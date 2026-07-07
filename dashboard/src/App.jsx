import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Landing from './pages/Landing';
import Demo from './pages/Demo';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Catalogue from './pages/Catalogue';
import Orders from './pages/Orders';
import Wallet from './pages/Wallet';
import WhatsAppSetup from './pages/WhatsAppSetup';
import Settings from './pages/Settings';
import Layout from './components/Layout';
import { api } from './api';
import { queryKeys } from './query';

function ProtectedRoute({ children }) {
    const { data: seller, isLoading, isError, error, refetch } = useQuery({
        queryKey: queryKeys.profile,
        queryFn: api.getProfile,
        retry: false,
    });

    useEffect(() => {
        if (seller) localStorage.setItem('seller', JSON.stringify(seller));
    }, [seller]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#f7f3ea] px-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#e7dfcf] bg-[#fffdf8] shadow-[0_20px_60px_rgba(21,35,29,0.1)]">
                    <div className="h-7 w-7 animate-spin rounded-full border-4 border-[#d9d1bf] border-t-[#153d32]" />
                </div>
            </div>
        );
    }

    if (isError && error?.status === 401) return <Navigate to="/login" replace />;

    if (isError) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#f7f3ea] px-4">
                <div className="w-full max-w-md rounded-[28px] border border-[#e7dfcf] bg-[#fffdf8] p-6 text-center shadow-[0_20px_60px_rgba(21,35,29,0.1)]">
                    <h1 className="text-2xl font-extrabold tracking-[-0.04em] text-[#18231d]">
                        Could not load your dashboard
                    </h1>
                    <p className="mt-3 text-sm leading-7 text-[#627168]">
                        Check your connection and try again.
                    </p>
                    <button
                        className="mt-5 rounded-2xl bg-[#153d32] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(21,61,50,0.18)] transition hover:bg-[#1b4a3d]"
                        onClick={() => refetch()}
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return children;
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/demo" element={<Demo />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route
                    path="/dashboard/*"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <Routes>
                                    <Route index element={<Dashboard />} />
                                    <Route path="catalogue" element={<Catalogue />} />
                                    <Route path="orders" element={<Orders />} />
                                    <Route path="wallet" element={<Wallet />} />
                                    <Route path="whatsapp" element={<WhatsAppSetup />} />
                                    <Route path="settings" element={<Settings />} />
                                </Routes>
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
