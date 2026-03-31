import {
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart,
} from 'recharts';
import type { AcessoDiario } from '../../types/metrics';
import { formatDayMonth, formatFullDate } from '../../utils/dateHelpers';

interface AccessEvolutionChartProps {
    data: AcessoDiario[];
}

export default function AccessEvolutionChart({ data }: AccessEvolutionChartProps) {
    if (data.length === 0) {
        return (
            <div className="card text-center py-12">
                <p className="text-prosperus-white/40 text-sm">Sem dados de acesso para exibir</p>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-prosperus-white">
                    Evolução de Acessos
                </h3>
            </div>

            <div className="w-full" style={{ aspectRatio: '16/7' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                        <defs>
                            <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#FFDA71" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#FFDA71" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                            dataKey="dia"
                            tickFormatter={formatDayMonth}
                            tick={{ fontSize: 10, fill: 'rgba(237,244,247,0.4)' }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: 'rgba(237,244,247,0.4)' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                background: '#123F5B',
                                border: '1px solid rgba(255,218,113,0.2)',
                                borderRadius: '8px',
                                color: '#EDF4F7',
                                fontSize: '12px',
                            }}
                            labelFormatter={formatFullDate}
                            formatter={(value: number, name: string) => [
                                value.toLocaleString('pt-BR'),
                                name === 'acessos' ? 'Acessos' : 'Usuários únicos',
                            ]}
                        />
                        <Area
                            type="monotone"
                            dataKey="acessos"
                            stroke="#FFDA71"
                            strokeWidth={2}
                            fill="url(#goldGradient)"
                        />
                        <Line
                            type="monotone"
                            dataKey="usuarios"
                            stroke="#CA9A43"
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                            dot={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
