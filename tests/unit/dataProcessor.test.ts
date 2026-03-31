import { describe, it, expect } from 'vitest';
import {
    buildEmailToEmpresaMap,
    enrichWithEmpresa,
    buildCompanyFirstEmailMap,
    validateFileStructure,
} from '../../src/services/csvParser';
import type { ReferenciaRow, AcessoRow } from '../../src/types/csv';

describe('Data Processor', () => {
    describe('buildEmailToEmpresaMap', () => {
        it('should create a map of lowercase emails to companies', () => {
            const input: ReferenciaRow[] = [
                { Email: 'Test@Example.com', Empresa: 'Company A' },
                { Email: 'other@example.com', Empresa: 'Company B' },
            ];
            const result = buildEmailToEmpresaMap(input);
            expect(result).toEqual({
                'test@example.com': 'Company A',
                'other@example.com': 'Company B',
            });
        });

        it('should ignore rows without email or company', () => {
            const input: ReferenciaRow[] = [
                { Email: 'valid@test.com', Empresa: 'Comp' },
                { Email: undefined, Empresa: 'Comp' },
                { Email: 'test@test.com', Empresa: undefined },
            ];
            const result = buildEmailToEmpresaMap(input);
            expect(Object.keys(result)).toHaveLength(1);
        });
    });

    describe('enrichWithEmpresa', () => {
        it('should add company name to rows based on email', () => {
            const emailMap = { 'test@example.com': 'Company A' };
            const dataset: AcessoRow[] = [
                { Email: 'Test@Example.com', Data: '2023-01-01' },
                { Email: 'unknown@example.com', Data: '2023-01-01' },
            ];
            enrichWithEmpresa(dataset, emailMap);
            expect(dataset[0].Empresa).toBe('Company A');
            expect(dataset[1].Empresa).toBe('Não identificada');
        });
    });

    describe('buildCompanyFirstEmailMap', () => {
        it('should map each company to its first encountered email', () => {
            const input: ReferenciaRow[] = [
                { Email: 'first@a.com', Empresa: 'Company A' },
                { Email: 'second@a.com', Empresa: 'Company A' },
                { Email: 'first@b.com', Empresa: 'Company B' },
            ];
            const result = buildCompanyFirstEmailMap(input);
            expect(result).toEqual({
                'Company A': 'first@a.com',
                'Company B': 'first@b.com',
            });
        });
    });

    describe('validateFileStructure', () => {
        it('should return valid for correct structure', () => {
            const data = [{ Email: 'a@a.com', Empresa: 'A' }];
            const config = {
                name: 'test',
                description: 'test',
                expectedColumns: ['Email', 'Empresa'],
                requiredColumns: ['Email'],
            };
            const result = validateFileStructure(data, config);
            expect(result.valid).toBe(true);
        });

        it('should return invalid if required columns are missing', () => {
            const data = [{ Nome: 'Test' }];
            const config = {
                name: 'test',
                description: 'test',
                expectedColumns: ['Email'],
                requiredColumns: ['Email'],
            };
            const result = validateFileStructure(data, config);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Colunas obrigatórias');
        });
    });
});
