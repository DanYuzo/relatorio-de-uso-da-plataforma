import type {
  ApiPaginatedResponse,
  ApiMember,
  ApiAccessReport,
  ApiProgressReport,
  ApiEnrollment,
} from '../types/api.ts';

// ─── Types ──────────────────────────────────────────────────────────────────

type ProgressCallback = (message: string, percent: number) => void;

interface DateRange {
  start: string;
  end: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 1000;
const CONCURRENT_PAGES = 5;

// ─── Single Page Fetcher ────────────────────────────────────────────────────

async function fetchPage<T>(
  service: 'members' | 'contents',
  endpoint: string,
  params: Record<string, string | number>,
): Promise<ApiPaginatedResponse<T>> {
  const response = await fetch('/.netlify/functions/api-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service, endpoint, params }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`API error ${response.status} on ${endpoint}: ${errorText}`);
  }

  let json: ApiPaginatedResponse<T>;
  try {
    json = await response.json();
  } catch {
    throw new Error(`Resposta inválida da API em ${endpoint}: JSON malformado`);
  }

  if (!json.data || !Array.isArray(json.data)) {
    throw new Error(`Resposta inválida da API em ${endpoint}: campo 'data' ausente`);
  }

  return json;
}

// ─── Parallel Paginated Fetcher ─────────────────────────────────────────────

async function fetchAllPages<T>(
  service: 'members' | 'contents',
  endpoint: string,
  params: Record<string, string | number> = {},
  onProgress?: ProgressCallback,
): Promise<T[]> {
  const limit = PAGE_SIZE;

  // First page to get totalCount
  const firstPage = await fetchPage<T>(service, endpoint, { ...params, limit, offset: 0 });
  const allData: T[] = [...firstPage.data];
  const totalCount = firstPage.metadata?.totalCount ?? allData.length;
  const meta = firstPage.metadata as Record<string, unknown> | undefined;
  let hasMore = (meta?.hasMore ?? meta?.hasmore ?? false) as boolean;

  if (onProgress) {
    const pct = totalCount > 0 ? Math.min(100, Math.round((allData.length / totalCount) * 100)) : 100;
    onProgress(`Buscando ${endpoint}... ${allData.length}/${totalCount}`, pct);
  }

  // Remaining pages in parallel batches
  let offset = limit;

  while (hasMore) {
    const batch: Promise<ApiPaginatedResponse<T>>[] = [];

    for (let i = 0; i < CONCURRENT_PAGES && hasMore; i++) {
      batch.push(fetchPage<T>(service, endpoint, { ...params, limit, offset }));
      offset += limit;
      // Estimate if there are more pages
      if (offset >= totalCount) hasMore = false;
    }

    const results = await Promise.all(batch);

    for (const result of results) {
      allData.push(...result.data);
      const rMeta = result.metadata as Record<string, unknown> | undefined;
      const pageHasMore = (rMeta?.hasMore ?? rMeta?.hasmore ?? false) as boolean;
      if (!pageHasMore) hasMore = false;
    }

    if (onProgress) {
      const pct = totalCount > 0 ? Math.min(100, Math.round((allData.length / totalCount) * 100)) : 100;
      onProgress(`Buscando ${endpoint}... ${allData.length}/${totalCount}`, pct);
    }
  }

  return allData;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function fetchMembers(
  onProgress?: ProgressCallback,
): Promise<ApiMember[]> {
  return fetchAllPages<ApiMember>('members', '/members', {}, onProgress);
}

export async function fetchAccessReports(
  dateRange?: DateRange,
  onProgress?: ProgressCallback,
): Promise<ApiAccessReport[]> {
  const params: Record<string, string | number> = {};
  if (dateRange) {
    params.createdSince = dateRange.start;
    params.createdUntil = dateRange.end;
  }
  return fetchAllPages<ApiAccessReport>('members', '/reports/access', params, onProgress);
}

export async function fetchProgressReports(
  dateRange?: DateRange,
  onProgress?: ProgressCallback,
): Promise<ApiProgressReport[]> {
  const params: Record<string, string | number> = {};
  if (dateRange) {
    params.finishedSince = dateRange.start;
    params.finishedUntil = dateRange.end;
  }
  return fetchAllPages<ApiProgressReport>('contents', '/reports/progress', params, onProgress);
}

export async function fetchEnrollments(
  onProgress?: ProgressCallback,
): Promise<ApiEnrollment[]> {
  return fetchAllPages<ApiEnrollment>('contents', '/api/reports/enrollments', {}, onProgress);
}
