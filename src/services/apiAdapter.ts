import type {
  ApiMember,
  ApiAccessReport,
  ApiProgressReport,
  ApiEnrollment,
} from '../types/api.ts';
import type {
  ReferenciaRow,
  AcessoRow,
  ConclusaoRow,
  ProgressoRow,
  UltimoAcessoRow,
  ParsedDataset,
} from '../types/csv.ts';
import {
  buildEmailToEmpresaMap,
  enrichWithEmpresa,
  getUniqueEmpresas,
} from './csvParser.ts';

// ─── Situation Mapping ──────────────────────────────────────────────────────

const SITUATION_MAP: Record<number, string> = {
  1: 'Ativo',
  2: 'Inativo',
  3: 'Cancelado',
};

export function mapSituationId(id: number | undefined): string {
  if (id == null) return '';
  return SITUATION_MAP[id] ?? `Desconhecido (${id})`;
}

// ─── Transformers ───────────────────────────────────────────────────────────

export function transformMembersToUltimoAcesso(
  members: ApiMember[],
): UltimoAcessoRow[] {
  return members.map((m) => ({
    Nome: m.name,
    Email: m.email,
    'Último acesso': m.lastAccess ?? m.lastLogin ?? '',
    'Situação': m.situation ?? '',
  }));
}

export function transformAccessToAcessos(
  reports: ApiAccessReport[],
): AcessoRow[] {
  return reports.map((r) => ({
    Nome: r.member?.name ?? '',
    Email: r.member?.email ?? '',
    Data: r.createdAt,
  }));
}

export function transformProgressToConclusoes(
  reports: ApiProgressReport[],
): ConclusaoRow[] {
  return reports.map((r) => ({
    Nome: r.member.name ?? '',
    Email: r.member.email,
    'Conteúdo': r.lesson?.section?.content?.title ?? '',
    'Módulo': r.lesson?.section?.title ?? '',
    'Nome da aula': r.lesson?.title ?? '',
    'Data de conclusão': r.finishedAt,
  }));
}

export function transformEnrollmentsToProgresso(
  enrollments: ApiEnrollment[],
): ProgressoRow[] {
  return enrollments.map((e) => ({
    Nome: e.member.name,
    Email: e.member.email,
    'Situação do membro': mapSituationId(e.situationId),
    Progresso: `${e.progress}%`,
    'Conteúdo': e.content.title,
  }));
}

// ─── Dataset Builder ────────────────────────────────────────────────────────

function filterByKnownEmails<T extends { Email?: string }>(
  rows: T[],
  knownEmails: Set<string>,
): T[] {
  return rows.filter((r) => {
    if (!r.Email) return false;
    return knownEmails.has(r.Email.toLowerCase().trim());
  });
}

export function buildParsedDatasetFromApi(
  referencia: ReferenciaRow[],
  members: ApiMember[],
  accessReports: ApiAccessReport[],
  progressReports: ApiProgressReport[],
  enrollments: ApiEnrollment[],
): ParsedDataset {
  const emailToEmpresa = buildEmailToEmpresaMap(referencia);
  const knownEmails = new Set(Object.keys(emailToEmpresa));

  // Transform API → CSV types
  const acessosAll = transformAccessToAcessos(accessReports);
  const conclusoesAll = transformProgressToConclusoes(progressReports);
  const progressoAll = transformEnrollmentsToProgresso(enrollments);
  const ultimoAcessoAll = transformMembersToUltimoAcesso(members);

  // Keep only people present in referencia.csv
  const acessos = filterByKnownEmails(acessosAll, knownEmails);
  const conclusoes = filterByKnownEmails(conclusoesAll, knownEmails);
  const progresso = filterByKnownEmails(progressoAll, knownEmails);
  const ultimoAcesso = filterByKnownEmails(ultimoAcessoAll, knownEmails);

  // Enrich with empresa
  enrichWithEmpresa(acessos, emailToEmpresa);
  enrichWithEmpresa(conclusoes, emailToEmpresa);
  enrichWithEmpresa(progresso, emailToEmpresa);
  enrichWithEmpresa(ultimoAcesso, emailToEmpresa);

  const empresasUnicas = getUniqueEmpresas(referencia);

  return { referencia, acessos, conclusoes, progresso, ultimoAcesso, empresasUnicas };
}
