import { useState, useEffect } from 'react';
import { Ticket, Plus, Edit2, Trash2, Copy, Percent, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Cupom } from '@/types';

export function CuponsView() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    codigo: '',
    tipo: 'percentual' as 'percentual' | 'valor_fixo',
    valor: 10,
    descricao: '',
    quantidade_maxima: null as number | null,
    valido_ate: '',
    primeira_visita: false,
    aniversariante: false,
    ativo: true,
  });

  useEffect(() => {
    loadCupons();
  }, []);

  const loadCupons = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('cupons')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      toast({ title: 'Erro ao carregar cupons', variant: 'destructive' });
    } else {
      setCupons((data || []) as Cupom[]);
    }
    setIsLoading(false);
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, codigo: code });
  };

  const handleSubmit = async () => {
    if (!formData.codigo.trim() || formData.valor <= 0) {
      toast({ title: 'Código e valor são obrigatórios', variant: 'destructive' });
      return;
    }

    const payload = {
      ...formData,
      codigo: formData.codigo.toUpperCase(),
      valido_ate: formData.valido_ate || null,
      quantidade_maxima: formData.quantidade_maxima || null,
    };

    if (editingId) {
      const { error } = await supabase.from('cupons').update(payload).eq('id', editingId);
      if (error) {
        toast({ title: 'Erro ao atualizar', variant: 'destructive' });
      } else {
        toast({ title: 'Cupom atualizado!' });
        loadCupons();
      }
    } else {
      const { error } = await supabase.from('cupons').insert(payload);
      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Este código já existe', variant: 'destructive' });
        } else {
          toast({ title: 'Erro ao criar', variant: 'destructive' });
        }
      } else {
        toast({ title: 'Cupom criado!' });
        loadCupons();
      }
    }

    resetForm();
  };

  const handleEdit = (cupom: Cupom) => {
    setEditingId(cupom.id);
    setFormData({
      codigo: cupom.codigo,
      tipo: cupom.tipo,
      valor: cupom.valor,
      descricao: cupom.descricao || '',
      quantidade_maxima: cupom.quantidade_maxima,
      valido_ate: cupom.valido_ate || '',
      primeira_visita: cupom.primeira_visita,
      aniversariante: cupom.aniversariante,
      ativo: cupom.ativo,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('cupons').delete().eq('id', id);
    if (!error) {
      toast({ title: 'Cupom excluído!' });
      loadCupons();
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Código copiado!' });
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      codigo: '',
      tipo: 'percentual',
      valor: 10,
      descricao: '',
      quantidade_maxima: null,
      valido_ate: '',
      primeira_visita: false,
      aniversariante: false,
      ativo: true,
    });
    setIsDialogOpen(false);
  };

  if (isLoading) return <LoadingSpinner message="Carregando cupons..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Cupons e Promoções</h2>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={resetForm}>
              <Plus className="w-4 h-4 mr-1" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar' : 'Novo'} Cupom</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Código *</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                    placeholder="DESCONTO10"
                    className="uppercase"
                  />
                  <Button variant="outline" onClick={generateCode}>Gerar</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                      <SelectItem value="percentual">Percentual (%)</SelectItem>
                      <SelectItem value="valor_fixo">Valor Fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor *</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Input
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Promoção de inauguração"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Limite de usos</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.quantidade_maxima || ''}
                    onChange={(e) => setFormData({ ...formData, quantidade_maxima: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Ilimitado"
                  />
                </div>
                <div>
                  <Label>Válido até</Label>
                  <Input
                    type="date"
                    value={formData.valido_ate}
                    onChange={(e) => setFormData({ ...formData, valido_ate: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Apenas primeira visita</Label>
                  <Switch
                    checked={formData.primeira_visita}
                    onCheckedChange={(v) => setFormData({ ...formData, primeira_visita: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Apenas aniversariantes</Label>
                  <Switch
                    checked={formData.aniversariante}
                    onCheckedChange={(v) => setFormData({ ...formData, aniversariante: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Ativo</Label>
                  <Switch
                    checked={formData.ativo}
                    onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
                  />
                </div>
              </div>
              <Button className="w-full" onClick={handleSubmit}>
                {editingId ? 'Salvar' : 'Criar Cupom'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {cupons.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="Nenhum cupom"
          description="Crie cupons de desconto para seus clientes"
        />
      ) : (
        <div className="space-y-3">
          {cupons.map((cupom) => (
            <div key={cupom.id} className={`card-premium p-4 ${!cupom.ativo ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary">{cupom.codigo}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyCode(cupom.codigo)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {cupom.tipo === 'percentual' ? (
                      <span className="flex items-center text-sm font-semibold">
                        <Percent className="w-3 h-3 mr-1" />{cupom.valor}%
                      </span>
                    ) : (
                      <span className="flex items-center text-sm font-semibold">
                        <DollarSign className="w-3 h-3" />R$ {cupom.valor}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {cupom.quantidade_usada}/{cupom.quantidade_maxima || '∞'} usos
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {cupom.primeira_visita && (
                      <span className="text-xs bg-secondary px-2 py-0.5 rounded">1ª visita</span>
                    )}
                    {cupom.aniversariante && (
                      <span className="text-xs bg-secondary px-2 py-0.5 rounded">Aniversário</span>
                    )}
                    {cupom.valido_ate && (
                      <span className="text-xs text-muted-foreground">
                        até {format(new Date(cupom.valido_ate), 'dd/MM/yyyy')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(cupom)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(cupom.id)}>
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