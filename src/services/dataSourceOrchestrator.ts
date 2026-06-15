import type { ReferenciaRow, ParsedDataset } from '../types/csv.ts';
import { processDataset } from './csvParser.ts';
import {
  fetchMembers,
  fetchAccessReports,
  fetchProgressReports,
  fetchEnrollments,
} from './cursEducaClient.ts';
import { buildParsedDatasetFromApi } from './apiAdapter.ts';

// ─── Types ──────────────────────────────────────────────────────────────────

export type DataSource = 'auto' | 'api' | 'csv';

export interface ApiLoadConfig {
  referencia: ReferenciaRow[];
  dateRange?: { start: string; end: string };
  onProgress?: (endpoint: string, message: string, percent: number) => void;
}

export interface AutoLoadConfig {
  dateRange?: { start: string; end: string };
  onProgress?: (endpoint: string, message: string, percent: number) => void;
}

export interface CsvLoadConfig {
  uploadedFiles: Record<string, unknown[]>;
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export async function loadData(
  source: 'auto',
  config: AutoLoadConfig,
): Promise<ParsedDataset>;
export async function loadData(
  source: 'csv',
  config: CsvLoadConfig,
): Promise<ParsedDataset>;
export async function loadData(
  source: 'api',
  config: ApiLoadConfig,
): Promise<ParsedDataset>;
export async function loadData(
  source: DataSource,
  config: AutoLoadConfig | ApiLoadConfig | CsvLoadConfig,
): Promise<ParsedDataset> {
  if (source === 'csv') {
    return processDataset((config as CsvLoadConfig).uploadedFiles);
  }

  if (source === 'auto') {
    const autoConfig = config as AutoLoadConfig;
    const { dateRange, onProgress } = autoConfig;

    // Step 1: Fetch referencia from Google Sheets via sheets-proxy
    onProgress?.('Referência', 'Buscando planilha Google Sheets...', 0);
    const res = await fetch('/.netlify/functions/sheets-proxy');
    if (!res.ok) throw new Error(`Sheets proxy error: ${res.status}`);
    const referencia: ReferenciaRow[] = await res.json();
    onProgress?.('Referência', 'Planilha carregada', 100);

    // Step 2: Fetch the 4 API datasets sequentially (not Promise.all): running
    // them all at once multiplied the request rate and tripped CursoEduca's
    // throttler (HTTP 429).
    const scoped = (label: string) =>
      onProgress ? (msg: string, pct: number) => onProgress(label, msg, pct) : undefined;

    const members = await fetchMembers(scoped('Membros'));
    const access = await fetchAccessReports(dateRange, scoped('Acessos'));
    const progress = await fetchProgressReports(dateRange, scoped('Conclusões'));
    const enrollments = await fetchEnrollments(scoped('Matrículas'));

    // Step 3: Build dataset
    return buildParsedDatasetFromApi(referencia, members, access, progress, enrollments);
  }

  // source === 'api'
  const apiConfig = config as ApiLoadConfig;
  const { referencia, dateRange, onProgress } = apiConfig;

  const scoped = (label: string) =>
    onProgress ? (msg: string, pct: number) => onProgress(label, msg, pct) : undefined;

  // Fetch the 4 endpoints sequentially (not Promise.all) to stay under
  // CursoEduca's throttler (HTTP 429).
  const members = await fetchMembers(scoped('Membros'));
  const access = await fetchAccessReports(dateRange, scoped('Acessos'));
  const progress = await fetchProgressReports(dateRange, scoped('Conclusões'));
  const enrollments = await fetchEnrollments(scoped('Matrículas'));

  return buildParsedDatasetFromApi(
    referencia,
    members,
    access,
    progress,
    enrollments,
  );
}
