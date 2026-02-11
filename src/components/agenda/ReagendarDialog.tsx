import { useState, useMemo } from 'react';
import { format, parseISO, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, X, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Agendamento, HorarioFuncionamento, Cliente } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { notifyRescheduledAppointment } from '@/lib/notificationService';

interface ReagendarDialogProps {
  isOpen: boolean;
  onClose: () => void;
  agendamento: Agendamento;
  horariosFuncionamento: HorarioFuncionamento[];
  agendamentos?: Agendamento[];
  clientes?: Cliente[];
  onEventUpdated?: () => void;
}

// Função para encontrar cliente pelo nome do agendamento (busca inteligente)
const findClienteByNome = (nomeAgendamento: string, clientes: Cliente[]): Cliente | undefined => {
  const nomeNormalizado = nomeAgendamento
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  
  let cliente = clientes.find(c => c.nome.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === nomeNormalizado);
  if (cliente) return cliente;
  
  const primeiroNome = nomeNormalizado.split(' ')[0];
  const matchesPrimeiroNome = clientes.filter(c => 
    c.nome.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ')[0] === primeiroNome
  );
  
  if (matchesPrimeiroNome.length === 1) {
    return matchesPrimeiroNome[0];
  }
  
  if (matchesPrimeiroNome.length > 1) {
    const matchExato = matchesPrimeiroNome.find(c => 
      c.nome.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').startsWith(nomeNormalizado)
    );
    if (matchExato) return matchExato;
  }
  
  const matchesContem = clientes.filter(c => {
    const cn = c.nome.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return cn.includes(nomeNormalizado) || nomeNormalizado.includes(cn);
  });
  
  if (matchesContem.length === 1) {
    return matchesContem[0];
  }
  
  return undefined;
};

export function ReagendarDialog({ 
  isOpen, 
  onClose, 
  agendamento,
  horariosFuncionamento,
  agendamentos = [],
  clientes = [],
  onEventUpdated
}: ReagendarDialogProps) {
  const [novaData, setNovaData] = useState(agendamento.data);
  const [novaHora, setNovaHora] = useState(agendamento.hora_inicio);
  const [isLoading, setIsLoading] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);

  // Encontra eventos da mesma série (mesmo cliente, serviço, horário, dia da semana)
  const findSeriesEvents = (): Agendamento[] => {
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
      if (a.id === agendamento.id) return false;

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
      
      const aDate = parseISO(a.data);
      if (getDay(aDate) !== dayOfWeek) return false;
      if (aDate <= agendamentoDate) return false;
      
      return true;
    });
  };

  const seriesEvents = useMemo(() => findSeriesEvents(), [agendamento, agendamentos]);
  const hasSeriesEvents = seriesEvents.length > 0;

  // Calcula duração do agendamento original
  const calcularDuracao = () => {
    const [startH, startM] = agendamento.hora_inicio.split(':').map(Number);
    const [endH, endM] = agendamento.hora_fim.split(':').map(Number);
    return (endH * 60 + endM) - (startH * 60 + startM);
  };

  const duracao = calcularDuracao();

  // Calcula nova hora de fim baseada na nova hora de início
  const calcularNovaHoraFim = () => {
    if (!novaHora) return novaHora;
    const [h, m] = novaHora.split(':').map(Number);
    const totalMinutos = h * 60 + m + duracao;
    const fimH = Math.floor(totalMinutos / 60);
    const fimM = totalMinutos % 60;
    return `${String(fimH).padStart(2, '0')}:${String(fimM).padStart(2, '0')}`;
  };

  // Obter horário de funcionamento do dia selecionado
  const selectedDate = new Date(novaData + 'T00:00:00');
  const diaSemana = selectedDate.getDay();
  const horarioDia = horariosFuncionamento.find(h => h.dia_semana === diaSemana);
  
  // Gerar horários disponíveis baseado no funcionamento
  const horarios = useMemo(() => {
    if (!horarioDia || horarioDia.fechado || !horarioDia.hora_inicio || !horarioDia.hora_fim) {
      return [];
    }
    
    const [inicioH, inicioM] = horarioDia.hora_inicio.split(':').map(Number);
    const [fimH, fimM] = horarioDia.hora_fim.split(':').map(Number);
    const inicioMinutos = inicioH * 60 + inicioM;
    const fimMinutos = fimH * 60 + fimM;
    
    const slots: string[] = [];
    for (let min = inicioMinutos; min < fimMinutos; min += 30) {
      const h = Math.floor(min / 60);
      const m = min % 60;
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
    return slots;
  }, [horarioDia]);

  const diaFechado = !horarioDia || horarioDia.fechado;

  if (!isOpen) return null;

  // Envia notificação de reagendamento via WhatsApp
  const sendRescheduleNotification = async (
    clienteNome: string, 
    servico: string, 
    dataAntiga: string, 
    horaAntiga: string,
    dataNova: string, 
    horaNova: string,
    mode: 'single' | 'series',
    count: number,
    eventId: string
  ) => {
    try {
      const cliente = findClienteByNome(clienteNome, clientes);
      const phone = cliente?.telefone;

      console.log('[Reagendar] Dados para notificação:', { clienteNome, phone, eventId, clienteEncontrado: !!cliente });

      // Permite enviar mesmo sem telefone, pois a edge function pode resolver via eventId
      const dataAntigaFormatada = format(parseISO(dataAntiga), "EEEE, d 'de' MMMM", { locale: ptBR });
      const dataNovaFormatada = format(parseISO(dataNova), "EEEE, d 'de' MMMM", { locale: ptBR });
      
      const message = mode === 'series'
        ? `Olá ${clienteNome}! 👋\n\n📅 *Seu horário fixo foi reagendado:*\n\n❌ De: ${dataAntigaFormatada} às ${horaAntiga}\n✅ Para: ${dataNovaFormatada} às ${horaNova}\n\n✂️ Serviço: ${servico}\n🔢 Total: ${count} agendamento(s) a partir desta data\n\nTe esperamos no novo horário! 💈`
        : `Olá ${clienteNome}! 👋\n\n📅 *Seu horário foi reagendado:*\n\n❌ De: ${dataAntigaFormatada} às ${horaAntiga}\n✅ Para: ${dataNovaFormatada} às ${horaNova}\n\n✂️ Serviço: ${servico}\n\nTe esperamos no novo horário! 💈`;

      console.log('[Reagendar] Enviando para edge function...', { phone: phone || 'via eventId', eventId });

      const { data: wapiData, error: wapiError } = await supabase.functions.invoke('send-wapi-reminder', {
        body: { phone: phone || undefined, message, eventId },
      });

      console.log('[Reagendar] Resposta da edge function:', { wapiData, wapiError });

      if (wapiError) throw wapiError;
      if ((wapiData as any)?.error) throw new Error((wapiData as any)?.error);
      
      console.log('[Reagendar] Notificação de reagendamento enviada com sucesso');
      return true;
    } catch (err) {
      console.error('[Reagendar] Erro ao enviar notificação WhatsApp:', err);
      return false;
    }
  };

  const handleReagendar = async (mode: 'single' | 'series' = 'single') => {
    if (!novaData || !novaHora) return;
    
    setIsLoading(true);
    setShowModeSelector(false);
    
    try {
      const eventsToReschedule: Agendamento[] = [agendamento];
      
      if (mode === 'series') {
        eventsToReschedule.push(...seriesEvents);
      }

      let successCount = 0;
      let errorCount = 0;

      for (const evento of eventsToReschedule) {
        
        try {
          // Para o evento clicado: usa a data/hora escolhida.
          // Para os demais da série: mantém o offset original (em dias) em relação ao evento base.
          let eventoNovaData: string;
          let eventoNovaHora: string;

          if (evento.id === agendamento.id) {
            eventoNovaData = novaData;
            eventoNovaHora = novaHora;
          } else {
            const eventoOriginalDate = parseISO(evento.data);
            const baseOriginalDate = parseISO(agendamento.data);
            const diffDays = Math.round(
              (eventoOriginalDate.getTime() - baseOriginalDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            const novaBaseDateObj = parseISO(novaData);
            novaBaseDateObj.setDate(novaBaseDateObj.getDate() + diffDays);
            eventoNovaData = format(novaBaseDateObj, 'yyyy-MM-dd');

            // Reagendar a HORA da série também
            eventoNovaHora = novaHora;
          }

          // Hora fim baseada na duração original
          const [startH, startM] = eventoNovaHora.split(':').map(Number);
          const totalMinutos = startH * 60 + startM + duracao;
          const fimH = Math.floor(totalMinutos / 60);
          const fimM = totalMinutos % 60;
          const eventoNovaHoraFim = `${String(fimH).padStart(2, '0')}:${String(fimM).padStart(2, '0')}`;

          const startDateTime = `${eventoNovaData}T${eventoNovaHora}:00-03:00`;
          const endDateTime = `${eventoNovaData}T${eventoNovaHoraFim}:00-03:00`;
          
          // Deletar evento antigo
          const { error: deleteError } = await supabase.functions.invoke('google-calendar-delete', {
            body: { eventId: evento.id },
          });
          
          if (deleteError) {
            throw new Error(deleteError.message || "Não foi possível remover o agendamento antigo.");
          }
          
          // Criar novo evento
          const eventoTitulo = `${evento.servico} - ${evento.cliente_nome}`;
          
          const { data: responseData, error: createError } = await supabase.functions.invoke('google-calendar-create', {
            body: {
              summary: eventoTitulo,
              description: '',
              startDateTime,
              endDateTime,
            },
          });

          if (createError) {
            throw new Error(createError.message || "Não foi possível criar o novo agendamento.");
          }

          if (responseData?.error) {
            throw new Error(responseData.error);
          }

          // Atualizar lembrete WhatsApp
          const newEventId = (responseData as any)?.data?.id ?? (responseData as any)?.id;
           if (newEventId) {
            try {
               const clienteDoEvento = findClienteByNome(evento.cliente_nome, clientes);
               const telefone = clienteDoEvento?.telefone;

              if (telefone) {
                await supabase.functions.invoke('schedule-reminder', {
                  body: {
                    eventId: newEventId,
                    previousEventId: evento.id,
                    clientPhone: telefone,
                    clientName: evento.cliente_nome,
                    serviceName: evento.servico,
                    appointmentTime: startDateTime,
                  },
                });
              }
            } catch (reminderError) {
              console.warn('[Reagendar] Erro ao agendar lembrete:', reminderError);
            }
          }

          successCount++;
        } catch (err) {
          console.error(`Erro ao reagendar evento ${evento.id}:`, err);
          errorCount++;
        }
      }

      // Enviar notificação WhatsApp (só uma vez para o cliente)
       const whatsappSent = await sendRescheduleNotification(
        agendamento.cliente_nome,
        agendamento.servico,
        agendamento.data,
        agendamento.hora_inicio,
        novaData,
         novaHora,
         mode,
         successCount,
         agendamento.id
      );

      // Notificação in-app
      notifyRescheduledAppointment(agendamento.cliente_nome, agendamento.servico, novaData, novaHora);

      if (mode === 'series') {
        toast({
          title: "Série reagendada!",
           description: `${successCount} agendamento(s) atualizado(s)${errorCount > 0 ? `, ${errorCount} erro(s)` : ''}.${whatsappSent ? ' WhatsApp enviado ao cliente.' : ' WhatsApp não foi enviado.'}`,
        });
      } else {
        toast({
          title: "Agendamento reagendado!",
           description: `${agendamento.cliente_nome} - ${format(selectedDate, "d 'de' MMMM", { locale: ptBR })} às ${novaHora}${whatsappSent ? ' (WhatsApp enviado)' : ' (WhatsApp não enviado)'}`,
        });
      }
      
      onEventUpdated?.();
      onClose();
      
    } catch (err: unknown) {
      console.error('Error:', err);
      toast({
        title: "Erro ao reagendar",
        description: err instanceof Error ? err.message : "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const dataAlterada = novaData !== agendamento.data;
  const horaAlterada = novaHora !== agendamento.hora_inicio;
  const temAlteracao = dataAlterada || horaAlterada;

  const handleConfirm = () => {
    if (hasSeriesEvents && !showModeSelector) {
      setShowModeSelector(true);
    } else {
      handleReagendar('single');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      onClick={onClose}
    >
      <div 
        className="fixed bottom-20 left-0 right-0 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 bg-card border sm:border border-border rounded-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl flex flex-col max-h-[70vh] mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fixo */}
        <div className="flex items-center justify-between p-4 pb-3 border-b border-border shrink-0">
          <h3 className="font-display text-lg font-semibold text-foreground">Reagendar</h3>
          <button 
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {/* Info do agendamento atual */}
          <div className="p-3 bg-secondary/50 rounded-xl border border-border/50 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Agendamento atual</p>
            <p className="text-sm font-semibold text-foreground">{agendamento.cliente_nome}</p>
            <p className="text-xs text-muted-foreground">{agendamento.servico} • {duracao} minutos</p>
            <div className="flex items-center gap-2 text-xs">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>{format(new Date(agendamento.data + 'T00:00:00'), "d 'de' MMMM", { locale: ptBR })}</span>
              <Clock className="w-3.5 h-3.5 text-primary ml-2" />
              <span>{agendamento.hora_inicio} - {agendamento.hora_fim}</span>
            </div>
          </div>

          {/* Nova data */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="w-4 h-4 text-primary" />
              Nova Data
            </Label>
            <Input
              type="date"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
              className="h-10 text-sm"
              disabled={isLoading}
            />
          </div>
          
          {diaFechado ? (
            <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/30 text-center">
              <p className="text-sm font-medium text-destructive">Barbearia fechada neste dia</p>
              <p className="text-xs text-muted-foreground mt-1">Selecione outro dia</p>
            </div>
          ) : (
            <>
              {/* Novo Horário */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="w-4 h-4 text-primary" />
                  Novo Horário
                </Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="time"
                      value={novaHora}
                      onChange={(e) => setNovaHora(e.target.value)}
                      placeholder="00:00"
                      className="h-10 text-sm"
                      disabled={isLoading}
                      list="horarios-reagendar"
                    />
                    <datalist id="horarios-reagendar">
                      {horarios.map(hora => (
                        <option key={hora} value={hora} />
                      ))}
                    </datalist>
                  </div>
                  
                  {novaHora && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-shrink-0">
                      <span>→</span>
                      <span className="font-semibold text-foreground">{calcularNovaHoraFim()}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Resumo das alterações */}
              {temAlteracao && (
                <div className="p-3 bg-primary/10 rounded-xl border border-primary/30 space-y-2">
                  <p className="text-xs text-primary uppercase tracking-wide font-medium">Alterações</p>
                  {dataAlterada && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Data:</span>
                      <span className="font-medium text-foreground">
                        {format(new Date(agendamento.data + 'T00:00:00'), "d/MM", { locale: ptBR })} → {format(selectedDate, "d/MM", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                  {horaAlterada && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Horário:</span>
                      <span className="font-medium text-foreground">
                        {agendamento.hora_inicio} → {novaHora}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footer fixo com botões */}
        <div className="flex flex-col gap-2 p-4 pt-3 border-t border-border bg-card shrink-0 pb-safe">
          {showModeSelector ? (
            <div className="space-y-2">
              <p className="text-sm text-foreground font-medium text-center mb-3">
                O que deseja reagendar?
              </p>
              <Button 
                onClick={() => handleReagendar('single')} 
                className="w-full gap-2 h-11 text-sm"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Reagendando...
                  </>
                ) : (
                  'Somente este agendamento'
                )}
              </Button>
              <Button 
                onClick={() => handleReagendar('series')} 
                variant="secondary"
                className="w-full gap-2 h-11 text-sm"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Reagendando...
                  </>
                ) : (
                  `Este e mais ${seriesEvents.length} futuro(s)`
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowModeSelector(false)} 
                className="w-full h-11 text-sm" 
                disabled={isLoading}
              >
                Voltar
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={onClose} 
                className="flex-1 h-11 text-sm" 
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirm} 
                className="flex-1 gap-2 h-11 text-sm"
                disabled={!novaData || !novaHora || diaFechado || isLoading || !temAlteracao}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Reagendando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Reagendar
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
