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

export type DataSource = 'api' | 'csv';

export interface ApiLoadConfig {
  referencia: ReferenciaRow[];
  dateRange?: { start: string; end: string };
  onProgress?: (endpoint: string, message: string, percent: number) => void;
}

export interface CsvLoadConfig {
  uploadedFiles: Record<string, unknown[]>;
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

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
  config: ApiLoadConfig | CsvLoadConfig,
): Promise<ParsedDataset> {
  if (source === 'csv') {
    return processDataset((config as CsvLoadConfig).uploadedFiles);
  }

  const apiConfig = config as ApiLoadConfig;
  const { referencia, dateRange, onProgress } = apiConfig;

  const scoped = (label: string) =>
    onProgress ? (msg: string, pct: number) => onProgress(label, msg, pct) : undefined;

  // Fetch all 4 endpoints in parallel
  const [members, access, progress, enrollments] = await Promise.all([
    fetchMembers(scoped('Membros')),
    fetchAccessReports(dateRange, scoped('Acessos')),
    fetchProgressReports(dateRange, scoped('Conclusões')),
    fetchEnrollments(scoped('Matrículas')),
  ]);

  return buildParsedDatasetFromApi(
    referencia,
    members,
    access,
    progress,
    enrollments,
  );
}
