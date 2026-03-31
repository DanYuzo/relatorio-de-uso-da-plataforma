import { Wifi, Upload } from 'lucide-react';
import type { DataSource } from '../../services/dataSourceOrchestrator.ts';

interface DataSourceSelectorProps {
    selected: DataSource;
    onSelect: (source: DataSource) => void;
}

const options: { value: DataSource; label: string; icon: typeof Wifi }[] = [
    { value: 'api', label: 'Conexão API', icon: Wifi },
    { value: 'csv', label: 'Upload Manual', icon: Upload },
];

export default function DataSourceSelector({ selected, onSelect }: DataSourceSelectorProps) {
    return (
        <div className="flex flex-col sm:flex-row gap-2 mb-6">
            {options.map(({ value, label, icon: Icon }) => (
                <button
                    key={value}
                    onClick={() => onSelect(value)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                        transition-all duration-200 border
                        ${selected === value
                            ? 'bg-prosperus-gold/15 text-prosperus-gold border-prosperus-gold/40'
                            : 'bg-transparent text-prosperus-white/50 border-prosperus-white/10 hover:border-prosperus-white/25 hover:text-prosperus-white/70'
                        }`}
                >
                    <Icon className="h-4 w-4" />
                    {label}
                </button>
            ))}
        </div>
    );
}
