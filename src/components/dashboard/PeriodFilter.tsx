import { Calendar } from 'lucide-react';
import type { PeriodValue } from './period-utils.ts';
import { PERIOD_OPTIONS } from './period-utils.ts';

interface PeriodFilterProps {
    selected: PeriodValue;
    onSelect: (period: PeriodValue) => void;
    customRange: { start: string; end: string };
    onCustomRangeChange: (range: { start: string; end: string }) => void;
}

export default function PeriodFilter({ selected, onSelect, customRange, onCustomRangeChange }: PeriodFilterProps) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-prosperus-gold/50 shrink-0" />
                <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5 -mb-0.5">
                    {PERIOD_OPTIONS.map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => onSelect(value)}
                            className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 border
                                ${selected === value
                                    ? 'bg-prosperus-gold/15 text-prosperus-gold border-prosperus-gold/40'
                                    : 'bg-transparent text-prosperus-white/50 border-prosperus-white/10 hover:border-prosperus-white/25 hover:text-prosperus-white/70'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
            {selected === 'custom' && (
                <div className="flex items-center gap-2 ml-6">
                    <label className="text-xs text-prosperus-white/40">De:</label>
                    <input
                        type="date"
                        value={customRange.start}
                        onChange={(e) => onCustomRangeChange({ ...customRange, start: e.target.value })}
                        className="bg-prosperus-midnight/60 border border-prosperus-white/10 rounded-lg text-xs
                            text-prosperus-white py-1 px-2 focus:outline-none focus:border-prosperus-gold/40
                            transition-colors"
                    />
                    <label className="text-xs text-prosperus-white/40">Até:</label>
                    <input
                        type="date"
                        value={customRange.end}
                        onChange={(e) => onCustomRangeChange({ ...customRange, end: e.target.value })}
                        className="bg-prosperus-midnight/60 border border-prosperus-white/10 rounded-lg text-xs
                            text-prosperus-white py-1 px-2 focus:outline-none focus:border-prosperus-gold/40
                            transition-colors"
                    />
                </div>
            )}
        </div>
    );
}
