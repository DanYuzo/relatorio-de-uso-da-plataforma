import { describe, it, expect } from 'vitest';
import {
  mapSituationId,
  transformMembersToUltimoAcesso,
  transformAccessToAcessos,
  transformProgressToConclusoes,
  transformEnrollmentsToProgresso,
  buildParsedDatasetFromApi,
} from '../../src/services/apiAdapter';
import type { ApiMember, ApiAccessReport, ApiProgressReport, ApiEnrollment } from '../../src/types/api';
import type { ReferenciaRow } from '../../src/types/csv';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const mockMembers: ApiMember[] = [
  {
    id: 1,
    name: 'João Silva',
    email: 'joao@empresa.com',
    lastAccess: '2026-03-15T10:00:00.000Z',
    lastLogin: '2026-03-14T08:00:00.000Z',
    situation: 'Ativo',
  },
  {
    id: 2,
    name: 'Maria Santos',
    email: 'maria@empresa.com',
    situation: 'Inativo',
  },
];

const mockAccessReports: ApiAccessReport[] = [
  {
    createdAt: '2026-03-15T10:30:00.000Z',
    member: { name: 'João Silva', email: 'joao@empresa.com' },
  },
  {
    createdAt: '2026-03-14T09:00:00.000Z',
    member: { email: 'maria@empresa.com' },
  },
];

const mockProgressReports: ApiProgressReport[] = [
  {
    id: 1,
    finishedAt: '2026-03-10T15:00:00.000Z',
    lesson: {
      id: 10,
      title: 'Introdução ao React',
      section: {
        id: 5,
        title: 'Módulo Frontend',
        content: {
          id: 3,
          title: 'Curso Completo Web',
          slug: 'curso-web',
        },
      },
    },
    member: { id: 1, email: 'joao@empresa.com', name: 'João Silva' },
    enrollment: { id: 100, progress: 75, group: { id: 1, name: 'Turma A' } },
  },
  {
    id: 2,
    finishedAt: '2026-03-11T12:00:00.000Z',
    lesson: {
      id: 20,
      title: 'Aula Avançada',
    },
    member: { id: 2, email: 'maria@empresa.com' },
  },
];

const mockEnrollments: ApiEnrollment[] = [
  {
    id: 100,
    content: { id: 3, title: 'Curso Completo Web' },
    member: { id: 1, name: 'João Silva', email: 'joao@empresa.com' },
    situationId: 1,
    progress: 75,
  },
  {
    id: 101,
    content: { id: 4, title: 'Curso de TypeScript' },
    member: { id: 2, name: 'Maria Santos', email: 'maria@empresa.com' },
    situationId: 2,
    progress: 100,
  },
];

const mockReferencia: ReferenciaRow[] = [
  { Nome: 'João Silva', Email: 'joao@empresa.com', Empresa: 'Acme Corp' },
  { Nome: 'Maria Santos', Email: 'maria@empresa.com', Empresa: 'Acme Corp' },
  { Nome: 'Pedro Lima', Email: 'pedro@other.com', Empresa: 'Other Inc' },
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('apiAdapter', () => {
  describe('mapSituationId', () => {
    it('should map known situation IDs', () => {
      expect(mapSituationId(1)).toBe('Ativo');
      expect(mapSituationId(2)).toBe('Inativo');
      expect(mapSituationId(3)).toBe('Cancelado');
    });

    it('should return fallback for unknown IDs', () => {
      expect(mapSituationId(99)).toBe('Desconhecido (99)');
    });

    it('should return empty string for undefined', () => {
      expect(mapSituationId(undefined)).toBe('');
    });
  });

  describe('transformMembersToUltimoAcesso', () => {
    it('should map member fields to UltimoAcessoRow', () => {
      const result = transformMembersToUltimoAcesso(mockMembers);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        Nome: 'João Silva',
        Email: 'joao@empresa.com',
        'Último acesso': '2026-03-15T10:00:00.000Z',
        'Situação': 'Ativo',
      });
    });

    it('should fallback to lastLogin when lastAccess is missing', () => {
      const members: ApiMember[] = [
        { id: 1, name: 'Test', email: 'test@test.com', lastLogin: '2026-01-01T00:00:00Z' },
      ];
      const result = transformMembersToUltimoAcesso(members);
      expect(result[0]['Último acesso']).toBe('2026-01-01T00:00:00Z');
    });

    it('should return empty string when both access dates are missing', () => {
      const result = transformMembersToUltimoAcesso([mockMembers[1]]);
      expect(result[0]['Último acesso']).toBe('');
    });

    it('should handle empty array', () => {
      expect(transformMembersToUltimoAcesso([])).toEqual([]);
    });
  });

  describe('transformAccessToAcessos', () => {
    it('should map access report fields to AcessoRow', () => {
      const result = transformAccessToAcessos(mockAccessReports);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        Nome: 'João Silva',
        Email: 'joao@empresa.com',
        Data: '2026-03-15T10:30:00.000Z',
      });
    });

    it('should use empty string for missing optional fields', () => {
      const result = transformAccessToAcessos(mockAccessReports);
      expect(result[1].Nome).toBe('');
    });

    it('should handle empty array', () => {
      expect(transformAccessToAcessos([])).toEqual([]);
    });
  });

  describe('transformProgressToConclusoes', () => {
    it('should map progress reports to ConclusaoRow with full nesting', () => {
      const result = transformProgressToConclusoes(mockProgressReports);
      expect(result[0]).toEqual({
        Nome: 'João Silva',
        Email: 'joao@empresa.com',
        'Conteúdo': 'Curso Completo Web',
        'Módulo': 'Módulo Frontend',
        'Nome da aula': 'Introdução ao React',
        'Data de conclusão': '2026-03-10T15:00:00.000Z',
      });
    });

    it('should handle missing nested section/content', () => {
      const result = transformProgressToConclusoes(mockProgressReports);
      expect(result[1]['Conteúdo']).toBe('');
      expect(result[1]['Módulo']).toBe('');
      expect(result[1]['Nome da aula']).toBe('Aula Avançada');
    });

    it('should handle empty array', () => {
      expect(transformProgressToConclusoes([])).toEqual([]);
    });
  });

  describe('transformEnrollmentsToProgresso', () => {
    it('should map enrollments to ProgressoRow', () => {
      const result = transformEnrollmentsToProgresso(mockEnrollments);
      expect(result[0]).toEqual({
        Nome: 'João Silva',
        Email: 'joao@empresa.com',
        'Situação do membro': 'Ativo',
        Progresso: '75%',
        'Conteúdo': 'Curso Completo Web',
      });
    });

    it('should map situation correctly', () => {
      const result = transformEnrollmentsToProgresso(mockEnrollments);
      expect(result[1]['Situação do membro']).toBe('Inativo');
    });

    it('should format progress as percentage string', () => {
      const result = transformEnrollmentsToProgresso(mockEnrollments);
      expect(result[1].Progresso).toBe('100%');
    });

    it('should handle empty array', () => {
      expect(transformEnrollmentsToProgresso([])).toEqual([]);
    });
  });

  describe('buildParsedDatasetFromApi', () => {
    it('should build a complete ParsedDataset', () => {
      const result = buildParsedDatasetFromApi(
        mockReferencia,
        mockMembers,
        mockAccessReports,
        mockProgressReports,
        mockEnrollments,
      );

      expect(result.referencia).toBe(mockReferencia);
      expect(result.acessos).toHaveLength(2);
      expect(result.conclusoes).toHaveLength(2);
      expect(result.progresso).toHaveLength(2);
      expect(result.ultimoAcesso).toHaveLength(2);
      expect(result.empresasUnicas).toEqual(['Acme Corp', 'Other Inc']);
    });

    it('should enrich data with Empresa from referencia', () => {
      const result = buildParsedDatasetFromApi(
        mockReferencia,
        mockMembers,
        mockAccessReports,
        mockProgressReports,
        mockEnrollments,
      );

      expect(result.acessos[0].Empresa).toBe('Acme Corp');
      expect(result.conclusoes[0].Empresa).toBe('Acme Corp');
      expect(result.progresso[0].Empresa).toBe('Acme Corp');
      expect(result.ultimoAcesso[0].Empresa).toBe('Acme Corp');
    });

    it('should exclude records with emails not in referencia', () => {
      const limitedRef: ReferenciaRow[] = [
        { Email: 'joao@empresa.com', Empresa: 'Acme Corp' },
      ];
      const result = buildParsedDatasetFromApi(
        limitedRef,
        mockMembers,
        mockAccessReports,
        mockProgressReports,
        mockEnrollments,
      );

      // maria@empresa.com is NOT in limitedRef → filtered out
      expect(result.ultimoAcesso).toHaveLength(1);
      expect(result.ultimoAcesso[0].Email).toBe('joao@empresa.com');
      expect(result.acessos).toHaveLength(1);
      expect(result.conclusoes).toHaveLength(1);
      expect(result.progresso).toHaveLength(1);
    });

    it('should derive empresasUnicas from referencia, not from API groups', () => {
      const result = buildParsedDatasetFromApi(
        mockReferencia,
        mockMembers,
        mockAccessReports,
        mockProgressReports,
        mockEnrollments,
      );

      expect(result.empresasUnicas).toEqual(['Acme Corp', 'Other Inc']);
    });

    it('should handle all empty arrays', () => {
      const result = buildParsedDatasetFromApi([], [], [], [], []);

      expect(result.referencia).toEqual([]);
      expect(result.acessos).toEqual([]);
      expect(result.conclusoes).toEqual([]);
      expect(result.progresso).toEqual([]);
      expect(result.ultimoAcesso).toEqual([]);
      expect(result.empresasUnicas).toEqual([]);
    });

    it('should produce a dataset compatible with computeMetrics', () => {
      const result = buildParsedDatasetFromApi(
        mockReferencia,
        mockMembers,
        mockAccessReports,
        mockProgressReports,
        mockEnrollments,
      );

      // Verify structural compatibility with ParsedDataset
      expect(result).toHaveProperty('referencia');
      expect(result).toHaveProperty('acessos');
      expect(result).toHaveProperty('conclusoes');
      expect(result).toHaveProperty('progresso');
      expect(result).toHaveProperty('ultimoAcesso');
      expect(result).toHaveProperty('empresasUnicas');
      expect(Array.isArray(result.empresasUnicas)).toBe(true);
    });
  });
});
