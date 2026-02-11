import { useMemo, useState } from 'react';
import { format, parseISO, isToday, isBefore, differenceInMinutes, startOfMonth, endOfMonth, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Clock, 
  Phone, 
  MessageCircle,
  Copy,
  Share2,
  CalendarDays,
  Timer,
  ChevronDown,
  ChevronUp,
  Zap,
  BarChart3,
  ListChecks,
  Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Agendamento, Servico, Cliente } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface AgendaFeaturesProps {
  agendamentos: Agendamento[];
  servicos: Servico[];
  clientes: Cliente[];
  currentDate: Date;
  currentTime: Date;
  onDateChange: (date: Date) => void;
  onAgendamentoSelect: (agendamento: Agendamento) => void;
}

export function AgendaFeatures({
  agendamentos,
  servicos,
  clientes,
  currentDate,
  currentTime,
  onDateChange,
  onAgendamentoSelect
}: AgendaFeaturesProps) {
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const currentDateStr = format(currentDate, 'yyyy-MM-dd');

  // 1. Próximo agendamento do dia
  const nextAppointment = useMemo(() => {
    const now = currentTime;
    const nowStr = format(now, 'HH:mm');
    
    return agendamentos
      .filter(a => a.data === todayStr && a.hora_inicio > nowStr)
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))[0] || null;
  }, [agendamentos, currentTime, todayStr]);

  // 2. Tempo até próximo agendamento
  const timeUntilNext = useMemo(() => {
    if (!nextAppointment) return null;
    
    const [h, m] = nextAppointment.hora_inicio.split(':').map(Number);
    const appointmentTime = new Date();
    appointmentTime.setHours(h, m, 0, 0);
    
    const diff = differenceInMinutes(appointmentTime, currentTime);
    if (diff <= 0) return null;
    
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    
    return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
  }, [nextAppointment, currentTime]);

  // 3. Agendamento atual (em andamento)
  const currentAppointment = useMemo(() => {
    const now = currentTime;
    const nowStr = format(now, 'HH:mm');
    
    return agendamentos.find(a => 
      a.data === todayStr && 
      a.hora_inicio <= nowStr && 
      a.hora_fim > nowStr
    ) || null;
  }, [agendamentos, currentTime, todayStr]);

  // 4. Estatísticas do dia
  const dayStats = useMemo(() => {
    const dayAgendamentos = agendamentos.filter(a => a.data === currentDateStr);
    const confirmados = dayAgendamentos.filter(a => a.status === 'confirmado').length;
    
    // Calcular faturamento estimado
    let faturamento = 0;
    dayAgendamentos.forEach(a => {
      const servico = servicos.find(s => s.nome === a.servico);
      if (servico) faturamento += servico.preco;
    });

    return {
      total: dayAgendamentos.length,
      confirmados,
      pendentes: dayAgendamentos.length - confirmados,
      faturamento
    };
  }, [agendamentos, servicos, currentDateStr]);

  // 5. Estatísticas do mês
  const monthStats = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const monthStartStr = format(monthStart, 'yyyy-MM-dd');
    const monthEndStr = format(monthEnd, 'yyyy-MM-dd');
    
    const monthAgendamentos = agendamentos.filter(a => 
      a.data >= monthStartStr && a.data <= monthEndStr
    );
    
    let faturamento = 0;
    monthAgendamentos.forEach(a => {
      const servico = servicos.find(s => s.nome === a.servico);
      if (servico) faturamento += servico.preco;
    });

    // Clientes únicos
    const clientesUnicos = new Set(monthAgendamentos.map(a => a.cliente_nome)).size;

    return {
      total: monthAgendamentos.length,
      faturamento,
      clientesUnicos
    };
  }, [agendamentos, servicos, currentDate]);

  // 6. Lista de clientes do dia
  const dayClients = useMemo(() => {
    return agendamentos
      .filter(a => a.data === currentDateStr)
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  }, [agendamentos, currentDateStr]);

  // 7. Agendamentos próximos (nas próximas 2 horas)
  const upcomingAppointments = useMemo(() => {
    const now = currentTime;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const twoHoursLater = nowMinutes + 120;
    
    return agendamentos
      .filter(a => {
        if (a.data !== todayStr) return false;
        const [h, m] = a.hora_inicio.split(':').map(Number);
        const appointmentMinutes = h * 60 + m;
        return appointmentMinutes >= nowMinutes && appointmentMinutes <= twoHoursLater;
      })
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  }, [agendamentos, currentTime, todayStr]);

  // 8. Função para contato rápido WhatsApp
  const openWhatsApp = (clienteNome: string) => {
    const cliente = clientes.find(c => c.nome.toLowerCase() === clienteNome.toLowerCase());
    if (cliente?.telefone) {
      const phone = cliente.telefone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}`, '_blank');
    } else {
      toast({
        title: "Telefone não encontrado",
        description: "Este cliente não tem telefone cadastrado.",
        variant: "destructive"
      });
    }
  };

  // 9. Função para ligar
  const makeCall = (clienteNome: string) => {
    const cliente = clientes.find(c => c.nome.toLowerCase() === clienteNome.toLowerCase());
    if (cliente?.telefone) {
      window.open(`tel:${cliente.telefone}`, '_self');
    } else {
      toast({
        title: "Telefone não encontrado",
        description: "Este cliente não tem telefone cadastrado.",
        variant: "destructive"
      });
    }
  };

  // 10. Copiar agenda do dia
  const copyDaySchedule = () => {
    const schedule = dayClients.map(a => 
      `${a.hora_inicio} - ${a.cliente_nome} (${a.servico})`
    ).join('\n');
    
    const text = `📅 Agenda ${format(currentDate, "dd/MM/yyyy", { locale: ptBR })}\n\n${schedule || 'Nenhum agendamento'}`;
    
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copiado!",
        description: "Agenda do dia copiada para a área de transferência."
      });
    });
  };

  // 11. Compartilhar via WhatsApp
  const shareDaySchedule = () => {
    const schedule = dayClients.map(a => 
      `${a.hora_inicio} - ${a.cliente_nome} (${a.servico})`
    ).join('\n');
    
    const text = `📅 Agenda ${format(currentDate, "dd/MM/yyyy", { locale: ptBR })}\n\n${schedule || 'Nenhum agendamento'}`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // 12. Navegação rápida
  const goToToday = () => onDateChange(new Date());
  const goToTomorrow = () => onDateChange(addDays(new Date(), 1));
  const goToYesterday = () => onDateChange(subDays(new Date(), 1));

  return (
    <div className="space-y-3">
      {/* Agendamento atual / Próximo */}
      {(currentAppointment || nextAppointment) && isToday(currentDate) && (
        <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/30 rounded-xl p-3 animate-fade-in">
          {currentAppointment ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-bold text-success uppercase tracking-wide">Agora</span>
              </div>
              <div 
                className="flex items-center justify-between cursor-pointer hover:bg-primary/10 rounded-lg p-2 -m-1 transition-all"
                onClick={() => onAgendamentoSelect(currentAppointment)}
              >
                <div>
                  <p className="font-semibold text-foreground">{currentAppointment.cliente_nome}</p>
                  <p className="text-xs text-muted-foreground">{currentAppointment.servico}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      openWhatsApp(currentAppointment.cliente_nome);
                    }}
                  >
                    <MessageCircle className="w-4 h-4 text-success" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      makeCall(currentAppointment.cliente_nome);
                    }}
                  >
                    <Phone className="w-4 h-4 text-primary" />
                  </Button>
                </div>
              </div>
            </div>
          ) : nextAppointment && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-primary uppercase tracking-wide">Próximo</span>
                </div>
                {timeUntilNext && (
                  <span className="text-xs font-bold text-primary bg-primary/20 px-2 py-0.5 rounded-full">
                    em {timeUntilNext}
                  </span>
                )}
              </div>
              <div 
                className="flex items-center justify-between cursor-pointer hover:bg-primary/10 rounded-lg p-2 -m-1 transition-all"
                onClick={() => onAgendamentoSelect(nextAppointment)}
              >
                <div>
                  <p className="font-semibold text-foreground">{nextAppointment.cliente_nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {nextAppointment.hora_inicio} • {nextAppointment.servico}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      openWhatsApp(nextAppointment.cliente_nome);
                    }}
                  >
                    <MessageCircle className="w-4 h-4 text-success" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      makeCall(nextAppointment.cliente_nome);
                    }}
                  >
                    <Phone className="w-4 h-4 text-primary" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alertas de agendamentos próximos */}
      {upcomingAppointments.length > 1 && isToday(currentDate) && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-2">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold text-accent">Próximas 2 horas</span>
            <span className="text-xs text-muted-foreground">({upcomingAppointments.length} agendamentos)</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {upcomingAppointments.slice(0, 4).map((a) => (
              <button
                key={a.id}
                onClick={() => onAgendamentoSelect(a)}
                className="text-[10px] px-2 py-1 bg-card border border-border rounded-lg hover:border-primary/50 transition-all"
              >
                <span className="font-bold text-primary">{a.hora_inicio}</span>
                <span className="text-muted-foreground ml-1">{a.cliente_nome.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ações rápidas */}
      <div className="bg-secondary/30 border border-border/50 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowQuickActions(!showQuickActions)}
          className="w-full flex items-center justify-between p-2 hover:bg-secondary/50 transition-all"
        >
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Ações Rápidas</span>
          </div>
          {showQuickActions ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        
        {showQuickActions && (
          <div className="p-2 pt-0 space-y-2 animate-fade-in">
            {/* Navegação rápida por data */}
            <div className="flex items-center gap-1 flex-wrap">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-[10px] gap-1"
                onClick={goToYesterday}
              >
                Ontem
              </Button>
              <Button 
                variant={isToday(currentDate) ? "default" : "outline"}
                size="sm" 
                className="h-7 text-[10px] gap-1"
                onClick={goToToday}
              >
                Hoje
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-[10px] gap-1"
                onClick={goToTomorrow}
              >
                Amanhã
              </Button>
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-[10px] gap-1"
                  >
                    <CalendarDays className="w-3 h-3" />
                    Ir para...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={currentDate}
                    onSelect={(date) => {
                      if (date) {
                        onDateChange(date);
                        setShowDatePicker(false);
                      }
                    }}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Ações da agenda */}
            <div className="flex items-center gap-1 flex-wrap">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-[10px] gap-1"
                onClick={copyDaySchedule}
              >
                <Copy className="w-3 h-3" />
                Copiar Agenda
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-[10px] gap-1"
                onClick={shareDaySchedule}
              >
                <Share2 className="w-3 h-3" />
                Compartilhar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Estatísticas */}
      <div className="bg-secondary/30 border border-border/50 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowStats(!showStats)}
          className="w-full flex items-center justify-between p-2 hover:bg-secondary/50 transition-all"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Estatísticas</span>
          </div>
          {showStats ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        
        {showStats && (
          <div className="p-2 pt-0 space-y-3 animate-fade-in">
            {/* Stats do dia */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                {format(currentDate, "dd 'de' MMMM", { locale: ptBR })}
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-1.5 text-center">
                  <p className="text-lg font-bold text-primary">{dayStats.total}</p>
                  <p className="text-[8px] text-muted-foreground">Total</p>
                </div>
                <div className="bg-success/10 border border-success/30 rounded-lg p-1.5 text-center">
                  <p className="text-lg font-bold text-success">{dayStats.confirmados}</p>
                  <p className="text-[8px] text-muted-foreground">Confirmados</p>
                </div>
                <div className="bg-accent/10 border border-accent/30 rounded-lg p-1.5 text-center">
                  <p className="text-lg font-bold text-accent">{dayStats.pendentes}</p>
                  <p className="text-[8px] text-muted-foreground">Pendentes</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-1.5 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {dayStats.faturamento > 0 ? `R$${dayStats.faturamento}` : '-'}
                  </p>
                  <p className="text-[8px] text-muted-foreground">Previsto</p>
                </div>
              </div>
            </div>

            {/* Stats do mês */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="bg-card border border-border rounded-lg p-1.5 text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <ListChecks className="w-3 h-3 text-primary" />
                  </div>
                  <p className="text-lg font-bold text-foreground">{monthStats.total}</p>
                  <p className="text-[8px] text-muted-foreground">Agendamentos</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-1.5 text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <Users className="w-3 h-3 text-primary" />
                  </div>
                  <p className="text-lg font-bold text-foreground">{monthStats.clientesUnicos}</p>
                  <p className="text-[8px] text-muted-foreground">Clientes</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-1.5 text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <DollarSign className="w-3 h-3 text-success" />
                  </div>
                  <p className="text-lg font-bold text-success">
                    {monthStats.faturamento > 0 ? `R$${monthStats.faturamento}` : '-'}
                  </p>
                  <p className="text-[8px] text-muted-foreground">Previsto</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lista de clientes do dia */}
      {dayClients.length > 0 && (
        <div className="bg-secondary/30 border border-border/50 rounded-xl p-2">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">
              Clientes do dia ({dayClients.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {dayClients.map((a) => {
              const isPast = a.data === todayStr && a.hora_fim < format(currentTime, 'HH:mm');
              return (
                <button
                  key={a.id}
                  onClick={() => onAgendamentoSelect(a)}
                  className={cn(
                    "text-[10px] px-2 py-1 rounded-lg border transition-all",
                    isPast 
                      ? "bg-muted/50 border-border/50 text-muted-foreground line-through" 
                      : "bg-card border-border hover:border-primary/50"
                  )}
                >
                  <span className="font-bold text-primary">{a.hora_inicio}</span>
                  <span className="ml-1">{a.cliente_nome.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
