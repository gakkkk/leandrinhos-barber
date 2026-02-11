import { useState, useMemo, useEffect, useRef } from 'react';
import { format, addDays, addMonths, startOfWeek, startOfMonth, endOfMonth, isToday, parseISO, getDay, isSameDay, isSameMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, AlertCircle, User, Scissors, Plus, Trash2, Loader2, RefreshCw, Search, X, Phone, MessageCircle, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Agendamento, Bloqueio, Ferias, ViewMode, HorarioFuncionamento, Cliente, Servico } from '@/types';
import { cn } from '@/lib/utils';
import { NovoAgendamentoDialog } from './NovoAgendamentoDialog';
import { ReagendarDialog } from './ReagendarDialog';
import { AgendaFeatures } from './AgendaFeatures';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { notifyDeletedAppointment } from '@/lib/notificationService';

interface AgendaViewProps {
  agendamentos: Agendamento[];
  bloqueios: Bloqueio[];
  ferias: Ferias[];
  horariosFuncionamento: HorarioFuncionamento[];
  clientes: Cliente[];
  servicos: Servico[];
  isLoading?: boolean;
  onEventCreated?: () => void;
}

// Gera horários de 30 em 30 minutos
const generateTimeSlots = (horaInicio: string, horaFim: string): string[] => {
  const slots: string[] = [];
  const [startHour, startMin] = horaInicio.split(':').map(Number);
  const [endHour, endMin] = horaFim.split(':').map(Number);
  
  let currentHour = startHour;
  let currentMin = startMin;
  
  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
    slots.push(`${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`);
    currentMin += 30;
    if (currentMin >= 60) {
      currentMin = 0;
      currentHour++;
    }
  }
  
  return slots;
};

// Calcula duração em minutos a partir de hora_inicio e hora_fim
const calculateDuration = (horaInicio: string, horaFim: string): number => {
  const [startH, startM] = horaInicio.split(':').map(Number);
  const [endH, endM] = horaFim.split(':').map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
};

type ExtendedViewMode = ViewMode | 'mes';

// Função para encontrar cliente pelo nome do agendamento (busca inteligente)
const findClienteByNome = (nomeAgendamento: string, clientes: Cliente[]): Cliente | undefined => {
  const nomeNormalizado = nomeAgendamento
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  
  // 1. Tentar match exato (case-insensitive)
  let cliente = clientes.find(c => c.nome.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === nomeNormalizado);
  if (cliente) return cliente;
  
  // 2. Tentar match exato com o primeiro nome apenas
  // (ex: agendamento "GABRIEL" deve encontrar "Gabriel Silva" mas não "Gabriel Outro")
  const primeiroNome = nomeNormalizado.split(' ')[0];
  const matchesPrimeiroNome = clientes.filter(c => 
    c.nome.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ')[0] === primeiroNome
  );
  
  // Se só tem um cliente com esse primeiro nome, usa ele
  if (matchesPrimeiroNome.length === 1) {
    return matchesPrimeiroNome[0];
  }
  
  // 3. Se tem múltiplos matches, tenta encontrar o que começa com o nome do agendamento
  if (matchesPrimeiroNome.length > 1) {
    const matchExato = matchesPrimeiroNome.find(c => 
      c.nome.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').startsWith(nomeNormalizado)
    );
    if (matchExato) return matchExato;
  }
  
  // 4. Tentar busca que contém o nome
  const matchesContem = clientes.filter(c => {
    const cn = c.nome.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return cn.includes(nomeNormalizado) || nomeNormalizado.includes(cn);
  });
  
  if (matchesContem.length === 1) {
    return matchesContem[0];
  }
  
  return undefined;
};

export function AgendaView({ agendamentos, bloqueios, ferias, horariosFuncionamento, clientes, servicos, isLoading, onEventCreated }: AgendaViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ExtendedViewMode>('dia');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);
  const [showNovoAgendamento, setShowNovoAgendamento] = useState(false);
  const [showReagendar, setShowReagendar] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'single' | 'series' | null>(null);
  
  // Referência para a data atual ao deletar (para manter navegação)
  const deletingDateRef = useRef<Date | null>(null);

  // Função para encontrar eventos da mesma série (mesmo cliente, serviço, horário, em datas futuras)
  const findSeriesEvents = (agendamento: Agendamento): Agendamento[] => {
    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

    const baseCliente = normalize(agendamento.cliente_nome);
    const baseServico = normalize(agendamento.servico);
    const basePrimeiroNome = baseCliente.split(' ')[0] ?? '';

    const agendamentoDate = parseISO(agendamento.data);
    const dayOfWeek = getDay(agendamentoDate);
    
    return agendamentos.filter(a => {
      if (a.id === agendamento.id) return false; // Excluir o próprio evento

      const candCliente = normalize(a.cliente_nome);
      const candServico = normalize(a.servico);
      const candPrimeiroNome = candCliente.split(' ')[0] ?? '';

      const clienteMatch =
        candCliente === baseCliente ||
        candCliente.startsWith(baseCliente) ||
        baseCliente.startsWith(candCliente) ||
        (basePrimeiroNome && candPrimeiroNome === basePrimeiroNome);

      const servicoMatch =
        candServico === baseServico ||
        candServico.startsWith(baseServico) ||
        baseServico.startsWith(candServico);

      if (!clienteMatch) return false;
      if (!servicoMatch) return false;
      if (a.hora_inicio !== agendamento.hora_inicio) return false;
      
      // Verificar se é no mesmo dia da semana
      const aDate = parseISO(a.data);
      if (getDay(aDate) !== dayOfWeek) return false;
      
      // Só eventos futuros (a partir do evento clicado)
      if (aDate <= agendamentoDate) return false;
      
      return true;
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const navigateDate = (direction: 'prev' | 'next') => {
    if (viewMode === 'mes') {
      setCurrentDate(prev => addMonths(prev, direction === 'next' ? 1 : -1));
    } else {
      const days = viewMode === 'dia' ? 1 : 7;
      setCurrentDate(prev => addDays(prev, direction === 'next' ? days : -days));
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Envia notificação de exclusão via WhatsApp
  const sendDeleteNotification = async (
    clienteNome: string, 
    servico: string, 
    data: string, 
    hora: string,
    mode: 'single' | 'series',
    count: number,
    eventId: string
  ) => {
    try {
      const cliente = findClienteByNome(clienteNome, clientes);
      const phone = cliente?.telefone;

      console.log('[Excluir] Dados para notificação:', { clienteNome, phone, eventId, clienteEncontrado: !!cliente });

      // Permite enviar mesmo sem telefone, pois a edge function pode resolver via eventId
      const dataFormatada = format(parseISO(data), "EEEE, d 'de' MMMM", { locale: ptBR });
      
      let message = '';
      if (mode === 'series') {
        message = `Olá ${clienteNome}! 👋\n\n❌ *Horários cancelados:*\n\nSeu horário fixo de ${servico} às ${hora} foi cancelado.\n\nForam removidos ${count} agendamento(s) a partir de ${dataFormatada}.\n\nQualquer dúvida, entre em contato! 💈`;
      } else {
        message = `Olá ${clienteNome}! 👋\n\n❌ *Agendamento cancelado:*\n\n✂️ Serviço: ${servico}\n🗓️ Data: ${dataFormatada}\n⏰ Horário: ${hora}\n\nSeu horário foi cancelado. Qualquer dúvida, entre em contato! 💈`;
      }
      
      console.log('[Excluir] Enviando para edge function...', { phone: phone || 'via eventId', eventId });
      
      const { data: wapiData, error: wapiError } = await supabase.functions.invoke('send-wapi-reminder', {
        body: { phone: phone || undefined, message, eventId },
      });

      console.log('[Excluir] Resposta da edge function:', { wapiData, wapiError });

      if (wapiError) throw wapiError;
      if ((wapiData as any)?.error) throw new Error((wapiData as any)?.error);
      
      console.log('[Excluir] Notificação de cancelamento enviada com sucesso');
      return true;
    } catch (err) {
      console.error('[Excluir] Erro ao enviar notificação WhatsApp:', err);
      return false;
    }
  };

  const handleDeleteAgendamento = async (mode: 'single' | 'series' = 'single') => {
    if (!selectedAgendamento) return;
    
    // Salva a data do agendamento antes de deletar para manter a navegação
    deletingDateRef.current = parseISO(selectedAgendamento.data);
    
    setIsDeleting(true);
    
    try {
      // Lista de eventos para deletar
      const eventsToDelete: Agendamento[] = [selectedAgendamento];
      
      if (mode === 'series') {
        const seriesEvents = findSeriesEvents(selectedAgendamento);
        eventsToDelete.push(...seriesEvents);
      }
      
      let deletedCount = 0;
      let errorCount = 0;
      
      // Deletar todos os eventos
      for (const event of eventsToDelete) {
        try {
          const { data, error } = await supabase.functions.invoke('google-calendar-delete', {
            body: { eventId: event.id },
          });
          
          if (error || data?.error) {
            errorCount++;
            console.error(`Erro ao deletar evento ${event.id}:`, error || data?.error);
          } else {
            deletedCount++;
          }
        } catch (err) {
          errorCount++;
          console.error(`Erro ao deletar evento ${event.id}:`, err);
        }
      }
      
      // Enviar notificação WhatsApp de cancelamento (se houver algo removido)
      const whatsappSent = deletedCount > 0
        ? await sendDeleteNotification(
            selectedAgendamento.cliente_nome,
            selectedAgendamento.servico,
            selectedAgendamento.data,
            selectedAgendamento.hora_inicio,
            mode,
              deletedCount,
              selectedAgendamento.id
          )
        : false;
      
      // Send notification in-app for cancelled appointment
      notifyDeletedAppointment(
        selectedAgendamento.cliente_nome,
        selectedAgendamento.servico,
        selectedAgendamento.data,
        selectedAgendamento.hora_inicio
      );
      
      if (mode === 'series') {
        toast({
          title: "Série excluída!",
          description: `${deletedCount} agendamento(s) removido(s)${errorCount > 0 ? `, ${errorCount} erro(s)` : ''}.${whatsappSent ? ' WhatsApp enviado ao cliente.' : ' WhatsApp não foi enviado.'}`,
        });
      } else {
        toast({
          title: "Agendamento excluído!",
          description: whatsappSent
            ? 'O agendamento foi removido e o cliente foi notificado no WhatsApp.'
            : 'O agendamento foi removido, mas não foi possível notificar no WhatsApp.',
        });
      }
      
      setShowDeleteConfirm(false);
      setDeleteMode(null);
      setSelectedAgendamento(null);
      
      // Mantém a data atual ao deletar (não volta para hoje)
      if (deletingDateRef.current) {
        setCurrentDate(deletingDateRef.current);
      }
      
      onEventCreated?.();
      
    } catch (err) {
      console.error('Error deleting:', err);
      toast({
        title: "Erro ao excluir",
        description: err instanceof Error ? err.message : "Não foi possível excluir o agendamento.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      deletingDateRef.current = null;
    }
  };

  const isHorarioBloqueado = (data: string, hora: string) => {
    return bloqueios.some(b => {
      if (b.data !== data) return false;
      return hora >= b.hora_inicio && hora < b.hora_fim;
    });
  };

  const getBloqueioForSlot = (data: string, hora: string) => {
    return bloqueios.find(b => {
      if (b.data !== data) return false;
      return hora >= b.hora_inicio && hora < b.hora_fim;
    });
  };

  const isDataEmFerias = (data: string) => {
    return ferias.some(f => f.data === data);
  };

  const getHorarioFuncionamentoForDay = (date: Date): HorarioFuncionamento | undefined => {
    const diaSemana = getDay(date);
    return horariosFuncionamento.find(h => h.dia_semana === diaSemana);
  };

  const isDiaFechado = (date: Date): boolean => {
    const horario = getHorarioFuncionamentoForDay(date);
    return horario?.fechado ?? false;
  };

  const getHorariosForDay = (date: Date): string[] => {
    const horario = getHorarioFuncionamentoForDay(date);
    if (!horario || horario.fechado || !horario.hora_inicio || !horario.hora_fim) {
      return [];
    }
    return generateTimeSlots(horario.hora_inicio, horario.hora_fim);
  };

  // Filtra agendamentos com base na busca
  const filteredAgendamentos = useMemo(() => {
    if (!searchQuery.trim()) return agendamentos;
    const query = searchQuery.toLowerCase().trim();
    return agendamentos.filter(a => 
      a.cliente_nome.toLowerCase().includes(query) ||
      a.servico.toLowerCase().includes(query)
    );
  }, [agendamentos, searchQuery]);

  // Agendamentos do resultado da busca para exibição
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return [...filteredAgendamentos].sort((a, b) => {
      // Ordena por data mais recente primeiro
      const dateCompare = a.data.localeCompare(b.data);
      if (dateCompare !== 0) return dateCompare;
      return a.hora_inicio.localeCompare(b.hora_inicio);
    });
  }, [filteredAgendamentos, searchQuery]);

  const getAgendamentosForSlot = (data: string, hora: string) => {
    // Retorna todos os agendamentos que começam dentro deste intervalo de 30 minutos
    const [slotH, slotM] = hora.split(':').map(Number);
    const slotMinutes = slotH * 60 + slotM;
    const nextSlotMinutes = slotMinutes + 30;
    
    return filteredAgendamentos
      .filter(a => {
        if (a.data !== data) return false;
        const [aH, aM] = a.hora_inicio.split(':').map(Number);
        const aMinutes = aH * 60 + aM;
        return aMinutes >= slotMinutes && aMinutes < nextSlotMinutes;
      })
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  };
  
  const getAgendamentosCount = (date: Date) => {
    const dataStr = format(date, 'yyyy-MM-dd');
    return filteredAgendamentos.filter(a => a.data === dataStr).length;
  };


  const getCurrentTimePosition = (horariosDay: string[]) => {
    if (horariosDay.length === 0) return 0;
    const now = currentTime;
    const currentTimeStr = format(now, 'HH:mm');
    const firstSlot = horariosDay[0];
    const lastSlot = horariosDay[horariosDay.length - 1];
    
    const [firstH, firstM] = firstSlot.split(':').map(Number);
    const [lastH, lastM] = lastSlot.split(':').map(Number);
    const [nowH, nowM] = currentTimeStr.split(':').map(Number);
    
    const firstMinutes = firstH * 60 + firstM;
    const lastMinutes = lastH * 60 + lastM + 30;
    const nowMinutes = nowH * 60 + nowM;
    
    const totalMinutes = lastMinutes - firstMinutes;
    const elapsedMinutes = nowMinutes - firstMinutes;
    
    const percentage = (elapsedMinutes / totalMinutes) * 100;
    return Math.max(0, Math.min(100, percentage));
  };

  const renderAppointmentCard = (agendamento: Agendamento, isCompact: boolean = false) => {
    const horaFim = agendamento.hora_fim;
    const duracao = calculateDuration(agendamento.hora_inicio, agendamento.hora_fim);
    const isConfirmado = agendamento.status === 'confirmado';
    
    if (isCompact) {
      return (
        <div 
          className={cn(
            "h-full rounded-lg p-1 sm:p-1.5 border cursor-pointer transition-all hover:scale-[1.02]",
            isConfirmado 
              ? "bg-primary/20 border-primary/50 hover:bg-primary/30" 
              : "bg-secondary border-border hover:bg-secondary/80"
          )}
          onClick={() => setSelectedAgendamento(agendamento)}
        >
          <p className="text-[8px] sm:text-[10px] font-semibold text-foreground truncate">{agendamento.cliente_nome}</p>
          <p className="text-[7px] sm:text-[8px] text-primary font-medium">{agendamento.hora_inicio}</p>
        </div>
      );
    }

    return (
      <div 
        className={cn(
          "rounded-xl p-2 sm:p-3 border cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg",
          isConfirmado 
            ? "bg-gradient-to-br from-primary/20 to-primary/10 border-primary/50" 
            : "bg-gradient-to-br from-secondary to-secondary/80 border-border"
        )}
        onClick={() => setSelectedAgendamento(agendamento)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary flex-shrink-0" />
              <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{agendamento.cliente_nome}</p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <Scissors className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground flex-shrink-0" />
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{agendamento.servico}</p>
            </div>
          </div>
          <div className={cn(
            "flex-shrink-0 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-bold",
            isConfirmado 
              ? "bg-primary text-primary-foreground" 
              : "bg-muted text-muted-foreground"
          )}>
            {isConfirmado ? '✓' : '?'}
          </div>
        </div>
        
        <div className="mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-border/50">
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
            <span className="text-[10px] sm:text-xs font-bold text-primary">{agendamento.hora_inicio}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">→</span>
            <span className="text-[10px] sm:text-xs font-bold text-foreground">{horaFim}</span>
            <span className="text-[8px] sm:text-[10px] text-muted-foreground">({duracao}min)</span>
          </div>
        </div>
      </div>
    );
  };

  const renderTimeSlot = (data: string, hora: string, isCurrentDay: boolean) => {
    const agendamentosSlot = getAgendamentosForSlot(data, hora);
    const bloqueio = getBloqueioForSlot(data, hora);
    const emFerias = isDataEmFerias(data);

    if (emFerias) {
      return (
        <div className="h-14 sm:h-16 bg-accent/10 border border-accent/30 rounded-xl flex items-center justify-center gap-2">
          <span className="text-base sm:text-lg">🌴</span>
          <span className="text-[10px] sm:text-xs text-accent font-medium">Férias</span>
        </div>
      );
    }

    if (bloqueio) {
      return (
        <div className="h-14 sm:h-16 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center justify-center gap-1 sm:gap-2">
          <span className="text-base sm:text-lg">🔒</span>
          <div className="text-center">
            <span className="text-[10px] sm:text-xs text-destructive font-medium block">Bloqueado</span>
            <span className="text-[8px] sm:text-[10px] text-destructive/70">{bloqueio.hora_inicio} - {bloqueio.hora_fim}</span>
          </div>
        </div>
      );
    }

    if (agendamentosSlot.length > 0) {
      // Se houver mais de um agendamento no mesmo bloco de 30min, exibe todos empilhados
      if (agendamentosSlot.length === 1) {
        return renderAppointmentCard(agendamentosSlot[0]);
      }
      return (
        <div className="space-y-1">
          {agendamentosSlot.map((ag) => (
            <div key={ag.id}>{renderAppointmentCard(ag)}</div>
          ))}
        </div>
      );
    }

    return (
      <div className="h-14 sm:h-16 bg-secondary/20 border border-border/30 rounded-xl flex items-center justify-center hover:bg-secondary/40 transition-all hover:border-primary/30 cursor-pointer group">
        <div className="text-center">
          <span className="text-[10px] sm:text-xs text-muted-foreground group-hover:text-foreground transition-colors">Disponível</span>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dataStr = format(currentDate, 'yyyy-MM-dd');
    const isCurrentDay = isToday(currentDate);
    const emFerias = isDataEmFerias(dataStr);
    const fechado = isDiaFechado(currentDate);
    const horariosDay = getHorariosForDay(currentDate);
    const dayAgendamentos = filteredAgendamentos.filter(a => a.data === dataStr);

    if (emFerias) {
      return (
        <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-accent/20 flex items-center justify-center mb-4 animate-pulse">
            <span className="text-3xl sm:text-4xl">🌴</span>
          </div>
          <h3 className="font-display text-lg sm:text-xl font-semibold text-foreground mb-2">Período de Férias</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">Aproveite o descanso!</p>
        </div>
      );
    }

    if (fechado || horariosDay.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-destructive" />
          </div>
          <h3 className="font-display text-lg sm:text-xl font-semibold text-foreground mb-2">Fechado</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">Não há expediente neste dia</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 sm:space-y-4">
        {/* Stats do dia */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-2 sm:p-3 text-center">
            <p className="text-xl sm:text-2xl font-bold text-primary">{dayAgendamentos.length}</p>
            <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-wide">Agendamentos</p>
          </div>
          <div className="bg-success/10 border border-success/30 rounded-xl p-2 sm:p-3 text-center">
            <p className="text-xl sm:text-2xl font-bold text-success">{dayAgendamentos.filter(a => a.status === 'confirmado').length}</p>
            <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-wide">Confirmados</p>
          </div>
          <div className="bg-secondary border border-border rounded-xl p-2 sm:p-3 text-center">
            <p className="text-xl sm:text-2xl font-bold text-foreground">{horariosDay.length - dayAgendamentos.length}</p>
            <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase tracking-wide">Disponíveis</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {isCurrentDay && (
            <div 
              className="current-time-indicator"
              style={{ top: `${getCurrentTimePosition(horariosDay)}%` }}
            />
          )}
          <div className="space-y-2 sm:space-y-3">
            {horariosDay.map((hora) => (
              <div key={hora} className="flex gap-2 sm:gap-4 items-start">
                <div className="flex-shrink-0 w-11 sm:w-14 pt-2 sm:pt-3">
                  <span className={cn(
                    "text-xs sm:text-sm font-bold",
                    hora === format(currentTime, 'HH:mm').slice(0,5) ? "text-primary" : "text-muted-foreground"
                  )}>{hora}</span>
                </div>
                <div className="flex-1">
                  {renderTimeSlot(dataStr, hora, isCurrentDay)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Calcula todos os horários únicos para a semana
  const weekTimeSlots = useMemo(() => {
    const allSlots = new Set<string>();
    weekDays.forEach(day => {
      const slots = getHorariosForDay(day);
      slots.forEach(slot => allSlots.add(slot));
    });
    return Array.from(allSlots).sort();
  }, [weekDays, horariosFuncionamento]);

  const renderWeekView = () => {
    return (
      <div className="overflow-x-auto -mx-2 sm:-mx-4 px-2 sm:px-4 scrollbar-thin">
        <div className="min-w-[600px] sm:min-w-[750px]">
          {/* Header dos dias */}
          <div className="grid grid-cols-8 gap-1 sm:gap-2 mb-2 sm:mb-3 sticky top-0 bg-card z-10 pb-2">
            <div className="w-10 sm:w-14" />
            {weekDays.map((day) => {
              const fechado = isDiaFechado(day);
              const emFerias = isDataEmFerias(format(day, 'yyyy-MM-dd'));
              const agendamentosCount = getAgendamentosCount(day);
              const isCurrent = isToday(day);
              
              return (
                <div 
                  key={day.toISOString()} 
                  className={cn(
                    "text-center py-2 sm:py-3 rounded-lg sm:rounded-xl transition-all",
                    isCurrent && "bg-primary/20 border-2 border-primary",
                    !isCurrent && "bg-secondary/50 border border-border/50",
                    (fechado || emFerias) && "opacity-50"
                  )}
                >
                  <p className="text-[8px] sm:text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
                    {format(day, 'EEE', { locale: ptBR })}
                  </p>
                  <p className={cn(
                    "text-sm sm:text-lg font-bold",
                    isCurrent ? "text-primary" : "text-foreground"
                  )}>
                    {format(day, 'd')}
                  </p>
                  {!fechado && !emFerias && agendamentosCount > 0 && (
                    <div className="mt-0.5 sm:mt-1">
                      <span className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary/20 text-primary text-[8px] sm:text-[10px] font-bold">
                        {agendamentosCount}
                      </span>
                    </div>
                  )}
                  {emFerias && <span className="text-[10px] sm:text-xs">🌴</span>}
                  {fechado && !emFerias && <span className="text-[8px] sm:text-[10px] text-destructive font-medium">Fechado</span>}
                </div>
              );
            })}
          </div>
          
          {/* Grid de horários */}
          <div className="space-y-1 sm:space-y-2">
            {weekTimeSlots.map((hora) => (
              <div key={hora} className="grid grid-cols-8 gap-1 sm:gap-2">
                <div className="w-10 sm:w-14 py-1 sm:py-2">
                  <span className="text-[10px] sm:text-xs font-bold text-muted-foreground">{hora}</span>
                </div>
                {weekDays.map((day) => {
                  const dataStr = format(day, 'yyyy-MM-dd');
                  const horariosDay = getHorariosForDay(day);
                  const emFerias = isDataEmFerias(dataStr);
                  const fechado = isDiaFechado(day);
                  const agendamentosSlot = getAgendamentosForSlot(dataStr, hora);
                  const bloqueado = isHorarioBloqueado(dataStr, hora);
                  
                  if (fechado || emFerias || !horariosDay.includes(hora)) {
                    return (
                      <div key={day.toISOString()} className="min-h-[36px] sm:min-h-[44px]">
                        <div className="h-9 sm:h-11 bg-muted/20 rounded-lg border border-border/20" />
                      </div>
                    );
                  }
                  
                  if (bloqueado) {
                    return (
                      <div key={day.toISOString()} className="min-h-[36px] sm:min-h-[44px]">
                        <div className="h-9 sm:h-11 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center justify-center">
                          <span className="text-[10px] sm:text-xs">🔒</span>
                        </div>
                      </div>
                    );
                  }
                  
                  if (agendamentosSlot.length > 0) {
                    return (
                      <div key={day.toISOString()} className="min-h-[36px] sm:min-h-[44px]">
                        {renderAppointmentCard(agendamentosSlot[0], true)}
                      </div>
                    );
                  }
                  
                  return (
                    <div key={day.toISOString()} className="min-h-[36px] sm:min-h-[44px]">
                      <div className="h-9 sm:h-11 bg-secondary/30 border border-border/30 rounded-lg hover:bg-secondary/50 hover:border-primary/30 transition-all cursor-pointer" />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Renderiza visão mensal
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = addDays(startOfWeek(monthEnd, { weekStartsOn: 1 }), 6);
    
    const daysInView = eachDayOfInterval({ start: startDate, end: endDate });
    const weeks: Date[][] = [];
    
    for (let i = 0; i < daysInView.length; i += 7) {
      weeks.push(daysInView.slice(i, i + 7));
    }

    return (
      <div className="space-y-1 sm:space-y-2">
        {/* Header dias da semana */}
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-2">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((dia) => (
            <div key={dia} className="text-center py-1 sm:py-2">
              <span className="text-[9px] sm:text-xs font-bold text-muted-foreground uppercase">{dia}</span>
            </div>
          ))}
        </div>

        {/* Semanas */}
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {week.map((day) => {
              const dataStr = format(day, 'yyyy-MM-dd');
              const emFerias = isDataEmFerias(dataStr);
              const fechado = isDiaFechado(day);
              const isCurrent = isToday(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const dayAgendamentos = filteredAgendamentos.filter(a => a.data === dataStr);

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => {
                    setCurrentDate(day);
                    setViewMode('dia');
                  }}
                  className={cn(
                    "min-h-[60px] sm:min-h-[80px] p-1 sm:p-1.5 rounded-lg sm:rounded-xl border cursor-pointer transition-all hover:scale-[1.02]",
                    !isCurrentMonth && "opacity-40",
                    isCurrent && "bg-primary/20 border-primary",
                    !isCurrent && isCurrentMonth && "bg-secondary/30 border-border/30 hover:border-primary/50",
                    emFerias && "bg-accent/10 border-accent/30",
                    fechado && !emFerias && "bg-muted/30 border-border/20"
                  )}
                >
                  <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                    <span className={cn(
                      "text-xs sm:text-sm font-bold",
                      isCurrent ? "text-primary" : "text-foreground"
                    )}>
                      {format(day, 'd')}
                    </span>
                    {emFerias && <span className="text-[9px] sm:text-xs">🌴</span>}
                    {fechado && !emFerias && <span className="text-[8px] sm:text-[10px] text-destructive">✕</span>}
                  </div>
                  
                  {dayAgendamentos.length > 0 && !emFerias && !fechado && (
                    <div className="space-y-0.5">
                      {dayAgendamentos.slice(0, 2).map((ag) => (
                        <div
                          key={ag.id}
                          className={cn(
                            "text-[7px] sm:text-[8px] px-0.5 sm:px-1 py-0.5 rounded truncate",
                            ag.status === 'confirmado'
                              ? "bg-primary/30 text-primary"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {ag.hora_inicio} {ag.cliente_nome.split(' ')[0]}
                        </div>
                      ))}
                      {dayAgendamentos.length > 2 && (
                        <div className="text-[7px] sm:text-[8px] text-muted-foreground text-center">
                          +{dayAgendamentos.length - 2}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3 sm:space-y-4 animate-fade-in">
      {/* Modal de novo agendamento */}
      <NovoAgendamentoDialog
        open={showNovoAgendamento}
        onOpenChange={setShowNovoAgendamento}
        selectedDate={currentDate}
        clientes={clientes}
        servicos={servicos}
        horariosFuncionamento={horariosFuncionamento}
        onEventCreated={onEventCreated}
      />

      {/* Modal de reagendamento */}
      {selectedAgendamento && (
        <ReagendarDialog
          isOpen={showReagendar}
          onClose={() => setShowReagendar(false)}
          agendamento={selectedAgendamento}
          horariosFuncionamento={horariosFuncionamento}
          agendamentos={agendamentos}
          clientes={clientes}
          onEventUpdated={() => {
            setShowReagendar(false);
            setSelectedAgendamento(null);
            onEventCreated?.();
          }}
        />
      )}

      {/* Modal de detalhes do agendamento - não mostrar quando ReagendarDialog está aberto */}
      {selectedAgendamento && !showReagendar && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
          onClick={() => setSelectedAgendamento(null)}
        >
          <div 
            className="bg-card border border-border rounded-2xl p-4 sm:p-6 max-w-sm w-full shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="font-display text-base sm:text-lg font-semibold text-foreground">Detalhes do Agendamento</h3>
              <button 
                onClick={() => setSelectedAgendamento(null)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-secondary/50 rounded-xl">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{selectedAgendamento.cliente_nome}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Cliente</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-secondary/50 rounded-xl">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <Scissors className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{selectedAgendamento.servico}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{calculateDuration(selectedAgendamento.hora_inicio, selectedAgendamento.hora_fim)} minutos</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-primary/10 rounded-xl border border-primary/30">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm sm:text-lg font-bold text-primary">
                    {selectedAgendamento.hora_inicio} → {selectedAgendamento.hora_fim}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {format(parseISO(selectedAgendamento.data), "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </p>
                </div>
              </div>
              
              <div className={cn(
                "text-center py-2 rounded-xl text-xs sm:text-sm font-semibold",
                selectedAgendamento.status === 'confirmado' 
                  ? "bg-success/20 text-success border border-success/30" 
                  : "bg-muted text-muted-foreground border border-border"
              )}>
                {selectedAgendamento.status === 'confirmado' ? '✓ Confirmado' : '? Pendente de confirmação'}
              </div>
              
              {/* Botões de contato */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 gap-2"
                  onClick={() => {
                    const cliente = findClienteByNome(selectedAgendamento.cliente_nome, clientes);
                    if (cliente?.telefone) {
                      const phone = cliente.telefone.replace(/\D/g, '');
                      window.open(`https://wa.me/55${phone}`, '_blank');
                    } else {
                      toast({
                        title: "Telefone não encontrado",
                        description: `Cliente "${selectedAgendamento.cliente_nome}" não encontrado ou sem telefone cadastrado.`,
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  <MessageCircle className="w-4 h-4 text-success" />
                  WhatsApp
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 gap-2"
                  onClick={() => {
                    const cliente = findClienteByNome(selectedAgendamento.cliente_nome, clientes);
                    if (cliente?.telefone) {
                      window.open(`tel:${cliente.telefone}`, '_self');
                    } else {
                      toast({
                        title: "Telefone não encontrado",
                        description: `Cliente "${selectedAgendamento.cliente_nome}" não encontrado ou sem telefone cadastrado.`,
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  <Phone className="w-4 h-4 text-primary" />
                  Ligar
                </Button>
              </div>

              {/* Botão Enviar lembrete via W-API */}
              <Button 
                variant="default" 
                className="w-full gap-2 bg-success hover:bg-success/90 text-success-foreground"
                onClick={async () => {
                  const cliente = findClienteByNome(selectedAgendamento.cliente_nome, clientes);
                  if (!cliente?.telefone) {
                    toast({
                      title: "Telefone não encontrado",
                      description: `Cliente "${selectedAgendamento.cliente_nome}" não encontrado ou sem telefone cadastrado.`,
                      variant: "destructive"
                    });
                    return;
                  }
                  
                  console.log(`[Enviar Lembrete] Cliente encontrado: ${cliente.nome}, Telefone: ${cliente.telefone}`);
                  setIsSendingReminder(true);
                  
                  try {
                    const dataFormatada = format(parseISO(selectedAgendamento.data), "EEEE, d 'de' MMMM", { locale: ptBR });
                    const message = `Olá ${selectedAgendamento.cliente_nome}! 👋\n\n📅 *Lembrete do seu agendamento:*\n\n✂️ Serviço: ${selectedAgendamento.servico}\n🗓️ Data: ${dataFormatada}\n⏰ Horário: ${selectedAgendamento.hora_inicio}\n\nTe esperamos! 💈`;
                    
                    const { data, error } = await supabase.functions.invoke('send-wapi-reminder', {
                      body: {
                        phone: cliente.telefone,
                        message,
                      },
                    });
                    
                    if (error) throw error;
                    if (data?.error) throw new Error(data.error);
                    
                    toast({
                      title: "Lembrete enviado!",
                      description: `Mensagem enviada para ${cliente.nome} (${cliente.telefone}) via WhatsApp.`,
                    });
                  } catch (err) {
                    console.error('Erro ao enviar lembrete:', err);
                    toast({
                      title: "Erro ao enviar lembrete",
                      description: err instanceof Error ? err.message : "Não foi possível enviar a mensagem.",
                      variant: "destructive"
                    });
                  } finally {
                    setIsSendingReminder(false);
                  }
                }}
                disabled={isSendingReminder}
              >
                {isSendingReminder ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar lembrete
                  </>
                )}
              </Button>

              {/* Botões de ação */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 gap-2"
                  onClick={() => setShowReagendar(true)}
                >
                  <RefreshCw className="w-4 h-4" />
                  Reagendar
                </Button>
              </div>
              
              {/* Botão de excluir com confirmação */}
              {!showDeleteConfirm ? (
                <Button 
                  variant="destructive" 
                  className="w-full gap-2"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </Button>
              ) : (
                <div className="space-y-3 p-3 bg-destructive/10 border border-destructive/30 rounded-xl">
                  <p className="text-sm text-destructive font-medium text-center">
                    O que deseja excluir?
                  </p>
                  
                  {/* Verificar se tem eventos da série */}
                  {(() => {
                    const seriesEvents = findSeriesEvents(selectedAgendamento);
                    const hasSeriesEvents = seriesEvents.length > 0;
                    
                    return (
                      <div className="space-y-2">
                        {/* Excluir só este */}
                        <Button 
                          variant="destructive" 
                          size="sm"
                          className="w-full gap-1.5"
                          onClick={() => handleDeleteAgendamento('single')}
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Excluindo...
                            </>
                          ) : (
                            'Somente este agendamento'
                          )}
                        </Button>
                        
                        {/* Excluir série (só mostra se tiver eventos futuros da série) */}
                        {hasSeriesEvents && (
                          <Button 
                            variant="destructive" 
                            size="sm"
                            className="w-full gap-1.5 bg-destructive/80"
                            onClick={() => handleDeleteAgendamento('series')}
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Excluindo...
                              </>
                            ) : (
                              `Este e mais ${seriesEvents.length} futuro(s)`
                            )}
                          </Button>
                        )}
                        
                        {/* Cancelar */}
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="w-full"
                          onClick={() => setShowDeleteConfirm(false)}
                          disabled={isDeleting}
                        >
                          Cancelar
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header Controls */}
      <div className="flex flex-col gap-2 sm:gap-3">
        {/* Search bar */}
        <div className="flex items-center gap-2">
          {showSearch ? (
            <div className="flex-1 flex items-center gap-2 animate-fade-in">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por cliente ou serviço..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8 h-9 text-sm"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 flex-shrink-0"
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-9 w-9"
                onClick={() => setShowSearch(true)}
              >
                <Search className="w-4 h-4" />
              </Button>
              <div className="flex-1" />
            </>
          )}
        </div>

        {/* Search results */}
        {searchQuery && searchResults.length > 0 && (
          <div className="bg-secondary/50 border border-border rounded-xl p-3 space-y-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">
                {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} encontrado{searchResults.length !== 1 ? 's' : ''}
              </p>
              <button 
                onClick={() => setSearchQuery('')}
                className="text-xs text-primary hover:underline"
              >
                Limpar busca
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {searchResults.slice(0, 10).map((ag) => (
                <div
                  key={ag.id}
                  onClick={() => {
                    setCurrentDate(parseISO(ag.data));
                    setViewMode('dia');
                    setSelectedAgendamento(ag);
                  }}
                  className="flex items-center justify-between p-2 bg-card rounded-lg border border-border/50 cursor-pointer hover:border-primary/50 transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{ag.cliente_nome}</p>
                    <p className="text-xs text-muted-foreground truncate">{ag.servico}</p>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <p className="text-xs font-medium text-primary">{ag.hora_inicio}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(parseISO(ag.data), "d 'de' MMM", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
              {searchResults.length > 10 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{searchResults.length - 10} mais resultados
                </p>
              )}
            </div>
          </div>
        )}
        
        {searchQuery && searchResults.length === 0 && (
          <div className="bg-secondary/30 border border-border/50 rounded-xl p-4 text-center animate-fade-in">
            <p className="text-sm text-muted-foreground">Nenhum agendamento encontrado para "{searchQuery}"</p>
          </div>
        )}

        {/* Top row: Navigation + Date + Add button */}
        <div className="flex items-center justify-between gap-1 sm:gap-2">
          <div className="flex items-center gap-0.5 sm:gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => navigateDate('prev')}>
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => setCurrentDate(new Date())}>
              <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => navigateDate('next')}>
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>

          <div className="text-center flex-1 min-w-0">
            <h2 className="font-display text-sm sm:text-lg font-bold text-foreground truncate">
              {viewMode === 'mes'
                ? format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })
                : viewMode === 'dia' 
                  ? format(currentDate, "d 'de' MMMM", { locale: ptBR })
                  : `${format(weekDays[0], 'd', { locale: ptBR })} - ${format(weekDays[6], "d 'de' MMM", { locale: ptBR })}`
              }
            </h2>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider">
              {viewMode === 'mes'
                ? 'Visão Mensal'
                : viewMode === 'dia' 
                  ? format(currentDate, 'EEEE', { locale: ptBR })
                  : format(currentDate, 'yyyy')
              }
            </p>
          </div>

          <Button 
            onClick={() => setShowNovoAgendamento(true)}
            size="sm" 
            className="gap-1 sm:gap-1.5 h-8 sm:h-9 px-2 sm:px-3"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline text-xs sm:text-sm">Agendar</span>
          </Button>
        </div>

        {/* View mode selector */}
        <div className="flex justify-center">
          <div className="flex bg-secondary rounded-xl p-0.5 sm:p-1 border border-border/50">
            <button
              onClick={() => setViewMode('dia')}
              className={cn(
                "px-3 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg transition-all",
                viewMode === 'dia' 
                  ? "bg-primary text-primary-foreground shadow-lg" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Dia
            </button>
            <button
              onClick={() => setViewMode('semana')}
              className={cn(
                "px-3 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg transition-all",
                viewMode === 'semana' 
                  ? "bg-primary text-primary-foreground shadow-lg" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Semana
            </button>
            <button
              onClick={() => setViewMode('mes')}
              className={cn(
                "px-3 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg transition-all",
                viewMode === 'mes' 
                  ? "bg-primary text-primary-foreground shadow-lg" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Mês
            </button>
          </div>
        </div>
      </div>

      {/* Current Time */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs sm:text-sm font-semibold text-foreground">Agora</span>
        </div>
        <span className="text-base sm:text-lg font-bold text-primary font-display">
          {format(currentTime, 'HH:mm')}
        </span>
      </div>

      {/* Funcionalidades extras */}
      <AgendaFeatures
        agendamentos={agendamentos}
        servicos={servicos}
        clientes={clientes}
        currentDate={currentDate}
        currentTime={currentTime}
        onDateChange={setCurrentDate}
        onAgendamentoSelect={setSelectedAgendamento}
      />

      {/* Calendar View */}
      <div className="card-premium p-3 sm:p-4">
        {viewMode === 'dia' && renderDayView()}
        {viewMode === 'semana' && renderWeekView()}
        {viewMode === 'mes' && renderMonthView()}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 sm:gap-4 text-[10px] sm:text-xs justify-center bg-secondary/30 rounded-xl p-2 sm:p-3 border border-border/50">
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-lg bg-primary/20 border-2 border-primary/50" />
          <span className="text-muted-foreground font-medium">Confirmado</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-lg bg-secondary border-2 border-border" />
          <span className="text-muted-foreground font-medium">Pendente</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-lg bg-destructive/20 border-2 border-destructive/30" />
          <span className="text-muted-foreground font-medium">Bloqueado</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-lg bg-accent/20 border-2 border-accent/30" />
          <span className="text-muted-foreground font-medium">Férias</span>
        </div>
      </div>
    </div>
  );
}
