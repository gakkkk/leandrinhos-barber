import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Scissors, TrendingUp, Trophy, Star } from 'lucide-react';
import { Agendamento, Servico } from '@/types';
import { cn } from '@/lib/utils';

interface ServicosPopularesProps {
  agendamentos: Agendamento[];
  servicos: Servico[];
}

interface ServicoAnalise {
  nome: string;
  count: number;
  percentual: number;
  receita: number;
  posicao: number;
}

export function ServicosPopulares({ agendamentos, servicos }: ServicosPopularesProps) {
  const analise = useMemo(() => {
    const hoje = new Date();
    
    // Helper para converter data+hora em Date
    const getDataHora = (a: Agendamento) => {
      const [ano, mes, dia] = a.data.split('-').map(Number);
      const [hora, minuto] = a.hora_inicio.split(':').map(Number);
      return new Date(ano, mes - 1, dia, hora, minuto);
    };
    
    const agendamentosPassados = agendamentos.filter(a => getDataHora(a) < hoje);
    
    // Contar serviços
    const servicosCount: Record<string, { count: number; receita: number }> = {};
    
    agendamentosPassados.forEach(a => {
      if (a.servico) {
        const servicosNomes = a.servico.split(/[+,/e]/i).map(s => s.trim().toLowerCase());
        servicosNomes.forEach(nomeServico => {
          if (nomeServico) {
            // Encontrar o serviço correspondente para obter o preço
            const servicoEncontrado = servicos.find(s => 
              s.nome.toLowerCase().includes(nomeServico) || 
              nomeServico.includes(s.nome.toLowerCase())
            );
            const preco = servicoEncontrado?.preco || 0;
            
            const nomeNormalizado = servicoEncontrado?.nome || nomeServico;
            
            if (!servicosCount[nomeNormalizado]) {
              servicosCount[nomeNormalizado] = { count: 0, receita: 0 };
            }
            servicosCount[nomeNormalizado].count++;
            servicosCount[nomeNormalizado].receita += preco;
          }
        });
      }
    });
    
    const totalServicos = Object.values(servicosCount).reduce((acc, s) => acc + s.count, 0);
    
    const servicosOrdenados: ServicoAnalise[] = Object.entries(servicosCount)
      .map(([nome, data], index) => ({
        nome: nome.charAt(0).toUpperCase() + nome.slice(1),
        count: data.count,
        percentual: totalServicos > 0 ? (data.count / totalServicos) * 100 : 0,
        receita: data.receita,
        posicao: 0,
      }))
      .sort((a, b) => b.count - a.count)
      .map((s, index) => ({ ...s, posicao: index + 1 }))
      .slice(0, 5);
    
    return { servicosOrdenados, totalServicos };
  }, [agendamentos, servicos]);

  const getPosicaoIcon = (posicao: number) => {
    switch (posicao) {
      case 1:
        return <Trophy className="h-4 w-4 text-amber-500" />;
      case 2:
        return <Star className="h-4 w-4 text-slate-400" />;
      case 3:
        return <Star className="h-4 w-4 text-amber-700" />;
      default:
        return <span className="text-xs text-muted-foreground font-medium">{posicao}º</span>;
    }
  };

  const getBarColor = (posicao: number) => {
    switch (posicao) {
      case 1:
        return "bg-amber-500";
      case 2:
        return "bg-slate-400";
      case 3:
        return "bg-amber-700";
      default:
        return "bg-primary/50";
    }
  };

  if (analise.servicosOrdenados.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" />
            Serviços Populares
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">
            Nenhum serviço registrado ainda
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Serviços Mais Populares
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Baseado em {analise.totalServicos} atendimentos
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {analise.servicosOrdenados.map((servico) => (
          <div key={servico.nome} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 flex justify-center">
                  {getPosicaoIcon(servico.posicao)}
                </div>
                <span className="font-medium text-sm">{servico.nome}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {servico.count}x
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {servico.percentual.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="ml-8">
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all duration-500", getBarColor(servico.posicao))}
                  style={{ width: `${servico.percentual}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
