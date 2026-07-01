import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api';

export default function WhatsAppSetup() {
    const [status, setStatus] = useState('none');
    const [qr, setQr] = useState(null);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState(null);
    const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
    const [loading, setLoading] = useState(false);
    const pollRef = useRef(null);
    const pollIntervalRef = useRef(null);

    const applySessionState = (data) => {
        setStatus(data.status);
        setQr(data.qr || null);
        setError(data.error || null);
        setProgress(data.progress || null);
        if (data.autoReplyEnabled !== undefined) {
            setAutoReplyEnabled(data.autoReplyEnabled);
        }

        if (data.qr) {
            setLoading(false);
        }

        if (data.status === 'connected') {
            setQr(null);
            setLoading(false);
            const seller = JSON.parse(localStorage.getItem('seller') || '{}');
            seller.whatsappConnected = true;
            localStorage.setItem('seller', JSON.stringify(seller));
            return;
        }

        if (data.status === 'none') {
            setLoading(false);
        }
    };

    const stopPolling = () => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
        pollIntervalRef.current = null;
    };

    const syncStatus = async () => {
        const data = await api.getWhatsAppStatus();
        applySessionState(data);

        const nextInterval = data.status === 'connected'
            ? 15000
            : ['initializing', 'qr_ready', 'authenticated', 'disconnected'].includes(data.status)
                ? 2000
                : null;

        if (!nextInterval) {
            stopPolling();
            return data;
        }

        if (pollIntervalRef.current !== nextInterval) {
            startPolling(nextInterval);
        }

        return data;
    };

    const startPolling = (intervalMs) => {
        if (pollRef.current && pollIntervalRef.current === intervalMs) return;
        stopPolling();
        pollIntervalRef.current = intervalMs;
        pollRef.current = setInterval(async () => {
            try {
                await syncStatus();
            } catch (err) {
                stopPolling();
                setLoading(false);
                setError(err.message || 'Failed to fetch WhatsApp status');
                setStatus('error');
            }
        }, intervalMs);
    };

    useEffect(() => {
        syncStatus().catch(() => { });

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                syncStatus().catch(() => { });
            }
        };

        const handleFocus = () => {
            syncStatus().catch(() => { });
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);

        return () => {
            stopPolling();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    const handleConnect = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.connectWhatsApp();
            applySessionState(data);
            await syncStatus();
        } catch (err) {
            alert(err.message);
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        stopPolling();
        try {
            await api.disconnectWhatsApp();
            setStatus('none');
            setQr(null);
            setError(null);
            setProgress(null);
            setAutoReplyEnabled(true);
        } catch (err) {
            alert(err.message);
        }
    };

    const handlePauseResume = async () => {
        setLoading(true);
        try {
            const data = autoReplyEnabled
                ? await api.pauseWhatsAppBot()
                : await api.resumeWhatsAppBot();
            setAutoReplyEnabled(data.autoReplyEnabled);
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const isLive = ['connected', 'qr_ready', 'authenticated'].includes(status);

    return (
        <div className="space-y-8">
            <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                    Channel
                </div>
                <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.05em] text-[#18231d]">
                    WhatsApp Connection
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[#627168]">
                    Link the merchant number, pause the AI when you want manual control, or fully unlink the channel when you need a fresh device session.
                </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-[28px] border border-[#e7dfcf] bg-white p-6 shadow-[0_12px_30px_rgba(104,85,45,0.05)]">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                                Session State
                            </div>
                            <div className="mt-2 flex items-center gap-3">
                                <div className={`h-3 w-3 rounded-full ${
                                    status === 'connected' ? 'bg-[#1f9d63]' :
                                    status === 'error' ? 'bg-red-500' : 'bg-[#b88427]'
                                }`} />
                                <div className="text-lg font-semibold text-[#1a2a22]">
                                    {status === 'none' && 'Not connected'}
                                    {status === 'initializing' && 'Initializing session'}
                                    {status === 'qr_ready' && 'QR ready for scan'}
                                    {status === 'authenticated' && 'Authenticated, syncing'}
                                    {status === 'connected' && (autoReplyEnabled ? 'Connected and live' : 'Connected, auto-replies paused')}
                                    {status === 'disconnected' && 'Disconnected'}
                                    {status === 'error' && 'Connection failed'}
                                </div>
                            </div>
                        </div>
                        {isLive && (
                            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                                autoReplyEnabled
                                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                    : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                            }`}>
                                {autoReplyEnabled ? 'AI Active' : 'Paused'}
                            </span>
                        )}
                    </div>

                    {error && (
                        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-7 text-red-700">
                            {error}
                        </div>
                    )}

                    {progress && status !== 'connected' && (
                        <div className="mt-5 rounded-2xl border border-[#e7dfcf] bg-[#fbf8f2] px-4 py-3 text-sm leading-7 text-[#5f6f67]">
                            {progress}
                        </div>
                    )}

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        {(status === 'none' || status === 'error' || status === 'disconnected') && (
                            <button
                                className="rounded-2xl bg-[#1f9d63] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(31,157,99,0.2)] transition hover:bg-[#188353] disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={handleConnect}
                                disabled={loading}
                            >
                                {loading ? 'Starting...' : 'Connect WhatsApp'}
                            </button>
                        )}
                        {isLive && (
                            <>
                                <button
                                    className="rounded-2xl border border-[#d8cfbc] bg-[#f8f4ec] px-5 py-3 text-sm font-semibold text-[#294136] transition hover:border-[#b8ac95] hover:bg-[#f1ebdf] disabled:cursor-not-allowed disabled:opacity-60"
                                    onClick={handlePauseResume}
                                    disabled={loading}
                                >
                                    {loading ? 'Saving...' : autoReplyEnabled ? 'Pause Auto-Reply' : 'Resume Auto-Reply'}
                                </button>
                                <button
                                    className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                                    onClick={handleDisconnect}
                                >
                                    Unlink WhatsApp
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="rounded-[28px] border border-[#e7dfcf] bg-[#fbf8f2] p-6 shadow-[0_12px_30px_rgba(104,85,45,0.05)]">
                    {qr ? (
                        <div className="flex flex-col items-center">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                                Scan to Link
                            </div>
                            <div className="mt-5 rounded-[28px] border border-[#e7dfcf] bg-white p-5 shadow-sm">
                                <QRCodeSVG value={qr} size={280} level="M" />
                            </div>
                            <p className="mt-5 max-w-sm text-center text-sm leading-7 text-[#627168]">
                                Open WhatsApp on your phone, go to Linked Devices, choose Link a Device, and scan this QR.
                            </p>
                        </div>
                    ) : status === 'initializing' ? (
                        <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#d9d1bf] border-t-[#153d32]" />
                            <p className="mt-5 max-w-sm text-sm leading-7 text-[#627168]">
                                Preparing the browser session and waiting for WhatsApp Web to become ready.
                            </p>
                        </div>
                    ) : (
                        <div className="flex min-h-[360px] flex-col justify-between">
                            <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                                    Operator Notes
                                </div>
                                <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#18231d]">
                                    Keep linked sessions intentional
                                </h2>
                                <div className="mt-5 space-y-3">
                                    <div className="rounded-2xl bg-white px-4 py-4">
                                        <div className="text-sm font-semibold text-[#294136]">Pause</div>
                                        <p className="mt-1 text-sm leading-7 text-[#627168]">
                                            Keeps the number linked and connected, but stores incoming messages without sending AI replies.
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-white px-4 py-4">
                                        <div className="text-sm font-semibold text-[#294136]">Unlink</div>
                                        <p className="mt-1 text-sm leading-7 text-[#627168]">
                                            Clears the saved linked-device session from this dashboard. The next connection will require a fresh QR scan.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <p className="mt-6 text-sm leading-7 text-[#627168]">
                                If WhatsApp still shows an old linked device on the phone after repeated restore failures, remove it from Linked Devices before reconnecting.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
