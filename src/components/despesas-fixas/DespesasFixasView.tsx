import { useState, useEffect } from 'react';
import { Receipt, Plus, Edit2, Trash2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import type { DespesaFixa } from '@/types';

export function DespesasFixasView() {
  const [despesas, setDespesas] = useState<DespesaFixa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    valor: 0,
    dia_vencimento: 1,
    categoria: '',
    observacoes: '',
    ativo: true,
  });

  useEffect(() => {
    loadDespesas();
  }, []);

  const loadDespesas = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('despesas_fixas')
      .select('*')
      .order('dia_vencimento');
    
    if (error) {
      toast({ title: 'Erro ao carregar despesas', variant: 'destructive' });
    } else {
      setDespesas(data || []);
    }
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim() || formData.valor <= 0) {
      toast({ title: 'Nome e valor são obrigatórios', variant: 'destructive' });
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from('despesas_fixas')
        .update(formData)
        .eq('id', editingId);
      
      if (error) {
        toast({ title: 'Erro ao atualizar', variant: 'destructive' });
      } else {
        toast({ title: 'Despesa atualizada!' });
        loadDespesas();
      }
    } else {
      const { error } = await supabase.from('despesas_fixas').insert(formData);
      
      if (error) {
        toast({ title: 'Erro ao criar', variant: 'destructive' });
      } else {
        toast({ title: 'Despesa cadastrada!' });
        loadDespesas();
      }
    }

    resetForm();
  };

  const handleEdit = (desp: DespesaFixa) => {
    setEditingId(desp.id);
    setFormData({
      nome: desp.nome,
      valor: desp.valor,
      dia_vencimento: desp.dia_vencimento,
      categoria: desp.categoria || '',
      observacoes: desp.observacoes || '',
      ativo: desp.ativo,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('despesas_fixas').delete().eq('id', id);
    if (!error) {
      toast({ title: 'Despesa excluída!' });
      loadDespesas();
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      nome: '',
      valor: 0,
      dia_vencimento: 1,
      categoria: '',
      observacoes: '',
      ativo: true,
    });
    setIsDialogOpen(false);
  };

  const totalMensal = despesas
    .filter(d => d.ativo)
    .reduce((acc, d) => acc + Number(d.valor), 0);

  if (isLoading) return <LoadingSpinner message="Carregando despesas..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Despesas Fixas</h2>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={resetForm}>
              <Plus className="w-4 h-4 mr-1" /> Nova
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar' : 'Nova'} Despesa Fixa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Aluguel, Luz, Internet..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor (R$) *</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Dia Vencimento</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={formData.dia_vencimento}
                    onChange={(e) => setFormData({ ...formData, dia_vencimento: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <Label>Categoria</Label>
                <Input
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  placeholder="Infraestrutura, Serviços..."
                />
              </div>
              <div>
                <Label>Observações</Label>
                <Input
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Notas adicionais"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativa</Label>
                <Switch
                  checked={formData.ativo}
                  onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
                />
              </div>
              <Button className="w-full" onClick={handleSubmit}>
                {editingId ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Total Mensal */}
      <div className="card-premium p-4 text-center">
        <p className="text-sm text-muted-foreground">Total Mensal em Despesas Fixas</p>
        <p className="text-2xl font-bold text-destructive">R$ {totalMensal.toFixed(2)}</p>
      </div>

      {despesas.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhuma despesa"
          description="Cadastre suas despesas fixas mensais"
        />
      ) : (
        <div className="space-y-2">
          {despesas.map((desp) => (
            <div key={desp.id} className={`card-premium p-4 ${!desp.ativo ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{desp.nome}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>Dia {desp.dia_vencimento}</span>
                    {desp.categoria && (
                      <>
                        <span>•</span>
                        <span>{desp.categoria}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-destructive">
                    R$ {Number(desp.valor).toFixed(2)}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(desp)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(desp.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}