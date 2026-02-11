import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Flame, Sun, Moon, Sunrise } from 'lucide-react';
import { Agendamento } from '@/types';
import { cn } from '@/lib/utils';

interface HorariosMovimentadosProps {
  agendamentos: Agendamento[];
}

interface HorarioAnalise {
  hora: number;
  horaFormatada: string;
  count: number;
  percentual: number;
  periodo: 'manha' | 'tarde' | 'noite';
}

export function HorariosMovimentados({ agendamentos }: HorariosMovimentadosProps) {
  const analise = useMemo(() => {
    const hoje = new Date();
    
    // Helper para converter data+hora em Date
    const getDataHora = (a: Agendamento) => {
      const [ano, mes, dia] = a.data.split('-').map(Number);
      const [hora, minuto] = a.hora_inicio.split(':').map(Number);
      return new Date(ano, mes - 1, dia, hora, minuto);
    };
    
    const agendamentosPassados = agendamentos.filter(a => getDataHora(a) < hoje);
    
    // Contar por hora
    const horasCount: Record<number, number> = {};
    
    agendamentosPassados.forEach(a => {
      const [hora] = a.hora_inicio.split(':').map(Number);
      horasCount[hora] = (horasCount[hora] || 0) + 1;
    });
    
    const totalAgendamentos = agendamentosPassados.length;
    
    // Criar análise por hora
    const horariosOrdenados: HorarioAnalise[] = Object.entries(horasCount)
      .map(([hora, count]) => {
        const horaNum = parseInt(hora);
        let periodo: 'manha' | 'tarde' | 'noite';
        if (horaNum < 12) periodo = 'manha';
        else if (horaNum < 18) periodo = 'tarde';
        else periodo = 'noite';
        
        return {
          hora: horaNum,
          horaFormatada: `${hora.padStart(2, '0')}:00`,
          count,
          percentual: totalAgendamentos > 0 ? (count / totalAgendamentos) * 100 : 0,
          periodo,
        };
      })
      .sort((a, b) => b.count - a.count);
    
    // Top 5 horários
    const top5 = horariosOrdenados.slice(0, 5);
    
    // Análise por período
    const periodos = {
      manha: horariosOrdenados.filter(h => h.periodo === 'manha').reduce((acc, h) => acc + h.count, 0),
      tarde: horariosOrdenados.filter(h => h.periodo === 'tarde').reduce((acc, h) => acc + h.count, 0),
      noite: horariosOrdenados.filter(h => h.periodo === 'noite').reduce((acc, h) => acc + h.count, 0),
    };
    
    const totalPeriodos = periodos.manha + periodos.tarde + periodos.noite;
    
    return { 
      top5, 
      periodos, 
      totalAgendamentos,
      periodoMaisMovimentado: Object.entries(periodos).sort((a, b) => b[1] - a[1])[0]?.[0] as 'manha' | 'tarde' | 'noite',
      periodosPercentual: {
        manha: totalPeriodos > 0 ? (periodos.manha / totalPeriodos) * 100 : 0,
        tarde: totalPeriodos > 0 ? (periodos.tarde / totalPeriodos) * 100 : 0,
        noite: totalPeriodos > 0 ? (periodos.noite / totalPeriodos) * 100 : 0,
      }
    };
  }, [agendamentos]);

  const getPeriodoIcon = (periodo: 'manha' | 'tarde' | 'noite') => {
    switch (periodo) {
      case 'manha':
        return <Sunrise className="h-4 w-4 text-amber-500" />;
      case 'tarde':
        return <Sun className="h-4 w-4 text-orange-500" />;
      case 'noite':
        return <Moon className="h-4 w-4 text-indigo-500" />;
    }
  };

  const getPeriodoLabel = (periodo: 'manha' | 'tarde' | 'noite') => {
    switch (periodo) {
      case 'manha':
        return 'Manhã (até 12h)';
      case 'tarde':
        return 'Tarde (12h-18h)';
      case 'noite':
        return 'Noite (após 18h)';
    }
  };

  if (analise.totalAgendamentos === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Horários Movimentados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">
            Nenhum agendamento registrado ainda
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          Horários Mais Movimentados
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Análise de {analise.totalAgendamentos} agendamentos
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Top 5 horários */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Top 5 Horários</p>
          <div className="flex flex-wrap gap-2">
            {analise.top5.map((horario, index) => (
              <Badge 
                key={horario.hora}
                variant={index === 0 ? "default" : "secondary"}
                className={cn(
                  "text-sm py-1 px-3",
                  index === 0 && "bg-primary"
                )}
              >
                <Clock className="h-3 w-3 mr-1" />
                {horario.horaFormatada}
                <span className="ml-1 opacity-70">({horario.count})</span>
              </Badge>
            ))}
          </div>
        </div>

        {/* Análise por período */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Por Período</p>
          <div className="space-y-2">
            {(['manha', 'tarde', 'noite'] as const).map(periodo => (
              <div 
                key={periodo} 
                className={cn(
                  "flex items-center justify-between p-2 rounded-lg",
                  periodo === analise.periodoMaisMovimentado && "bg-primary/10"
                )}
              >
                <div className="flex items-center gap-2">
                  {getPeriodoIcon(periodo)}
                  <span className="text-sm">{getPeriodoLabel(periodo)}</span>
                  {periodo === analise.periodoMaisMovimentado && (
                    <Badge className="text-[10px] bg-primary/20 text-primary border-0">Mais movimentado</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{analise.periodos[periodo]}</span>
                  <span className="text-xs text-muted-foreground">
                    ({analise.periodosPercentual[periodo].toFixed(0)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
