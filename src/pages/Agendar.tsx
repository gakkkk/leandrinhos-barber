import { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, Scissors, User, Check, Clock, ArrowLeft } from 'lucide-react';
import { format, addDays, addMinutes, isSameDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { cn } from '@/lib/utils';
import { fetchGoogleCalendarEvents, convertToAgendamento } from '@/lib/googleCalendar';
import { InstallPrompt, useInstallPrompt } from '@/components/pwa/InstallPrompt';
import { Download, Lock, CheckCircle2 } from 'lucide-react';
import { notifyNewAppointment } from '@/lib/notificationService';

interface Servico {
  id: string;
  nome: string;
  preco: number;
  duracao_minutos: number;
}

interface HorarioFuncionamento {
  dia_semana: number;
  hora_inicio: string | null;
  hora_fim: string | null;
  fechado: boolean;
}

interface AgendamentoOcupado {
  data: string;
  horario: string;
  duracao: number;
}

type Step = 'servico' | 'data' | 'horario' | 'dados' | 'sucesso';

export default function Agendar() {
  const [step, setStep] = useState<Step>('servico');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [horariosFuncionamento, setHorariosFuncionamento] = useState<HorarioFuncionamento[]>([]);
  const [agendamentosOcupados, setAgendamentosOcupados] = useState<AgendamentoOcupado[]>([]);
  const [configAtivo, setConfigAtivo] = useState(false);
  const [config, setConfig] = useState<{ intervalo_minutos: number; antecedencia_maxima_dias: number } | null>(null);

  const [selectedServico, setSelectedServico] = useState<Servico | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedHorario, setSelectedHorario] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nome: '', telefone: '' });

  const { canInstall, install } = useInstallPrompt();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  const handleInstallClick = async () => {
    if (canInstall) {
      const installed = await install();
      if (installed) {
        toast({
          title: "App instalado!",
          description: "O app foi adicionado à sua tela inicial.",
        });
      }
    } else {
      setShowInstallPrompt(true);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadAgendamentosDoDia(selectedDate);
    }
  }, [selectedDate]);

  const loadInitialData = async () => {
    setIsLoading(true);

    try {
      // Verificar configuração de agendamento online
      const { data: configData } = await supabase
        .from('agendamento_online_config')
        .select('ativo, intervalo_minutos, antecedencia_maxima_dias')
        .limit(1)
        .single();

      if (!configData?.ativo) {
        setConfigAtivo(false);
        setIsLoading(false);
        return;
      }

      setConfigAtivo(true);
      setConfig({
        intervalo_minutos: configData.intervalo_minutos || 30,
        antecedencia_maxima_dias: configData.antecedencia_maxima_dias || 30
      });

      // Buscar serviços via proxy (banco externo)
      const servicosResponse = await fetch(`https://wtkxyofvbillvclkcvir.supabase.co/functions/v1/supabase-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'servicos', method: 'GET' }),
      });
      const servicosResult = await servicosResponse.json();
      setServicos(servicosResult.data || []);

      // Buscar horários de funcionamento via proxy (banco externo)
      const horariosResponse = await fetch(`https://wtkxyofvbillvclkcvir.supabase.co/functions/v1/supabase-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'horarios_funcionamento', method: 'GET' }),
      });
      const horariosResult = await horariosResponse.json();
      setHorariosFuncionamento(horariosResult.data || []);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }

    setIsLoading(false);
  };

  const loadAgendamentosDoDia = async (date: Date) => {
    const dataStr = format(date, 'yyyy-MM-dd');

    // Definir intervalo do dia inteiro para a busca
    const startOfDayDate = startOfDay(date);
    const endOfDayDate = new Date(startOfDayDate);
    endOfDayDate.setHours(23, 59, 59, 999);

    const timeMin = startOfDayDate.toISOString();
    const timeMax = endOfDayDate.toISOString();

    try {
      // Buscar agendamentos confirmados do Google Calendar usando a lib padrão
      const { data: gcalEvents, error: gcalError } = await fetchGoogleCalendarEvents(timeMin, timeMax);

      if (gcalError) {
        console.error('Erro ao buscar do Google Calendar:', gcalError);
      }

      // Buscar agendamentos pendentes (que ainda não foram rejeitados)
      const { data: pendentes } = await supabase
        .from('agendamentos_pendentes')
        .select('data, horario, servico')
        .eq('data', dataStr)
        .neq('status', 'recusado');

      const ocupados: AgendamentoOcupado[] = [];

      // Processar eventos do Google Calendar
      if (gcalEvents && Array.isArray(gcalEvents)) {
        gcalEvents.forEach((event) => {
          const agendamento = convertToAgendamento(event);

          // Calcular duração em minutos
          const [hInicio, mInicio] = agendamento.hora_inicio.split(':').map(Number);
          const [hFim, mFim] = agendamento.hora_fim.split(':').map(Number);

          const inicioMin = hInicio * 60 + mInicio;
          const fimMin = hFim * 60 + mFim;
          const duracao = fimMin - inicioMin;

          if (duracao > 0) {
            ocupados.push({
              data: agendamento.data,
              horario: agendamento.hora_inicio,
              duracao: duracao,
            });
          }
        });
      }

      // Processar agendamentos pendentes
      if (pendentes) {
        pendentes.forEach((p) => {
          // Tentar encontrar a duração do serviço
          const servicoInfo = servicos.find(s => s.nome === p.servico);
          const duracao = servicoInfo?.duracao_minutos || 30;

          ocupados.push({
            data: p.data,
            horario: p.horario,
            duracao: duracao,
          });
        });
      }

      setAgendamentosOcupados(ocupados);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
      setAgendamentosOcupados([]);
    }
  };

  // Calcular slots disponíveis baseado na duração do serviço selecionado
  const slotsDisponiveis = useMemo(() => {
    if (!selectedDate || !selectedServico) return []; // Removida dependência de config para intervalo

    const diaSemana = selectedDate.getDay();
    const horarioDia = horariosFuncionamento.find(h => h.dia_semana === diaSemana);

    if (!horarioDia || horarioDia.fechado || !horarioDia.hora_inicio || !horarioDia.hora_fim) {
      return [];
    }

    const [horaInicio, minInicio] = horarioDia.hora_inicio.split(':').map(Number);
    const [horaFim, minFim] = horarioDia.hora_fim.split(':').map(Number);

    const dataBase = startOfDay(selectedDate);
    const inicioExpediente = new Date(dataBase);
    inicioExpediente.setHours(horaInicio, minInicio, 0, 0);

    const fimExpediente = new Date(dataBase);
    fimExpediente.setHours(horaFim, minFim, 0, 0);

    const duracaoServico = selectedServico.duracao_minutos;
    // Intervalo de verificação fixo em 10 minutos para alta precisão
    const intervaloVerificacao = 10;

    const slots: { horario: string; disponivel: boolean }[] = [];
    let slotAtual = new Date(inicioExpediente);

    while (slotAtual < fimExpediente) {
      const horarioStr = format(slotAtual, 'HH:mm');
      const fimNovoServico = addMinutes(slotAtual, duracaoServico);

      // Verificar se o serviço cabe no expediente
      if (fimNovoServico > fimExpediente) {
        // Se não cabe mais no dia, paramos de gerar slots
        break;
      }

      // Verificar conflitos com agendamentos existentes
      let temConflito = false;

      for (const ocupado of agendamentosOcupados) {
        const [horaOcupada, minOcupada] = ocupado.horario.split(':').map(Number);
        const inicioOcupado = new Date(dataBase);
        inicioOcupado.setHours(horaOcupada, minOcupada, 0, 0);
        const fimOcupado = addMinutes(inicioOcupado, ocupado.duracao);

        const novoInicio = slotAtual;
        const novoFim = fimNovoServico;

        // Regra de colisão estrita:
        // (NovoInicio < FimOcupado) && (NovoFim > InicioOcupado)
        // Isso cobre todos os casos: inicio dentro, fim dentro, engloba, englobado.
        const sobrepoe = (novoInicio < fimOcupado && novoFim > inicioOcupado);

        if (sobrepoe) {
          temConflito = true;
          break;
        }
      }

      if (!temConflito) {
        slots.push({
          horario: horarioStr,
          disponivel: true,
        });
      }

      slotAtual = addMinutes(slotAtual, intervaloVerificacao);
    }

    return slots;
  }, [selectedDate, selectedServico, horariosFuncionamento, agendamentosOcupados]);

  // Verificar quais dias estão disponíveis para o calendário
  const isDayDisabled = (date: Date) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Não pode agendar no passado
    if (date < hoje) return true;

    // Não pode agendar hoje (precisa de antecedência mínima)
    if (isSameDay(date, hoje)) return true;

    // Verificar limite máximo de dias
    const maxDate = addDays(hoje, config?.antecedencia_maxima_dias || 30);
    if (date > maxDate) return true;

    // Verificar se está fechado nesse dia da semana
    const diaSemana = date.getDay();
    const horarioDia = horariosFuncionamento.find(h => h.dia_semana === diaSemana);

    if (!horarioDia || horarioDia.fechado) return true;

    return false;
  };

  const handleSubmit = async () => {
    if (!formData.nome || !formData.telefone || !selectedServico || !selectedDate || !selectedHorario) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    try {
      // Preparar dados para o Google Calendar
      const dataStr = format(selectedDate, 'yyyy-MM-dd');

      // Calcular horário de fim
      const [hora, min] = selectedHorario.split(':').map(Number);
      const dataInicioObj = new Date(selectedDate);
      dataInicioObj.setHours(hora, min, 0, 0);
      const dataFimObj = addMinutes(dataInicioObj, selectedServico.duracao_minutos);
      const horarioFim = format(dataFimObj, 'HH:mm');

      // Formatar datas ISO com offset fixo de Brasília (-03:00) para evitar problemas de timezone
      const startDateTime = `${dataStr}T${selectedHorario}:00-03:00`;
      const endDateTime = `${dataStr}T${horarioFim}:00-03:00`;

      const eventoTitulo = `${selectedServico.nome} - ${formData.nome}`;
      const description = `Cliente: ${formData.nome}\nTelefone: ${formData.telefone}\nAgendado via App`;

      // Criar evento diretamente no Google Calendar (Confirmado)
      const { data: responseData, error } = await supabase.functions.invoke('google-calendar-create', {
        body: {
          summary: eventoTitulo,
          description,
          startDateTime,
          endDateTime,
        },
      });

      if (error) {
        throw new Error(error.message || "Erro ao conectar com servidor.");
      }

      if (responseData?.error) {
        throw new Error(responseData.error || "Erro ao criar agendamento.");
      }

      // === LOGICA DE WHATSAPP ===
      const eventId = (responseData as any)?.id ?? (responseData as any)?.data?.id;

      if (eventId && formData.telefone) {
        // 1. Agendar lembretes automáticos (24h e 2h antes)
        try {
          await supabase.functions.invoke('schedule-reminder', {
            body: {
              eventId,
              clientPhone: formData.telefone,
              clientName: formData.nome,
              serviceName: selectedServico.nome,
              appointmentTime: startDateTime,
            },
          });
        } catch (error) {
          console.error('Erro ao agendar lembrete:', error);
        }

        // 2. Enviar confirmação imediata no WhatsApp
        try {
          const dataFormatada = format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR });
          // Capitalizar primeira letra
          const dataLegivel = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

          const confirmationMessage = `Olá ${formData.nome}! 👋\n\n✅ *Seu agendamento online foi confirmado!*\n\n✂️ Serviço: ${selectedServico.nome}\n🗓️ Data: ${dataLegivel}\n⏰ Horário: ${selectedHorario}\n\nTe esperamos! 💈`;

          await supabase.functions.invoke('send-wapi-reminder', {
            body: {
              phone: formData.telefone,
              message: confirmationMessage,
            },
          });
        } catch (error) {
          console.error('Erro ao enviar confirmação WhatsApp:', error);
        }
      }
      // ==========================

      // Notificar sistema (Barbeiro recebe push)
      notifyNewAppointment(formData.nome, selectedServico.nome, dataStr, selectedHorario);

      setStep('sucesso');
    } catch (error: any) {
      console.error('Erro ao agendar:', error);
      toast({
        title: 'Erro ao realizar agendamento',
        description: error.message || 'Tente novamente ou entre em contato pelo WhatsApp.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'data':
        setSelectedDate(undefined);
        setStep('servico');
        break;
      case 'horario':
        setSelectedHorario(null);
        setStep('data');
        break;
      case 'dados':
        setStep('horario');
        break;
    }
  };

  const slotsDisponiveisCount = slotsDisponiveis.filter(s => s.disponivel).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner message="Carregando..." />
      </div>
    );
  }

  if (!configAtivo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="card-premium p-8 text-center max-w-md">
          <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-playfair font-bold text-primary">
            Agendamento Online
          </h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleInstallClick}
            className="text-primary hover:text-primary/80 hover:bg-primary/10"
          >
            <Download className="h-5 w-5" />
          </Button>
          <p className="text-muted-foreground">
            O agendamento online não está disponível no momento. Entre em contato por WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  if (step === 'sucesso') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="card-premium p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-300">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold mb-2 text-foreground">Agendamento Confirmado!</h1>
          <p className="text-muted-foreground mb-4">
            Seu horário foi reservado com sucesso e já está na agenda do profissional.
          </p>
          <div className="bg-secondary/30 rounded-lg p-4 text-left space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span>{formData.nome}</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              <span>{selectedDate && format(selectedDate, "dd/MM/yyyy (EEEE)", { locale: ptBR })}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>{selectedHorario}</span>
            </div>
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-muted-foreground" />
              <span>{selectedServico?.nome} ({selectedServico?.duracao_minutos} min)</span>
            </div>
          </div>

          {/* Reminder to Install App */}
          <div className="mt-8 pt-6 border-t border-border/50">
            <p className="text-sm text-foreground mb-4 font-medium">
              Para agendar mais rápido da próxima vez:
            </p>
            <Button
              onClick={handleInstallClick}
              className="w-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
              variant="outline"
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar App
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card/95 backdrop-blur-lg border-b border-border/50 p-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-center">Leandrinho's Barber</h1>
        <p className="text-sm text-muted-foreground text-center">Agendamento Online</p>
      </header>

      <main className="p-4 max-w-lg mx-auto pb-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {(['servico', 'data', 'horario', 'dados'] as Step[]).map((s, idx) => {
            const stepOrder = ['servico', 'data', 'horario', 'dados'];
            const currentIdx = stepOrder.indexOf(step);
            const thisIdx = idx;
            const isCompleted = thisIdx < currentIdx;
            const isCurrent = s === step;

            return (
              <div key={s} className="flex items-center">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                    isCurrent && "bg-primary text-primary-foreground",
                    isCompleted && "bg-green-500 text-white",
                    !isCurrent && !isCompleted && "bg-secondary text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                </div>
                {idx < 3 && (
                  <div className={cn(
                    "w-8 h-0.5 mx-1",
                    isCompleted ? "bg-green-500" : "bg-secondary"
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Back Button */}
        {step !== 'servico' && (
          <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
        )}

        {/* Step 1: Escolha do Serviço */}
        {step === 'servico' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Scissors className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Escolha o Serviço</h2>
            </div>

            <div className="grid gap-3">
              {servicos.map((servico) => (
                <button
                  key={servico.id}
                  onClick={() => {
                    setSelectedServico(servico);
                    setSelectedDate(undefined);
                    setSelectedHorario(null);
                    setStep('data');
                  }}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left transition-all",
                    "hover:border-primary/50 hover:bg-primary/5",
                    selectedServico?.id === servico.id
                      ? "border-primary bg-primary/10"
                      : "border-border"
                  )}
                >
                  <div className="font-semibold text-foreground">{servico.nome}</div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="font-medium text-primary">R$ {servico.preco.toFixed(2)}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {servico.duracao_minutos} min
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Escolha da Data */}
        {step === 'data' && selectedServico && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Escolha a Data</h2>
            </div>

            <div className="text-sm text-muted-foreground bg-secondary/30 rounded-lg p-3">
              <span className="font-medium text-foreground">{selectedServico.nome}</span>
              <span className="mx-2">•</span>
              <span>{selectedServico.duracao_minutos} minutos</span>
            </div>

            <div className="card-premium p-4 flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    setSelectedHorario(null);
                    setStep('horario');
                  }
                }}
                disabled={isDayDisabled}
                locale={ptBR}
                className="pointer-events-auto"
              />
            </div>
          </div>
        )}

        {/* Step 3: Escolha do Horário */}
        {step === 'horario' && selectedServico && selectedDate && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Escolha o Horário</h2>
            </div>

            <div className="text-sm text-muted-foreground bg-secondary/30 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4" />
                <span className="font-medium text-foreground">{selectedServico.nome}</span>
                <span>({selectedServico.duracao_minutos} min)</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <CalendarIcon className="w-4 h-4" />
                <span>{format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
              </div>
            </div>

            {slotsDisponiveis.length === 0 ? (
              <div className="card-premium p-6 text-center">
                <p className="text-muted-foreground">Nenhum horário disponível para esta data.</p>
                <Button variant="outline" className="mt-4" onClick={() => setStep('data')}>
                  Escolher outra data
                </Button>
              </div>
            ) : slotsDisponiveisCount === 0 ? (
              <div className="card-premium p-6 text-center">
                <p className="text-muted-foreground">Todos os horários estão ocupados.</p>
                <Button variant="outline" className="mt-4" onClick={() => setStep('data')}>
                  Escolher outra data
                </Button>
              </div>
            ) : (
              <div className="card-premium p-4">
                <p className="text-sm text-muted-foreground mb-3">
                  {slotsDisponiveisCount} horário{slotsDisponiveisCount > 1 ? 's' : ''} disponível{slotsDisponiveisCount > 1 ? 's' : ''}
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {slotsDisponiveis.map(({ horario, disponivel }) => (
                    <button
                      key={horario}
                      disabled={!disponivel}
                      onClick={() => {
                        setSelectedHorario(horario);
                        setStep('dados');
                      }}
                      className={cn(
                        "p-3 rounded-lg text-sm font-medium transition-all",
                        disponivel
                          ? "bg-primary/10 border-2 border-primary/30 text-primary hover:bg-primary/20 hover:border-primary"
                          : "bg-secondary/50 text-muted-foreground/50 cursor-not-allowed line-through"
                      )}
                    >
                      {horario}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Dados do Cliente */}
        {step === 'dados' && selectedServico && selectedDate && selectedHorario && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Seus Dados</h2>
            </div>

            <div className="text-sm text-muted-foreground bg-secondary/30 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4" />
                <span className="font-medium text-foreground">{selectedServico.nome}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                <span>{format(selectedDate, "EEEE, dd/MM", { locale: ptBR })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="font-medium text-foreground">{selectedHorario}</span>
              </div>
            </div>

            <div className="card-premium p-4 space-y-4">
              <div>
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Seu nome"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="telefone">WhatsApp *</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(11) 99999-9999"
                  className="mt-1"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={!formData.nome || !formData.telefone || isSubmitting}
              >
                {isSubmitting ? 'Enviando...' : 'Confirmar Agendamento'}
              </Button>
            </div>
          </div>
        )}
      </main>
      <InstallPrompt
        open={showInstallPrompt}
        onOpenChange={setShowInstallPrompt}
        onInstall={handleInstallClick}
        canInstall={canInstall}
      />

      {/* Admin Link */}
      <div className="mt-8 text-center pb-8">
        <a href="/login" className="inline-flex items-center gap-2 text-xs text-muted-foreground/50 hover:text-primary transition-colors">
          <Lock className="w-3 h-3" />
          Sou o Profissional
        </a>
      </div>
    </div>
  );
}
