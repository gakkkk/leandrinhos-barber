import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, Minus, AlertTriangle, Trash2, Pencil } from 'lucide-react';
import { Estoque } from '@/types';
import { fetchEstoque, createEstoque, updateEstoque, deleteEstoque } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function EstoqueView() {
  const [itens, setItens] = useState<Estoque[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Estoque | null>(null);

  // Form state
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('0');
  const [quantidadeMinima, setQuantidadeMinima] = useState('5');
  const [precoCusto, setPrecoCusto] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [categoria, setCategoria] = useState('');

  useEffect(() => {
    loadEstoque();
  }, []);

  const loadEstoque = async () => {
    setIsLoading(true);
    const result = await fetchEstoque();
    if (result.data) {
      setItens(result.data);
    }
    setIsLoading(false);
  };

  const resetForm = () => {
    setNome('');
    setQuantidade('0');
    setQuantidadeMinima('5');
    setPrecoCusto('');
    setPrecoVenda('');
    setCategoria('');
    setEditando(null);
  };

  const handleOpenDialog = (item?: Estoque) => {
    if (item) {
      setEditando(item);
      setNome(item.nome);
      setQuantidade(item.quantidade.toString());
      setQuantidadeMinima(item.quantidade_minima.toString());
      setPrecoCusto(item.preco_custo?.toString() || '');
      setPrecoVenda(item.preco_venda?.toString() || '');
      setCategoria(item.categoria || '');
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!nome) {
      toast({ title: 'Informe o nome do produto', variant: 'destructive' });
      return;
    }

    const data = {
      nome,
      quantidade: parseInt(quantidade) || 0,
      quantidade_minima: parseInt(quantidadeMinima) || 5,
      preco_custo: precoCusto ? parseFloat(precoCusto) : undefined,
      preco_venda: precoVenda ? parseFloat(precoVenda) : undefined,
      categoria: categoria || undefined,
    };

    let result;
    if (editando) {
      result = await updateEstoque(editando.id, data);
    } else {
      result = await createEstoque(data);
    }

    if (result.error) {
      toast({ title: 'Erro ao salvar', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: editando ? 'Produto atualizado!' : 'Produto adicionado!' });
      setDialogOpen(false);
      resetForm();
      loadEstoque();
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteEstoque(id);
    if (result.error) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    } else {
      toast({ title: 'Produto excluído' });
      loadEstoque();
    }
  };

  const handleAjustarQuantidade = async (item: Estoque, delta: number) => {
    const novaQuantidade = Math.max(0, item.quantidade + delta);
    const result = await updateEstoque(item.id, { quantidade: novaQuantidade });
    if (result.error) {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    } else {
      loadEstoque();
    }
  };

  const itensBaixoEstoque = itens.filter(item => item.quantidade <= item.quantidade_minima);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Controle de Estoque</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4" />
              Novo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editando ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome do Produto *</Label>
                <Input
                  placeholder="Ex: Pomada modeladora"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Qtd. Mínima</Label>
                  <Input
                    type="number"
                    value={quantidadeMinima}
                    onChange={(e) => setQuantidadeMinima(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preço Custo (R$)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={precoCusto}
                    onChange={(e) => setPrecoCusto(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço Venda (R$)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={precoVenda}
                    onChange={(e) => setPrecoVenda(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Categoria (opcional)</Label>
                <Input
                  placeholder="Ex: Finalizadores"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                />
              </div>

              <Button onClick={handleSubmit} className="w-full">
                {editando ? 'Salvar Alterações' : 'Adicionar Produto'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alerta de estoque baixo */}
      {itensBaixoEstoque.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-foreground">{itensBaixoEstoque.length} produto(s) precisam de reposição</p>
              <p className="text-xs text-muted-foreground">
                {itensBaixoEstoque.map(i => i.nome).join(', ')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de produtos */}
      <div className="space-y-2">
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : itens.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Nenhum produto cadastrado</p>
          </div>
        ) : (
          itens.map((item) => {
            const estoqueBaixo = item.quantidade <= item.quantidade_minima;
            return (
              <Card key={item.id} className={cn(estoqueBaixo && "border-amber-500/30")}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center",
                        estoqueBaixo ? "bg-amber-500/20" : "bg-primary/10"
                      )}>
                        <Package className={cn("h-5 w-5", estoqueBaixo ? "text-amber-600" : "text-primary")} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{item.nome}</p>
                          {estoqueBaixo && (
                            <Badge variant="outline" className="text-amber-600 border-amber-600/30 text-xs">
                              Baixo
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {item.categoria && <span>{item.categoria}</span>}
                          {item.preco_venda && <span>• R$ {item.preco_venda.toFixed(2)}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleAjustarQuantidade(item, -1)}
                        disabled={item.quantidade === 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className={cn(
                        "min-w-[40px] text-center font-bold",
                        estoqueBaixo ? "text-amber-600" : "text-foreground"
                      )}>
                        {item.quantidade}
                      </span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleAjustarQuantidade(item, 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-border/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleOpenDialog(item)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item.id)}
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
