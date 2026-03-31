#!/usr/bin/env tsx
// ─── Server-Side Report Generation Script ──────────────────────────────────
// Standalone Node.js script that generates HTML reports for all recipients
// and sends them via the Prosperus webhook API.
// Usage: npm run generate-reports

import * as fs from 'node:fs';
import * as path from 'node:path';
import { google } from 'googleapis';

import type {
  ReferenciaRow,
  ParsedDataset,
} from '../src/types/csv.ts';
import type {
  ApiPaginatedResponse,
  ApiMember,
  ApiAccessReport,
  ApiProgressReport,
  ApiEnrollment,
} from '../src/types/api.ts';

import {
  buildEmailToEmpresaMap,
  enrichWithEmpresa,
  buildEmailToNomeMap,
  enrichWithNome,
  injectMissingAccess,
  buildRecipientMap,
  filterByEmpresa,
  getUniqueEmpresas,
} from '../src/services/csvParser.ts';

import { buildParsedDatasetFromApi } from '../src/services/apiAdapter.ts';
import { computeMetrics } from '../src/services/metricsComputer.ts';
import { generateCompanyHTML } from '../src/utils/exportHelpers.ts';
import { sendReportToProsperusApi } from '../src/services/prosperusWebhook.ts';

// ─── Environment Validation ────────────────────────────────────────────────

const REQUIRED_ENV_VARS = [
  'CURSEDUCA_API_KEY',
  'ACCESS_TOKEN',
  'GOOGLE_SHEETS_CREDENTIALS',
  'GOOGLE_SHEET_ID',
  'PROSPERUS_WEBHOOK_URL',
  'PROSPERUS_WEBHOOK_SECRET',
] as const;

function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error('[FATAL] Missing required environment variables:');
    missing.forEach((v) => console.error(`  - ${v}`));
    process.exit(1);
  }
}

// ─── Google Sheets Reader ──────────────────────────────────────────────────

async function readReferenciaFromSheets(): Promise<ReferenciaRow[]> {
  const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS!);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: 'A:Z', // Dynamic range — reads all columns present in the spreadsheet
  });

  const rows = response.data.values;
  if (!rows || rows.length < 2) {
    console.warn('[WARN] Google Sheets returned no data rows');
    return [];
  }

  // Map header row to object keys (same logic as sheets-proxy)
  const headers = rows[0] as string[];
  console.log(`[SHEETS] Headers found: ${JSON.stringify(headers)}`);
  const data: ReferenciaRow[] = rows
    .slice(1)
    .map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h: string, i: number) => {
        obj[h] = row[i] || '';
      });
      return obj as unknown as ReferenciaRow;
    })
    .filter((row) => row.Email?.trim());

  return data;
}

// ─── CursoEduca API Direct Client ─────────────────────────────────────────

const CURSEDUCA_PAGE_SIZE = 1000;
const CURSEDUCA_CONCURRENT_PAGES = 3;

const CURSEDUCA_BASE_URLS: Record<string, string> = {
  members: 'https://prof.curseduca.pro',
  contents: 'https://clas.curseduca.pro',
};

function getCursEducaHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'api_key': process.env.CURSEDUCA_API_KEY!,
    'Authorization': `Bearer ${process.env.ACCESS_TOKEN!}`,
  };
}

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchCursEducaPage<T>(
  service: 'members' | 'contents',
  endpoint: string,
  params: Record<string, string | number>,
): Promise<ApiPaginatedResponse<T>> {
  const baseUrl = CURSEDUCA_BASE_URLS[service];
  const url = new URL(endpoint, baseUrl);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: getCursEducaHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      // Retry on 502/503/504 (transient server errors)
      if ((response.status === 502 || response.status === 503 || response.status === 504) && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * attempt;
        console.warn(`  [RETRY] ${endpoint} returned ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(delay);
        continue;
      }
      throw new Error(`CursoEduca API error ${response.status} on ${endpoint}: ${errorText}`);
    }

    let json: ApiPaginatedResponse<T>;
    try {
      json = await response.json() as ApiPaginatedResponse<T>;
    } catch {
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * attempt;
        console.warn(`  [RETRY] ${endpoint} returned invalid JSON, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(delay);
        continue;
      }
      throw new Error(`Invalid JSON response from CursoEduca API on ${endpoint}`);
    }

    if (!json.data || !Array.isArray(json.data)) {
      throw new Error(`Invalid API response on ${endpoint}: missing 'data' field`);
    }

    return json;
  }

  // Should not reach here, but TypeScript needs it
  throw new Error(`Failed to fetch ${endpoint} after ${MAX_RETRIES} attempts`);
}

async function fetchAllCursEducaPages<T>(
  service: 'members' | 'contents',
  endpoint: string,
  params: Record<string, string | number> = {},
): Promise<T[]> {
  const limit = CURSEDUCA_PAGE_SIZE;

  // First page to get totalCount
  const firstPage = await fetchCursEducaPage<T>(service, endpoint, { ...params, limit, offset: 0 });
  const allData: T[] = [...firstPage.data];
  const totalCount = firstPage.metadata?.totalCount ?? allData.length;
  const meta = firstPage.metadata as Record<string, unknown> | undefined;
  let hasMore = (meta?.hasMore ?? (meta as Record<string, unknown>)?.hasmore ?? false) as boolean;

  console.log(`  [FETCH] ${endpoint}: page 1 loaded (${allData.length}/${totalCount})`);

  // Remaining pages in parallel batches
  let offset = limit;

  while (hasMore) {
    const batch: Promise<ApiPaginatedResponse<T>>[] = [];

    for (let i = 0; i < CURSEDUCA_CONCURRENT_PAGES && hasMore; i++) {
      batch.push(fetchCursEducaPage<T>(service, endpoint, { ...params, limit, offset }));
      offset += limit;
      if (offset >= totalCount) hasMore = false;
    }

    const results = await Promise.all(batch);

    for (const result of results) {
      allData.push(...result.data);
      const rMeta = result.metadata as Record<string, unknown> | undefined;
      const pageHasMore = (rMeta?.hasMore ?? (rMeta as Record<string, unknown>)?.hasmore ?? false) as boolean;
      if (!pageHasMore) hasMore = false;
    }

    console.log(`  [FETCH] ${endpoint}: ${allData.length}/${totalCount} records loaded`);
  }

  return allData;
}

async function fetchMembers(): Promise<ApiMember[]> {
  return fetchAllCursEducaPages<ApiMember>('members', '/members');
}

async function fetchAccessReports(): Promise<ApiAccessReport[]> {
  return fetchAllCursEducaPages<ApiAccessReport>('members', '/reports/access');
}

async function fetchProgressReports(): Promise<ApiProgressReport[]> {
  return fetchAllCursEducaPages<ApiProgressReport>('contents', '/reports/progress');
}

async function fetchEnrollments(): Promise<ApiEnrollment[]> {
  return fetchAllCursEducaPages<ApiEnrollment>('contents', '/api/reports/enrollments');
}

// ─── Main Pipeline ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== Prosperus Report Generator ===');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('');

  // Step 1: Validate environment
  validateEnv();
  console.log('[OK] Environment variables validated');

  // Step 2: Read referencia from Google Sheets
  console.log('[STEP] Reading referencia from Google Sheets...');
  const referencia = await readReferenciaFromSheets();
  if (referencia.length === 0) {
    console.error('[FATAL] No referencia data returned from Google Sheets');
    process.exit(1);
  }
  console.log(`[OK] Referencia loaded: ${referencia.length} rows`);

  // Step 3: Fetch CursoEduca API data
  console.log('[STEP] Fetching CursoEduca API data...');
  const [members, accessReports, progressReports, enrollments] = await Promise.all([
    fetchMembers(),
    fetchAccessReports(),
    fetchProgressReports(),
    fetchEnrollments(),
  ]);
  console.log(`[OK] API data fetched:`);
  console.log(`  Members: ${members.length}`);
  console.log(`  Access reports: ${accessReports.length}`);
  console.log(`  Progress reports: ${progressReports.length}`);
  console.log(`  Enrollments: ${enrollments.length}`);

  // Step 4: Build ParsedDataset from API data
  console.log('[STEP] Building parsed dataset...');
  const dataset: ParsedDataset = buildParsedDatasetFromApi(
    referencia,
    members,
    accessReports,
    progressReports,
    enrollments,
  );

  // Step 5: Apply enrichments (Story 2.6)
  console.log('[STEP] Applying enrichments...');
  const emailToNome = buildEmailToNomeMap(referencia);
  enrichWithNome(dataset.acessos, emailToNome);
  enrichWithNome(dataset.conclusoes, emailToNome);
  enrichWithNome(dataset.progresso, emailToNome);
  enrichWithNome(dataset.ultimoAcesso, emailToNome);

  const emailToEmpresa = buildEmailToEmpresaMap(referencia);
  enrichWithEmpresa(dataset.acessos, emailToEmpresa);
  enrichWithEmpresa(dataset.conclusoes, emailToEmpresa);
  enrichWithEmpresa(dataset.progresso, emailToEmpresa);
  enrichWithEmpresa(dataset.ultimoAcesso, emailToEmpresa);

  dataset.acessos = injectMissingAccess(dataset.acessos, dataset.conclusoes, referencia);
  dataset.empresasUnicas = getUniqueEmpresas(referencia);
  console.log(`[OK] Enrichments applied. Companies: ${dataset.empresasUnicas.length}`);

  // Step 6: Build recipient map
  const recipients = buildRecipientMap(referencia);
  if (recipients.length === 0) {
    console.warn('[WARN] No recipients with "Recebe o relatorio?" = "Sim". Nothing to generate.');
    process.exit(0);
  }
  console.log(`[OK] Recipients: ${recipients.length}`);

  // Step 7: Generate HTML reports with cache per empresa
  console.log('[STEP] Generating HTML reports...');
  const dateDir = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const outputDir = path.join('output', 'reports', dateDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const htmlCache: Record<string, string> = {};
  let filesGenerated = 0;
  let fileErrors = 0;
  const companiesProcessed = new Set<string>();

  for (const { email, empresa } of recipients) {
    if (!htmlCache[empresa]) {
      const companyData = filterByEmpresa(dataset, empresa);
      const metrics = computeMetrics(companyData);
      htmlCache[empresa] = generateCompanyHTML(empresa, metrics, companyData);
      companiesProcessed.add(empresa);
    }

    try {
      const filePath = path.join(outputDir, `${email}.html`);
      fs.writeFileSync(filePath, htmlCache[empresa], 'utf-8');
      console.log(`  [OK] ${email}.html (${empresa})`);
      filesGenerated++;
    } catch (err) {
      console.error(`  [ERROR] Failed to write ${email}.html: ${err}`);
      fileErrors++;
    }
  }

  console.log(`[OK] HTML generation complete: ${filesGenerated} files, ${fileErrors} errors`);
  console.log(`[OK] Companies processed: ${companiesProcessed.size}`);

  // Step 8: Send via webhook
  console.log('[STEP] Sending reports via webhook...');
  const webhookUrl = process.env.PROSPERUS_WEBHOOK_URL!;
  const webhookSecret = process.env.PROSPERUS_WEBHOOK_SECRET!;

  let webhookOk = 0;
  let webhookFail = 0;

  for (const { email, empresa } of recipients) {
    const html = htmlCache[empresa];
    const title = `Relatorio ${empresa} — ${dateDir}`;
    try {
      const result = await sendReportToProsperusApi(email, title, html, webhookUrl, webhookSecret);
      if (result.ok) {
        console.log(`  [WEBHOOK OK] ${email}`);
        webhookOk++;
      } else {
        console.error(`  [WEBHOOK FAIL] ${email}: ${result.status} ${result.message ?? ''}`);
        webhookFail++;
      }
    } catch (err) {
      console.error(`  [WEBHOOK FAIL] ${email}: ${err}`);
      webhookFail++;
    }
  }

  // Step 9: Final summary
  console.log('');
  console.log('=== SUMMARY ===');
  console.log(`Companies processed: ${companiesProcessed.size}`);
  console.log(`Recipients generated: ${filesGenerated}`);
  console.log(`File write errors: ${fileErrors}`);
  console.log(`Webhook OK: ${webhookOk}`);
  console.log(`Webhook FAIL: ${webhookFail}`);
  console.log(`Output directory: ${outputDir}`);
  console.log('');

  // Exit code logic
  if (webhookOk === 0 && recipients.length > 0) {
    console.error('[FATAL] All webhooks failed');
    process.exit(1);
  }

  if (fileErrors > 0) {
    console.warn('[WARN] Some files failed to write, but continuing');
  }

  console.log('[DONE] Report generation complete');
  process.exit(0);
}

// ─── Entry Point ───────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('[FATAL] Unhandled error:', err);
  process.exit(1);
});
