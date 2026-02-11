import { useState, useEffect, useMemo } from 'react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  User, Calendar, Clock, Search, AlertTriangle, 
  CheckCircle2, XCircle, Phone, MessageCircle, TrendingUp
} from 'lucide-react';
import { Agendamento, Cliente } from '@/types';
import { cn } from '@/lib/utils';

interface ClienteHistoricoProps {
  agendamentos: Agendamento[];
  clientes: Cliente[];
}

interface ClienteResumo {
  cliente: Cliente;
  totalVisitas: number;
  ultimaVisita: Date | null;
  diasDesdeUltimaVisita: number | null;
  servicosFavoritos: { nome: string; count: number }[];
  totalGasto: number;
  status: 'ativo' | 'atencao' | 'inativo';
}

export function ClienteHistorico({ agendamentos, clientes }: ClienteHistoricoProps) {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativo' | 'atencao' | 'inativo'>('todos');

  const clientesResumo = useMemo(() => {
    const hoje = new Date();
    
    // Helper para converter data+hora em Date
    const getDataHora = (a: Agendamento) => {
      const [ano, mes, dia] = a.data.split('-').map(Number);
      const [hora, minuto] = a.hora_inicio.split(':').map(Number);
      return new Date(ano, mes - 1, dia, hora, minuto);
    };
    
    return clientes.map(cliente => {
      // Filtrar agendamentos deste cliente (passados e confirmados)
      const agendamentosCliente = agendamentos.filter(a => 
        a.cliente_nome?.toLowerCase() === cliente.nome?.toLowerCase()
      ).filter(a => getDataHora(a) < hoje);
      
      // Calcular última visita
      const visitasOrdenadas = [...agendamentosCliente].sort(
        (a, b) => getDataHora(b).getTime() - getDataHora(a).getTime()
      );
      
      const ultimaVisita = visitasOrdenadas[0] ? getDataHora(visitasOrdenadas[0]) : null;
      const diasDesdeUltimaVisita = ultimaVisita ? differenceInDays(hoje, ultimaVisita) : null;
      
      // Serviços mais frequentes
      const servicosCount: Record<string, number> = {};
      agendamentosCliente.forEach(a => {
        if (a.servico) {
          const servicos = a.servico.split(/[+,/e]/i).map(s => s.trim());
          servicos.forEach(s => {
            if (s) servicosCount[s] = (servicosCount[s] || 0) + 1;
          });
        }
      });
      
      const servicosFavoritos = Object.entries(servicosCount)
        .map(([nome, count]) => ({ nome, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
      
      // Determinar status
      let status: 'ativo' | 'atencao' | 'inativo';
      if (!diasDesdeUltimaVisita || diasDesdeUltimaVisita > 60) {
        status = 'inativo';
      } else if (diasDesdeUltimaVisita > 30) {
        status = 'atencao';
      } else {
        status = 'ativo';
      }
      
      return {
        cliente,
        totalVisitas: agendamentosCliente.length,
        ultimaVisita,
        diasDesdeUltimaVisita,
        servicosFavoritos,
        totalGasto: 0, // Seria calculado se tivéssemos preços por agendamento
        status,
      } as ClienteResumo;
    }).filter(c => c.totalVisitas > 0) // Apenas clientes com histórico
      .sort((a, b) => {
        // Ordenar por status (inativos primeiro para atenção)
        const statusOrder = { inativo: 0, atencao: 1, ativo: 2 };
        return statusOrder[a.status] - statusOrder[b.status];
      });
  }, [agendamentos, clientes]);

  const clientesFiltrados = useMemo(() => {
    return clientesResumo.filter(c => {
      const matchBusca = c.cliente.nome?.toLowerCase().includes(busca.toLowerCase());
      const matchStatus = filtroStatus === 'todos' || c.status === filtroStatus;
      return matchBusca && matchStatus;
    });
  }, [clientesResumo, busca, filtroStatus]);

  const estatisticas = useMemo(() => {
    const ativos = clientesResumo.filter(c => c.status === 'ativo').length;
    const atencao = clientesResumo.filter(c => c.status === 'atencao').length;
    const inativos = clientesResumo.filter(c => c.status === 'inativo').length;
    return { ativos, atencao, inativos, total: clientesResumo.length };
  }, [clientesResumo]);

  const enviarWhatsApp = (telefone: string, nome: string) => {
    const mensagem = `Olá ${nome}! 👋 Tudo bem? Notamos que faz um tempo desde a sua última visita. Que tal agendar um horário? Estamos com saudades! 💈`;
    window.open(`https://wa.me/55${telefone.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  const getStatusBadge = (status: 'ativo' | 'atencao' | 'inativo') => {
    switch (status) {
      case 'ativo':
        return <Badge className="bg-emerald-500/20 text-emerald-600 border-0">Ativo</Badge>;
      case 'atencao':
        return <Badge className="bg-amber-500/20 text-amber-600 border-0">Atenção</Badge>;
      case 'inativo':
        return <Badge className="bg-red-500/20 text-red-600 border-0">Inativo</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Fidelidade de Clientes
        </h2>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-4 gap-2">
        <Card 
          className={cn(
            "cursor-pointer transition-all",
            filtroStatus === 'todos' && "ring-2 ring-primary"
          )}
          onClick={() => setFiltroStatus('todos')}
        >
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-foreground">{estatisticas.total}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "cursor-pointer transition-all bg-emerald-500/10",
            filtroStatus === 'ativo' && "ring-2 ring-emerald-500"
          )}
          onClick={() => setFiltroStatus('ativo')}
        >
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-emerald-600">{estatisticas.ativos}</p>
            <p className="text-[10px] text-muted-foreground">Ativos</p>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "cursor-pointer transition-all bg-amber-500/10",
            filtroStatus === 'atencao' && "ring-2 ring-amber-500"
          )}
          onClick={() => setFiltroStatus('atencao')}
        >
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-amber-600">{estatisticas.atencao}</p>
            <p className="text-[10px] text-muted-foreground">Atenção</p>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "cursor-pointer transition-all bg-red-500/10",
            filtroStatus === 'inativo' && "ring-2 ring-red-500"
          )}
          onClick={() => setFiltroStatus('inativo')}
        >
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-red-600">{estatisticas.inativos}</p>
            <p className="text-[10px] text-muted-foreground">Inativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Lista de clientes */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2 pr-2">
          {clientesFiltrados.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum cliente encontrado
            </p>
          ) : (
            clientesFiltrados.map((item) => (
              <Card key={item.cliente.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                        item.status === 'ativo' && "bg-emerald-500/20",
                        item.status === 'atencao' && "bg-amber-500/20",
                        item.status === 'inativo' && "bg-red-500/20"
                      )}>
                        <User className={cn(
                          "h-5 w-5",
                          item.status === 'ativo' && "text-emerald-600",
                          item.status === 'atencao' && "text-amber-600",
                          item.status === 'inativo' && "text-red-600"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground truncate">{item.cliente.nome}</p>
                          {getStatusBadge(item.status)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {item.totalVisitas} visitas
                          </span>
                          {item.ultimaVisita && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {item.diasDesdeUltimaVisita === 0 
                                ? 'Hoje' 
                                : `${item.diasDesdeUltimaVisita} dias`
                              }
                            </span>
                          )}
                        </div>
                        {item.servicosFavoritos.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {item.servicosFavoritos.map(s => (
                              <Badge key={s.nome} variant="secondary" className="text-[10px]">
                                {s.nome} ({s.count}x)
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {item.cliente.telefone && item.status !== 'ativo' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={() => enviarWhatsApp(item.cliente.telefone!, item.cliente.nome)}
                      >
                        <MessageCircle className="h-4 w-4 text-emerald-600" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
