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
const CONCURRENT_PAGES = 3;
const MAX_RETRIES = 6;
const RETRY_BASE_DELAY_MS = 2000;
// Brief pause between parallel page batches to smooth the request rate.
const BATCH_DELAY_MS = 250;
// Statuses worth retrying: 429 (throttling) plus transient 408/5xx errors.
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Single Page Fetcher ────────────────────────────────────────────────────

async function fetchPage<T>(
  service: 'members' | 'contents',
  endpoint: string,
  params: Record<string, string | number>,
): Promise<ApiPaginatedResponse<T>> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch('/.netlify/functions/api-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service, endpoint, params }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      // Retry on 429 (throttling) and transient 408/5xx errors.
      if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_RETRIES) {
        // Honor Retry-After (propagated by api-proxy) when present; otherwise
        // fall back to exponential backoff (2s, 4s, 8s, 16s, 32s).
        const retryAfter = Number(response.headers.get('retry-after'));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
        await sleep(delay);
        continue;
      }
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

  throw new Error(`Falha ao buscar ${endpoint} após ${MAX_RETRIES} tentativas`);
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

    // Throttle: brief pause before the next batch to avoid tripping HTTP 429.
    if (hasMore) await sleep(BATCH_DELAY_MS);
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
