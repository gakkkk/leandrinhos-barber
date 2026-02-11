import { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Profissional } from '@/types';

export function ProfissionaisView() {
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    comissao_padrao: 50,
    pix_chave: '',
    ativo: true,
  });

  useEffect(() => {
    loadProfissionais();
  }, []);

  const loadProfissionais = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('profissionais')
      .select('*')
      .order('nome');
    
    if (error) {
      toast({ title: 'Erro ao carregar profissionais', variant: 'destructive' });
    } else {
      setProfissionais(data || []);
    }
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from('profissionais')
        .update(formData)
        .eq('id', editingId);
      
      if (error) {
        toast({ title: 'Erro ao atualizar', variant: 'destructive' });
      } else {
        toast({ title: 'Profissional atualizado!' });
        loadProfissionais();
      }
    } else {
      const { error } = await supabase
        .from('profissionais')
        .insert(formData);
      
      if (error) {
        toast({ title: 'Erro ao criar', variant: 'destructive' });
      } else {
        toast({ title: 'Profissional cadastrado!' });
        loadProfissionais();
      }
    }

    resetForm();
  };

  const handleEdit = (prof: Profissional) => {
    setEditingId(prof.id);
    setFormData({
      nome: prof.nome,
      telefone: prof.telefone || '',
      email: prof.email || '',
      comissao_padrao: prof.comissao_padrao,
      pix_chave: prof.pix_chave || '',
      ativo: prof.ativo,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('profissionais').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    } else {
      toast({ title: 'Profissional excluído!' });
      loadProfissionais();
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ nome: '', telefone: '', email: '', comissao_padrao: 50, pix_chave: '', ativo: true });
    setIsDialogOpen(false);
  };

  if (isLoading) return <LoadingSpinner message="Carregando profissionais..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Profissionais</h2>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={resetForm}>
              <Plus className="w-4 h-4 mr-1" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar' : 'Novo'} Profissional</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome do profissional"
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <Label>Comissão Padrão (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.comissao_padrao}
                  onChange={(e) => setFormData({ ...formData, comissao_padrao: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Chave PIX</Label>
                <Input
                  value={formData.pix_chave}
                  onChange={(e) => setFormData({ ...formData, pix_chave: e.target.value })}
                  placeholder="CPF, email, telefone ou chave aleatória"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch
                  checked={formData.ativo}
                  onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
                />
              </div>
              <Button className="w-full" onClick={handleSubmit}>
                {editingId ? 'Salvar Alterações' : 'Cadastrar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {profissionais.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum profissional"
          description="Cadastre os profissionais da barbearia"
        />
      ) : (
        <div className="grid gap-3">
          {profissionais.map((prof) => (
            <div
              key={prof.id}
              className={`card-premium p-4 ${!prof.ativo ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{prof.nome}</h3>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Percent className="w-3 h-3" />
                      {prof.comissao_padrao}%
                    </span>
                    {prof.telefone && <span>{prof.telefone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(prof)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(prof.id)}>
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