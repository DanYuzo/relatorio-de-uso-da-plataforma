import { useState, useMemo, useCallback } from 'react';
import type { ParsedDataset, ReferenciaRow, FileValidation } from './types/csv.ts';
import type { UsuarioTabela } from './types/metrics.ts';
import { processDataset, filterByEmpresa, filterByDateRange, REQUIRED_FILES } from './services/csvParser.ts';
import { computeMetrics } from './services/metricsComputer.ts';
import { exportDashboards } from './utils/exportHelpers.ts';
import type { PeriodValue } from './components/dashboard/period-utils.ts';
import { getPeriodDateRange } from './components/dashboard/period-utils.ts';
import type { DataSource } from './services/dataSourceOrchestrator.ts';
import { loadData } from './services/dataSourceOrchestrator.ts';

// ─── Components ─────────────────────────────────────────────────────────────
import UploadScreen from './components/upload/UploadScreen.tsx';
import ProcessingScreen from './components/upload/ProcessingScreen.tsx';
import DashboardHeader from './components/dashboard/DashboardHeader.tsx';
import CompanyFilter from './components/dashboard/CompanyFilter.tsx';
import KPIGrid from './components/dashboard/KPIGrid.tsx';
import AccessEvolutionChart from './components/dashboard/AccessEvolutionChart.tsx';
import UserTable from './components/tables/UserTable.tsx';
import ProgressTable from './components/tables/ProgressTable.tsx';
import UserDetailPanel from './components/dashboard/UserDetailPanel.tsx';
import PeriodFilter from './components/dashboard/PeriodFilter.tsx';

// ─── Types ──────────────────────────────────────────────────────────────────

type AppView = 'upload' | 'processing' | 'dashboard';

// ─── App ────────────────────────────────────────────────────────────────────

export default function App() {
  // Navigation
  const [view, setView] = useState<AppView>('upload');

  // Data source mode (default API as primary data source)
  const [dataSource, setDataSource] = useState<DataSource>('api');

  // Upload state (CSV mode)
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, unknown[]>>({});
  const [fileValidations, setFileValidations] = useState<Record<string, FileValidation>>({});

  // API mode state
  const [apiReferencia, setApiReferencia] = useState<ReferenciaRow[]>([]);
  const [apiReferenciaValid, setApiReferenciaValid] = useState(false);
  const [apiReferenciaFileName, setApiReferenciaFileName] = useState<string | null>(null);
  const [fetchProgress, setFetchProgress] = useState<Record<string, { message: string; percent: number }> | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  // Processing state
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');

  // Dashboard state
  const [data, setData] = useState<ParsedDataset | null>(null);
  const [empresaFilter, setEmpresaFilter] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UsuarioTabela | null>(null);
  const [periodoFilter, setPeriodoFilter] = useState<PeriodValue>('all');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });

  // ── Derived: all files valid? (CSV mode) ──
  const allFilesValid = useMemo(
    () => REQUIRED_FILES.every((f) => uploadedFiles[f.name] && fileValidations[f.name]?.valid !== false),
    [uploadedFiles, fileValidations],
  );

  // ── Derived: current dataset (filtered or full) ──
  const currentData = useMemo(() => {
    if (!data) return null;
    let filtered = empresaFilter ? filterByEmpresa(data, empresaFilter) : data;
    const range = getPeriodDateRange(periodoFilter, customDateRange);
    if (range) {
      filtered = filterByDateRange(filtered, range.start, range.end);
    }
    return filtered;
  }, [data, empresaFilter, periodoFilter, customDateRange]);

  // ── Derived: metrics from current data ──
  const metrics = useMemo(() => {
    if (!currentData) return null;
    return computeMetrics(currentData);
  }, [currentData]);

  // ── Handlers ──

  const handleFilesUploaded = useCallback(
    (files: Record<string, unknown[]>, validations: Record<string, FileValidation>) => {
      setUploadedFiles(files);
      setFileValidations(validations);
    },
    [],
  );

  const handleFileRemoved = useCallback(
    (fileName: string) => {
      setUploadedFiles((prev) => {
        const next = { ...prev };
        delete next[fileName];
        return next;
      });
      setFileValidations((prev) => {
        const next = { ...prev };
        delete next[fileName];
        return next;
      });
    },
    [],
  );

  const handleReferenciaUploaded = useCallback(
    (rows: ReferenciaRow[], validation: FileValidation) => {
      setApiReferencia(rows);
      setApiReferenciaValid(validation.valid);
      setApiReferenciaFileName(validation.originalFileName ?? null);
      setFetchError(null);
      setFetchProgress(null);
    },
    [],
  );

  // CSV mode processing
  const handleProcess = useCallback(async () => {
    setView('processing');
    setProcessingMessage('Processando dados...');
    setProcessingProgress(20);

    await new Promise((r) => setTimeout(r, 50));

    try {
      setProcessingProgress(40);
      setProcessingMessage('Mapeando emails para empresas...');
      await new Promise((r) => setTimeout(r, 50));

      const dataset = processDataset(uploadedFiles);

      setProcessingProgress(80);
      setProcessingMessage('Calculando métricas...');
      await new Promise((r) => setTimeout(r, 50));

      setData(dataset);
      setProcessingProgress(100);
      setProcessingMessage('Pronto!');

      await new Promise((r) => setTimeout(r, 300));
      setView('dashboard');
    } catch (err) {
      console.error('Error processing data:', err);
      setProcessingMessage(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [uploadedFiles]);

  // API mode fetch
  const handleApiFetch = useCallback(async () => {
    if (!apiReferenciaValid || apiReferencia.length === 0) return;

    setIsFetching(true);
    setFetchError(null);
    setFetchProgress({});

    try {
      const dataset = await loadData('api', {
        referencia: apiReferencia,
        onProgress: (endpoint, message, percent) =>
          setFetchProgress(prev => ({ ...prev, [endpoint]: { message, percent } })),
      });

      setData(dataset);

      await new Promise((r) => setTimeout(r, 300));
      setView('dashboard');
    } catch (err) {
      console.error('Error fetching API data:', err);
      setFetchError(err instanceof Error ? err.message : String(err));
      setFetchProgress(null);
    } finally {
      setIsFetching(false);
    }
  }, [apiReferencia, apiReferenciaValid]);

  const handleRetry = useCallback(() => {
    setFetchError(null);
    setFetchProgress(null);
    handleApiFetch();
  }, [handleApiFetch]);

  const handleExport = useCallback(async () => {
    if (!data) return;
    setExporting(true);
    setExportProgress(0);

    try {
      const companies = empresaFilter ? [empresaFilter] : data.empresasUnicas;
      await exportDashboards(data, companies, setExportProgress);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }, [data, empresaFilter]);

  // AC11: Reset clears both modes
  const handleReset = useCallback(() => {
    setView('upload');
    setData(null);
    setUploadedFiles({});
    setFileValidations({});
    setApiReferencia([]);
    setApiReferenciaValid(false);
    setApiReferenciaFileName(null);
    setFetchProgress(null);
    setFetchError(null);
    setIsFetching(false);
    setEmpresaFilter(null);
    setPeriodoFilter('all');
    setCustomDateRange({ start: '', end: '' });
  }, []);

  const handleUserClick = useCallback((_user: UsuarioTabela) => {
    setSelectedUser(_user);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedUser(null);
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (view === 'upload') {
    return (
      <UploadScreen
        uploadedFiles={uploadedFiles}
        fileValidations={fileValidations}
        allFilesValid={allFilesValid}
        onFilesUploaded={handleFilesUploaded}
        onFileRemoved={handleFileRemoved}
        onProcess={handleProcess}
        dataSource={dataSource}
        onDataSourceChange={setDataSource}
        onReferenciaUploaded={handleReferenciaUploaded}
        referenciaValid={apiReferenciaValid}
        referenciaFileName={apiReferenciaFileName}
        onFetchData={handleApiFetch}
        fetchProgress={fetchProgress}
        fetchError={fetchError}
        onRetry={handleRetry}
        isFetching={isFetching}
      />
    );
  }

  if (view === 'processing') {
    return (
      <ProcessingScreen
        progress={processingProgress}
        message={processingMessage}
      />
    );
  }

  // Dashboard view
  if (!metrics || !data) return null;

  return (
    <div className="min-h-screen bg-prosperus-midnight p-4 sm:p-6 lg:p-8">
      {/* Detail Panel Slide-Over */}
      <UserDetailPanel user={selectedUser} onClose={handleCloseDetail} />

      <div className="max-w-7xl mx-auto">
        <DashboardHeader
          empresaFilter={empresaFilter}
          onReset={handleReset}
          onExport={handleExport}
          exporting={exporting}
          exportProgress={exportProgress}
        />

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <CompanyFilter
            companies={data.empresasUnicas}
            selected={empresaFilter}
            onSelect={setEmpresaFilter}
          />
          <PeriodFilter
            selected={periodoFilter}
            onSelect={setPeriodoFilter}
            customRange={customDateRange}
            onCustomRangeChange={setCustomDateRange}
          />
        </div>

        {/* KPIs */}
        <div className="mb-6">
          <KPIGrid metrics={metrics} />
        </div>

        {/* Chart */}
        <div className="mb-6">
          <AccessEvolutionChart data={metrics.acessosDiarios} />
        </div>

        {/* User Table */}
        <div className="mb-6">
          <UserTable users={metrics.usuariosTabela} onUserClick={handleUserClick} />
        </div>

        {/* Progress Table */}
        <div className="mb-6">
          <ProgressTable data={metrics.progressoPorConteudo} />
        </div>

        {/* Footer */}
        <footer className="text-center py-6 text-xs text-prosperus-white/20 border-t border-prosperus-white/5">
          Prosperus Club — Dashboard de Treinamento Corporativo
        </footer>
      </div>
    </div>
  );
}
