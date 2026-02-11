import { useState, useMemo } from 'react';
import { format, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, User, Scissors, Check, X, Loader2, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Cliente, Servico, HorarioFuncionamento } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { notifyNewAppointment } from '@/lib/notificationService';

interface NovoAgendamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  clientes: Cliente[];
  servicos: Servico[];
  horariosFuncionamento: HorarioFuncionamento[];
  ferias?: { data: string }[];
  onEventCreated?: () => void;
}

export function NovoAgendamentoDialog({ 
  open, 
  onOpenChange, 
  selectedDate, 
  clientes, 
  servicos,
  horariosFuncionamento,
  onEventCreated
}: NovoAgendamentoDialogProps) {
  const onClose = () => onOpenChange(false);
  const [clienteId, setClienteId] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [modoCliente, setModoCliente] = useState<'existente' | 'novo'>('existente');
  const [servicoId, setServicoId] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [horarioFixo, setHorarioFixo] = useState(false);
  const [quantidadeSemanas, setQuantidadeSemanas] = useState('4');

  const selectedServico = servicos.find(s => s.id === servicoId);
  const selectedCliente = clientes.find(c => c.id === clienteId);
  
  // Obter horário de funcionamento do dia selecionado
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

  if (!open) return null;

  const calcularHoraFim = () => {
    if (!selectedServico || !horaInicio) return horaInicio;
    const [h, m] = horaInicio.split(':').map(Number);
    const totalMinutos = h * 60 + m + selectedServico.duracao;
    const fimH = Math.floor(totalMinutos / 60);
    const fimM = totalMinutos % 60;
    return `${String(fimH).padStart(2, '0')}:${String(fimM).padStart(2, '0')}`;
  };

  const criarEvento = async (data: Date, nomeCliente: string, nomeServico: string, preco: number | undefined, clienteTelefone?: string) => {
    const eventoTitulo = `${nomeServico} - ${nomeCliente}`;
    const dataStr = format(data, 'yyyy-MM-dd');
    const horaFim = calcularHoraFim();
    
    // Adiciona offset de Brasília (-03:00) para garantir timezone correto
    const startDateTime = `${dataStr}T${horaInicio}:00-03:00`;
    const endDateTime = `${dataStr}T${horaFim}:00-03:00`;
    
    const description = preco ? `Valor: R$ ${preco.toFixed(2)}` : '';
    
    const { data: responseData, error } = await supabase.functions.invoke('google-calendar-create', {
      body: {
        summary: eventoTitulo,
        description,
        startDateTime,
        endDateTime,
      },
    });
    
    if (error) {
      throw new Error(error.message || "Não foi possível criar o agendamento.");
    }
    
    if (responseData?.error) {
      throw new Error(responseData.error);
    }
    
    // Agendar lembrete WhatsApp se tiver telefone do cliente
    // OBS: a função google-calendar-create retorna { data: createdEvent, error: null }
    // então o id do evento fica em responseData.data.id (não em responseData.id)
    const eventId = (responseData as any)?.id ?? (responseData as any)?.data?.id;

    if (clienteTelefone && eventId) {
      try {
        await supabase.functions.invoke('schedule-reminder', {
          body: {
            eventId,
            clientPhone: clienteTelefone,
            clientName: nomeCliente,
            serviceName: nomeServico,
            appointmentTime: startDateTime,
          },
        });
        console.log('[NovoAgendamento] Lembrete agendado para', nomeCliente);
      } catch (reminderError) {
        console.warn('[NovoAgendamento] Erro ao agendar lembrete:', reminderError);
        // Não interrompe o fluxo se falhar o lembrete
      }
      
      // Enviar confirmação imediata via W-API
      try {
        const dataFormatada = format(data, "EEEE, d 'de' MMMM", { locale: ptBR });
        const confirmationMessage = `Olá ${nomeCliente}! 👋\n\n✅ *Seu agendamento foi confirmado!*\n\n✂️ Serviço: ${nomeServico}\n🗓️ Data: ${dataFormatada}\n⏰ Horário: ${horaInicio}\n\nTe esperamos! 💈`;
        
        await supabase.functions.invoke('send-wapi-reminder', {
          body: {
            phone: clienteTelefone,
            message: confirmationMessage,
          },
        });
        console.log('[NovoAgendamento] Confirmação enviada via W-API para', nomeCliente);
      } catch (wapiError) {
        console.warn('[NovoAgendamento] Erro ao enviar confirmação W-API:', wapiError);
        // Não interrompe o fluxo se falhar o envio
      }
    }
    
    return responseData;
  };

  // Cria evento SEM enviar confirmação (usado para eventos recorrentes após o primeiro)
  const criarEventoSemConfirmacao = async (data: Date, nomeCliente: string, nomeServico: string, preco: number | undefined, clienteTelefone?: string) => {
    const eventoTitulo = `${nomeServico} - ${nomeCliente}`;
    const dataStr = format(data, 'yyyy-MM-dd');
    const horaFim = calcularHoraFim();
    
    const startDateTime = `${dataStr}T${horaInicio}:00-03:00`;
    const endDateTime = `${dataStr}T${horaFim}:00-03:00`;
    
    const description = preco ? `Valor: R$ ${preco.toFixed(2)}` : '';
    
    const { data: responseData, error } = await supabase.functions.invoke('google-calendar-create', {
      body: {
        summary: eventoTitulo,
        description,
        startDateTime,
        endDateTime,
      },
    });
    
    if (error) {
      throw new Error(error.message || "Não foi possível criar o agendamento.");
    }
    
    if (responseData?.error) {
      throw new Error(responseData.error);
    }
    
    // Agendar lembrete WhatsApp (sem enviar confirmação)
    const eventId = (responseData as any)?.id ?? (responseData as any)?.data?.id;
    if (clienteTelefone && eventId) {
      try {
        await supabase.functions.invoke('schedule-reminder', {
          body: {
            eventId,
            clientPhone: clienteTelefone,
            clientName: nomeCliente,
            serviceName: nomeServico,
            appointmentTime: startDateTime,
          },
        });
      } catch (reminderError) {
        console.warn('[NovoAgendamento] Erro ao agendar lembrete:', reminderError);
      }
    }
    
    return responseData;
  };

  const handleAgendar = async () => {
    if (!selectedServico || !horaInicio) return;
    
    setIsLoading(true);
    
    try {
      const nomeCliente = modoCliente === 'existente' 
        ? (selectedCliente?.nome || 'Cliente')
        : (clienteNome.trim() || 'Cliente');
      const telefoneCliente = modoCliente === 'existente' 
        ? selectedCliente?.telefone 
        : undefined;
      const nomeServico = selectedServico.nome;
      
      if (horarioFixo) {
        const semanas = parseInt(quantidadeSemanas);
        let criados = 0;
        let erros = 0;
        
        // Criar primeiro evento COM confirmação
        try {
          await criarEvento(selectedDate, nomeCliente, nomeServico, selectedServico.preco, telefoneCliente);
          criados++;
        } catch (err) {
          console.error(`Erro ao criar evento para semana 1:`, err);
          erros++;
        }
        
        // Criar demais eventos SEM confirmação (para não spammar o cliente)
        for (let i = 1; i < semanas; i++) {
          const dataEvento = addWeeks(selectedDate, i);
          try {
            await criarEventoSemConfirmacao(dataEvento, nomeCliente, nomeServico, selectedServico.preco, telefoneCliente);
            criados++;
          } catch (err) {
            console.error(`Erro ao criar evento para semana ${i + 1}:`, err);
            erros++;
          }
        }
        
        // Enviar uma única mensagem consolidada sobre horário fixo
        if (criados > 0 && telefoneCliente) {
          try {
            const primeiraData = format(selectedDate, "d 'de' MMMM", { locale: ptBR });
            const ultimaData = format(addWeeks(selectedDate, semanas - 1), "d 'de' MMMM", { locale: ptBR });
            const diaSemana = format(selectedDate, "EEEE", { locale: ptBR });
            
            const confirmationMessage = `Olá ${nomeCliente}! 👋\n\n✅ *Horário fixo semanal confirmado!*\n\n✂️ Serviço: ${nomeServico}\n🗓️ Dia: Toda ${diaSemana}\n⏰ Horário: ${horaInicio}\n📅 Período: ${primeiraData} até ${ultimaData}\n🔢 Total: ${criados} semana(s)\n\nTe esperamos! 💈`;
            
            await supabase.functions.invoke('send-wapi-reminder', {
              body: {
                phone: telefoneCliente,
                message: confirmationMessage,
              },
            });
            console.log('[NovoAgendamento] Confirmação de horário fixo enviada via W-API');
          } catch (wapiError) {
            console.warn('[NovoAgendamento] Erro ao enviar confirmação W-API:', wapiError);
          }
        }
        
        if (criados > 0) {
          toast({
            title: "Agendamentos criados!",
            description: `${criados} agendamento(s) criado(s)${erros > 0 ? `, ${erros} erro(s)` : ''} para ${nomeCliente}`,
          });
        } else {
          toast({
            title: "Erro ao agendar",
            description: "Não foi possível criar os agendamentos.",
            variant: "destructive",
          });
        }
      } else {
        await criarEvento(selectedDate, nomeCliente, nomeServico, selectedServico.preco, telefoneCliente);
        
        // Send notification for new appointment
        const dataStr = format(selectedDate, 'yyyy-MM-dd');
        notifyNewAppointment(nomeCliente, nomeServico, dataStr, horaInicio);
        
        toast({
          title: "Agendamento criado!",
          description: `${nomeServico} para ${nomeCliente} às ${horaInicio}`,
        });
      }
      
      // Reset form
      setClienteId('');
      setClienteNome('');
      setServicoId('');
      setHoraInicio('');
      setHorarioFixo(false);
      setQuantidadeSemanas('4');
      
      onEventCreated?.();
      onClose();
      
    } catch (err: unknown) {
      console.error('Error:', err);
      toast({
        title: "Erro ao agendar",
        description: err instanceof Error ? err.message : "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
          <h3 className="font-display text-lg font-semibold text-foreground">Novo Agendamento</h3>
          <button 
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {/* Data selecionada */}
          <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-xl border border-primary/30">
            <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
              <p className="text-xs text-muted-foreground">Data do agendamento</p>
            </div>
          </div>
          
          {diaFechado ? (
            <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/30 text-center">
              <p className="text-sm font-medium text-destructive">Barbearia fechada neste dia</p>
              <p className="text-xs text-muted-foreground mt-1">Selecione outro dia para agendar</p>
            </div>
          ) : (
            <>
              {/* Modo de seleção de cliente */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <User className="w-4 h-4 text-primary" />
                  Cliente
                </Label>
                
                <div className="flex gap-2">
                  <Button 
                    type="button"
                    variant={modoCliente === 'existente' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setModoCliente('existente')}
                    disabled={isLoading}
                    className="flex-1 text-xs h-9"
                  >
                    Existente
                  </Button>
                  <Button 
                    type="button"
                    variant={modoCliente === 'novo' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setModoCliente('novo')}
                    disabled={isLoading}
                    className="flex-1 text-xs h-9"
                  >
                    Novo
                  </Button>
                </div>
                
                {modoCliente === 'existente' ? (
                  <Select value={clienteId} onValueChange={setClienteId} disabled={isLoading}>
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue placeholder="Selecione o cliente..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {clientes.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={clienteNome}
                    onChange={(e) => setClienteNome(e.target.value)}
                    placeholder="Digite o nome do cliente..."
                    className="h-10 text-sm"
                    disabled={isLoading}
                  />
                )}
              </div>
              
              {/* Serviço */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Scissors className="w-4 h-4 text-primary" />
                  Serviço
                </Label>
                <Select value={servicoId} onValueChange={setServicoId} disabled={isLoading}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Selecione o serviço..." />
                  </SelectTrigger>
                  <SelectContent>
                    {servicos.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="truncate">{s.nome}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {s.duracao}min • R$ {s.preco.toFixed(2)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Horário */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="w-4 h-4 text-primary" />
                  Horário
                </Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="time"
                      value={horaInicio}
                      onChange={(e) => setHoraInicio(e.target.value)}
                      placeholder="00:00"
                      className="h-10 text-sm"
                      disabled={isLoading}
                      list="horarios-sugeridos"
                    />
                    <datalist id="horarios-sugeridos">
                      {horarios.map(hora => (
                        <option key={hora} value={hora} />
                      ))}
                    </datalist>
                  </div>
                  
                  {selectedServico && horaInicio && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-shrink-0">
                      <span>→</span>
                      <span className="font-semibold text-foreground">{calcularHoraFim()}</span>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">Digite ou selecione um horário</p>
              </div>
              
              {/* Horário Fixo Semanal */}
              <div className="p-3 bg-secondary/30 rounded-xl border border-border/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-primary" />
                    <Label className="text-xs font-medium">Horário fixo semanal</Label>
                  </div>
                  <Switch
                    checked={horarioFixo}
                    onCheckedChange={setHorarioFixo}
                    disabled={isLoading}
                  />
                </div>
                
                {horarioFixo && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Quantidade de semanas</Label>
                    <Select value={quantidadeSemanas} onValueChange={setQuantidadeSemanas} disabled={isLoading}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 semanas</SelectItem>
                        <SelectItem value="4">4 semanas (1 mês)</SelectItem>
                        <SelectItem value="8">8 semanas (2 meses)</SelectItem>
                        <SelectItem value="12">12 semanas (3 meses)</SelectItem>
                        <SelectItem value="24">24 semanas (6 meses)</SelectItem>
                        <SelectItem value="52">52 semanas (1 ano)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      Será criado um agendamento para cada semana no mesmo dia e horário
                    </p>
                  </div>
                )}
              </div>
              
              {/* Resumo */}
              {selectedServico && (
                <div className="p-3 bg-secondary/50 rounded-xl border border-border/50 space-y-2">
                  <p className="text-sm font-semibold text-foreground">Resumo</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Serviço:</span>
                    <span className="font-medium truncate max-w-[150px]">{selectedServico.nome}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Duração:</span>
                    <span className="font-medium">{selectedServico.duracao} minutos</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-bold text-primary">R$ {selectedServico.preco.toFixed(2)}</span>
                  </div>
                  {horarioFixo && (
                    <div className="flex justify-between text-xs pt-2 border-t border-border/50">
                      <span className="text-muted-foreground">Agendamentos:</span>
                      <span className="font-medium">{quantidadeSemanas}x semanais</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footer fixo com botões - sempre visível */}
        <div className="flex gap-3 p-4 pt-3 border-t border-border bg-card shrink-0 pb-safe">
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="flex-1 h-11 text-sm" 
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleAgendar} 
            className="flex-1 gap-2 h-11 text-sm"
            disabled={!selectedServico || !horaInicio || diaFechado || isLoading || (modoCliente === 'existente' && !clienteId)}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Agendando...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Agendar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}