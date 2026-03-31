export type PeriodValue = 'all' | 'this-month' | 'last-month' | 'this-year' | 'last-year' | 'custom';

interface PeriodOption {
    value: PeriodValue;
    label: string;
}

export const PERIOD_OPTIONS: PeriodOption[] = [
    { value: 'all', label: 'Todo período' },
    { value: 'this-month', label: 'Este mês' },
    { value: 'last-month', label: 'Mês passado' },
    { value: 'this-year', label: 'Este ano' },
    { value: 'last-year', label: 'Ano passado' },
    { value: 'custom', label: 'Personalizado' },
];

export function getPeriodLabel(period: PeriodValue): string {
    if (period === 'custom') return 'Personalizado';
    return PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? 'Todo período';
}

export function getPeriodDateRange(
    period: PeriodValue,
    customRange?: { start: string; end: string },
): { start: Date; end: Date } | null {
    if (period === 'all') return null;

    if (period === 'custom') {
        if (!customRange?.start || !customRange?.end) return null;
        const start = new Date(customRange.start + 'T00:00:00');
        const end = new Date(customRange.end + 'T23:59:59');
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
        // end is inclusive — move to start of next day
        end.setDate(end.getDate() + 1);
        end.setHours(0, 0, 0, 0);
        return { start, end };
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    switch (period) {
        case 'this-month':
            return { start: new Date(year, month, 1), end: new Date(year, month + 1, 1) };
        case 'last-month':
            return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
        case 'this-year':
            return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
        case 'last-year':
            return { start: new Date(year - 1, 0, 1), end: new Date(year, 0, 1) };
        default:
            return null;
    }
}
