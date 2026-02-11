import { useState, useEffect, useMemo } from 'react';
import { format, getMonth, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Gift, MessageCircle, Phone, Trash2, Calendar, Pencil, Cake, Send, Loader2 } from 'lucide-react';
import { AniversarioCliente, Cliente } from '@/types';
import { fetchAniversarios, createAniversario, updateAniversario, deleteAniversario, fetchClientes } from '@/lib/supabase';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function AniversariosView() {
  const [aniversarios, setAniversarios] = useState<AniversarioCliente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<AniversarioCliente | null>(null);
  const [filtroMes, setFiltroMes] = useState<string>('todos');
  const [alertaAutomatico, setAlertaAutomatico] = useState(() => {
    return localStorage.getItem('aniversario_alerta_auto') === 'true';
  });
  const [enviandoAlerta, setEnviandoAlerta] = useState<string | null>(null);

  // Form state
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [dataAniversario, setDataAniversario] = useState('');

  const hoje = new Date();
  const mesAtual = getMonth(hoje);
  const anoAtual = getYear(hoje);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [anivResult, clientesResult] = await Promise.all([
      fetchAniversarios(),
      fetchClientes(),
    ]);
    
    if (anivResult.data) {
      setAniversarios(anivResult.data);
    }
    if (clientesResult.data) {
      setClientes(clientesResult.data.map((c: any) => ({
        id: String(c.id),
        nome: c.nomewpp,
        telefone: c.telefone || '',
      })));
    }
    setIsLoading(false);
  };

  const resetForm = () => {
    setClienteNome('');
    setClienteTelefone('');
    setDataAniversario('');
    setEditando(null);
  };

  const handleOpenDialog = (aniv?: AniversarioCliente) => {
    if (aniv) {
      setEditando(aniv);
      setClienteNome(aniv.cliente_nome);
      setClienteTelefone(aniv.cliente_telefone || '');
      setDataAniversario(aniv.data_aniversario);
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!clienteNome || !dataAniversario) {
      toast({ title: 'Preencha nome e data', variant: 'destructive' });
      return;
    }

    const data = {
      cliente_nome: clienteNome,
      cliente_telefone: clienteTelefone || undefined,
      data_aniversario: dataAniversario,
    };

    let result;
    if (editando) {
      result = await updateAniversario(editando.id, data);
    } else {
      result = await createAniversario(data);
    }

    if (result.error) {
      toast({ title: 'Erro ao salvar', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: editando ? 'Aniversário atualizado!' : 'Aniversário cadastrado!' });
      setDialogOpen(false);
      resetForm();
      loadData();
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteAniversario(id);
    if (result.error) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    } else {
      toast({ title: 'Aniversário excluído' });
      loadData();
    }
  };

  const handleClienteSelect = (clienteId: string) => {
    const cliente = clientes.find(c => c.id === clienteId);
    if (cliente) {
      setClienteNome(cliente.nome);
      setClienteTelefone(cliente.telefone || '');
    }
  };

  const enviarWhatsApp = (telefone: string, nome: string) => {
    const mensagem = `Parabéns, ${nome}! 🎂🎉 Desejamos um feliz aniversário! Como presente, você tem 10% de desconto no seu próximo corte! 💈`;
    window.open(`https://wa.me/55${telefone.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  const ligar = (telefone: string) => {
    window.open(`tel:${telefone}`, '_self');
  };

  const enviarAlertaAutomatico = async (aniv: AniversarioCliente) => {
    if (!aniv.cliente_telefone) {
      toast({ title: 'Cliente sem telefone cadastrado', variant: 'destructive' });
      return;
    }

    setEnviandoAlerta(aniv.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-birthday-alert', {
        body: {
          phone: aniv.cliente_telefone,
          clientName: aniv.cliente_nome,
        },
      });

      if (error) throw error;

      // Marcar como notificado este ano
      await updateAniversario(aniv.id, { notificado_este_ano: true });
      
      toast({ title: 'Mensagem enviada!', description: `Parabéns enviado para ${aniv.cliente_nome}` });
      loadData();
    } catch (error) {
      console.error('Erro ao enviar alerta:', error);
      toast({ title: 'Erro ao enviar mensagem', variant: 'destructive' });
    } finally {
      setEnviandoAlerta(null);
    }
  };

  const toggleAlertaAutomatico = (checked: boolean) => {
    setAlertaAutomatico(checked);
    localStorage.setItem('aniversario_alerta_auto', String(checked));
    toast({ 
      title: checked ? 'Alertas automáticos ativados' : 'Alertas automáticos desativados',
      description: checked ? 'Mensagens serão enviadas automaticamente nos aniversários' : undefined,
    });
  };

  // Organizar aniversários por mês
  const aniversariosFiltrados = useMemo(() => {
    return aniversarios
      .filter(aniv => {
        if (filtroMes === 'todos') return true;
        const [, mes] = aniv.data_aniversario.split('-');
        return mes === filtroMes;
      })
      .map(aniv => {
        const [ano, mes, dia] = aniv.data_aniversario.split('-');
        const aniversarioEsteAno = new Date(anoAtual, parseInt(mes) - 1, parseInt(dia));
        const diffDays = Math.ceil((aniversarioEsteAno.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        return { ...aniv, diffDays, dataFormatada: format(aniversarioEsteAno, "dd 'de' MMMM", { locale: ptBR }) };
      })
      .sort((a, b) => {
        // Ordenar por proximidade do aniversário
        const [, mesA, diaA] = a.data_aniversario.split('-');
        const [, mesB, diaB] = b.data_aniversario.split('-');
        const dataA = new Date(anoAtual, parseInt(mesA) - 1, parseInt(diaA));
        const dataB = new Date(anoAtual, parseInt(mesB) - 1, parseInt(diaB));
        return dataA.getTime() - dataB.getTime();
      });
  }, [aniversarios, filtroMes, anoAtual, hoje]);

  const proximosAniversarios = aniversariosFiltrados.filter(a => a.diffDays >= 0 && a.diffDays <= 7);

  const MESES = [
    { value: 'todos', label: 'Todos' },
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Aniversários</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4" />
              Novo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editando ? 'Editar Aniversário' : 'Novo Aniversário'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {/* Selecionar cliente existente */}
              {!editando && clientes.length > 0 && (
                <div className="space-y-2">
                  <Label>Selecionar Cliente (opcional)</Label>
                  <Select onValueChange={handleClienteSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  placeholder="Nome do cliente"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={clienteTelefone}
                  onChange={(e) => setClienteTelefone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Data de Aniversário *</Label>
                <Input
                  type="date"
                  value={dataAniversario}
                  onChange={(e) => setDataAniversario(e.target.value)}
                />
              </div>

              <Button onClick={handleSubmit} className="w-full">
                {editando ? 'Salvar Alterações' : 'Cadastrar Aniversário'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtro por mês e configurações */}
      <div className="flex gap-2">
        <Select value={filtroMes} onValueChange={setFiltroMes}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Filtrar por mês" />
          </SelectTrigger>
          <SelectContent>
            {MESES.map((mes) => (
              <SelectItem key={mes.value} value={mes.value}>{mes.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Toggle alertas automáticos */}
      <Card className="bg-muted/30">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Alertas WhatsApp Automáticos</p>
              <p className="text-xs text-muted-foreground">Enviar parabéns via W-API</p>
            </div>
            <Switch 
              checked={alertaAutomatico} 
              onCheckedChange={toggleAlertaAutomatico} 
            />
          </div>
        </CardContent>
      </Card>

      {/* Próximos aniversários (esta semana) */}
      {proximosAniversarios.length > 0 && filtroMes === 'todos' && (
        <Card className="border-pink-500/30 bg-pink-500/10">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-pink-600 mb-2">
              <Cake className="h-5 w-5" />
              <span className="font-medium">Esta semana</span>
            </div>
            <div className="space-y-2">
              {proximosAniversarios.map((aniv) => (
                <div key={aniv.id} className="flex items-center justify-between bg-background/50 rounded-lg p-2">
                  <div>
                    <p className="font-medium text-foreground">{aniv.cliente_nome}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">{aniv.dataFormatada}</p>
                      {aniv.notificado_este_ano && (
                        <Badge variant="secondary" className="text-xs bg-emerald-500/20 text-emerald-600">Notificado</Badge>
                      )}
                    </div>
                  </div>
                  {aniv.cliente_telefone && (
                    <div className="flex gap-1">
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-8 w-8"
                        disabled={enviandoAlerta === aniv.id}
                        onClick={() => enviarAlertaAutomatico(aniv)}
                      >
                        {enviandoAlerta === aniv.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 text-primary" />
                        )}
                      </Button>
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-8 w-8"
                        onClick={() => enviarWhatsApp(aniv.cliente_telefone!, aniv.cliente_nome)}
                      >
                        <MessageCircle className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-8 w-8"
                        onClick={() => ligar(aniv.cliente_telefone!)}
                      >
                        <Phone className="h-4 w-4 text-blue-600" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista completa */}
      <div className="space-y-2">
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : aniversariosFiltrados.length === 0 ? (
          <div className="text-center py-8">
            <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Nenhum aniversário cadastrado</p>
          </div>
        ) : (
          aniversariosFiltrados.map((aniv) => {
            const isProximo = aniv.diffDays >= 0 && aniv.diffDays <= 7;
            const isHoje = aniv.diffDays === 0;
            
            return (
              <Card key={aniv.id} className={cn(isHoje && "border-pink-500/50 bg-pink-500/10")}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center",
                        isHoje ? "bg-pink-500/30" : "bg-primary/10"
                      )}>
                        <Gift className={cn("h-5 w-5", isHoje ? "text-pink-600" : "text-primary")} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{aniv.cliente_nome}</p>
                          {isHoje && (
                            <Badge className="bg-pink-500 text-white text-xs">Hoje! 🎂</Badge>
                          )}
                          {aniv.notificado_este_ano && (
                            <Badge variant="secondary" className="text-xs bg-emerald-500/20 text-emerald-600">✓</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{aniv.dataFormatada}</p>
                      </div>
                    </div>

                    {aniv.cliente_telefone && (
                      <div className="flex gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8"
                          disabled={enviandoAlerta === aniv.id}
                          onClick={() => enviarAlertaAutomatico(aniv)}
                        >
                          {enviandoAlerta === aniv.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4 text-primary" />
                          )}
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8"
                          onClick={() => enviarWhatsApp(aniv.cliente_telefone!, aniv.cliente_nome)}
                        >
                          <MessageCircle className="h-4 w-4 text-emerald-600" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-border/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleOpenDialog(aniv)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => handleDelete(aniv.id)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
