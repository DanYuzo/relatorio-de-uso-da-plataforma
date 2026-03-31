import { X, Calendar, BookOpen, CheckCircle, Clock } from 'lucide-react';
import type { UsuarioTabela } from '../../types/metrics';
import { formatDateBR } from '../../utils/dateHelpers';

interface UserDetailPanelProps {
    user: UsuarioTabela | null;
    onClose: () => void;
}

export default function UserDetailPanel({ user, onClose }: UserDetailPanelProps) {
    if (!user) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-prosperus-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="relative w-full max-w-md h-full bg-prosperus-midnight border-l border-prosperus-white/10 shadow-2xl flex flex-col animate-slide-in-right">
                {/* Header */}
                <div className="p-6 border-b border-prosperus-white/10 flex items-start justify-between bg-prosperus-navy/30">
                    <div>
                        <h2 className="text-xl font-bold text-white leading-tight">{user.nome}</h2>
                        <p className="text-sm text-prosperus-white/50 mt-1">{user.email}</p>
                        <p className="text-xs text-prosperus-gold/60 mt-1 uppercase tracking-wide font-semibold">
                            {user.empresa}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-prosperus-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="card bg-prosperus-navy/40 border-prosperus-white/5 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-md bg-prosperus-gold/10">
                                    <Clock className="w-4 h-4 text-prosperus-gold" />
                                </div>
                                <span className="text-xs font-medium text-prosperus-white/50">Acessos</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{user.acessos}</p>
                        </div>

                        <div className="card bg-prosperus-navy/40 border-prosperus-white/5 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-md bg-emerald-500/10">
                                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                                </div>
                                <span className="text-xs font-medium text-prosperus-white/50">Conclusões</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{user.conclusoes}</p>
                        </div>
                    </div>

                    {/* Last Access */}
                    <div>
                        <h3 className="text-sm font-semibold text-prosperus-white/80 mb-3 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-prosperus-gold/60" />
                            Último Acesso
                        </h3>
                        <div className={`p-4 rounded-lg border ${!user.ultimoAcesso ? 'bg-red-500/5 border-red-500/20' : 'bg-prosperus-white/5 border-prosperus-white/5'}`}>
                            {!user.ultimoAcesso ? (
                                <p className="text-red-400 font-medium text-sm">Nunca acessou a plataforma</p>
                            ) : (
                                <p className="text-prosperus-white font-medium text-lg">
                                    {formatDateBR(user.ultimoAcesso)}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Access History */}
                    <div>
                        <h3 className="text-sm font-semibold text-prosperus-white/80 mb-4 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-prosperus-gold/60" />
                            Histórico de Acessos
                        </h3>

                        {user.historico.length > 0 ? (
                            <div className="relative border-l border-prosperus-white/10 ml-2 space-y-6 pb-2">
                                {user.historico
                                    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
                                    .slice(0, 5)
                                    .map((h, i) => (
                                        <div key={i} className="relative pl-6">
                                            <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-prosperus-midnight border-2 border-prosperus-gold" />
                                            <p className="text-sm text-prosperus-white font-medium">Acesso à plataforma</p>
                                            <p className="text-xs text-prosperus-white/40 mt-0.5">{formatDateBR(h.data)}</p>
                                        </div>
                                    ))}
                            </div>
                        ) : (
                            <p className="text-sm text-prosperus-white/30 italic">Nenhuma atividade registrada por enquanto.</p>
                        )}
                    </div>

                    {/* Content History */}
                    <div>
                        <h3 className="text-sm font-semibold text-prosperus-white/80 mb-4 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-prosperus-gold/60" />
                            Conteúdo Recente
                        </h3>

                        {(user.conteudoRecente && user.conteudoRecente.length > 0) ? (
                            <div className="relative border-l border-prosperus-white/10 ml-2 space-y-6 pb-2">
                                {user.conteudoRecente.map((c, i) => (
                                    <div key={i} className="relative pl-6">
                                        <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-prosperus-midnight border-2 border-emerald-500" />
                                        <p className="text-sm text-prosperus-white font-medium">{c.titulo}</p>
                                        <p className="text-xs text-prosperus-white/40 mt-0.5">{c.data ? formatDateBR(c.data) : 'Data indisponível'}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-prosperus-white/30 italic">Nenhum conteúdo concluído recentemente.</p>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
