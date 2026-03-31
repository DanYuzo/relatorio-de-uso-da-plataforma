import { Upload, FileText, CheckCircle, AlertTriangle, X, Cloud, Loader2 } from 'lucide-react';
import { REQUIRED_FILES, matchFileConfig, validateFileStructure, parseCSV } from '../../services/csvParser.ts';
import type { FileValidation } from '../../types/csv.ts';
import type { ReferenciaRow } from '../../types/csv.ts';
import type { DataSource } from '../../services/dataSourceOrchestrator.ts';
import DataSourceSelector from './DataSourceSelector.tsx';
import ApiConnectionPanel from './ApiConnectionPanel.tsx';

interface UploadScreenProps {
    uploadedFiles: Record<string, unknown[]>;
    fileValidations: Record<string, FileValidation>;
    allFilesValid: boolean;
    onFilesUploaded: (files: Record<string, unknown[]>, validations: Record<string, FileValidation>) => void;
    onFileRemoved: (fileName: string) => void;
    onProcess: () => void;
    dataSource: DataSource;
    onDataSourceChange: (source: DataSource) => void;
    onReferenciaUploaded: (data: ReferenciaRow[], validation: FileValidation) => void;
    referenciaValid: boolean;
    referenciaFileName: string | null;
    onFetchData: () => void;
    fetchProgress: Record<string, { message: string; percent: number }> | null;
    fetchError: string | null;
    onRetry: () => void;
    isFetching: boolean;
    onAutoGenerate: () => void;
}

export default function UploadScreen({
    uploadedFiles,
    fileValidations,
    allFilesValid,
    onFilesUploaded,
    onFileRemoved,
    onProcess,
    dataSource,
    onDataSourceChange,
    onReferenciaUploaded,
    referenciaValid,
    referenciaFileName,
    onFetchData,
    fetchProgress,
    fetchError,
    onRetry,
    isFetching,
    onAutoGenerate,
}: UploadScreenProps) {
    const uploadedCount = Object.keys(uploadedFiles).length;
    const progress = (uploadedCount / REQUIRED_FILES.length) * 100;

    const handleMultipleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        if (files.length === 0) return;

        const newUploadedFiles = { ...uploadedFiles };
        const newValidations = { ...fileValidations };
        let processedCount = 0;

        files.forEach((file) => {
            if (!file.name.endsWith('.csv')) {
                newValidations[file.name] = {
                    valid: false,
                    error: 'Arquivo deve ser CSV',
                    originalFileName: file.name,
                };
                processedCount++;
                if (processedCount === files.length) {
                    onFilesUploaded(newUploadedFiles, newValidations);
                }
                return;
            }

            const matchedFile = matchFileConfig(file.name);

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target?.result as string;
                    const parsed = parseCSV<Record<string, unknown>>(content);

                    if (matchedFile) {
                        const validation = validateFileStructure(parsed.data, matchedFile);
                        newValidations[matchedFile.name] = {
                            ...validation,
                            originalFileName: file.name,
                            rowCount: parsed.data.length,
                        };
                        if (validation.valid) {
                            newUploadedFiles[matchedFile.name] = parsed.data;
                        }
                    } else {
                        let identified = false;
                        for (const reqFile of REQUIRED_FILES) {
                            const validation = validateFileStructure(parsed.data, reqFile);
                            if (validation.valid && !newUploadedFiles[reqFile.name]) {
                                newUploadedFiles[reqFile.name] = parsed.data;
                                newValidations[reqFile.name] = {
                                    ...validation,
                                    originalFileName: file.name,
                                    rowCount: parsed.data.length,
                                };
                                identified = true;
                                break;
                            }
                        }
                        if (!identified) {
                            newValidations[file.name] = {
                                valid: false,
                                error: 'Arquivo não identificado ou estrutura inválida',
                                originalFileName: file.name,
                                columns: Object.keys(parsed.data[0] ?? {}),
                            };
                        }
                    }

                    processedCount++;
                    if (processedCount === files.length) {
                        onFilesUploaded(newUploadedFiles, newValidations);
                    }
                } catch (err) {
                    newValidations[file.name] = {
                        valid: false,
                        error: `Erro ao ler arquivo: ${err instanceof Error ? err.message : String(err)}`,
                        originalFileName: file.name,
                    };
                    processedCount++;
                    if (processedCount === files.length) {
                        onFilesUploaded(newUploadedFiles, newValidations);
                    }
                }
            };
            reader.readAsText(file);
        });
    };

    return (
        <div className="min-h-screen bg-prosperus-midnight flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-gold-gradient text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
                        Prosperus Club
                    </h1>
                    <p className="text-prosperus-white/60 text-sm sm:text-base">
                        Dashboard de Treinamento Corporativo
                    </p>
                </div>

                <div className="card">
                    {/* Data Source Toggle */}
                    <DataSourceSelector selected={dataSource} onSelect={onDataSourceChange} />

                    {/* Auto Mode */}
                    {dataSource === 'auto' && (
                        <div className="space-y-4">
                            <div className="text-center p-6 border border-prosperus-gold/20 rounded-xl bg-prosperus-gold/5">
                                <Cloud className="h-10 w-10 text-prosperus-gold mx-auto mb-3" />
                                <h3 className="text-lg font-semibold text-prosperus-white mb-1">
                                    Modo Automático
                                </h3>
                                <p className="text-sm text-prosperus-white/50 mb-4">
                                    Busca automática da planilha de referência (Google Sheets) e dos 4 datasets da CursoEduca API. Nenhum upload necessário.
                                </p>

                                <button
                                    onClick={onAutoGenerate}
                                    disabled={isFetching}
                                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all ${
                                        isFetching
                                            ? 'bg-prosperus-white/10 text-prosperus-white/30 cursor-not-allowed'
                                            : 'bg-prosperus-gold text-prosperus-midnight hover:bg-prosperus-gold-light cursor-pointer shadow-lg shadow-prosperus-gold/20'
                                    }`}
                                >
                                    {isFetching ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Buscando dados...
                                        </>
                                    ) : (
                                        'Gerar Dashboard'
                                    )}
                                </button>
                            </div>

                            {/* Progress indicators */}
                            {fetchProgress && Object.keys(fetchProgress).length > 0 && (
                                <div className="space-y-2">
                                    {Object.entries(fetchProgress).map(([endpoint, { message, percent }]) => (
                                        <div key={endpoint} className="flex items-center gap-3 p-2.5 rounded-lg bg-prosperus-midnight/50 border border-prosperus-white/10">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-prosperus-white/70 font-medium">{endpoint}</span>
                                                    <span className="text-prosperus-white/40">{percent}%</span>
                                                </div>
                                                <div className="progress-track h-1.5">
                                                    <div
                                                        className="progress-fill medium"
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                                <p className="text-xs text-prosperus-white/40 mt-0.5">{message}</p>
                                            </div>
                                            {percent >= 100 && <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Error display */}
                            {fetchError && (
                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-red-300 font-medium">Erro ao buscar dados</p>
                                            <p className="text-xs text-red-400/70 mt-0.5">{fetchError}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onAutoGenerate}
                                        className="mt-2 text-xs text-prosperus-gold hover:text-prosperus-gold-light transition-colors"
                                    >
                                        Tentar novamente
                                    </button>
                                </div>
                            )}

                            {/* Instructions */}
                            <div className="p-3 bg-prosperus-gold/5 border border-prosperus-gold/10 rounded-lg">
                                <h4 className="text-xs font-medium text-prosperus-gold/70 mb-1.5">Como funciona:</h4>
                                <ul className="text-xs text-prosperus-white/40 space-y-0.5 list-disc list-inside">
                                    <li>Referência é carregada automaticamente do Google Sheets</li>
                                    <li>Dados de membros, acessos, conclusões e matrículas são buscados da API CursoEduca</li>
                                    <li>Nenhum arquivo precisa ser enviado manualmente</li>
                                    <li>Exportação usa lógica multi-destinatário automática</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* API Mode */}
                    {dataSource === 'api' && (
                        <ApiConnectionPanel
                            onReferenciaUploaded={onReferenciaUploaded}
                            referenciaValid={referenciaValid}
                            referenciaFileName={referenciaFileName}
                            onFetchData={onFetchData}
                            fetchProgress={fetchProgress}
                            fetchError={fetchError}
                            onRetry={onRetry}
                            isFetching={isFetching}
                        />
                    )}

                    {/* CSV Mode — existing UI unchanged */}
                    {dataSource === 'csv' && <>
                    {/* Drop Zone */}
                    <div className="border-2 border-dashed border-prosperus-gold/30 rounded-xl p-6 sm:p-8 text-center mb-6
                          hover:border-prosperus-gold/60 hover:bg-prosperus-gold/5 transition-all duration-300">
                        <Upload className="h-10 w-10 sm:h-12 sm:w-12 text-prosperus-gold mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-prosperus-white mb-1">
                            Carregar Arquivos CSV
                        </h3>
                        <p className="text-sm text-prosperus-white/50 mb-4">
                            Selecione todos os 5 arquivos de uma vez ou adicione um por vez
                        </p>

                        <label className="cursor-pointer inline-block">
                            <input
                                type="file"
                                accept=".csv"
                                multiple
                                onChange={handleMultipleFileUpload}
                                className="hidden"
                            />
                            <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-prosperus-gold text-prosperus-midnight
                             font-semibold rounded-lg hover:bg-prosperus-gold-light transition-colors text-sm">
                                <FileText className="h-4 w-4" />
                                Selecionar arquivos CSV
                            </span>
                        </label>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-6">
                        <div className="flex justify-between text-xs text-prosperus-white/50 mb-1.5">
                            <span>Progresso de upload</span>
                            <span>{uploadedCount} de {REQUIRED_FILES.length} arquivos</span>
                        </div>
                        <div className="progress-track h-2">
                            <div
                                className="progress-fill medium"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* File List */}
                    <div className="space-y-2 mb-6">
                        {REQUIRED_FILES.map((file) => {
                            const validation = fileValidations[file.name];
                            const isUploaded = !!uploadedFiles[file.name];
                            const hasError = validation && !validation.valid;

                            return (
                                <div
                                    key={file.name}
                                    className={`flex items-center p-3 rounded-lg border transition-all ${isUploaded && !hasError
                                        ? 'bg-emerald-500/10 border-emerald-500/30'
                                        : hasError
                                            ? 'bg-red-500/10 border-red-500/30'
                                            : 'bg-prosperus-midnight/50 border-prosperus-white/10'
                                        }`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm text-prosperus-white truncate">{file.name}</p>
                                        <p className="text-xs text-prosperus-white/40">{file.description}</p>
                                        {validation?.originalFileName && (
                                            <p className="text-xs text-prosperus-white/30 mt-0.5">
                                                {validation.originalFileName}
                                                {validation.rowCount && ` (${validation.rowCount} registros)`}
                                            </p>
                                        )}
                                        {hasError && validation.details && (
                                            <div className="mt-2">
                                                <p className="text-xs text-red-400 font-medium">{validation.error}</p>
                                                {validation.details.missing && validation.details.missing.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {validation.details.missing.map((col) => (
                                                            <span key={col} className="px-1.5 py-0.5 bg-red-500/20 text-red-300 text-xs rounded">
                                                                {col}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="ml-3 flex items-center gap-1.5 shrink-0">
                                        {isUploaded && !hasError && <CheckCircle className="h-5 w-5 text-emerald-400" />}
                                        {hasError && <AlertTriangle className="h-5 w-5 text-red-400" />}
                                        {!isUploaded && !hasError && <div className="h-5 w-5 rounded-full border-2 border-prosperus-white/20" />}
                                        {(isUploaded || hasError) && (
                                            <button
                                                onClick={() => onFileRemoved(file.name)}
                                                className="p-1 hover:bg-prosperus-white/10 rounded transition-colors"
                                            >
                                                <X className="h-3.5 w-3.5 text-prosperus-white/40" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Unidentified Files Warning */}
                    {Object.entries(fileValidations)
                        .filter(([name, v]) => !REQUIRED_FILES.find((rf) => rf.name === name) && !v.valid)
                        .length > 0 && (
                            <div className="mb-6">
                                <h4 className="text-xs font-medium text-prosperus-gold/70 mb-2">Arquivos não identificados:</h4>
                                <div className="space-y-1">
                                    {Object.entries(fileValidations)
                                        .filter(([name, v]) => !REQUIRED_FILES.find((rf) => rf.name === name) && !v.valid)
                                        .map(([name, validation]) => (
                                            <div key={name} className="flex items-center justify-between p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-amber-300">{validation.originalFileName ?? name}</p>
                                                    <p className="text-xs text-amber-400/60">{validation.error}</p>
                                                </div>
                                                <button
                                                    onClick={() => onFileRemoved(name)}
                                                    className="p-1 hover:bg-amber-500/20 rounded ml-2"
                                                >
                                                    <X className="h-3.5 w-3.5 text-amber-400" />
                                                </button>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                    {/* Process Button */}
                    <button
                        onClick={onProcess}
                        disabled={!allFilesValid}
                        className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${allFilesValid
                            ? 'bg-prosperus-gold text-prosperus-midnight hover:bg-prosperus-gold-light cursor-pointer shadow-lg shadow-prosperus-gold/20'
                            : 'bg-prosperus-white/10 text-prosperus-white/30 cursor-not-allowed'
                            }`}
                    >
                        {allFilesValid ? 'Processar dados e gerar dashboard' : 'Aguardando todos os arquivos válidos'}
                    </button>

                    {/* Instructions */}
                    <div className="mt-6 p-3 bg-prosperus-gold/5 border border-prosperus-gold/10 rounded-lg">
                        <h4 className="text-xs font-medium text-prosperus-gold/70 mb-1.5">Instruções:</h4>
                        <ul className="text-xs text-prosperus-white/40 space-y-0.5 list-disc list-inside">
                            <li>Selecione múltiplos arquivos de uma vez</li>
                            <li>Identificação automática pelo nome do arquivo</li>
                            <li>Todos os 5 arquivos devem ter as colunas obrigatórias</li>
                            <li>Remova e reenvie arquivos individuais se necessário</li>
                        </ul>
                    </div>
                    </>}
                </div>
            </div>
        </div>
    );
}
