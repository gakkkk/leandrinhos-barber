import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, isToday, isBefore, startOfMonth, endOfMonth, getMonth, getYear, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, DollarSign, Users, Clock, MessageCircle, Phone, 
  TrendingUp, Target, AlertTriangle, Gift, Package, Plus, ChevronRight, BarChart3
} from 'lucide-react';
import { Agendamento, Servico, Caixa, Meta, Estoque, AniversarioCliente } from '@/types';
import { fetchCaixa, fetchMetaAtual, fetchEstoque, fetchAniversarios, fetchMetasByYear, fetchCaixaMensal } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { EvolucaoChart } from './EvolucaoChart';

interface DashboardResumoProps {
  agendamentos: Agendamento[];
  servicos: Servico[];
  onOpenAgendamento: () => void;
  onNavigateTo: (tab: string) => void;
}

export function DashboardResumo({ agendamentos, servicos, onOpenAgendamento, onNavigateTo }: DashboardResumoProps) {
  const [caixaHoje, setCaixaHoje] = useState<Caixa[]>([]);
  const [metaAtual, setMetaAtual] = useState<Meta | null>(null);
  const [estoqueBaixo, setEstoqueBaixo] = useState<Estoque[]>([]);
  const [aniversariosProximos, setAniversariosProximos] = useState<AniversarioCliente[]>([]);
  const [dadosGrafico, setDadosGrafico] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('resumo');

  const hoje = new Date();
  const hojeStr = format(hoje, 'yyyy-MM-dd');
  const mesAtual = getMonth(hoje) + 1;
  const anoAtual = getYear(hoje);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    // Caixa de hoje
    const caixaResult = await fetchCaixa(hojeStr, hojeStr);
    if (caixaResult.data) {
      setCaixaHoje(caixaResult.data);
    }

    // Meta do mês
    const metaResult = await fetchMetaAtual(mesAtual, anoAtual);
    if (metaResult.data && metaResult.data.length > 0) {
      setMetaAtual(metaResult.data[0]);
    }

    // Estoque baixo
    const estoqueResult = await fetchEstoque();
    if (estoqueResult.data) {
      const baixo = estoqueResult.data.filter((item: Estoque) => item.quantidade <= item.quantidade_minima);
      setEstoqueBaixo(baixo);
    }

    // Aniversários próximos (nos próximos 7 dias)
    const aniversariosResult = await fetchAniversarios();
    if (aniversariosResult.data) {
      const proximos = aniversariosResult.data.filter((a: AniversarioCliente) => {
        const [, mes, dia] = a.data_aniversario.split('-');
        const aniversarioEsteAno = new Date(anoAtual, parseInt(mes) - 1, parseInt(dia));
        const diffDays = Math.ceil((aniversarioEsteAno.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
      });
      setAniversariosProximos(proximos);
    }

    // Carregar dados para gráficos (últimos 6 meses)
    await loadDadosGrafico();
  };

  const loadDadosGrafico = async () => {
    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const dados: any[] = [];
    
    // Buscar metas do ano
    const metasResult = await fetchMetasByYear(anoAtual);
    const metasMap = new Map<number, Meta>();
    if (metasResult.data) {
      metasResult.data.forEach((m: Meta) => metasMap.set(m.mes, m));
    }

    // Calcular dados dos últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const dataRef = subMonths(hoje, i);
      const mes = getMonth(dataRef) + 1;
      const ano = getYear(dataRef);
      const inicioMes = startOfMonth(dataRef);
      const fimMes = endOfMonth(dataRef);
      
      // Filtrar agendamentos deste mês (somente passados para meses anteriores)
      const agendamentosDoMes = agendamentos.filter(ag => {
        const dataAg = parseISO(ag.data);
        const mesAg = getMonth(dataAg) + 1;
        const anoAg = getYear(dataAg);
        if (mesAg !== mes || anoAg !== ano) return false;
        
        // Se for o mês atual, incluir todos até hoje
        if (mes === mesAtual && ano === anoAtual) {
          return isBefore(parseISO(ag.data), hoje) || ag.data === hojeStr;
        }
        return true;
      });

      // Calcular faturamento
      const faturamento = agendamentosDoMes.reduce((acc, ag) => {
        const servicosNoAgendamento = ag.servico.split(/\s*[+,\/]\s*|\s+e\s+/i).map(s => s.trim()).filter(Boolean);
        return acc + servicosNoAgendamento.reduce((sum, servicoNome) => {
          const servicoEncontrado = servicos.find(s => 
            servicoNome.toLowerCase().includes(s.nome.toLowerCase()) ||
            s.nome.toLowerCase().includes(servicoNome.toLowerCase())
          );
          return sum + (servicoEncontrado?.preco || 0);
        }, 0);
      }, 0);

      const meta = metasMap.get(mes);
      
      dados.push({
        mes: mesesNomes[mes - 1],
        mesNum: mes,
        faturamento,
        atendimentos: agendamentosDoMes.length,
        metaFaturamento: meta?.meta_faturamento || 0,
        metaAtendimentos: meta?.meta_atendimentos || 0,
      });
    }

    setDadosGrafico(dados);
  };

  // Agendamentos de hoje
  const agendamentosHoje = useMemo(() => {
    return agendamentos.filter(ag => ag.data === hojeStr);
  }, [agendamentos, hojeStr]);

  // Próximo cliente
  const proximoCliente = useMemo(() => {
    const agora = format(hoje, 'HH:mm');
    return agendamentosHoje
      .filter(ag => ag.hora_inicio > agora)
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))[0] || null;
  }, [agendamentosHoje, hoje]);

  // Faturamento previsto hoje
  const faturamentoPrevisto = useMemo(() => {
    return agendamentosHoje.reduce((acc, ag) => {
      const servicosNoAgendamento = ag.servico.split(/\s*[+,\/]\s*|\s+e\s+/i).map(s => s.trim()).filter(Boolean);
      const total = servicosNoAgendamento.reduce((sum, servicoNome) => {
        const servicoEncontrado = servicos.find(s => 
          servicoNome.toLowerCase().includes(s.nome.toLowerCase()) ||
          s.nome.toLowerCase().includes(servicoNome.toLowerCase())
        );
        return sum + (servicoEncontrado?.preco || 0);
      }, 0);
      return acc + total;
    }, 0);
  }, [agendamentosHoje, servicos]);

  // Saldo do caixa hoje
  const saldoCaixaHoje = useMemo(() => {
    return caixaHoje.reduce((acc, mov) => {
      return mov.tipo === 'entrada' ? acc + mov.valor : acc - mov.valor;
    }, 0);
  }, [caixaHoje]);

  // Progresso da meta
  const progressoMeta = useMemo(() => {
    if (!metaAtual) return { faturamento: 0, atendimentos: 0 };
    
    const inicio = startOfMonth(hoje);
    const agendamentosDoMes = agendamentos.filter(ag => {
      const dataAg = parseISO(ag.data);
      const endDateTime = parseISO(`${ag.data}T${ag.hora_fim || ag.hora_inicio || '00:00'}:00-03:00`);
      return dataAg >= inicio && isBefore(endDateTime, hoje);
    });

    const faturamentoMes = agendamentosDoMes.reduce((acc, ag) => {
      const servicosNoAgendamento = ag.servico.split(/\s*[+,\/]\s*|\s+e\s+/i).map(s => s.trim()).filter(Boolean);
      return acc + servicosNoAgendamento.reduce((sum, servicoNome) => {
        const servicoEncontrado = servicos.find(s => 
          servicoNome.toLowerCase().includes(s.nome.toLowerCase()) ||
          s.nome.toLowerCase().includes(servicoNome.toLowerCase())
        );
        return sum + (servicoEncontrado?.preco || 0);
      }, 0);
    }, 0);

    return {
      faturamento: metaAtual.meta_faturamento > 0 ? (faturamentoMes / metaAtual.meta_faturamento) * 100 : 0,
      atendimentos: metaAtual.meta_atendimentos > 0 ? (agendamentosDoMes.length / metaAtual.meta_atendimentos) * 100 : 0,
      faturamentoValor: faturamentoMes,
      atendimentosValor: agendamentosDoMes.length,
    };
  }, [metaAtual, agendamentos, servicos, hoje]);

  const enviarWhatsApp = (telefone: string, nome: string) => {
    const mensagem = `Olá ${nome}! 👋`;
    window.open(`https://wa.me/55${telefone.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  const ligar = (telefone: string) => {
    window.open(`tel:${telefone}`, '_self');
  };

  return (
    <div className="space-y-4">
      {/* Header com data */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {format(hoje, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {agendamentosHoje.length} agendamento{agendamentosHoje.length !== 1 ? 's' : ''} hoje
          </p>
        </div>
        <Button onClick={onOpenAgendamento} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Novo
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="resumo" className="gap-2">
            <Target className="h-4 w-4" />
            Resumo
          </TabsTrigger>
          <TabsTrigger value="graficos" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Gráficos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-4 mt-4">

      {/* Cards principais */}

      {/* Cards principais removidos por privacidade */}


      {/* Próximo cliente */}
      {proximoCliente && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Próximo às {proximoCliente.hora_inicio}</p>
                  <p className="font-semibold text-foreground">{proximoCliente.cliente_nome}</p>
                  <p className="text-xs text-muted-foreground">{proximoCliente.servico}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="icon" 
                  variant="outline" 
                  className="h-9 w-9"
                  onClick={() => {
                    const cliente = agendamentos.find(a => a.cliente_nome === proximoCliente.cliente_nome);
                    // Buscar telefone do cliente (precisa estar disponível)
                  }}
                >
                  <MessageCircle className="h-4 w-4 text-emerald-600" />
                </Button>
                <Button 
                  size="icon" 
                  variant="outline" 
                  className="h-9 w-9"
                >
                  <Phone className="h-4 w-4 text-blue-600" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meta do mês */}
      {metaAtual && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-500" />
              Meta de {format(hoje, 'MMMM', { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Faturamento</span>
                <span className="font-medium">
                  R$ {(progressoMeta as any).faturamentoValor?.toFixed(0) || 0} / R$ {metaAtual.meta_faturamento}
                </span>
              </div>
              <Progress value={Math.min(progressoMeta.faturamento, 100)} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Atendimentos</span>
                <span className="font-medium">
                  {(progressoMeta as any).atendimentosValor || 0} / {metaAtual.meta_atendimentos}
                </span>
              </div>
              <Progress value={Math.min(progressoMeta.atendimentos, 100)} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alertas */}
      <div className="space-y-2">
        {/* Estoque baixo */}
        {estoqueBaixo.length > 0 && (
          <Card 
            className="border-amber-500/30 bg-amber-500/5 cursor-pointer hover:bg-amber-500/10 transition-colors"
            onClick={() => window.location.href = '/estoque'}
          >
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-foreground">{estoqueBaixo.length} produto(s) com estoque baixo</p>
                  <p className="text-xs text-muted-foreground">
                    {estoqueBaixo.slice(0, 2).map(e => e.nome).join(', ')}
                    {estoqueBaixo.length > 2 && '...'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* Aniversários próximos */}
        {aniversariosProximos.length > 0 && (
          <Card 
            className="border-pink-500/30 bg-pink-500/5 cursor-pointer hover:bg-pink-500/10 transition-colors"
            onClick={() => window.location.href = '/aniversarios'}
          >
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Gift className="h-5 w-5 text-pink-600" />
                <div>
                  <p className="text-sm font-medium text-foreground">{aniversariosProximos.length} aniversário(s) esta semana</p>
                  <p className="text-xs text-muted-foreground">
                    {aniversariosProximos.slice(0, 2).map(a => a.cliente_nome).join(', ')}
                    {aniversariosProximos.length > 2 && '...'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-4 gap-2 pt-2">
        <Button
          variant="outline"
          className="flex flex-col h-auto py-3 gap-1"
          onClick={() => window.location.href = '/caixa'}
        >
          <DollarSign className="h-5 w-5 text-emerald-600" />
          <span className="text-xs">Caixa</span>
        </Button>
        <Button
          variant="outline"
          className="flex flex-col h-auto py-3 gap-1"
          onClick={() => window.location.href = '/estoque'}
        >
          <Package className="h-5 w-5 text-blue-600" />
          <span className="text-xs">Estoque</span>
        </Button>
        <Button
          variant="outline"
          className="flex flex-col h-auto py-3 gap-1"
          onClick={() => window.location.href = '/aniversarios'}
        >
          <Gift className="h-5 w-5 text-pink-600" />
          <span className="text-xs">Aniver.</span>
        </Button>
        <Button
          variant="outline"
          className="flex flex-col h-auto py-3 gap-1"
          onClick={() => window.location.href = '/metas'}
        >
          <Target className="h-5 w-5 text-amber-600" />
          <span className="text-xs">Metas</span>
        </Button>
      </div>
        </TabsContent>

        <TabsContent value="graficos" className="mt-4">
          <EvolucaoChart dadosMensais={dadosGrafico} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
