import { useState, useEffect } from 'react';
import { Image, Plus, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import type { GaleriaItem } from '@/types';

export function GaleriaView() {
  const [items, setItems] = useState<GaleriaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    cliente_nome: '',
    servico: '',
    foto_antes_url: '',
    foto_depois_url: '',
    destaque: false,
  });

  useEffect(() => {
    loadGaleria();
  }, []);

  const loadGaleria = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('galeria')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      toast({ title: 'Erro ao carregar galeria', variant: 'destructive' });
    } else {
      setItems(data || []);
    }
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.titulo.trim() || !formData.foto_depois_url.trim()) {
      toast({ title: 'Título e foto depois são obrigatórios', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('galeria').insert(formData);
    
    if (error) {
      toast({ title: 'Erro ao adicionar', variant: 'destructive' });
    } else {
      toast({ title: 'Trabalho adicionado!' });
      loadGaleria();
      setIsDialogOpen(false);
      setFormData({
        titulo: '',
        descricao: '',
        cliente_nome: '',
        servico: '',
        foto_antes_url: '',
        foto_depois_url: '',
        destaque: false,
      });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('galeria').delete().eq('id', id);
    if (!error) {
      toast({ title: 'Trabalho removido!' });
      loadGaleria();
    }
  };

  const toggleDestaque = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from('galeria')
      .update({ destaque: !current })
      .eq('id', id);
    if (!error) loadGaleria();
  };

  if (isLoading) return <LoadingSpinner message="Carregando galeria..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Galeria de Trabalhos</h2>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Trabalho</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título *</Label>
                <Input
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Ex: Degradê com risco"
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descrição do trabalho..."
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cliente</Label>
                  <Input
                    value={formData.cliente_nome}
                    onChange={(e) => setFormData({ ...formData, cliente_nome: e.target.value })}
                    placeholder="Nome"
                  />
                </div>
                <div>
                  <Label>Serviço</Label>
                  <Input
                    value={formData.servico}
                    onChange={(e) => setFormData({ ...formData, servico: e.target.value })}
                    placeholder="Corte"
                  />
                </div>
              </div>
              <div>
                <Label>URL Foto ANTES</Label>
                <Input
                  value={formData.foto_antes_url}
                  onChange={(e) => setFormData({ ...formData, foto_antes_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label>URL Foto DEPOIS *</Label>
                <Input
                  value={formData.foto_depois_url}
                  onChange={(e) => setFormData({ ...formData, foto_depois_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Destacar na página pública</Label>
                <Switch
                  checked={formData.destaque}
                  onCheckedChange={(v) => setFormData({ ...formData, destaque: v })}
                />
              </div>
              <Button className="w-full" onClick={handleSubmit}>Adicionar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Image}
          title="Galeria vazia"
          description="Adicione fotos dos seus trabalhos"
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <div key={item.id} className="card-premium overflow-hidden">
              <div className="relative aspect-square">
                <img
                  src={item.foto_depois_url}
                  alt={item.titulo}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder.svg';
                  }}
                />
                {item.destaque && (
                  <div className="absolute top-2 left-2 bg-primary rounded-full p-1">
                    <Star className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-sm truncate">{item.titulo}</h3>
                {item.servico && (
                  <p className="text-xs text-muted-foreground">{item.servico}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => toggleDestaque(item.id, item.destaque)}
                  >
                    <Star className={`w-4 h-4 ${item.destaque ? 'text-primary fill-primary' : ''}`} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleDelete(item.id)}
                  >
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