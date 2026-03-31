import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import type { ProgressoConteudo, SortConfig } from '../../types/metrics';

interface ProgressTableProps {
    data: ProgressoConteudo[];
}

export default function ProgressTable({ data }: ProgressTableProps) {
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortConfig>({ key: 'progresso', direction: 'desc' });
    const [page, setPage] = useState(0);
    const pageSize = 15;

    const filtered = useMemo(() => {
        let result = data;
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                (p) => p.nome.toLowerCase().includes(q) || p.conteudo.toLowerCase().includes(q),
            );
        }
        result = [...result].sort((a, b) => {
            const dir = sort.direction === 'asc' ? 1 : -1;
            if (sort.key === 'progresso') return (a.progresso - b.progresso) * dir;
            if (sort.key === 'aulasCompletas') return (a.aulasCompletas - b.aulasCompletas) * dir;
            return (a[sort.key as keyof ProgressoConteudo] as string ?? '')
                .localeCompare(String((b[sort.key as keyof ProgressoConteudo] as string) ?? ''), 'pt-BR') * dir;
        });
        return result;
    }, [data, search, sort]);

    const totalPages = Math.ceil(filtered.length / pageSize);
    const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

    const toggleSort = (key: string) => {
        setSort((prev) => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
        }));
        setPage(0);
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sort.key !== columnKey) return null;
        return sort.direction === 'asc'
            ? <ChevronUp className="h-3 w-3 text-prosperus-gold" />
            : <ChevronDown className="h-3 w-3 text-prosperus-gold" />;
    };

    const progressClass = (pct: number) => {
        if (pct >= 80) return 'high';
        if (pct >= 50) return 'medium';
        if (pct >= 25) return 'low';
        return 'critical';
    };

    return (
        <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-prosperus-white">
                    Progresso por Conteúdo
                </h3>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-prosperus-white/30" />
                    <input
                        type="text"
                        placeholder="Buscar nome ou conteúdo..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                        className="w-full pl-9 pr-3 py-2 bg-prosperus-midnight/60 border border-prosperus-white/10
                       rounded-lg text-sm text-prosperus-white placeholder:text-prosperus-white/30
                       focus:outline-none focus:border-prosperus-gold/40 transition-colors"
                    />
                </div>
                {/* Mobile Sort */}
                <select
                    className="sm:hidden w-full bg-prosperus-midnight/60 border border-prosperus-white/10 text-prosperus-white text-sm rounded-lg p-2 outline-none focus:border-prosperus-gold/40 mt-1"
                    onChange={(e) => {
                        const [key, dir] = e.target.value.split('-');
                        setSort({ key, direction: dir as 'asc' | 'desc' });
                        setPage(0);
                    }}
                    value={`${sort.key}-${sort.direction}`}
                >
                    <option value="progresso-desc">Maior Progresso</option>
                    <option value="progresso-asc">Menor Progresso</option>
                    <option value="nome-asc">Nome (A-Z)</option>
                    <option value="conteudo-asc">Conteúdo (A-Z)</option>
                </select>
            </div>

            {/* ═══ DESKTOP TABLE ═══ */}
            <div className="hidden sm:block overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-prosperus-white/10">
                            <th
                                className="py-2 px-3 text-left text-xs font-medium text-prosperus-white/40 cursor-pointer hover:text-prosperus-gold/60"
                                onClick={() => toggleSort('nome')}
                            >
                                <span className="inline-flex items-center gap-1">Nome <SortIcon columnKey="nome" /></span>
                            </th>
                            <th className="py-2 px-3 text-left text-xs font-medium text-prosperus-white/40">Conteúdo</th>
                            <th
                                className="py-2 px-3 text-right text-xs font-medium text-prosperus-white/40 cursor-pointer hover:text-prosperus-gold/60 min-w-[140px]"
                                onClick={() => toggleSort('progresso')}
                            >
                                <span className="inline-flex items-center gap-1 justify-end">Progresso <SortIcon columnKey="progresso" /></span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map((item, idx) => (
                            <tr key={`${item.email}-${item.conteudo}-${idx}`} className="border-b border-prosperus-white/5 hover:bg-prosperus-gold/5 transition-colors">
                                <td className="py-2.5 px-3">
                                    <p className="font-medium text-prosperus-white truncate max-w-[180px]">{item.nome}</p>
                                </td>
                                <td className="py-2.5 px-3 text-prosperus-white/60 truncate max-w-[250px]">{item.conteudo}</td>
                                <td className="py-2.5 px-3">
                                    <div className="flex items-center gap-2 justify-end">
                                        <div className="progress-track flex-1 max-w-[80px]">
                                            <div className={`progress-fill ${progressClass(item.progresso)}`} style={{ width: `${item.progresso}%` }} />
                                        </div>
                                        <span className="text-xs font-semibold text-prosperus-white/60 w-10 text-right">{item.progresso}%</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ═══ MOBILE CARDS ═══ */}
            <div className="sm:hidden space-y-2">
                {paged.map((item, idx) => (
                    <div key={`${item.email}-${item.conteudo}-${idx}`} className="table-card-mobile">
                        <p className="font-semibold text-sm text-prosperus-white truncate">{item.nome}</p>
                        <p className="text-xs text-prosperus-white/40 truncate">{item.conteudo}</p>
                        <div className="flex items-center gap-3 mt-2">
                            <div className="flex-1">
                                <div className="progress-track h-2">
                                    <div className={`progress-fill ${progressClass(item.progresso)} h-2`} style={{ width: `${item.progresso}%` }} />
                                </div>
                            </div>
                            <span className="text-sm font-bold text-prosperus-gold w-12 text-right">{item.progresso}%</span>
                        </div>
                        <p className="text-xs text-prosperus-white/30 mt-1">{item.aulasCompletas} aulas concluídas</p>
                    </div>
                ))}
            </div>

            {/* ═══ PAGINATION ═══ */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-prosperus-white/5">
                    <p className="text-xs text-prosperus-white/30">{filtered.length} registros</p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage(Math.max(0, page - 1))}
                            disabled={page === 0}
                            className="px-3 py-1 text-xs rounded bg-prosperus-midnight/50 text-prosperus-white/50 hover:bg-prosperus-gold/10
                         disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            Anterior
                        </button>
                        <span className="px-3 py-1 text-xs text-prosperus-white/40">{page + 1} / {totalPages}</span>
                        <button
                            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                            disabled={page >= totalPages - 1}
                            className="px-3 py-1 text-xs rounded bg-prosperus-midnight/50 text-prosperus-white/50 hover:bg-prosperus-gold/10
                         disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            Próximo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
