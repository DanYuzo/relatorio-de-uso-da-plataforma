import { FileText, CheckCircle, AlertTriangle, RefreshCw, Wifi } from 'lucide-react';
import { matchFileConfig, validateFileStructure, parseCSV } from '../../services/csvParser.ts';
import type { FileValidation } from '../../types/csv.ts';
import type { ReferenciaRow } from '../../types/csv.ts';

interface ApiConnectionPanelProps {
    onReferenciaUploaded: (data: ReferenciaRow[], validation: FileValidation) => void;
    referenciaValid: boolean;
    referenciaFileName: string | null;
    onFetchData: () => void;
    fetchProgress: Record<string, { message: string; percent: number }> | null;
    fetchError: string | null;
    onRetry: () => void;
    isFetching: boolean;
}

const ENDPOINT_LABELS: Record<string, string> = {
    'Membros': 'Membros',
    'Acessos': 'Acessos',
    'Conclusões': 'Conclusões',
    'Matrículas': 'Matrículas',
};

const ENDPOINT_ORDER = ['Membros', 'Acessos', 'Conclusões', 'Matrículas'];

export default function ApiConnectionPanel({
    onReferenciaUploaded,
    referenciaValid,
    referenciaFileName,
    onFetchData,
    fetchProgress,
    fetchError,
    onRetry,
    isFetching,
}: ApiConnectionPanelProps) {

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.csv')) {
            onReferenciaUploaded([], {
                valid: false,
                error: 'Arquivo deve ser CSV',
                originalFileName: file.name,
            });
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const parsed = parseCSV<Record<string, unknown>>(content);
                const refConfig = matchFileConfig('referencia.csv');

                if (!refConfig) return;

                const validation = validateFileStructure(parsed.data, refConfig);
                onReferenciaUploaded(
                    validation.valid ? parsed.data as unknown as ReferenciaRow[] : [],
                    {
                        ...validation,
                        originalFileName: file.name,
                        rowCount: parsed.data.length,
                    },
                );
            } catch (err) {
                onReferenciaUploaded([], {
                    valid: false,
                    error: `Erro ao ler arquivo: ${err instanceof Error ? err.message : String(err)}`,
                    originalFileName: file.name,
                });
            }
        };
        reader.readAsText(file);
    };

    const hasProgress = fetchProgress && Object.keys(fetchProgress).length > 0;

    return (
        <div className="space-y-5">
            {/* Step 1: Upload referencia.csv */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-prosperus-gold/20 text-prosperus-gold text-xs font-bold">1</span>
                    <h3 className="text-sm font-semibold text-prosperus-white">Upload de referencia.csv</h3>
                </div>

                {!referenciaValid ? (
                    <div className="border-2 border-dashed border-prosperus-gold/30 rounded-xl p-5 text-center
                          hover:border-prosperus-gold/60 hover:bg-prosperus-gold/5 transition-all duration-300">
                        <FileText className="h-8 w-8 text-prosperus-gold mx-auto mb-2" />
                        <p className="text-sm text-prosperus-white/50 mb-3">
                            Arquivo base com mapeamento email → empresa
                        </p>
                        <label className="cursor-pointer inline-block">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                            <span className="inline-flex items-center gap-2 px-4 py-2 bg-prosperus-gold text-prosperus-midnight
                                font-semibold rounded-lg hover:bg-prosperus-gold-light transition-colors text-sm">
                                <FileText className="h-4 w-4" />
                                Selecionar referencia.csv
                            </span>
                        </label>
                    </div>
                ) : (
                    <div className="flex items-center p-3 rounded-lg border bg-emerald-500/10 border-emerald-500/30">
                        <CheckCircle className="h-5 w-5 text-emerald-400 mr-3 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-prosperus-white">referencia.csv</p>
                            {referenciaFileName && (
                                <p className="text-xs text-prosperus-white/40">{referenciaFileName}</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Step 2: Fetch data */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <span className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold
                        ${referenciaValid ? 'bg-prosperus-gold/20 text-prosperus-gold' : 'bg-prosperus-white/10 text-prosperus-white/30'}`}>
                        2
                    </span>
                    <h3 className={`text-sm font-semibold ${referenciaValid ? 'text-prosperus-white' : 'text-prosperus-white/30'}`}>
                        Buscar dados da plataforma
                    </h3>
                </div>

                {/* Fetch button */}
                {!hasProgress && !fetchError && (
                    <button
                        onClick={onFetchData}
                        disabled={!referenciaValid || isFetching}
                        className={`w-full py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2
                            ${referenciaValid && !isFetching
                                ? 'bg-prosperus-gold text-prosperus-midnight hover:bg-prosperus-gold-light cursor-pointer shadow-lg shadow-prosperus-gold/20'
                                : 'bg-prosperus-white/10 text-prosperus-white/30 cursor-not-allowed'
                            }`}
                    >
                        <Wifi className="h-4 w-4" />
                        Buscar Dados da Plataforma
                    </button>
                )}

                {/* Multi-endpoint progress */}
                {hasProgress && (
                    <div className="space-y-3">
                        {ENDPOINT_ORDER.map((key) => {
                            const entry = fetchProgress[key];
                            const label = ENDPOINT_LABELS[key] ?? key;
                            const percent = entry?.percent ?? 0;
                            const isDone = percent >= 100;

                            return (
                                <div key={key} className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {isDone
                                                ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                                                : <div className={`h-3.5 w-3.5 rounded-full border-2 ${entry ? 'border-prosperus-gold animate-pulse' : 'border-prosperus-white/20'}`} />
                                            }
                                            <span className={`text-xs font-medium ${isDone ? 'text-emerald-400' : entry ? 'text-prosperus-white' : 'text-prosperus-white/30'}`}>
                                                {label}
                                            </span>
                                        </div>
                                        <span className={`text-xs ${isDone ? 'text-emerald-400' : 'text-prosperus-white/40'}`}>
                                            {entry ? `${percent}%` : '—'}
                                        </span>
                                    </div>
                                    <div className="progress-track h-1.5">
                                        <div
                                            className={`h-1.5 rounded-full transition-all duration-300 ${isDone ? 'bg-emerald-400' : 'progress-fill medium'}`}
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                    {entry && !isDone && (
                                        <p className="text-xs text-prosperus-white/30 truncate">{entry.message}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Error + retry */}
                {fetchError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-red-300">Erro ao buscar dados</p>
                                <p className="text-xs text-red-400/70 mt-1">{fetchError}</p>
                            </div>
                        </div>
                        <button
                            onClick={onRetry}
                            className="mt-3 w-full py-2 rounded-lg font-semibold text-sm bg-red-500/20 text-red-300
                                hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Tentar novamente
                        </button>
                    </div>
                )}
            </div>

            {/* Instructions */}
            <div className="p-3 bg-prosperus-gold/5 border border-prosperus-gold/10 rounded-lg">
                <h4 className="text-xs font-medium text-prosperus-gold/70 mb-1.5">Modo API Híbrido:</h4>
                <ul className="text-xs text-prosperus-white/40 space-y-0.5 list-disc list-inside">
                    <li>Upload manual apenas do <strong className="text-prosperus-white/60">referencia.csv</strong> (mapeamento empresa)</li>
                    <li>Dados de atividade são buscados automaticamente da CursoEduca</li>
                    <li>O dashboard funciona identicamente ao modo CSV</li>
                </ul>
            </div>
        </div>
    );
}
