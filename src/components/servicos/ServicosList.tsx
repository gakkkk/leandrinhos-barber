import { useState } from 'react';
import { Plus, Scissors, Clock, DollarSign, Edit2, Trash2, X, Check, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Servico } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';

interface ServicosListProps {
  servicos: Servico[];
  onAdd: (servico: Omit<Servico, 'id'>) => void;
  onEdit: (servico: Servico) => void;
  onDelete: (id: string) => void;
}

export function ServicosList({ servicos, onAdd, onEdit, onDelete }: ServicosListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nome: '', descricao: '', preco: '', duracao: '' });

  const handleSubmit = () => {
    if (!formData.nome || !formData.preco || !formData.duracao) return;
    
    const data = {
      nome: formData.nome,
      descricao: formData.descricao,
      preco: parseFloat(formData.preco),
      duracao: parseInt(formData.duracao),
    };

    if (editingId) {
      onEdit({ ...data, id: editingId });
      setEditingId(null);
    } else {
      onAdd(data);
      setIsAdding(false);
    }
    setFormData({ nome: '', descricao: '', preco: '', duracao: '' });
  };

  const startEdit = (servico: Servico) => {
    setEditingId(servico.id);
    setFormData({ 
      nome: servico.nome, 
      descricao: servico.descricao || '',
      preco: servico.preco.toString(), 
      duracao: servico.duracao.toString() 
    });
    setIsAdding(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({ nome: '', descricao: '', preco: '', duracao: '' });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-foreground">Serviços</h2>
        <Button 
          onClick={() => { setIsAdding(true); setEditingId(null); }}
          disabled={isAdding}
          size="sm"
        >
          <Plus className="w-4 h-4" />
          Novo
        </Button>
      </div>

      {/* Add Form */}
      {isAdding && (
        <div className="card-premium p-4 space-y-3 animate-slide-in-right">
          <h3 className="font-medium text-foreground">Novo Serviço</h3>
          <Input
            placeholder="Nome do serviço"
            value={formData.nome}
            onChange={(e) => setFormData(p => ({ ...p, nome: e.target.value }))}
            className="input-premium"
          />
          <Textarea
            placeholder="Descrição do serviço (opcional)"
            value={formData.descricao}
            onChange={(e) => setFormData(p => ({ ...p, descricao: e.target.value }))}
            className="input-premium min-h-[80px]"
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="Preço"
                value={formData.preco}
                onChange={(e) => setFormData(p => ({ ...p, preco: e.target.value }))}
                className="input-premium pl-10"
              />
            </div>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="Duração (min)"
                value={formData.duracao}
                onChange={(e) => setFormData(p => ({ ...p, duracao: e.target.value }))}
                className="input-premium pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} size="sm" className="flex-1">
              <Check className="w-4 h-4" /> Salvar
            </Button>
            <Button variant="outline" onClick={cancelEdit} size="sm">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {servicos.length === 0 ? (
        <EmptyState 
          icon={Scissors}
          title="Nenhum serviço cadastrado"
          description="Adicione seu primeiro serviço"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {servicos.map((servico) => (
            <div key={servico.id} className="card-premium p-4 animate-fade-in">
              {editingId === servico.id ? (
                <div className="space-y-3">
                  <Input
                    placeholder="Nome"
                    value={formData.nome}
                    onChange={(e) => setFormData(p => ({ ...p, nome: e.target.value }))}
                    className="input-premium"
                  />
                  <Textarea
                    placeholder="Descrição (opcional)"
                    value={formData.descricao}
                    onChange={(e) => setFormData(p => ({ ...p, descricao: e.target.value }))}
                    className="input-premium min-h-[60px]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      placeholder="Preço"
                      value={formData.preco}
                      onChange={(e) => setFormData(p => ({ ...p, preco: e.target.value }))}
                      className="input-premium"
                    />
                    <Input
                      type="number"
                      placeholder="Duração"
                      value={formData.duracao}
                      onChange={(e) => setFormData(p => ({ ...p, duracao: e.target.value }))}
                      className="input-premium"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSubmit} size="sm" className="flex-1">
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" onClick={cancelEdit} size="sm">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full gradient-gold flex items-center justify-center flex-shrink-0">
                      <Scissors className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground">{servico.nome}</h3>
                      {servico.descricao && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {servico.descricao}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm font-semibold text-primary">
                          {formatPrice(servico.preco)}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {servico.duracao} min
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="iconSm" onClick={() => startEdit(servico)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="iconSm" onClick={() => onDelete(servico.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
