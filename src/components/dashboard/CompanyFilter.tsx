import { useMemo } from 'react';
import { Filter } from 'lucide-react';

interface CompanyFilterProps {
    companies: string[];
    selected: string | null;
    onSelect: (empresa: string | null) => void;
}

export default function CompanyFilter({ companies, selected, onSelect }: CompanyFilterProps) {
    const sorted = useMemo(() => [...companies].sort((a, b) => a.localeCompare(b, 'pt-BR')), [companies]);

    return (
        <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-prosperus-gold/50 shrink-0" />
            <select
                value={selected ?? '__all__'}
                onChange={(e) => onSelect(e.target.value === '__all__' ? null : e.target.value)}
                className="bg-prosperus-midnight/60 border border-prosperus-white/10 rounded-lg text-sm
                   text-prosperus-white py-1.5 px-3 focus:outline-none focus:border-prosperus-gold/40
                   transition-colors min-w-0 flex-1 sm:flex-none sm:w-auto appearance-none
                   cursor-pointer"
            >
                <option value="__all__">Todas as empresas ({companies.length})</option>
                {sorted.map((emp) => (
                    <option key={emp} value={emp}>
                        {emp}
                    </option>
                ))}
            </select>
        </div>
    );
}
