import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface EvolucaoChartProps {
  dadosMensais: {
    mes: string;
    mesNum: number;
    faturamento: number;
    atendimentos: number;
    metaFaturamento?: number;
    metaAtendimentos?: number;
  }[];
}

export function EvolucaoChart({ dadosMensais }: EvolucaoChartProps) {
  const { crescimentoFaturamento, crescimentoAtendimentos } = useMemo(() => {
    if (dadosMensais.length < 2) return { crescimentoFaturamento: 0, crescimentoAtendimentos: 0 };
    
    const atual = dadosMensais[dadosMensais.length - 1];
    const anterior = dadosMensais[dadosMensais.length - 2];
    
    const crescFat = anterior.faturamento > 0 
      ? ((atual.faturamento - anterior.faturamento) / anterior.faturamento) * 100 
      : 0;
    const crescAt = anterior.atendimentos > 0 
      ? ((atual.atendimentos - anterior.atendimentos) / anterior.atendimentos) * 100 
      : 0;
    
    return { crescimentoFaturamento: crescFat, crescimentoAtendimentos: crescAt };
  }, [dadosMensais]);

  const chartData = dadosMensais.map(item => ({
    ...item,
    metaFat: item.metaFaturamento || 0,
    metaAt: item.metaAtendimentos || 0,
  }));

  if (dadosMensais.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Sem dados suficientes para exibir gráficos
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Indicadores de crescimento */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Faturamento</span>
              <Badge 
                variant={crescimentoFaturamento >= 0 ? "default" : "destructive"}
                className={crescimentoFaturamento >= 0 
                  ? "bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30" 
                  : ""
                }
              >
                <span className="flex items-center gap-1">
                  {crescimentoFaturamento >= 0 
                    ? <TrendingUp className="h-3 w-3" /> 
                    : <TrendingDown className="h-3 w-3" />
                  }
                  {crescimentoFaturamento >= 0 ? '+' : ''}{crescimentoFaturamento.toFixed(0)}%
                </span>
              </Badge>
            </div>
            <p className="text-lg font-bold text-foreground mt-1">
              vs mês anterior
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Atendimentos</span>
              <Badge 
                variant={crescimentoAtendimentos >= 0 ? "default" : "destructive"}
                className={crescimentoAtendimentos >= 0 
                  ? "bg-blue-500/20 text-blue-600 hover:bg-blue-500/30" 
                  : ""
                }
              >
                <span className="flex items-center gap-1">
                  {crescimentoAtendimentos >= 0 
                    ? <TrendingUp className="h-3 w-3" /> 
                    : <TrendingDown className="h-3 w-3" />
                  }
                  {crescimentoAtendimentos >= 0 ? '+' : ''}{crescimentoAtendimentos.toFixed(0)}%
                </span>
              </Badge>
            </div>
            <p className="text-lg font-bold text-foreground mt-1">
              vs mês anterior
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Faturamento */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium">Faturamento Mensal</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis 
                  dataKey="mes" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  formatter={(value: number) => [`R$ ${value.toFixed(0)}`, 'Faturamento']}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar 
                  dataKey="faturamento" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                  name="Faturamento"
                />
                {chartData.some(d => d.metaFat > 0) && (
                  <ReferenceLine 
                    y={chartData[chartData.length - 1]?.metaFat || 0} 
                    stroke="hsl(var(--destructive))" 
                    strokeDasharray="3 3"
                    label={{ value: 'Meta', position: 'right', fontSize: 10 }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Atendimentos */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium">Atendimentos por Mês</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis 
                  dataKey="mes" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10 }}
                />
                <Tooltip 
                  formatter={(value: number) => [value, 'Atendimentos']}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar 
                  dataKey="atendimentos" 
                  fill="hsl(160, 84%, 39%)" 
                  radius={[4, 4, 0, 0]}
                  name="Atendimentos"
                />
                {chartData.some(d => d.metaAt > 0) && (
                  <ReferenceLine 
                    y={chartData[chartData.length - 1]?.metaAt || 0} 
                    stroke="hsl(var(--destructive))" 
                    strokeDasharray="3 3"
                    label={{ value: 'Meta', position: 'right', fontSize: 10 }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
