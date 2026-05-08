import { describe, it, expect } from 'vitest';
import { computeMetrics } from '../../src/services/metricsComputer';
import type { ParsedDataset } from '../../src/types/csv';

describe('Metrics Computer', () => {
    const mockDataset: ParsedDataset = {
        referencia: [
            { Nome: 'User A', Email: 'a@test.com', Empresa: 'Comp A' },
            { Nome: 'User B', Email: 'b@test.com', Empresa: 'Comp A' },
            { Nome: 'User C', Email: 'c@test.com', Empresa: 'Comp A' },
        ],
        acessos: [
            // User A accessed twice on same day
            { Email: 'a@test.com', Data: '2023-01-01T12:00:00', Empresa: 'Comp A' },
            { Email: 'a@test.com', Data: '2023-01-01T12:00:00', Empresa: 'Comp A' },
            // User B accessed once on different day
            { Email: 'b@test.com', Data: '2023-01-02T12:00:00', Empresa: 'Comp A' },
        ],
        conclusoes: [
            { Email: 'a@test.com', 'Módulo': 'Mod 1', 'Conteúdo': 'Course X', Empresa: 'Comp A' },
        ],
        progresso: [
            { Email: 'a@test.com', Progresso: '50%', 'Conteúdo': 'Course X', Empresa: 'Comp A' },
        ],
        ultimoAcesso: [],
        empresasUnicas: ['Comp A'],
    };

    it('should calculate total employees correctly', () => {
        const metrics = computeMetrics(mockDataset);
        expect(metrics.totalFuncionarios).toBe(3);
    });

    it('should calculate active users (users with valid access/completion)', () => {
        const metrics = computeMetrics(mockDataset);
        // User A and B have access; User C has nothing.
        expect(metrics.usuariosAtivos).toBe(2);
        expect(metrics.usuariosInativos).toBe(1);
    });

    it('should group accesses by day', () => {
        const metrics = computeMetrics(mockDataset);
        expect(metrics.acessosDiarios).toHaveLength(2);
        // 2023-01-01: 2 accesses, 1 unique user
        expect(metrics.acessosDiarios[0].dia).toBe('2023-01-01');
        expect(metrics.acessosDiarios[0].acessos).toBe(2);
        expect(metrics.acessosDiarios[0].usuarios).toBe(1);
        // 2023-01-02: 1 access, 1 unique user
        expect(metrics.acessosDiarios[1].dia).toBe('2023-01-02');
    });

    it('should compute user table rows', () => {
        const metrics = computeMetrics(mockDataset);
        const userA = metrics.usuariosTabela.find(u => u.email === 'a@test.com');
        expect(userA).toBeDefined();
        expect(userA?.acessos).toBe(2);
        expect(userA?.conclusoes).toBe(1);

        const userC = metrics.usuariosTabela.find(u => u.email === 'c@test.com');
        expect(userC?.acessos).toBe(0);
    });

    it('should combine progress data', () => {
        const metrics = computeMetrics(mockDataset);
        const courseX = metrics.progressoPorConteudo.find(p => p.email === 'a@test.com' && p.conteudo === 'Course X');
        expect(courseX).toBeDefined();
        expect(courseX?.progresso).toBe(50);
        expect(courseX?.modulosCompletos).toBe(1);
    });

    it('should keep full access and content history without trimming', () => {
        const acessosMany = Array.from({ length: 8 }, (_, i) => ({
            Email: 'a@test.com',
            Data: `2023-02-0${(i % 9) + 1}T12:00:00`,
            Empresa: 'Comp A',
        }));
        const conclusoesMany = Array.from({ length: 7 }, (_, i) => ({
            Email: 'a@test.com',
            Nome: 'User A',
            'Módulo': `Mod ${i + 1}`,
            'Conteúdo': 'Course X',
            'Nome da aula': `Aula ${i + 1}`,
            'Data de conclusão': `2023-02-1${i}T12:00:00`,
            Empresa: 'Comp A',
        }));
        const dataset: ParsedDataset = {
            ...mockDataset,
            acessos: acessosMany,
            conclusoes: conclusoesMany,
        };
        const metrics = computeMetrics(dataset);
        const userA = metrics.usuariosTabela.find(u => u.email === 'a@test.com');
        expect(userA?.historico).toHaveLength(8);
        expect(userA?.conteudoRecente).toHaveLength(7);
    });

    it('should include courses with completed lessons even when enrollment shows 0%', () => {
        const dataset: ParsedDataset = {
            ...mockDataset,
            conclusoes: [
                { Email: 'a@test.com', Nome: 'User A', 'Módulo': 'Mod 1', 'Conteúdo': 'Course Y', 'Nome da aula': 'Aula 1', Empresa: 'Comp A' },
                { Email: 'a@test.com', Nome: 'User A', 'Módulo': 'Mod 2', 'Conteúdo': 'Course Y', 'Nome da aula': 'Aula 2', Empresa: 'Comp A' },
            ],
            progresso: [
                // Enrollment exists but lags at 0%
                { Email: 'a@test.com', Progresso: '0%', 'Conteúdo': 'Course Y', Empresa: 'Comp A' },
            ],
        };
        const metrics = computeMetrics(dataset);
        const courseY = metrics.progressoPorConteudo.find(p => p.email === 'a@test.com' && p.conteudo === 'Course Y');
        expect(courseY).toBeDefined();
        expect(courseY?.aulasCompletas).toBe(2);
        expect(courseY?.progresso).toBe(0);
    });

    it('should include courses with completed lessons even when enrollment is missing', () => {
        const dataset: ParsedDataset = {
            ...mockDataset,
            conclusoes: [
                { Email: 'a@test.com', Nome: 'User A', 'Módulo': 'Mod 1', 'Conteúdo': 'Course Z', 'Nome da aula': 'Aula 1', Empresa: 'Comp A' },
            ],
            progresso: [],
        };
        const metrics = computeMetrics(dataset);
        const courseZ = metrics.progressoPorConteudo.find(p => p.email === 'a@test.com' && p.conteudo === 'Course Z');
        expect(courseZ).toBeDefined();
        expect(courseZ?.aulasCompletas).toBe(1);
    });

    it('should still hide enrollments at 0% with no completed lessons', () => {
        const dataset: ParsedDataset = {
            ...mockDataset,
            conclusoes: [],
            progresso: [
                { Email: 'a@test.com', Progresso: '0%', 'Conteúdo': 'Empty Course', Empresa: 'Comp A' },
            ],
        };
        const metrics = computeMetrics(dataset);
        const empty = metrics.progressoPorConteudo.find(p => p.conteudo === 'Empty Course');
        expect(empty).toBeUndefined();
    });
});
