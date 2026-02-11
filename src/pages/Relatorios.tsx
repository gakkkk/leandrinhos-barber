import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, TrendingUp, Calendar, Users, DollarSign, Clock, BarChart3, PieChart, Target, Award, Scissors, AlertTriangle, Crown, Star, Activity, Timer, Wallet, CalendarCheck, UserCheck, Sparkles, ChevronUp, ChevronDown, Minus, Filter, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, getDay, startOfWeek, endOfWeek, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { fetchGoogleCalendarEvents, convertToAgendamento } from '@/lib/googleCalendar';
import { fetchServicos, fetchClientes, fetchHorariosFuncionamento } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Agendamento, Servico, Cliente, HorarioFuncionamento } from '@/types';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import { cn } from '@/lib/utils';

export default function Relatorios() {
  const [allAgendamentos, setAllAgendamentos] = useState<Agendamento[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [horariosFuncionamento, setHorariosFuncionamento] = useState<HorarioFuncionamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [periodo, setPeriodo] = useState('mes-atual');
  const [previousAgendamentos, setPreviousAgendamentos] = useState<Agendamento[]>([]);
  const [clienteFilter, setClienteFilter] = useState<string>('todos');

  useEffect(() => {
    loadData();
  }, [periodo]);

  const loadData = async () => {
    setIsLoading(true);
    
    const now = new Date();
    let timeMin: Date;
    let timeMax: Date;
    let prevTimeMin: Date;
    let prevTimeMax: Date;
    
    switch (periodo) {
      case 'semana':
        timeMin = startOfWeek(now, { weekStartsOn: 1 });
        timeMax = endOfWeek(now, { weekStartsOn: 1 });
        prevTimeMin = startOfWeek(subMonths(now, 0), { weekStartsOn: 1 });
        prevTimeMax = endOfWeek(subMonths(now, 0), { weekStartsOn: 1 });
        prevTimeMin = new Date(timeMin.getTime() - 7 * 24 * 60 * 60 * 1000);
        prevTimeMax = new Date(timeMax.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'mes-atual':
        timeMin = startOfMonth(now);
        timeMax = endOfMonth(now);
        prevTimeMin = startOfMonth(subMonths(now, 1));
        prevTimeMax = endOfMonth(subMonths(now, 1));
        break;
      case 'mes-passado':
        timeMin = startOfMonth(subMonths(now, 1));
        timeMax = endOfMonth(subMonths(now, 1));
        prevTimeMin = startOfMonth(subMonths(now, 2));
        prevTimeMax = endOfMonth(subMonths(now, 2));
        break;
      case 'trimestre':
        timeMin = startOfMonth(subMonths(now, 2));
        timeMax = endOfMonth(now);
        prevTimeMin = startOfMonth(subMonths(now, 5));
        prevTimeMax = endOfMonth(subMonths(now, 3));
        break;
      case 'semestre':
        timeMin = startOfMonth(subMonths(now, 5));
        timeMax = endOfMonth(now);
        prevTimeMin = startOfMonth(subMonths(now, 11));
        prevTimeMax = endOfMonth(subMonths(now, 6));
        break;
      default:
        timeMin = startOfMonth(now);
        timeMax = endOfMonth(now);
        prevTimeMin = startOfMonth(subMonths(now, 1));
        prevTimeMax = endOfMonth(subMonths(now, 1));
    }
    
    const [calendarResult, prevCalendarResult, servicosResult, clientesResult, horariosResult] = await Promise.all([
      fetchGoogleCalendarEvents(timeMin.toISOString(), timeMax.toISOString()),
      fetchGoogleCalendarEvents(prevTimeMin.toISOString(), prevTimeMax.toISOString()),
      fetchServicos(),
      fetchClientes(),
      fetchHorariosFuncionamento(),
    ]);
    
    if (calendarResult.data) {
      setAllAgendamentos(calendarResult.data.map(convertToAgendamento));
    }
    if (prevCalendarResult.data) {
      // Filtra apenas agendamentos passados para o período anterior
      const now = new Date();
      const passados = prevCalendarResult.data
        .map(convertToAgendamento)
        .filter((ag) => {
          const endDateTime = parseISO(`${ag.data}T${ag.hora_fim || ag.hora_inicio || '00:00'}:00-03:00`);
          return isBefore(endDateTime, now);
        });
      setPreviousAgendamentos(passados);
    }
    if (servicosResult.data) {
      setServicos(servicosResult.data.map((s: { id: number; nome: string; preco: number; duracao_minutos: number }) => ({
        id: String(s.id),
        nome: s.nome,
        preco: s.preco,
        duracao: s.duracao_minutos,
      })));
    }
    if (clientesResult.data) {
      setClientes(clientesResult.data.map((c: { id: number; nomewpp: string; telefone?: string; observacoes?: string }) => ({
        id: String(c.id),
        nome: c.nomewpp,
        telefone: c.telefone || '',
        observacoes: c.observacoes,
      })));
    }
    if (horariosResult.data) {
      setHorariosFuncionamento(horariosResult.data);
    }
    
    setIsLoading(false);
  };

  // Filtra apenas agendamentos que já passaram e aplica filtro de cliente
  const agendamentos = useMemo(() => {
    const now = new Date();

    return allAgendamentos.filter((ag) => {
      // Só considera agendamentos que já passaram (usa hora_fim para contar assim que termina)
      const endDateTime = parseISO(`${ag.data}T${ag.hora_fim || ag.hora_inicio || '00:00'}:00-03:00`);
      if (!isBefore(endDateTime, now)) return false;

      // Filtro por cliente
      if (clienteFilter !== 'todos' && ag.cliente_nome !== clienteFilter) {
        return false;
      }

      return true;
    });
  }, [allAgendamentos, clienteFilter]);

  // Lista de clientes únicos para o filtro
  const clientesUnicos = useMemo(() => {
    const nomes = new Set(allAgendamentos.map(ag => ag.cliente_nome));
    return Array.from(nomes).sort();
  }, [allAgendamentos]);

  // Métricas calculadas
  const metricas = useMemo(() => {
    const totalAgendamentos = agendamentos.length;
    const totalAgendamentosAnterior = previousAgendamentos.length;
    
    // Helper para somar valores de múltiplos serviços em um agendamento
    const calcularValorAgendamento = (servicoStr: string): number => {
      // Divide por separadores comuns: " + ", ", ", " e ", " / "
      const servicosNoAgendamento = servicoStr.split(/\s*[+,\/]\s*|\s+e\s+/i).map(s => s.trim()).filter(Boolean);
      
      return servicosNoAgendamento.reduce((total, servicoNome) => {
        const servicoEncontrado = servicos.find(s => 
          servicoNome.toLowerCase().includes(s.nome.toLowerCase()) ||
          s.nome.toLowerCase().includes(servicoNome.toLowerCase())
        );
        return total + (servicoEncontrado?.preco || 0);
      }, 0);
    };

    // Faturamento estimado baseado nos serviços (soma todos os serviços do agendamento)
    const faturamentoEstimado = agendamentos.reduce((acc, ag) => {
      return acc + calcularValorAgendamento(ag.servico);
    }, 0);

    const faturamentoAnterior = previousAgendamentos.reduce((acc, ag) => {
      return acc + calcularValorAgendamento(ag.servico);
    }, 0);
    
    // Tempo total de serviço
    const tempoTotalMinutos = agendamentos.reduce((acc, ag) => {
      const [startH, startM] = ag.hora_inicio.split(':').map(Number);
      const [endH, endM] = ag.hora_fim.split(':').map(Number);
      return acc + ((endH * 60 + endM) - (startH * 60 + startM));
    }, 0);
    
    // Agendamentos por dia da semana
    const porDiaSemana: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    agendamentos.forEach(ag => {
      const dia = getDay(parseISO(ag.data));
      porDiaSemana[dia]++;
    });
    
    // Serviços com contagem e receita (considera múltiplos serviços por agendamento)
    const servicosData: Record<string, { count: number; receita: number }> = {};
    agendamentos.forEach(ag => {
      // Divide por separadores comuns
      const servicosNoAgendamento = ag.servico.split(/\s*[+,\/]\s*|\s+e\s+/i).map(s => s.trim()).filter(Boolean);
      
      servicosNoAgendamento.forEach(servicoNome => {
        const servicoEncontrado = servicos.find(s => 
          servicoNome.toLowerCase().includes(s.nome.toLowerCase()) ||
          s.nome.toLowerCase().includes(servicoNome.toLowerCase())
        );
        if (!servicosData[servicoNome]) {
          servicosData[servicoNome] = { count: 0, receita: 0 };
        }
        servicosData[servicoNome].count++;
        servicosData[servicoNome].receita += servicoEncontrado?.preco || 0;
      });
    });
    const servicosPopulares = Object.entries(servicosData)
      .map(([nome, data]) => ({ nome, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
    
    // Clientes com dados detalhados (soma todos os serviços do agendamento)
    const clientesData: Record<string, { count: number; totalGasto: number; ultimaVisita: string }> = {};
    agendamentos.forEach(ag => {
      const cliente = ag.cliente_nome;
      const valorAgendamento = calcularValorAgendamento(ag.servico);
      if (!clientesData[cliente]) {
        clientesData[cliente] = { count: 0, totalGasto: 0, ultimaVisita: ag.data };
      }
      clientesData[cliente].count++;
      clientesData[cliente].totalGasto += valorAgendamento;
      if (ag.data > clientesData[cliente].ultimaVisita) {
        clientesData[cliente].ultimaVisita = ag.data;
      }
    });
    const clientesRanking = Object.entries(clientesData)
      .map(([nome, data]) => ({ nome, ...data }))
      .sort((a, b) => b.totalGasto - a.totalGasto)
      .slice(0, 10);
    
    // Horários mais movimentados
    const horariosCount: Record<string, number> = {};
    agendamentos.forEach(ag => {
      const hora = ag.hora_inicio.split(':')[0] + ':00';
      horariosCount[hora] = (horariosCount[hora] || 0) + 1;
    });
    const horariosPico = Object.entries(horariosCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    // Distribuição por horário para gráfico
    const horariosChartData = Object.entries(horariosCount)
      .map(([hora, count]) => ({ hora, agendamentos: count }))
      .sort((a, b) => a.hora.localeCompare(b.hora));
    
    // Média por dia
    const diasUnicos = new Set(agendamentos.map(ag => ag.data)).size;
    const mediaPorDia = diasUnicos > 0 ? totalAgendamentos / diasUnicos : 0;
    
    // Taxa de ocupação estimada com base nos horários de funcionamento reais
    const diasAbertos = horariosFuncionamento.filter(h => !h.fechado).length;
    const diasPeriodo = periodo === 'semana' ? 7 : periodo === 'mes-atual' || periodo === 'mes-passado' ? 30 : periodo === 'trimestre' ? 90 : 180;
    const horasTrabalhoPorDia = horariosFuncionamento
      .filter(h => !h.fechado && h.hora_inicio && h.hora_fim)
      .reduce((acc, h) => {
        const [startH] = (h.hora_inicio || '08:00').split(':').map(Number);
        const [endH] = (h.hora_fim || '18:00').split(':').map(Number);
        return acc + (endH - startH);
      }, 0) / Math.max(diasAbertos, 1);
    
    const slotsDisponiveis = (diasPeriodo * diasAbertos / 7) * horasTrabalhoPorDia * 2;
    const taxaOcupacao = slotsDisponiveis > 0 ? Math.min(100, (totalAgendamentos / slotsDisponiveis) * 100) : 0;
    
    // Ticket médio
    const ticketMedio = totalAgendamentos > 0 ? faturamentoEstimado / totalAgendamentos : 0;
    
    // Clientes únicos
    const clientesNoPeriodo = new Set(agendamentos.map(ag => ag.cliente_nome)).size;
    const clientesNoPeriodoAnterior = new Set(previousAgendamentos.map(ag => ag.cliente_nome)).size;
    
    // Dados para gráficos por dia da semana
    const diasSemanaChart = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((nome, index) => ({
      dia: nome,
      agendamentos: porDiaSemana[index],
    }));

    // Evolução diária do período (soma todos os serviços do agendamento)
    const evolucaoDiaria: Record<string, { data: string; agendamentos: number; receita: number }> = {};
    agendamentos.forEach(ag => {
      const data = ag.data;
      const valorAgendamento = calcularValorAgendamento(ag.servico);
      if (!evolucaoDiaria[data]) {
        evolucaoDiaria[data] = { data, agendamentos: 0, receita: 0 };
      }
      evolucaoDiaria[data].agendamentos++;
      evolucaoDiaria[data].receita += valorAgendamento;
    });
    const evolucaoChart = Object.values(evolucaoDiaria)
      .sort((a, b) => a.data.localeCompare(b.data))
      .map(item => ({
        ...item,
        dataFormatada: format(parseISO(item.data), 'dd/MM', { locale: ptBR }),
      }));

    // Variações percentuais
    const variacaoAgendamentos = totalAgendamentosAnterior > 0 
      ? ((totalAgendamentos - totalAgendamentosAnterior) / totalAgendamentosAnterior) * 100 
      : 0;
    const variacaoFaturamento = faturamentoAnterior > 0 
      ? ((faturamentoEstimado - faturamentoAnterior) / faturamentoAnterior) * 100 
      : 0;
    const variacaoClientes = clientesNoPeriodoAnterior > 0 
      ? ((clientesNoPeriodo - clientesNoPeriodoAnterior) / clientesNoPeriodoAnterior) * 100 
      : 0;
    
    // Receita por hora trabalhada
    const receitaPorHora = tempoTotalMinutos > 0 ? faturamentoEstimado / (tempoTotalMinutos / 60) : 0;
    
    // Cliente com maior gasto
    const melhorCliente = clientesRanking[0] || null;
    
    // Serviço mais rentável
    const servicoMaisRentavel = servicosPopulares.length > 0 
      ? servicosPopulares.reduce((prev, curr) => curr.receita > prev.receita ? curr : prev)
      : null;

    return {
      totalAgendamentos,
      totalAgendamentosAnterior,
      faturamentoEstimado,
      faturamentoAnterior,
      tempoTotalMinutos,
      porDiaSemana,
      servicosPopulares,
      clientesRanking,
      horariosPico,
      horariosChartData,
      mediaPorDia,
      taxaOcupacao,
      ticketMedio,
      clientesNoPeriodo,
      clientesNoPeriodoAnterior,
      diasSemanaChart,
      evolucaoChart,
      variacaoAgendamentos,
      variacaoFaturamento,
      variacaoClientes,
      receitaPorHora,
      melhorCliente,
      servicoMaisRentavel,
    };
  }, [agendamentos, previousAgendamentos, servicos, horariosFuncionamento, periodo]);

  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const chartConfig: ChartConfig = {
    agendamentos: {
      label: "Agendamentos",
      color: "hsl(var(--primary))",
    },
    receita: {
      label: "Receita",
      color: "hsl(var(--success))",
    },
  };

  const pieColors = [
    'hsl(var(--primary))',
    'hsl(var(--success))',
    'hsl(var(--accent))',
    'hsl(var(--warning))',
    'hsl(var(--destructive))',
    'hsl(var(--secondary-foreground))',
  ];

  const VariacaoIndicator = ({ valor, className }: { valor: number; className?: string }) => {
    if (valor === 0) return (
      <span className={cn("flex items-center text-xs text-muted-foreground", className)}>
        <Minus className="w-3 h-3 mr-0.5" />
        0%
      </span>
    );
    if (valor > 0) return (
      <span className={cn("flex items-center text-xs text-success", className)}>
        <ChevronUp className="w-3 h-3" />
        +{valor.toFixed(1)}%
      </span>
    );
    return (
      <span className={cn("flex items-center text-xs text-destructive", className)}>
        <ChevronDown className="w-3 h-3" />
        {valor.toFixed(1)}%
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="fixed top-0 left-0 right-0 h-14 sm:h-16 bg-card/95 backdrop-blur-lg border-b border-border/50 z-50 flex items-center px-3 sm:px-4">
          <Link to="/" className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <h1 className="font-display text-base sm:text-lg font-semibold text-foreground ml-2">Relatórios & Insights</h1>
        </header>
        <main className="pt-20 pb-8 px-3 sm:px-4">
          <LoadingSpinner message="Carregando dados..." />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="fixed top-0 left-0 right-0 h-14 sm:h-16 bg-card/95 backdrop-blur-lg border-b border-border/50 z-50 flex items-center justify-between px-3 sm:px-4">
        <div className="flex items-center">
          <Link to="/" className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <div className="ml-1 sm:ml-2">
            <h1 className="font-display text-base sm:text-lg font-semibold text-foreground">Relatórios</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Dados realizados</p>
          </div>
        </div>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[100px] sm:w-[130px] h-8 sm:h-9 text-[10px] sm:text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semana">Esta semana</SelectItem>
            <SelectItem value="mes-atual">Este mês</SelectItem>
            <SelectItem value="mes-passado">Mês passado</SelectItem>
            <SelectItem value="trimestre">Trimestre</SelectItem>
            <SelectItem value="semestre">Semestre</SelectItem>
          </SelectContent>
        </Select>
      </header>
      
      <main className="pt-16 sm:pt-20 px-3 sm:px-4 animate-fade-in">
        {/* Filtro por cliente */}
        <div className="mb-3 sm:mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
              <Filter className="w-3.5 h-3.5" />
              <span>Cliente:</span>
            </div>
            <Select value={clienteFilter} onValueChange={setClienteFilter}>
              <SelectTrigger className="w-[140px] sm:w-[180px] h-8 text-xs sm:text-sm">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="max-h-[250px]">
                <SelectItem value="todos">Todos os clientes</SelectItem>
                {clientesUnicos.map(nome => (
                  <SelectItem key={nome} value={nome}>{nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clienteFilter !== 'todos' && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2"
                onClick={() => setClienteFilter('todos')}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
            <Badge variant="outline" className="text-[10px] sm:text-xs ml-auto">
              {agendamentos.length} realizados
            </Badge>
          </div>
        </div>
        
        <Tabs defaultValue="resumo" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-3 sm:mb-4 h-9 sm:h-10">
            <TabsTrigger value="resumo" className="text-[10px] sm:text-xs px-1 sm:px-2">Resumo</TabsTrigger>
            <TabsTrigger value="ranking" className="text-[10px] sm:text-xs px-1 sm:px-2">Ranking</TabsTrigger>
            <TabsTrigger value="graficos" className="text-[10px] sm:text-xs px-1 sm:px-2">Gráficos</TabsTrigger>
            <TabsTrigger value="insights" className="text-[10px] sm:text-xs px-1 sm:px-2">Insights</TabsTrigger>
          </TabsList>
          
          {/* RESUMO TAB */}
          <TabsContent value="resumo" className="space-y-3 sm:space-y-4">
            {/* KPIs principais */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Card className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-primary/30">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    <VariacaoIndicator valor={metricas.variacaoAgendamentos} />
                  </div>
                  <p className="text-xl sm:text-3xl font-bold text-foreground">{metricas.totalAgendamentos}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Agendamentos</p>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground/70 mt-0.5">
                    ~{metricas.mediaPorDia.toFixed(1)}/dia
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-success/20 via-success/10 to-transparent border-success/30">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
                    <VariacaoIndicator valor={metricas.variacaoFaturamento} />
                  </div>
                  <p className="text-xl sm:text-3xl font-bold text-foreground">
                    R$ {metricas.faturamentoEstimado.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Faturamento</p>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground/70 mt-0.5">
                    Ticket: R$ {metricas.ticketMedio.toFixed(0)}
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-accent/20 via-accent/10 to-transparent border-accent/30">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <Timer className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                  </div>
                  <p className="text-xl sm:text-3xl font-bold text-foreground">
                    {Math.floor(metricas.tempoTotalMinutos / 60)}h
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Trabalhadas</p>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground/70 mt-0.5">
                    R$ {metricas.receitaPorHora.toFixed(0)}/hora
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-secondary to-secondary/50 border-border">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
                    <VariacaoIndicator valor={metricas.variacaoClientes} />
                  </div>
                  <p className="text-xl sm:text-3xl font-bold text-foreground">{metricas.clientesNoPeriodo}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Clientes</p>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground/70 mt-0.5">
                    atendidos
                  </p>
                </CardContent>
              </Card>
            </div>
            
            {/* Taxa de ocupação */}
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    <span className="text-xs sm:text-sm font-medium">Taxa de Ocupação</span>
                  </div>
                  <Badge variant={metricas.taxaOcupacao > 70 ? "default" : metricas.taxaOcupacao > 40 ? "secondary" : "destructive"} className="text-[10px] sm:text-xs">
                    {metricas.taxaOcupacao > 70 ? 'Excelente' : metricas.taxaOcupacao > 40 ? 'Bom' : 'Baixa'}
                  </Badge>
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Progress value={metricas.taxaOcupacao} className="h-3 sm:h-4" />
                  <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                    <span>0%</span>
                    <span className="font-bold text-foreground">{metricas.taxaOcupacao.toFixed(0)}%</span>
                    <span>100%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gráfico de dias da semana */}
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Por Dia da Semana
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-4 pb-3 sm:pb-4">
                <div className="h-32 sm:h-40">
                  <ChartContainer config={chartConfig}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metricas.diasSemanaChart} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                        <XAxis dataKey="dia" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="agendamentos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

            {/* Destaques */}
            {metricas.melhorCliente && (
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <Card className="border-primary/30">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                      <span className="text-[10px] sm:text-xs text-muted-foreground">Top Cliente</span>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{metricas.melhorCliente.nome}</p>
                    <p className="text-[10px] sm:text-xs text-primary font-medium">
                      R$ {metricas.melhorCliente.totalGasto.toFixed(0)}
                    </p>
                  </CardContent>
                </Card>

                {metricas.servicoMaisRentavel && (
                  <Card className="border-success/30">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                        <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success" />
                        <span className="text-[10px] sm:text-xs text-muted-foreground">Top Serviço</span>
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{metricas.servicoMaisRentavel.nome}</p>
                      <p className="text-[10px] sm:text-xs text-success font-medium">
                        R$ {metricas.servicoMaisRentavel.receita.toFixed(0)}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
          
          {/* RANKING TAB */}
          <TabsContent value="ranking" className="space-y-3 sm:space-y-4">
            {/* Ranking de Clientes */}
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Ranking de Clientes
                </CardTitle>
                <CardDescription className="text-[10px] sm:text-xs">
                  Por valor total gasto no período
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                {metricas.clientesRanking.length === 0 ? (
                  <p className="text-xs sm:text-sm text-muted-foreground text-center py-4">Sem dados no período</p>
                ) : (
                  <div className="space-y-2">
                    {metricas.clientesRanking.map((cliente, index) => (
                      <div 
                        key={cliente.nome} 
                        className={cn(
                          "flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl transition-all",
                          index === 0 ? "bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30" :
                          index === 1 ? "bg-gradient-to-r from-secondary to-secondary/50 border border-border" :
                          index === 2 ? "bg-secondary/30 border border-border/50" :
                          "bg-secondary/10"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0",
                          index === 0 ? "bg-primary text-primary-foreground" :
                          index === 1 ? "bg-foreground/80 text-background" :
                          index === 2 ? "bg-foreground/60 text-background" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{cliente.nome}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">{cliente.count} visitas</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={cn(
                            "text-xs sm:text-sm font-bold",
                            index === 0 ? "text-primary" : "text-foreground"
                          )}>
                            R$ {cliente.totalGasto.toFixed(0)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ranking de Serviços */}
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Scissors className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Ranking de Serviços
                </CardTitle>
                <CardDescription className="text-[10px] sm:text-xs">
                  Por popularidade e receita gerada
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                {metricas.servicosPopulares.length === 0 ? (
                  <p className="text-xs sm:text-sm text-muted-foreground text-center py-4">Sem dados no período</p>
                ) : (
                  <div className="space-y-3">
                    {metricas.servicosPopulares.map((servico, index) => {
                      const percentage = metricas.totalAgendamentos > 0 
                        ? (servico.count / metricas.totalAgendamentos) * 100 
                        : 0;
                      return (
                        <div key={servico.nome} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {index === 0 && <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary flex-shrink-0" />}
                              <span className="text-xs sm:text-sm font-medium text-foreground truncate">{servico.nome}</span>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                              <Badge variant="outline" className="text-[9px] sm:text-[10px]">{servico.count}x</Badge>
                              <span className="text-xs sm:text-sm font-bold text-success">R$ {servico.receita.toFixed(0)}</span>
                            </div>
                          </div>
                          <div className="h-1.5 sm:h-2 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all",
                                index === 0 ? 'bg-primary' : 'bg-primary/60'
                              )}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Horários de Pico */}
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Horários de Pico
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                {metricas.horariosPico.length === 0 ? (
                  <p className="text-xs sm:text-sm text-muted-foreground text-center py-4">Sem dados no período</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {metricas.horariosPico.map(([hora, count], index) => (
                      <div 
                        key={hora} 
                        className={cn(
                          "p-2 sm:p-3 rounded-xl text-center",
                          index === 0 ? 'bg-primary/20 border border-primary/30' : 'bg-secondary/50'
                        )}
                      >
                        <p className="text-sm sm:text-lg font-bold text-foreground">{hora}</p>
                        <p className="text-[9px] sm:text-xs text-muted-foreground">{count} agend.</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* GRÁFICOS TAB */}
          <TabsContent value="graficos" className="space-y-3 sm:space-y-4">
            {/* Evolução no período */}
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Evolução no Período
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-4 pb-3 sm:pb-4">
                {metricas.evolucaoChart.length === 0 ? (
                  <p className="text-xs sm:text-sm text-muted-foreground text-center py-8">Sem dados no período</p>
                ) : (
                  <div className="h-44 sm:h-56">
                    <ChartContainer config={chartConfig}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={metricas.evolucaoChart} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                          <defs>
                            <linearGradient id="colorAgendamentos" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis 
                            dataKey="dataFormatada" 
                            tick={{ fontSize: 9 }} 
                            tickLine={false} 
                            axisLine={false}
                            interval="preserveStartEnd"
                          />
                          <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Area 
                            type="monotone" 
                            dataKey="agendamentos" 
                            stroke="hsl(var(--primary))" 
                            fillOpacity={1}
                            fill="url(#colorAgendamentos)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Receita por dia */}
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-success" />
                  Receita por Dia
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-4 pb-3 sm:pb-4">
                {metricas.evolucaoChart.length === 0 ? (
                  <p className="text-xs sm:text-sm text-muted-foreground text-center py-8">Sem dados no período</p>
                ) : (
                  <div className="h-44 sm:h-56">
                    <ChartContainer config={chartConfig}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={metricas.evolucaoChart} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                          <XAxis 
                            dataKey="dataFormatada" 
                            tick={{ fontSize: 9 }} 
                            tickLine={false} 
                            axisLine={false}
                            interval="preserveStartEnd"
                          />
                          <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="receita" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Distribuição por horário */}
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent" />
                  Distribuição por Horário
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-4 pb-3 sm:pb-4">
                {metricas.horariosChartData.length === 0 ? (
                  <p className="text-xs sm:text-sm text-muted-foreground text-center py-8">Sem dados no período</p>
                ) : (
                  <div className="h-44 sm:h-56">
                    <ChartContainer config={chartConfig}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={metricas.horariosChartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                          <XAxis dataKey="hora" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line 
                            type="monotone" 
                            dataKey="agendamentos" 
                            stroke="hsl(var(--accent))" 
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--accent))', strokeWidth: 0, r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Distribuição de serviços (Pie) */}
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-primary" />
                  Distribuição de Serviços
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-4 pb-3 sm:pb-4">
                {metricas.servicosPopulares.length === 0 ? (
                  <p className="text-xs sm:text-sm text-muted-foreground text-center py-8">Sem dados no período</p>
                ) : (
                  <div className="h-52 sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={metricas.servicosPopulares}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="count"
                          nameKey="nome"
                          label={({ nome, percent }) => `${nome.slice(0, 10)}${nome.length > 10 ? '...' : ''} ${(percent * 100).toFixed(0)}%`}
                          labelLine={{ strokeWidth: 1 }}
                        >
                          {metricas.servicosPopulares.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                          ))}
                        </Pie>
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* INSIGHTS TAB */}
          <TabsContent value="insights" className="space-y-3 sm:space-y-4">
            {/* Insights inteligentes */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
              <CardHeader className="pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Insights Inteligentes
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2 sm:space-y-3">
                {metricas.totalAgendamentos === 0 ? (
                  <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs sm:text-sm text-muted-foreground">Sem agendamentos no período selecionado</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2 p-2.5 sm:p-3 bg-card/50 rounded-xl border border-border/50">
                      <div className="w-2 h-2 rounded-full bg-success mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs sm:text-sm text-foreground">
                          <strong>Melhor dia:</strong> {diasSemana[Object.entries(metricas.porDiaSemana).sort(([,a], [,b]) => b - a)[0]?.[0] as unknown as number || 0]}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          Com {Math.max(...Object.values(metricas.porDiaSemana))} agendamentos
                        </p>
                      </div>
                    </div>
                    
                    {metricas.servicosPopulares[0] && (
                      <div className="flex items-start gap-2 p-2.5 sm:p-3 bg-card/50 rounded-xl border border-border/50">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs sm:text-sm text-foreground">
                            <strong>Serviço campeão:</strong> {metricas.servicosPopulares[0].nome}
                          </p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {((metricas.servicosPopulares[0].count / metricas.totalAgendamentos) * 100).toFixed(0)}% dos agendamentos • R$ {metricas.servicosPopulares[0].receita.toFixed(0)}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {metricas.horariosPico[0] && (
                      <div className="flex items-start gap-2 p-2.5 sm:p-3 bg-card/50 rounded-xl border border-border/50">
                        <div className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs sm:text-sm text-foreground">
                            <strong>Horário de pico:</strong> {metricas.horariosPico[0][0]}
                          </p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {metricas.horariosPico[0][1]} agendamentos neste horário
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-start gap-2 p-2.5 sm:p-3 bg-card/50 rounded-xl border border-border/50">
                      <div className={cn(
                        "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                        metricas.taxaOcupacao > 70 ? "bg-success" : metricas.taxaOcupacao > 40 ? "bg-warning" : "bg-destructive"
                      )} />
                      <div>
                        <p className="text-xs sm:text-sm text-foreground">
                          <strong>Ocupação:</strong> {metricas.taxaOcupacao.toFixed(0)}%
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {metricas.taxaOcupacao > 70 
                            ? 'Excelente aproveitamento da agenda!' 
                            : metricas.taxaOcupacao > 40 
                              ? 'Bom, mas há espaço para mais clientes'
                              : 'Considere promoções para aumentar a ocupação'}
                        </p>
                      </div>
                    </div>

                    {metricas.melhorCliente && (
                      <div className="flex items-start gap-2 p-2.5 sm:p-3 bg-card/50 rounded-xl border border-border/50">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs sm:text-sm text-foreground">
                            <strong>Cliente VIP:</strong> {metricas.melhorCliente.nome}
                          </p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {metricas.melhorCliente.count} visitas • R$ {metricas.melhorCliente.totalGasto.toFixed(0)} gastos
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-start gap-2 p-2.5 sm:p-3 bg-card/50 rounded-xl border border-border/50">
                      <div className="w-2 h-2 rounded-full bg-success mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs sm:text-sm text-foreground">
                          <strong>Produtividade:</strong> R$ {metricas.receitaPorHora.toFixed(0)}/hora
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          Receita média por hora trabalhada
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            
            {/* Resumo Financeiro */}
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
                  Resumo Financeiro
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="p-2.5 sm:p-3 bg-success/10 rounded-xl border border-success/20">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Faturamento Total</p>
                    <p className="text-base sm:text-xl font-bold text-success">R$ {metricas.faturamentoEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <VariacaoIndicator valor={metricas.variacaoFaturamento} className="mt-1" />
                  </div>
                  <div className="p-2.5 sm:p-3 bg-secondary/30 rounded-xl">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Ticket Médio</p>
                    <p className="text-base sm:text-xl font-bold text-foreground">R$ {metricas.ticketMedio.toFixed(2)}</p>
                  </div>
                  <div className="p-2.5 sm:p-3 bg-secondary/30 rounded-xl">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Receita/Hora</p>
                    <p className="text-base sm:text-xl font-bold text-foreground">R$ {metricas.receitaPorHora.toFixed(2)}</p>
                  </div>
                  <div className="p-2.5 sm:p-3 bg-secondary/30 rounded-xl">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Média/Dia</p>
                    <p className="text-base sm:text-xl font-bold text-foreground">
                      R$ {metricas.mediaPorDia > 0 ? ((metricas.faturamentoEstimado / (metricas.totalAgendamentos / metricas.mediaPorDia))).toFixed(0) : '0'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Comparativo com período anterior */}
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Comparativo
                </CardTitle>
                <CardDescription className="text-[10px] sm:text-xs">
                  vs. período anterior
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2.5 sm:p-3 bg-secondary/30 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs sm:text-sm text-foreground">Agendamentos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-medium">{metricas.totalAgendamentos} vs {metricas.totalAgendamentosAnterior}</span>
                      <VariacaoIndicator valor={metricas.variacaoAgendamentos} />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-2.5 sm:p-3 bg-secondary/30 rounded-xl">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs sm:text-sm text-foreground">Faturamento</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-medium">R$ {metricas.faturamentoEstimado.toFixed(0)} vs R$ {metricas.faturamentoAnterior.toFixed(0)}</span>
                      <VariacaoIndicator valor={metricas.variacaoFaturamento} />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-2.5 sm:p-3 bg-secondary/30 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs sm:text-sm text-foreground">Clientes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-medium">{metricas.clientesNoPeriodo} vs {metricas.clientesNoPeriodoAnterior}</span>
                      <VariacaoIndicator valor={metricas.variacaoClientes} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}