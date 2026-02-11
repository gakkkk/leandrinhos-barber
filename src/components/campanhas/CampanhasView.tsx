import { useState, useEffect } from 'react';
import { Megaphone, Plus, Send, Trash2, Users, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Campanha, Cupom } from '@/types';

const WAPI_INSTANCE_ID = import.meta.env.VITE_WAPI_INSTANCE_ID || '';

export function CampanhasView() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    mensagem: '',
    tipo: 'promocao' as 'promocao' | 'retorno' | 'aniversario' | 'personalizado',
    filtro_dias_inativo: 30,
    cupom_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    
    const [{ data: camps }, { data: cups }] = await Promise.all([
      supabase.from('campanhas').select('*').order('created_at', { ascending: false }),
      supabase.from('cupons').select('*').eq('ativo', true),
    ]);
    
    setCampanhas((camps || []) as Campanha[]);
    setCupons((cups || []) as Cupom[]);
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim() || !formData.mensagem.trim()) {
      toast({ title: 'Nome e mensagem são obrigatórios', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('campanhas').insert({
      ...formData,
      cupom_id: formData.cupom_id || null,
      filtro_dias_inativo: formData.tipo === 'retorno' ? formData.filtro_dias_inativo : null,
    });

    if (error) {
      toast({ title: 'Erro ao criar campanha', variant: 'destructive' });
    } else {
      toast({ title: 'Campanha criada!' });
      loadData();
      setIsDialogOpen(false);
      setFormData({
        nome: '',
        mensagem: '',
        tipo: 'promocao',
        filtro_dias_inativo: 30,
        cupom_id: '',
      });
    }
  };

  const handleEnviar = async (campanha: Campanha) => {
    setIsSending(true);
    
    try {
      // Buscar clientes do banco externo via proxy
      const response = await fetch(`https://wtkxyofvbillvclkcvir.supabase.co/functions/v1/supabase-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'dados_cliente',
          method: 'GET',
        }),
      });
      
      const result = await response.json();
      const clientes = result.data || [];
      
      if (clientes.length === 0) {
        toast({ title: 'Nenhum cliente encontrado', variant: 'destructive' });
        setIsSending(false);
        return;
      }

      // Filtrar clientes com telefone
      const destinatarios = clientes.filter((c: any) => c.telefone);
      
      if (destinatarios.length === 0) {
        toast({ title: 'Nenhum cliente com telefone cadastrado', variant: 'destructive' });
        setIsSending(false);
        return;
      }

      // Criar destinatários na tabela
      await supabase.from('campanhas_destinatarios').insert(
        destinatarios.map((c: any) => ({
          campanha_id: campanha.id,
          cliente_nome: c.nomewpp,
          cliente_telefone: c.telefone,
        }))
      );

      // Atualizar campanha
      await supabase
        .from('campanhas')
        .update({ total_destinatarios: destinatarios.length })
        .eq('id', campanha.id);

      // Enviar mensagens via W-API
      let enviados = 0;
      let erros = 0;

      for (const dest of destinatarios) {
        try {
          const mensagemPersonalizada = campanha.mensagem
            .replace('{nome}', dest.nomewpp || 'Cliente');

          const wapiResponse = await fetch(
            `https://api.w-api.app/v1/message/send-text?instanceId=${WAPI_INSTANCE_ID}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_WAPI_TOKEN || ''}`,
              },
              body: JSON.stringify({
                phone: dest.telefone.replace(/\D/g, ''),
                message: mensagemPersonalizada,
              }),
            }
          );

          if (wapiResponse.ok) {
            enviados++;
            await supabase
              .from('campanhas_destinatarios')
              .update({ enviado: true, enviado_em: new Date().toISOString() })
              .eq('campanha_id', campanha.id)
              .eq('cliente_telefone', dest.telefone);
          } else {
            erros++;
          }

          // Delay entre mensagens para evitar bloqueio
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch {
          erros++;
        }
      }

      // Atualizar status final
      await supabase
        .from('campanhas')
        .update({
          enviada: true,
          enviada_em: new Date().toISOString(),
          total_enviados: enviados,
          total_erros: erros,
        })
        .eq('id', campanha.id);

      toast({
        title: 'Campanha enviada!',
        description: `${enviados} mensagens enviadas, ${erros} erros`,
      });

      loadData();
    } catch {
      toast({ title: 'Erro ao enviar campanha', variant: 'destructive' });
    }

    setIsSending(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('campanhas').delete().eq('id', id);
    toast({ title: 'Campanha excluída!' });
    loadData();
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'promocao': return 'Promoção';
      case 'retorno': return 'Retorno';
      case 'aniversario': return 'Aniversário';
      case 'personalizado': return 'Personalizado';
      default: return tipo;
    }
  };

  if (isLoading) return <LoadingSpinner message="Carregando campanhas..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Campanhas de Marketing</h2>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> Nova
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Campanha</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome da Campanha *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Promoção de Natal"
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(v) => setFormData({ ...formData, tipo: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="promocao">Promoção Geral</SelectItem>
                    <SelectItem value="retorno">Retorno de Clientes</SelectItem>
                    <SelectItem value="aniversario">Aniversariantes</SelectItem>
                    <SelectItem value="personalizado">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.tipo === 'retorno' && (
                <div>
                  <Label>Clientes inativos há (dias)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.filtro_dias_inativo}
                    onChange={(e) => setFormData({ ...formData, filtro_dias_inativo: Number(e.target.value) })}
                  />
                </div>
              )}
              <div>
                <Label>Cupom (opcional)</Label>
                <Select
                  value={formData.cupom_id}
                  onValueChange={(v) => setFormData({ ...formData, cupom_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem cupom" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {cupons.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo} ({c.tipo === 'percentual' ? `${c.valor}%` : `R$${c.valor}`})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mensagem *</Label>
                <Textarea
                  value={formData.mensagem}
                  onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
                  placeholder="Olá {nome}! Temos uma promoção especial..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use {'{nome}'} para personalizar com o nome do cliente
                </p>
              </div>
              <Button className="w-full" onClick={handleSubmit}>Criar Campanha</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {campanhas.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhuma campanha"
          description="Crie campanhas para engajar seus clientes"
        />
      ) : (
        <div className="space-y-3">
          {campanhas.map((camp) => (
            <div key={camp.id} className="card-premium p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{camp.nome}</span>
                    <span className="text-xs bg-secondary px-2 py-0.5 rounded">
                      {getTipoLabel(camp.tipo)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {camp.mensagem}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {camp.enviada ? (
                      <>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {camp.total_enviados}/{camp.total_destinatarios}
                        </span>
                        <span>
                          Enviada em {format(new Date(camp.enviada_em!), 'dd/MM/yyyy HH:mm')}
                        </span>
                      </>
                    ) : (
                      <span className="flex items-center gap-1 text-yellow-600">
                        <Clock className="w-3 h-3" />
                        Pendente
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!camp.enviada && (
                    <Button
                      size="sm"
                      onClick={() => handleEnviar(camp)}
                      disabled={isSending}
                    >
                      <Send className="w-3 h-3 mr-1" />
                      Enviar
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(camp.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}