import { Users, BarChart3, BookOpen, TrendingUp, UserCheck, UserX } from 'lucide-react';
import type { DashboardMetrics } from '../../types/metrics';

interface KPIGridProps {
    metrics: DashboardMetrics;
}

const KPI_CARDS = [
    { key: 'totalFuncionarios', label: 'Total Funcionários', icon: Users, format: 'number' },
    { key: 'usuariosAtivos', label: 'Usuários Ativos', icon: UserCheck, format: 'number' },
    { key: 'usuariosInativos', label: 'Inativos', icon: UserX, format: 'number' },
    { key: 'totalAcessos', label: 'Total de Acessos', icon: BarChart3, format: 'number' },
    { key: 'totalConclusoes', label: 'Conclusões', icon: BookOpen, format: 'number' },
    { key: 'taxaEngajamento', label: 'Taxa Engajamento', icon: TrendingUp, format: 'percent' },
] as const;

export default function KPIGrid({ metrics }: KPIGridProps) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {KPI_CARDS.map(({ key, label, icon: Icon, format }) => {
                const raw = metrics[key as keyof DashboardMetrics];
                const value = format === 'percent' ? `${raw}%` : Number(raw).toLocaleString('pt-BR');

                return (
                    <div
                        key={key}
                        className="card group hover:border-prosperus-gold/30 transition-all duration-300"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 bg-prosperus-gold/10 rounded-md group-hover:bg-prosperus-gold/20 transition-colors">
                                <Icon className="h-4 w-4 text-prosperus-gold" />
                            </div>
                        </div>
                        <p className="metric-value text-xl sm:text-2xl">{value}</p>
                        <p className="text-xs text-prosperus-white/50 mt-1 leading-tight">{label}</p>
                    </div>
                );
            })}
        </div>
    );
}
