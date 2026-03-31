// ─── Computed Metrics Types ──────────────────────────────────────────────────
// Shared across in-app dashboard rendering AND HTML export generation.
// Single source of truth — eliminates the previous duplication.

/** A single user row in the collaborator ranking table */
export interface UsuarioTabela {
    nome: string;
    email: string;
    empresa: string;
    acessos: number;
    conclusoes: number;
    ultimoAcesso: string | null;
    historico: { data: string; tipo: 'acesso' }[];
    conteudoRecente: { titulo: string; data?: string }[];
}

/** A single course/content progress entry (user × content) */
export interface ProgressoConteudo {
    nome: string;
    email: string;
    conteudo: string;
    aulasCompletas: number;
    modulosCompletos: number;
    progresso: number; // 0–100 from progresso.csv only
}

/** Daily access aggregation for the access evolution chart */
export interface AcessoDiario {
    dia: string; // YYYY-MM-DD
    acessos: number;
    usuarios: number;
}

/** Top module/user entry for bar charts */
export interface TopEntry {
    nome?: string;
    modulo?: string;
    conclusoes: number;
}

/** Full computed metrics for a dataset (global or per-company) */
export interface DashboardMetrics {
    totalFuncionarios: number;
    totalAcessos: number;
    totalConclusoes: number;
    usuariosAtivos: number;
    usuariosInativos: number;
    taxaEngajamento: string | number;
    acessosDiarios: AcessoDiario[];
    topModulos: TopEntry[];
    topUsuarios: TopEntry[];
    usuariosTabela: UsuarioTabela[];
    progressoPorConteudo: ProgressoConteudo[];
    usuariosComProgresso: number;
}

/** Per-user detail view (slide-over panel) */
export interface UserDetails {
    /** Access history entries */
    acessos: Array<{ data: string; nome: string }>;
    /** Completion entries */
    conclusoes: Array<{
        conteudo: string;
        modulo: string;
        aula: string;
        data: string;
    }>;
    /** Aggregated course progress */
    cursos: Record<string, {
        nome: string;
        modulos: number;
        aulas: number;
        ultimaData: Date | null;
    }>;
    /** Raw reference/ultimo_acesso info */
    info: Record<string, unknown> | null;
    /** Progress row if available */
    progresso?: Record<string, unknown>;
}

/** Sort configuration for tables */
export interface SortConfig {
    key: string;
    direction: 'asc' | 'desc';
}

/** Company export mapping */
export interface CompanyExportInfo {
    empresa: string;
    firstEmail: string; // used for output filename
    memberCount: number;
}
