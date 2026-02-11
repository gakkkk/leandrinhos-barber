import { useState, useEffect } from 'react';
import { Brain, Sparkles, TrendingUp, Users, AlertCircle, Calendar } from 'lucide-react';
import { format, subDays, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

interface Insight {
  id: string;
  tipo: 'alerta' | 'oportunidade' | 'tendencia';
  titulo: string;
  descricao: string;
  acao?: string;
  icon: typeof AlertCircle;
}

export function RelatoriosIAView() {
  const [isLoading, setIsLoading] = useState(true);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isGenerating] = useState(false);

  useEffect(() => {
    generateInsights();
  }, []);

  const generateInsights = async () => {
    setIsLoading(true);
    const insightsGenerated: Insight[] = [];

    try {
      // 1. Buscar dados do caixa
      const { data: caixaData } = await supabase
        .from('caixa')
        .select('*')
        .gte('data', format(subDays(new Date(), 30), 'yyyy-MM-dd'));

      // 2. Buscar aniversários próximos
      const hoje = new Date();
      const { data: aniversarios } = await supabase
        .from('aniversarios_clientes')
        .select('*');

      // 3. Buscar estoque baixo
      const { data: estoqueBaixo } = await supabase
        .from('estoque')
        .select('*');

      // 4. Buscar clientes inativos (via proxy)
      const response = await fetch(`https://wtkxyofvbillvclkcvir.supabase.co/functions/v1/supabase-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'dados_cliente', method: 'GET' }),
      });
      const clientesResult = await response.json();
      const clientes = clientesResult.data || [];

      // Análise: Faturamento
      if (caixaData && caixaData.length > 0) {
        const entradas = caixaData.filter(c => c.tipo === 'entrada');
        const totalEntradas = entradas.reduce((acc, c) => acc + Number(c.valor), 0);
        const mediaDiaria = totalEntradas / 30;

        if (mediaDiaria > 0) {
          insightsGenerated.push({
            id: 'faturamento',
            tipo: 'tendencia',
            titulo: 'Faturamento dos últimos 30 dias',
            descricao: `Média diária de R$ ${mediaDiaria.toFixed(2)}. Total: R$ ${totalEntradas.toFixed(2)}.`,
            icon: TrendingUp,
          });
        }
      }

      // Análise: Aniversariantes
      if (aniversarios && aniversarios.length > 0) {
        const proximoMes = aniversarios.filter(a => {
          const dataAniv = new Date(a.data_aniversario);
          const mesAniv = dataAniv.getMonth();
          const diaAniv = dataAniv.getDate();
          const dataEsteAno = new Date(hoje.getFullYear(), mesAniv, diaAniv);
          const diff = differenceInDays(dataEsteAno, hoje);
          return diff >= 0 && diff <= 30;
        });

        if (proximoMes.length > 0) {
          insightsGenerated.push({
            id: 'aniversarios',
            tipo: 'oportunidade',
            titulo: `${proximoMes.length} aniversariante(s) nos próximos 30 dias`,
            descricao: `Oportunidade para enviar cupom de desconto ou mensagem especial.`,
            acao: 'Criar campanha de aniversário',
            icon: Calendar,
          });
        }
      }

      // Análise: Estoque baixo
      if (estoqueBaixo && estoqueBaixo.length > 0) {
        const criticos = estoqueBaixo.filter(e => e.quantidade <= e.quantidade_minima);
        if (criticos.length > 0) {
          insightsGenerated.push({
            id: 'estoque',
            tipo: 'alerta',
            titulo: `${criticos.length} produto(s) com estoque baixo`,
            descricao: `Produtos: ${criticos.map(c => c.nome).join(', ')}`,
            acao: 'Verificar estoque',
            icon: AlertCircle,
          });
        }
      }

      // Análise: Quantidade de clientes
      if (clientes.length > 0) {
        insightsGenerated.push({
          id: 'clientes',
          tipo: 'tendencia',
          titulo: `${clientes.length} clientes cadastrados`,
          descricao: 'Base de clientes para campanhas de marketing.',
          icon: Users,
        });
      }

      // Insight genérico se não houver dados
      if (insightsGenerated.length === 0) {
        insightsGenerated.push({
          id: 'vazio',
          tipo: 'tendencia',
          titulo: 'Dados insuficientes',
          descricao: 'Continue registrando dados para obter insights personalizados.',
          icon: Sparkles,
        });
      }

    } catch (error) {
      console.error('Erro ao gerar insights:', error);
    }

    setInsights(insightsGenerated);
    setIsLoading(false);
  };

  const getInsightColor = (tipo: string) => {
    switch (tipo) {
      case 'alerta': return 'border-l-destructive bg-destructive/5';
      case 'oportunidade': return 'border-l-green-500 bg-green-500/5';
      case 'tendencia': return 'border-l-primary bg-primary/5';
      default: return 'border-l-muted';
    }
  };

  if (isLoading) return <LoadingSpinner message="Gerando insights..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Insights com IA</h2>
        </div>
        <Button size="sm" variant="outline" onClick={generateInsights} disabled={isGenerating}>
          <Sparkles className="w-4 h-4 mr-1" />
          Atualizar
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Análise automática dos seus dados para identificar oportunidades e alertas.
      </p>

      <div className="space-y-3">
        {insights.map((insight) => {
          const Icon = insight.icon;
          return (
            <div
              key={insight.id}
              className={`card-premium p-4 border-l-4 ${getInsightColor(insight.tipo)}`}
            >
              <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold">{insight.titulo}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{insight.descricao}</p>
                  {insight.acao && (
                    <Button size="sm" variant="link" className="p-0 h-auto mt-2">
                      {insight.acao} →
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center text-xs text-muted-foreground pt-4">
        <Sparkles className="w-4 h-4 inline mr-1" />
        Insights gerados automaticamente com base nos seus dados
      </div>
    </div>
  );
}