import { useState } from 'react';
import { Plus, Search, User, Phone, Edit2, Trash2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Cliente } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';

interface ClientesListProps {
  clientes: Cliente[];
  onAdd: (cliente: Omit<Cliente, 'id'>) => void;
  onEdit: (cliente: Cliente) => void;
  onDelete: (id: string) => void;
}

export function ClientesList({ clientes, onAdd, onEdit, onDelete }: ClientesListProps) {
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nome: '', telefone: '', observacoes: '' });

  const filteredClientes = clientes.filter(c => 
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.telefone.includes(search)
  );

  const handleSubmit = () => {
    if (!formData.nome || !formData.telefone) return;
    
    if (editingId) {
      onEdit({ ...formData, id: editingId });
      setEditingId(null);
    } else {
      onAdd(formData);
      setIsAdding(false);
    }
    setFormData({ nome: '', telefone: '', observacoes: '' });
  };

  const startEdit = (cliente: Cliente) => {
    setEditingId(cliente.id);
    setFormData({ nome: cliente.nome, telefone: cliente.telefone, observacoes: cliente.observacoes || '' });
    setIsAdding(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({ nome: '', telefone: '', observacoes: '' });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-foreground">Clientes</h2>
        <Button 
          onClick={() => { setIsAdding(true); setEditingId(null); }}
          disabled={isAdding}
          size="sm"
        >
          <Plus className="w-4 h-4" />
          Novo
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 input-premium"
        />
      </div>

      {/* Add Form */}
      {isAdding && (
        <div className="card-premium p-4 space-y-3 animate-slide-in-right">
          <h3 className="font-medium text-foreground">Novo Cliente</h3>
          <Input
            placeholder="Nome"
            value={formData.nome}
            onChange={(e) => setFormData(p => ({ ...p, nome: e.target.value }))}
            className="input-premium"
          />
          <Input
            placeholder="Telefone"
            value={formData.telefone}
            onChange={(e) => setFormData(p => ({ ...p, telefone: e.target.value }))}
            className="input-premium"
          />
          <Textarea
            placeholder="Observações (opcional)"
            value={formData.observacoes}
            onChange={(e) => setFormData(p => ({ ...p, observacoes: e.target.value }))}
            className="input-premium min-h-[80px]"
          />
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
      {filteredClientes.length === 0 ? (
        <EmptyState 
          icon={User}
          title="Nenhum cliente encontrado"
          description={search ? "Tente uma busca diferente" : "Adicione seu primeiro cliente"}
        />
      ) : (
        <div className="space-y-2">
          {filteredClientes.map((cliente) => (
            <div key={cliente.id} className="card-premium p-4 animate-fade-in">
              {editingId === cliente.id ? (
                <div className="space-y-3">
                  <Input
                    placeholder="Nome"
                    value={formData.nome}
                    onChange={(e) => setFormData(p => ({ ...p, nome: e.target.value }))}
                    className="input-premium"
                  />
                  <Input
                    placeholder="Telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData(p => ({ ...p, telefone: e.target.value }))}
                    className="input-premium"
                  />
                  <Textarea
                    placeholder="Observações"
                    value={formData.observacoes}
                    onChange={(e) => setFormData(p => ({ ...p, observacoes: e.target.value }))}
                    className="input-premium min-h-[80px]"
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleSubmit} size="sm" className="flex-1">
                      <Check className="w-4 h-4" /> Salvar
                    </Button>
                    <Button variant="outline" onClick={cancelEdit} size="sm">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{cliente.nome}</h3>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        {cliente.telefone}
                      </div>
                      {cliente.observacoes && (
                        <p className="text-xs text-beige-muted mt-1">{cliente.observacoes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="iconSm" onClick={() => startEdit(cliente)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="iconSm" onClick={() => onDelete(cliente.id)} className="text-destructive hover:text-destructive">
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
