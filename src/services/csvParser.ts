import * as Papa from 'papaparse';
import type {
    FileConfig,
    FileValidation,
    ParsedDataset,
    ReferenciaRow,
    AcessoRow,
    ConclusaoRow,
    ProgressoRow,
    UltimoAcessoRow,
} from '../types/csv';
import { safeParseDate } from '../utils/dateHelpers';

// ─── File Configuration ─────────────────────────────────────────────────────

export const REQUIRED_FILES: FileConfig[] = [
    {
        name: 'referencia.csv',
        description: 'Arquivo base com empresas e funcionários',
        expectedColumns: ['Nome', 'Email', 'Empresa'],
        requiredColumns: ['Email', 'Empresa'],
    },
    {
        name: 'acessos.csv',
        description: 'Registro de acessos à plataforma',
        expectedColumns: ['Nome', 'Email', 'Data'],
        requiredColumns: ['Email', 'Data'],
    },
    {
        name: 'conclusoes.csv',
        description: 'Aulas e módulos concluídos',
        expectedColumns: ['Nome', 'Email', 'CPF', 'Conteúdo', 'Módulo', 'Nome da aula', 'Data de conclusão'],
        requiredColumns: ['Email'],
    },
    {
        name: 'progresso.csv',
        description: 'Progresso dos usuários',
        expectedColumns: ['Nome', 'Email', 'CPF', 'Situação do membro', 'Progresso'],
        requiredColumns: ['Email'],
    },
    {
        name: 'ultimo_acesso.csv',
        description: 'Informações de último acesso',
        expectedColumns: ['Nome', 'Email', 'Último acesso', 'Situação'],
        requiredColumns: ['Email'],
    },
];

// ─── CSV Parsing ────────────────────────────────────────────────────────────

/**
 * Parses CSV text content into typed rows using PapaParse.
 */
export function parseCSV<T>(content: string): Papa.ParseResult<T> {
    return Papa.parse<T>(content, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
    });
}

/**
 * Validates that parsed CSV data contains required columns.
 */
export function validateFileStructure(
    parsedData: Record<string, unknown>[],
    fileConfig: FileConfig,
): FileValidation {
    if (!parsedData || parsedData.length === 0) {
        return { valid: false, error: 'Arquivo vazio ou inválido' };
    }

    const columns = Object.keys(parsedData[0]);
    const missingRequired = fileConfig.requiredColumns.filter(
        (col) => !columns.includes(col),
    );

    if (missingRequired.length > 0) {
        return {
            valid: false,
            error: 'Colunas obrigatórias não encontradas',
            details: {
                expected: fileConfig.expectedColumns,
                found: columns,
                missing: missingRequired,
            },
        };
    }

    return { valid: true, columns };
}

/**
 * Matches a file name to one of the required file configurations.
 */
export function matchFileConfig(fileName: string): FileConfig | undefined {
    return REQUIRED_FILES.find((reqFile) =>
        fileName.toLowerCase().includes(reqFile.name.split('.')[0].toLowerCase()),
    );
}

// ─── Data Enrichment ────────────────────────────────────────────────────────

/**
 * Creates email→empresa mapping from referencia.csv.
 */
export function buildEmailToEmpresaMap(
    referencia: ReferenciaRow[],
): Record<string, string> {
    const map: Record<string, string> = {};
    referencia.forEach((row) => {
        if (row.Email && row.Empresa) {
            map[row.Email.toLowerCase().trim()] = row.Empresa;
        }
    });
    return map;
}

/**
 * Enriches a dataset by adding the Empresa field to every row via email lookup.
 */
export function enrichWithEmpresa<T extends { Email?: string; Empresa?: string }>(
    dataset: T[],
    emailToEmpresa: Record<string, string>,
): void {
    dataset.forEach((row) => {
        if (row.Email) {
            const emailLower = row.Email.toLowerCase().trim();
            row.Empresa = emailToEmpresa[emailLower] ?? 'Não identificada';
        }
    });
}

/**
 * Builds the first-email-per-company map for output filename generation.
 * The first occurrence of each Empresa in referencia.csv determines the filename.
 */
export function buildCompanyFirstEmailMap(
    referencia: ReferenciaRow[],
): Record<string, string> {
    const map: Record<string, string> = {};
    referencia.forEach((row) => {
        if (row.Empresa && row.Email && !map[row.Empresa]) {
            map[row.Empresa] = row.Email.toLowerCase().trim();
        }
    });
    return map;
}

/**
 * Returns the unique sorted list of companies from referencia data.
 */
export function getUniqueEmpresas(referencia: ReferenciaRow[]): string[] {
    const empresas = new Set<string>();
    referencia.forEach((r) => {
        if (r.Empresa) empresas.add(r.Empresa);
    });
    return Array.from(empresas).sort();
}

// ─── Full Pipeline ──────────────────────────────────────────────────────────

/**
 * Processes all uploaded CSV files into an enriched, typed dataset.
 * This is the main pipeline entry point.
 */
export function processDataset(uploadedFiles: Record<string, unknown[]>): ParsedDataset {
    const referencia = (uploadedFiles['referencia.csv'] ?? []) as ReferenciaRow[];
    const acessos = (uploadedFiles['acessos.csv'] ?? []) as AcessoRow[];
    const conclusoes = (uploadedFiles['conclusoes.csv'] ?? []) as ConclusaoRow[];
    const progresso = (uploadedFiles['progresso.csv'] ?? []) as ProgressoRow[];
    const ultimoAcesso = (uploadedFiles['ultimo_acesso.csv'] ?? []) as UltimoAcessoRow[];

    // Build email → empresa mapping
    const emailToEmpresa = buildEmailToEmpresaMap(referencia);

    // Enrich all datasets with company information
    enrichWithEmpresa(acessos, emailToEmpresa);
    enrichWithEmpresa(conclusoes, emailToEmpresa);
    enrichWithEmpresa(progresso, emailToEmpresa);
    enrichWithEmpresa(ultimoAcesso, emailToEmpresa);

    // Compute unique companies
    const empresasUnicas = getUniqueEmpresas(referencia);

    return {
        referencia,
        acessos,
        conclusoes,
        progresso,
        ultimoAcesso,
        empresasUnicas,
    };
}

/**
 * Filters a parsed dataset to only include data for a specific company.
 */
export function filterByEmpresa(
    data: ParsedDataset,
    empresa: string,
): ParsedDataset {
    return {
        ...data,
        referencia: data.referencia.filter((r) => r.Empresa === empresa),
        acessos: data.acessos.filter((a) => a.Empresa === empresa),
        conclusoes: data.conclusoes.filter((c) => c.Empresa === empresa),
        progresso: data.progresso.filter((p) => p.Empresa === empresa),
        ultimoAcesso: data.ultimoAcesso.filter((u) => u.Empresa === empresa),
    };
}

/**
 * Filters a parsed dataset by a date range [start, end).
 * Only filters date-bearing arrays: acessos, conclusoes, ultimoAcesso.
 * referencia and progresso are kept intact (no date fields).
 */
export function filterByDateRange(
    data: ParsedDataset,
    start: Date,
    end: Date,
): ParsedDataset {
    const inRange = (dateStr: string | undefined | null): boolean => {
        const d = safeParseDate(dateStr);
        if (!d) return false;
        return d >= start && d < end;
    };

    return {
        ...data,
        acessos: data.acessos.filter((a) => inRange(a.Data)),
        conclusoes: data.conclusoes.filter((c) => inRange(c['Data de conclusão'])),
        ultimoAcesso: data.ultimoAcesso.filter((u) => inRange(u['Último acesso'])),
    };
}
