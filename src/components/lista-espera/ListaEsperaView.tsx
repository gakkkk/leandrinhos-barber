import { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, Check, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import type { ListaEspera } from '@/types';

export function ListaEsperaView() {
  const [items, setItems] = useState<ListaEspera[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    cliente_nome: '',
    cliente_telefone: '',
    servico: '',
    data_preferida: format(new Date(), 'yyyy-MM-dd'),
    horario_preferido: '',
  });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('lista_espera')
      .select('*')
      .order('data_preferida', { ascending: true });
    
    if (error) {
      toast({ title: 'Erro ao carregar lista', variant: 'destructive' });
    } else {
      setItems((data || []) as ListaEspera[]);
    }
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.cliente_nome.trim() || !formData.cliente_telefone.trim()) {
      toast({ title: 'Nome e telefone são obrigatórios', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('lista_espera').insert(formData);
    
    if (error) {
      toast({ title: 'Erro ao adicionar', variant: 'destructive' });
    } else {
      toast({ title: 'Adicionado à lista!' });
      loadItems();
      setIsDialogOpen(false);
      setFormData({
        cliente_nome: '',
        cliente_telefone: '',
        servico: '',
        data_preferida: format(new Date(), 'yyyy-MM-dd'),
        horario_preferido: '',
      });
    }
  };

  const handleNotificar = async (item: ListaEspera) => {
    // Abrir WhatsApp
    const msg = encodeURIComponent(
      `Olá ${item.cliente_nome}! 😊\n\nUm horário ficou disponível para ${format(new Date(item.data_preferida), "dd/MM", { locale: ptBR })}${item.horario_preferido ? ` (${item.horario_preferido})` : ''}.\n\nDeseja agendar?`
    );
    const phone = item.cliente_telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');

    // Marcar como notificado
    await supabase
      .from('lista_espera')
      .update({ notificado: true, notificado_em: new Date().toISOString(), status: 'notificado' })
      .eq('id', item.id);
    
    loadItems();
  };

  const handleMarcarAgendado = async (id: string) => {
    await supabase
      .from('lista_espera')
      .update({ status: 'agendado' })
      .eq('id', id);
    
    toast({ title: 'Marcado como agendado!' });
    loadItems();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('lista_espera').delete().eq('id', id);
    toast({ title: 'Removido da lista!' });
    loadItems();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aguardando': return 'bg-yellow-500/20 text-yellow-600';
      case 'notificado': return 'bg-blue-500/20 text-blue-600';
      case 'agendado': return 'bg-green-500/20 text-green-600';
      case 'expirado': return 'bg-muted text-muted-foreground';
      default: return 'bg-secondary';
    }
  };

  const aguardando = items.filter(i => i.status === 'aguardando');
  const outros = items.filter(i => i.status !== 'aguardando');

  if (isLoading) return <LoadingSpinner message="Carregando lista..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Lista de Espera</h2>
          {aguardando.length > 0 && (
            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
              {aguardando.length}
            </span>
          )}
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar à Lista</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={formData.cliente_nome}
                  onChange={(e) => setFormData({ ...formData, cliente_nome: e.target.value })}
                  placeholder="Nome do cliente"
                />
              </div>
              <div>
                <Label>Telefone *</Label>
                <Input
                  value={formData.cliente_telefone}
                  onChange={(e) => setFormData({ ...formData, cliente_telefone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <Label>Serviço</Label>
                <Input
                  value={formData.servico}
                  onChange={(e) => setFormData({ ...formData, servico: e.target.value })}
                  placeholder="Corte + Barba"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data Preferida</Label>
                  <Input
                    type="date"
                    value={formData.data_preferida}
                    onChange={(e) => setFormData({ ...formData, data_preferida: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Horário</Label>
                  <Select
                    value={formData.horario_preferido}
                    onValueChange={(v) => setFormData({ ...formData, horario_preferido: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Qualquer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manha">Manhã</SelectItem>
                      <SelectItem value="tarde">Tarde</SelectItem>
                      <SelectItem value="noite">Noite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full" onClick={handleSubmit}>Adicionar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Lista vazia"
          description="Adicione clientes que aguardam horários"
        />
      ) : (
        <div className="space-y-4">
          {aguardando.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Aguardando</h3>
              <div className="space-y-2">
                {aguardando.map((item) => (
                  <div key={item.id} className="card-premium p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{item.cliente_nome}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(item.data_preferida), "dd/MM (EEEE)", { locale: ptBR })}
                          {item.horario_preferido && ` • ${item.horario_preferido}`}
                        </div>
                        {item.servico && (
                          <div className="text-xs text-muted-foreground">{item.servico}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" onClick={() => handleNotificar(item)}>
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {outros.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Histórico</h3>
              <div className="space-y-2">
                {outros.map((item) => (
                  <div key={item.id} className="card-premium p-3 opacity-60">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.cliente_nome}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(item.status)}`}>
                            {item.status}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(item.data_preferida), "dd/MM/yyyy")}
                        </div>
                      </div>
                      {item.status === 'notificado' && (
                        <Button size="sm" variant="outline" onClick={() => handleMarcarAgendado(item.id)}>
                          <Check className="w-3 h-3 mr-1" /> Agendou
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}