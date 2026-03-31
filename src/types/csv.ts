// ─── CSV Row Interfaces ─────────────────────────────────────────────────────
// Type-safe representations of each CSV source file's row structure.
// All fields are optional to handle missing/malformed data gracefully.

/** referencia.csv — Master reference mapping email → company */
export interface ReferenciaRow {
    Nome?: string;
    Cel?: string;
    Email?: string;
    Empresa?: string;
    Programa?: string;
    PC?: string;
    'Observações'?: string;
    'Recebe o relatório?'?: string;
}

/** acessos.csv — Platform access log */
export interface AcessoRow {
    Nome?: string;
    Email?: string;
    Data?: string;
    /** Enriched at processing time from referencia.csv */
    Empresa?: string;
}

/** conclusoes.csv — Lesson/module completions */
export interface ConclusaoRow {
    Nome?: string;
    Email?: string;
    CPF?: string;
    'Conteúdo'?: string;
    'Módulo'?: string;
    'Nome da aula'?: string;
    'Data de conclusão'?: string;
    /** Enriched at processing time */
    Empresa?: string;
}

/** progresso.csv — User progress percentage */
export interface ProgressoRow {
    Nome?: string;
    Email?: string;
    CPF?: string;
    'Situação do membro'?: string;
    Progresso?: string | number;
    /** Dynamic content key (varies across exports) */
    [key: string]: string | number | undefined;
}

/** ultimo_acesso.csv — Last access info */
export interface UltimoAcessoRow {
    Nome?: string;
    Email?: string;
    'Último acesso'?: string;
    'Situação'?: string;
    /** Enriched at processing time */
    Empresa?: string;
}

// ─── File Configuration ─────────────────────────────────────────────────────

export interface FileConfig {
    name: string;
    description: string;
    expectedColumns: string[];
    requiredColumns: string[];
}

export interface FileValidation {
    valid: boolean;
    error?: string;
    columns?: string[];
    details?: {
        expected: string[];
        found: string[];
        missing: string[];
    };
    originalFileName?: string;
    rowCount?: number;
}

// ─── Parsed Data Container ──────────────────────────────────────────────────

export interface ParsedDataset {
    referencia: ReferenciaRow[];
    acessos: AcessoRow[];
    conclusoes: ConclusaoRow[];
    progresso: ProgressoRow[];
    ultimoAcesso: UltimoAcessoRow[];
    empresasUnicas: string[];
}
