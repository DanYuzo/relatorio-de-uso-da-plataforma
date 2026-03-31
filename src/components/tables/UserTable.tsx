import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import type { UsuarioTabela, SortConfig } from '../../types/metrics';
import { formatDateBR } from '../../utils/dateHelpers';

interface UserTableProps {
    users: UsuarioTabela[];
    onUserClick?: (user: UsuarioTabela) => void;
}

const COLUMNS = [
    { key: 'nome', label: 'Nome', sortable: true, align: 'left' as const },
    { key: 'acessos', label: 'Acessos', sortable: true, align: 'right' as const },
    { key: 'conclusoes', label: 'Conclusões', sortable: true, align: 'right' as const },
    { key: 'ultimoAcesso', label: 'Último Acesso', sortable: true, align: 'left' as const },
] as const;

export default function UserTable({ users, onUserClick }: UserTableProps) {
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortConfig>({ key: 'conclusoes', direction: 'desc' });
    const [page, setPage] = useState(0);
    const pageSize = 20;

    const filtered = useMemo(() => {
        let result = users;
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                (u) =>
                    u.nome.toLowerCase().includes(q) ||
                    u.email.toLowerCase().includes(q) ||
                    u.empresa.toLowerCase().includes(q),
            );
        }
        result = [...result].sort((a, b) => {
            const aVal = a[sort.key as keyof UsuarioTabela];
            const bVal = b[sort.key as keyof UsuarioTabela];
            const dir = sort.direction === 'asc' ? 1 : -1;
            if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * dir;
            return String(aVal ?? '').localeCompare(String(bVal ?? ''), 'pt-BR') * dir;
        });
        return result;
    }, [users, search, sort]);

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

    return (
        <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-prosperus-white">
                    Ranking de Colaboradores
                </h3>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-prosperus-white/30" />
                    <input
                        type="text"
                        placeholder="Buscar por nome, email ou empresa..."
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
                    <option value="nome-asc">Nome (A-Z)</option>
                    <option value="acessos-desc">Mais Acessos</option>
                    <option value="conclusoes-desc">Mais Conclusões</option>
                    <option value="ultimoAcesso-desc">Último Acesso (Recente)</option>
                    <option value="ultimoAcesso-asc">Último Acesso (Antigo)</option>
                </select>
            </div>

            {/* ═══ DESKTOP TABLE (hidden on mobile) ═══ */}
            <div className="hidden sm:block overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-prosperus-white/10">
                            <th className="py-2 px-3 text-left text-xs font-medium text-prosperus-white/40 w-8">#</th>
                            {COLUMNS.map((col) => (
                                <th
                                    key={col.key}
                                    className={`py-2 px-3 text-xs font-medium text-prosperus-white/40 cursor-pointer
                             hover:text-prosperus-gold/60 transition-colors select-none
                             ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                                    onClick={() => col.sortable && toggleSort(col.key)}
                                >
                                    <span className="inline-flex items-center gap-1">
                                        {col.label}
                                        <SortIcon columnKey={col.key} />
                                    </span>
                                </th>
                            ))}
                            <th className="py-2 px-3 text-right text-xs font-medium text-prosperus-white/40">Ação</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map((user, idx) => {
                            const rank = page * pageSize + idx + 1;
                            const isActive = user.acessos > 0 || user.conclusoes > 0;
                            const neverAccessed = !user.ultimoAcesso;
                            return (
                                <tr
                                    key={user.email}
                                    className={`border-b border-prosperus-white/5 transition-colors
                                    ${neverAccessed ? 'bg-red-500/10 hover:bg-red-500/20' : 'hover:bg-prosperus-gold/5'}`}
                                >
                                    <td className="py-2.5 px-3 text-xs text-prosperus-white/30">{rank}</td>
                                    <td className="py-2.5 px-3">
                                        <p className={`font-medium truncate max-w-[200px] ${neverAccessed ? 'text-red-400' : 'text-prosperus-white'}`}>{user.nome}</p>
                                        <p className="text-xs text-prosperus-white/40 truncate max-w-[200px]">{user.email}</p>
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                        <span className={`font-semibold ${isActive ? 'text-prosperus-gold' : 'text-prosperus-white/20'}`}>
                                            {user.acessos}
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                        <span className={`font-semibold ${user.conclusoes > 0 ? 'text-emerald-400' : 'text-prosperus-white/20'}`}>
                                            {user.conclusoes}
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-xs text-prosperus-white/40">
                                        {user.ultimoAcesso ? formatDateBR(user.ultimoAcesso) : '—'}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                        <button
                                            onClick={() => onUserClick?.(user)}
                                            className="p-1.5 hover:bg-prosperus-gold/10 rounded transition-colors"
                                            title="Ver detalhes"
                                        >
                                            <Eye className="h-4 w-4 text-prosperus-gold/60 hover:text-prosperus-gold" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ═══ MOBILE CARDS (hidden on desktop) ═══ */}
            <div className="sm:hidden space-y-3">
                {paged.map((user, idx) => {
                    const rank = page * pageSize + idx + 1;
                    const neverAccessed = !user.ultimoAcesso;
                    return (
                        <div
                            key={user.email}
                            onClick={() => onUserClick?.(user)}
                            className={`table-card-mobile cursor-pointer active:scale-[0.98] transition-all
                ${neverAccessed ? 'border-red-500/30 bg-red-500/5' : ''}
              `}
                        >
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex items-start gap-3 min-w-0">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-prosperus-gold/10 text-prosperus-gold text-xs font-bold shrink-0 mt-0.5 border border-prosperus-gold/20">
                                        {rank}
                                    </span>
                                    <div className="min-w-0">
                                        <p className={`font-semibold text-sm truncate ${neverAccessed ? 'text-red-400' : 'text-prosperus-white'}`}>
                                            {user.nome}
                                        </p>
                                        <p className="text-xs text-prosperus-white/40 truncate">{user.email}</p>
                                    </div>
                                </div>
                                {neverAccessed && (
                                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/20">
                                        NUNCA
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-prosperus-white/5">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-prosperus-white/30 font-semibold">
                                        Acessos
                                    </p>
                                    <p className="text-lg font-bold text-prosperus-gold">{user.acessos}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase tracking-wider text-prosperus-white/30 font-semibold">
                                        Conclusões
                                    </p>
                                    <p className="text-lg font-bold text-prosperus-white">{user.conclusoes}</p>
                                </div>
                            </div>

                            {!neverAccessed && (
                                <div className="mt-2 text-right">
                                    <p className="text-xs text-prosperus-white/40">
                                        Último acesso: <span className="text-prosperus-white/70">{formatDateBR(user.ultimoAcesso!)}</span>
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ═══ PAGINATION ═══ */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-prosperus-white/5">
                    <p className="text-xs text-prosperus-white/30">
                        {filtered.length} colaboradores
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage(Math.max(0, page - 1))}
                            disabled={page === 0}
                            className="px-3 py-1 text-xs rounded bg-prosperus-midnight/50 text-prosperus-white/50
                         hover:bg-prosperus-gold/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            Anterior
                        </button>
                        <span className="px-3 py-1 text-xs text-prosperus-white/40">
                            {page + 1} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                            disabled={page >= totalPages - 1}
                            className="px-3 py-1 text-xs rounded bg-prosperus-midnight/50 text-prosperus-white/50
                         hover:bg-prosperus-gold/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            Próximo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
