/**
 * Date formatting utilities using native Intl APIs (no external dependency).
 * All formatters default to pt-BR locale and America/Sao_Paulo timezone.
 */

const LOCALE = 'pt-BR';

const MONTHS_SHORT = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

/**
 * Safely parses a date string. Returns null if invalid.
 */
export function safeParseDate(value: string | undefined | null): Date | null {
    if (!value) return null;
    try {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
    } catch {
        return null;
    }
}

/**
 * Formats a date string to DD/MM/YYYY in pt-BR locale.
 */
export function formatDateBR(value: string | Date | undefined | null): string {
    if (!value) return 'Data não informada';
    try {
        const date = value instanceof Date ? value : new Date(value);
        if (isNaN(date.getTime())) return 'Data inválida';
        return date.toLocaleDateString(LOCALE);
    } catch {
        return 'Data inválida';
    }
}

/**
 * Formats a YYYY-MM-DD string to DD/MM (chart tick labels).
 */
export function formatDayMonth(isoDay: string): string {
    if (!isoDay) return '';
    const parts = isoDay.split('-');
    if (parts.length !== 3) return isoDay;
    return `${parts[2]}/${parts[1]}`;
}

/**
 * Formats a YYYY-MM-DD string to "DD de Mon YYYY" (tooltip labels).
 */
export function formatFullDate(isoDay: string): string {
    if (!isoDay) return '';
    const parts = isoDay.split('-');
    if (parts.length !== 3) return isoDay;
    const [year, month, day] = parts;
    const monthIdx = parseInt(month, 10) - 1;
    if (monthIdx < 0 || monthIdx > 11) return isoDay;
    return `${day} de ${MONTHS_SHORT[monthIdx]} ${year}`;
}

/**
 * Returns a standardized YYYY-MM-DD string from a Date-like value.
 * Used for grouping accesses by day.
 */
export function toISODay(value: string | undefined | null): string | null {
    const date = safeParseDate(value);
    if (!date) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Returns a human-readable timestamp string (pt-BR).
 */
export function formatTimestamp(): string {
    return new Date().toLocaleString(LOCALE);
}
