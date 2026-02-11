import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, getMonth, getYear, parseISO, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Target, DollarSign, Users, TrendingUp, Trophy, Pencil } from 'lucide-react';
import { Meta, Agendamento, Servico } from '@/types';
import { fetchMetaAtual, upsertMeta } from '@/lib/supabase';
import { fetchGoogleCalendarEvents, convertToAgendamento } from '@/lib/googleCalendar';
import { fetchServicos } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function MetasView() {
  const [metaAtual, setMetaAtual] = useState<Meta | null>(null);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [metaFaturamento, setMetaFaturamento] = useState('');
  const [metaAtendimentos, setMetaAtendimentos] = useState('');

  const hoje = new Date();
  const mesAtual = getMonth(hoje) + 1;
  const anoAtual = getYear(hoje);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);

    // Carregar meta atual
    const metaResult = await fetchMetaAtual(mesAtual, anoAtual);
    if (metaResult.data && metaResult.data.length > 0) {
      setMetaAtual(metaResult.data[0]);
      setMetaFaturamento(metaResult.data[0].meta_faturamento.toString());
      setMetaAtendimentos(metaResult.data[0].meta_atendimentos.toString());
    }

    // Carregar agendamentos do mês
    const inicio = startOfMonth(hoje);
    const [calendarResult, servicosResult] = await Promise.all([
      fetchGoogleCalendarEvents(inicio.toISOString(), hoje.toISOString()),
      fetchServicos(),
    ]);

    if (calendarResult.data) {
      const passados = calendarResult.data
        .map(convertToAgendamento)
        .filter((ag) => {
          const endDateTime = parseISO(`${ag.data}T${ag.hora_fim || ag.hora_inicio || '00:00'}:00-03:00`);
          return isBefore(endDateTime, hoje);
        });
      setAgendamentos(passados);
    }

    if (servicosResult.data) {
      setServicos(servicosResult.data.map((s: any) => ({
        id: String(s.id),
        nome: s.nome,
        preco: s.preco,
        duracao: s.duracao_minutos,
      })));
    }

    setIsLoading(false);
  };

  const handleSaveMeta = async () => {
    if (!metaFaturamento && !metaAtendimentos) {
      toast({ title: 'Defina pelo menos uma meta', variant: 'destructive' });
      return;
    }

    const result = await upsertMeta({
      mes: mesAtual,
      ano: anoAtual,
      meta_faturamento: parseFloat(metaFaturamento) || 0,
      meta_atendimentos: parseInt(metaAtendimentos) || 0,
    });

    if (result.error) {
      toast({ title: 'Erro ao salvar', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Meta salva com sucesso!' });
      setDialogOpen(false);
      loadData();
    }
  };

  // Calcular progresso
  const progresso = useMemo(() => {
    const calcularValorAgendamento = (servicoStr: string): number => {
      const servicosNoAgendamento = servicoStr.split(/\s*[+,\/]\s*|\s+e\s+/i).map(s => s.trim()).filter(Boolean);
      return servicosNoAgendamento.reduce((total, servicoNome) => {
        const servicoEncontrado = servicos.find(s => 
          servicoNome.toLowerCase().includes(s.nome.toLowerCase()) ||
          s.nome.toLowerCase().includes(servicoNome.toLowerCase())
        );
        return total + (servicoEncontrado?.preco || 0);
      }, 0);
    };

    const faturamentoAtual = agendamentos.reduce((acc, ag) => {
      return acc + calcularValorAgendamento(ag.servico);
    }, 0);

    const atendimentosAtual = agendamentos.length;

    return {
      faturamento: {
        atual: faturamentoAtual,
        meta: metaAtual?.meta_faturamento || 0,
        percentual: metaAtual?.meta_faturamento ? (faturamentoAtual / metaAtual.meta_faturamento) * 100 : 0,
      },
      atendimentos: {
        atual: atendimentosAtual,
        meta: metaAtual?.meta_atendimentos || 0,
        percentual: metaAtual?.meta_atendimentos ? (atendimentosAtual / metaAtual.meta_atendimentos) * 100 : 0,
      },
    };
  }, [agendamentos, servicos, metaAtual]);

  const diasRestantes = useMemo(() => {
    const ultimoDia = new Date(anoAtual, mesAtual, 0);
    return Math.ceil((ultimoDia.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  }, [hoje, anoAtual, mesAtual]);

  const getStatusColor = (percentual: number) => {
    if (percentual >= 100) return 'text-emerald-600';
    if (percentual >= 75) return 'text-amber-600';
    return 'text-foreground';
  };

  const getProgressColor = (percentual: number) => {
    if (percentual >= 100) return 'bg-emerald-500';
    if (percentual >= 75) return 'bg-amber-500';
    return 'bg-primary';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Metas</h2>
          <p className="text-sm text-muted-foreground">
            {format(hoje, "MMMM 'de' yyyy", { locale: ptBR })} • {diasRestantes} dias restantes
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-2">
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Definir Metas do Mês</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  Meta de Faturamento (R$)
                </Label>
                <Input
                  type="number"
                  placeholder="Ex: 5000"
                  value={metaFaturamento}
                  onChange={(e) => setMetaFaturamento(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  Meta de Atendimentos
                </Label>
                <Input
                  type="number"
                  placeholder="Ex: 100"
                  value={metaAtendimentos}
                  onChange={(e) => setMetaAtendimentos(e.target.value)}
                />
              </div>

              <Button onClick={handleSaveMeta} className="w-full">
                Salvar Metas
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : !metaAtual ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">Nenhuma meta definida para este mês</p>
            <Button onClick={() => setDialogOpen(true)}>Definir Metas</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Card de Faturamento */}
          <Card className={cn(
            "overflow-hidden",
            progresso.faturamento.percentual >= 100 && "border-emerald-500/50 bg-emerald-500/5"
          )}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                Faturamento
                {progresso.faturamento.percentual >= 100 && (
                  <Trophy className="h-4 w-4 text-amber-500 ml-auto" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className={cn("text-3xl font-bold", getStatusColor(progresso.faturamento.percentual))}>
                    R$ {progresso.faturamento.atual.toFixed(0)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    de R$ {progresso.faturamento.meta.toFixed(0)}
                  </p>
                </div>
                <p className={cn("text-2xl font-bold", getStatusColor(progresso.faturamento.percentual))}>
                  {Math.min(progresso.faturamento.percentual, 100).toFixed(0)}%
                </p>
              </div>
              <Progress 
                value={Math.min(progresso.faturamento.percentual, 100)} 
                className={cn("h-3", `[&>div]:${getProgressColor(progresso.faturamento.percentual)}`)}
              />
              {progresso.faturamento.meta > progresso.faturamento.atual && (
                <p className="text-xs text-muted-foreground">
                  Falta R$ {(progresso.faturamento.meta - progresso.faturamento.atual).toFixed(0)} para bater a meta
                </p>
              )}
            </CardContent>
          </Card>

          {/* Card de Atendimentos */}
          <Card className={cn(
            "overflow-hidden",
            progresso.atendimentos.percentual >= 100 && "border-emerald-500/50 bg-emerald-500/5"
          )}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                Atendimentos
                {progresso.atendimentos.percentual >= 100 && (
                  <Trophy className="h-4 w-4 text-amber-500 ml-auto" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className={cn("text-3xl font-bold", getStatusColor(progresso.atendimentos.percentual))}>
                    {progresso.atendimentos.atual}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    de {progresso.atendimentos.meta} atendimentos
                  </p>
                </div>
                <p className={cn("text-2xl font-bold", getStatusColor(progresso.atendimentos.percentual))}>
                  {Math.min(progresso.atendimentos.percentual, 100).toFixed(0)}%
                </p>
              </div>
              <Progress 
                value={Math.min(progresso.atendimentos.percentual, 100)} 
                className={cn("h-3", `[&>div]:${getProgressColor(progresso.atendimentos.percentual)}`)}
              />
              {progresso.atendimentos.meta > progresso.atendimentos.atual && (
                <p className="text-xs text-muted-foreground">
                  Falta {progresso.atendimentos.meta - progresso.atendimentos.atual} atendimento(s) para bater a meta
                </p>
              )}
            </CardContent>
          </Card>

          {/* Projeção */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-600" />
                Projeção
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Com base no ritmo atual, você deve terminar o mês com aproximadamente:
              </p>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-xl font-bold text-foreground">
                    R$ {((progresso.faturamento.atual / (30 - diasRestantes)) * 30).toFixed(0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Faturamento projetado</p>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-xl font-bold text-foreground">
                    {Math.round((progresso.atendimentos.atual / (30 - diasRestantes)) * 30)}
                  </p>
                  <p className="text-xs text-muted-foreground">Atendimentos projetados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
