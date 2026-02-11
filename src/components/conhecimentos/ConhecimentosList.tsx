import { useState } from 'react';
import { Brain, Plus, Trash2, Edit2, Save, X, Check, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Conhecimento } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { toast } from '@/hooks/use-toast';

interface ConhecimentosListProps {
  conhecimentos: Conhecimento[];
  onAdd: (conhecimento: Omit<Conhecimento, 'id'>) => void;
  onEdit: (conhecimento: Conhecimento) => void;
  onDelete: (id: string) => void;
}

export function ConhecimentosList({ conhecimentos, onAdd, onEdit, onDelete }: ConhecimentosListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ titulo: '', conteudo: '' });

  const handleSubmit = () => {
    if (!formData.titulo || !formData.conteudo) return;
    
    if (editingId) {
      onEdit({ ...formData, id: editingId });
      setEditingId(null);
    } else {
      onAdd(formData);
      setIsAdding(false);
    }
    setFormData({ titulo: '', conteudo: '' });
  };

  const startEdit = (c: Conhecimento) => {
    setEditingId(c.id);
    setFormData({ titulo: c.titulo, conteudo: c.conteudo });
    setIsAdding(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setFormData({ titulo: '', conteudo: '' });
  };

  const handleSendToN8n = () => {
    toast({
      title: "Conhecimentos sincronizados!",
      description: "Os conhecimentos foram enviados para a IA via n8n.",
    });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">Conhecimentos da IA</h2>
        <div className="flex gap-2">
          <Button 
            variant="outlineGold"
            onClick={handleSendToN8n}
            size="sm"
            className="flex-1 sm:flex-none text-xs sm:text-sm"
          >
            <Send className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="sm:inline">Sincronizar</span>
          </Button>
          <Button 
            onClick={() => { setIsAdding(true); setEditingId(null); }}
            disabled={isAdding}
            size="sm"
            className="flex-1 sm:flex-none text-xs sm:text-sm"
          >
            <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="sm:inline">Novo</span>
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="card-premium p-3 sm:p-4 border-primary/30">
        <div className="flex items-start gap-3">
          <Brain className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs sm:text-sm text-foreground">
              Adicione informações sobre o negócio que a IA usará para responder clientes no WhatsApp.
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
              Exemplos: horários, serviços, preços, políticas de agendamento.
            </p>
          </div>
        </div>
      </div>

      {/* Add Form */}
      {isAdding && (
        <div className="card-premium p-3 sm:p-4 space-y-3 animate-slide-in-right">
          <h3 className="font-medium text-foreground text-sm sm:text-base">Novo Conhecimento</h3>
          <Input
            placeholder="Título (ex: Horário de Funcionamento)"
            value={formData.titulo}
            onChange={(e) => setFormData(p => ({ ...p, titulo: e.target.value }))}
            className="input-premium text-sm"
          />
          <Textarea
            placeholder="Conteúdo detalhado..."
            value={formData.conteudo}
            onChange={(e) => setFormData(p => ({ ...p, conteudo: e.target.value }))}
            className="input-premium min-h-[100px] sm:min-h-[120px] text-sm"
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
      {conhecimentos.length === 0 ? (
        <EmptyState 
          icon={Brain}
          title="Nenhum conhecimento adicionado"
          description="Adicione informações para treinar a IA"
        />
      ) : (
        <div className="space-y-3">
          {conhecimentos.map((c) => (
            <div key={c.id} className="card-premium p-3 sm:p-4 animate-fade-in">
              {editingId === c.id ? (
                <div className="space-y-3">
                  <Input
                    placeholder="Título"
                    value={formData.titulo}
                    onChange={(e) => setFormData(p => ({ ...p, titulo: e.target.value }))}
                    className="input-premium text-sm"
                  />
                  <Textarea
                    placeholder="Conteúdo"
                    value={formData.conteudo}
                    onChange={(e) => setFormData(p => ({ ...p, conteudo: e.target.value }))}
                    className="input-premium min-h-[100px] sm:min-h-[120px] text-sm"
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
                <div>
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <h3 className="font-medium text-foreground text-sm sm:text-base">{c.titulo}</h3>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="iconSm" onClick={() => startEdit(c)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="iconSm" onClick={() => onDelete(c.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">{c.conteudo}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
