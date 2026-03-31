import { Download, RotateCcw } from 'lucide-react';

interface DashboardHeaderProps {
    empresaFilter: string | null;
    onReset: () => void;
    onExport: () => void;
    exporting: boolean;
    exportProgress: number;
}

export default function DashboardHeader({
    empresaFilter,
    onReset,
    onExport,
    exporting,
    exportProgress,
}: DashboardHeaderProps) {
    return (
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="min-w-0">
                <h1 className="text-gold-gradient text-xl sm:text-2xl font-extrabold tracking-tight truncate">
                    {empresaFilter ? empresaFilter : 'Dashboard Geral'}
                </h1>
                <p className="text-xs text-prosperus-white/40 mt-0.5">
                    Prosperus Club — Treinamento Corporativo
                </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
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
            </div>
        </header>
    );
}
