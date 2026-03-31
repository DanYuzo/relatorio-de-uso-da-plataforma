import { useState, useCallback } from 'react';
import { Download, RotateCcw, Cloud, CheckCircle, AlertCircle } from 'lucide-react';
import type { SendAllResult } from '../../services/prosperusWebhook.ts';
import { sendAllReports } from '../../services/prosperusWebhook.ts';

// ─── Webhook env config ─────────────────────────────────────────────────────
const WEBHOOK_URL = import.meta.env.VITE_PROSPERUS_WEBHOOK_URL as string | undefined;
const WEBHOOK_SECRET = import.meta.env.VITE_PROSPERUS_WEBHOOK_SECRET as string | undefined;
const webhookConfigured = Boolean(WEBHOOK_URL && WEBHOOK_SECRET);

// ─── Types ──────────────────────────────────────────────────────────────────

type SyncState = 'idle' | 'syncing' | 'success' | 'error';

interface SyncProgress {
    current: number;
    total: number;
    email: string;
}

export interface SyncRecipient {
    email: string;
    html: string;
    title: string;
}

interface DashboardHeaderProps {
    empresaFilter: string | null;
    onReset: () => void;
    onExport: () => void;
    exporting: boolean;
    exportProgress: number;
    /** Recipients with pre-built HTML for webhook sync */
    syncRecipients?: SyncRecipient[];
}

export default function DashboardHeader({
    empresaFilter,
    onReset,
    onExport,
    exporting,
    exportProgress,
    syncRecipients,
}: DashboardHeaderProps) {
    const [syncState, setSyncState] = useState<SyncState>('idle');
    const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
    const [syncResult, setSyncResult] = useState<SendAllResult | null>(null);

    const handleSync = useCallback(async () => {
        if (!syncRecipients || syncRecipients.length === 0 || !WEBHOOK_URL || !WEBHOOK_SECRET) return;

        setSyncState('syncing');
        setSyncProgress(null);
        setSyncResult(null);

        try {
            const result = await sendAllReports(
                syncRecipients,
                WEBHOOK_URL,
                WEBHOOK_SECRET,
                (current, total, email) => {
                    setSyncProgress({ current, total, email });
                },
            );

            setSyncResult(result);
            setSyncState(result.failed.length > 0 ? 'error' : 'success');
        } catch {
            setSyncState('error');
            setSyncResult({ sent: 0, failed: [{ email: '—', error: 'Erro inesperado' }] });
        }
    }, [syncRecipients]);

    return (
        <header className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-gold-gradient text-xl sm:text-2xl font-extrabold tracking-tight truncate">
                        {empresaFilter ? empresaFilter : 'Dashboard Geral'}
                    </h1>
                    <p className="text-xs text-prosperus-white/40 mt-0.5">
                        Prosperus Club — Treinamento Corporativo
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                        onClick={onReset}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium
                         bg-prosperus-white/5 text-prosperus-white/60 rounded-lg
                         hover:bg-prosperus-white/10 hover:text-prosperus-white transition-colors"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Novo upload</span>
                    </button>

                    <button
                        onClick={onExport}
                        disabled={exporting}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold
                         bg-prosperus-gold text-prosperus-midnight rounded-lg
                         hover:bg-prosperus-gold-light transition-colors
                         disabled:opacity-60 disabled:cursor-not-allowed
                         shadow-md shadow-prosperus-gold/10"
                    >
                        <Download className="h-3.5 w-3.5" />
                        {exporting ? `Exportando ${exportProgress}%` : 'Exportar Dashboards'}
                    </button>

                    {/* Webhook Sync Button — only visible when env vars are configured */}
                    {webhookConfigured && syncRecipients && syncRecipients.length > 0 && (
                        <button
                            onClick={handleSync}
                            disabled={syncState === 'syncing'}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold
                             bg-prosperus-teal/20 text-prosperus-teal border border-prosperus-teal/30 rounded-lg
                             hover:bg-prosperus-teal/30 transition-colors
                             disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {syncState === 'idle' && (
                                <>
                                    <Cloud className="h-3.5 w-3.5" />
                                    Sincronizar com Aplicativo Prosperus
                                </>
                            )}
                            {syncState === 'syncing' && (
                                <>
                                    <Cloud className="h-3.5 w-3.5 animate-pulse" />
                                    Enviando...
                                </>
                            )}
                            {syncState === 'success' && (
                                <>
                                    <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                                    Enviados!
                                </>
                            )}
                            {syncState === 'error' && (
                                <>
                                    <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                                    Falhas no envio
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Sync progress feedback */}
            {syncState === 'syncing' && syncProgress && (
                <div className="bg-prosperus-navy/60 border border-prosperus-white/5 rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between text-xs text-prosperus-white/70 mb-2">
                        <span>
                            Enviando relatório de <strong className="text-prosperus-white">{syncProgress.email}</strong>
                        </span>
                        <span className="text-prosperus-gold font-medium">
                            {syncProgress.current} de {syncProgress.total}
                        </span>
                    </div>
                    <div className="w-full h-1.5 bg-prosperus-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-prosperus-teal rounded-full transition-all duration-300"
                            style={{ width: `${Math.round((syncProgress.current / syncProgress.total) * 100)}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Sync success message */}
            {syncState === 'success' && syncResult && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-xs text-green-400">
                    <CheckCircle className="h-3.5 w-3.5 inline mr-1.5" />
                    {syncResult.sent} relatório{syncResult.sent !== 1 ? 's' : ''} enviado{syncResult.sent !== 1 ? 's' : ''} com sucesso
                </div>
            )}

            {/* Sync error / partial failure message */}
            {syncState === 'error' && syncResult && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-xs">
                    {syncResult.sent > 0 && (
                        <p className="text-green-400 mb-2">
                            <CheckCircle className="h-3.5 w-3.5 inline mr-1" />
                            {syncResult.sent} relatório{syncResult.sent !== 1 ? 's' : ''} enviado{syncResult.sent !== 1 ? 's' : ''} com sucesso
                        </p>
                    )}
                    <p className="text-red-400 mb-1">
                        <AlertCircle className="h-3.5 w-3.5 inline mr-1" />
                        {syncResult.failed.length} falha{syncResult.failed.length !== 1 ? 's' : ''} no envio:
                    </p>
                    <ul className="text-red-300/80 ml-5 list-disc">
                        {syncResult.failed.map((f) => (
                            <li key={f.email}>{f.email} — {f.error}</li>
                        ))}
                    </ul>
                </div>
            )}
        </header>
    );
}
