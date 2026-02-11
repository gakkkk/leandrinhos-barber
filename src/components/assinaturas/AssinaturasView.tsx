import { useState, useEffect } from 'react';
import { Plus, CreditCard, User, Calendar, Trash2, X, Check, Pause, Play, Search, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Assinatura, PlanoAssinatura, AssinaturaUso } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

export function AssinaturasView() {
  const [planos, setPlanos] = useState<PlanoAssinatura[]>([]);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [_usos, setUsos] = useState<AssinaturaUso[]>([]);
  const [search, setSearch] = useState('');
  const [isAddingPlano, setIsAddingPlano] = useState(false);
  const [isAddingAssinatura, setIsAddingAssinatura] = useState(false);
  const [_isLoading, setIsLoading] = useState(true);
  
  const [planoForm, setPlanoForm] = useState({
    nome: '',
    descricao: '',
    preco: '',
    quantidade_servicos_mes: '4',
  });
  
  const [assinaturaForm, setAssinaturaForm] = useState({
    cliente_nome: '',
    cliente_telefone: '',
    plano_id: '',
    data_vencimento: '',
    observacoes: '',
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [planosRes, assinaturasRes, usosRes] = await Promise.all([
        supabase.from('planos_assinatura').select('*').order('nome'),
        supabase.from('assinaturas').select('*').order('created_at', { ascending: false }),
        supabase.from('assinatura_uso').select('*').order('data_uso', { ascending: false }).limit(100),
      ]);

      if (planosRes.data) setPlanos(planosRes.data as any);
      if (assinaturasRes.data) setAssinaturas(assinaturasRes.data as any);
      if (usosRes.data) setUsos(usosRes.data as any);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddPlano = async () => {
    if (!planoForm.nome || !planoForm.preco) return;
    
    try {
      const { error } = await supabase.from('planos_assinatura').insert({
        nome: planoForm.nome,
        descricao: planoForm.descricao || null,
        preco: parseFloat(planoForm.preco),
        quantidade_servicos_mes: parseInt(planoForm.quantidade_servicos_mes) || 4,
      });

      if (error) throw error;
      
      toast({ title: "Plano criado!" });
      setPlanoForm({ nome: '', descricao: '', preco: '', quantidade_servicos_mes: '4' });
      setIsAddingPlano(false);
      fetchData();
    } catch (err) {
      toast({ title: "Erro ao criar plano", variant: "destructive" });
    }
  };

  const handleAddAssinatura = async () => {
    if (!assinaturaForm.cliente_nome || !assinaturaForm.plano_id) return;
    
    try {
      const { error } = await supabase.from('assinaturas').insert({
        cliente_nome: assinaturaForm.cliente_nome,
        cliente_telefone: assinaturaForm.cliente_telefone || null,
        plano_id: assinaturaForm.plano_id,
        data_vencimento: assinaturaForm.data_vencimento || null,
        observacoes: assinaturaForm.observacoes || null,
      });

      if (error) throw error;
      
      toast({ title: "Assinatura criada!" });
      setAssinaturaForm({ cliente_nome: '', cliente_telefone: '', plano_id: '', data_vencimento: '', observacoes: '' });
      setIsAddingAssinatura(false);
      fetchData();
    } catch (err) {
      toast({ title: "Erro ao criar assinatura", variant: "destructive" });
    }
  };

  const handleToggleStatus = async (assinatura: Assinatura) => {
    const newStatus = assinatura.status === 'ativa' ? 'pausada' : 'ativa';
    
    try {
      const { error } = await supabase
        .from('assinaturas')
        .update({ status: newStatus })
        .eq('id', assinatura.id);

      if (error) throw error;
      
      toast({ title: newStatus === 'ativa' ? "Assinatura reativada!" : "Assinatura pausada" });
      fetchData();
    } catch (err) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
  };

  const handleCancelar = async (id: string) => {
    try {
      const { error } = await supabase
        .from('assinaturas')
        .update({ status: 'cancelada' })
        .eq('id', id);

      if (error) throw error;
      
      toast({ title: "Assinatura cancelada" });
      fetchData();
    } catch (err) {
      toast({ title: "Erro ao cancelar", variant: "destructive" });
    }
  };

  const handleDeletePlano = async (id: string) => {
    try {
      const { error } = await supabase.from('planos_assinatura').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Plano removido!" });
      fetchData();
    } catch (err) {
      toast({ title: "Erro ao remover plano", variant: "destructive" });
    }
  };

  const filteredAssinaturas = assinaturas.filter(a => 
    a.cliente_nome.toLowerCase().includes(search.toLowerCase())
  );

  const getPlanoByAssinatura = (assinatura: Assinatura) => 
    planos.find(p => p.id === assinatura.plano_id);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativa': return 'bg-success/20 text-success border-success/30';
      case 'pausada': return 'bg-warning/20 text-warning border-warning/30';
      case 'cancelada': return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'vencida': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-secondary text-foreground border-border';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary" />
          Clube de Assinatura
        </h2>
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsAddingPlano(true)}
            disabled={isAddingPlano}
            size="sm"
            variant="outline"
          >
            <Plus className="w-4 h-4" />
            Plano
          </Button>
          <Button 
            onClick={() => setIsAddingAssinatura(true)}
            disabled={isAddingAssinatura}
            size="sm"
          >
            <Plus className="w-4 h-4" />
            Assinatura
          </Button>
        </div>
      </div>

      {/* Planos Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Planos Disponíveis</h3>
        
        {isAddingPlano && (
          <div className="card-premium p-4 space-y-3 animate-slide-in-right">
            <h4 className="font-medium text-foreground">Novo Plano</h4>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Nome do plano"
                value={planoForm.nome}
                onChange={(e) => setPlanoForm(p => ({ ...p, nome: e.target.value }))}
              />
              <Input
                placeholder="Preço mensal (R$)"
                type="number"
                value={planoForm.preco}
                onChange={(e) => setPlanoForm(p => ({ ...p, preco: e.target.value }))}
              />
            </div>
            <Input
              placeholder="Descrição (opcional)"
              value={planoForm.descricao}
              onChange={(e) => setPlanoForm(p => ({ ...p, descricao: e.target.value }))}
            />
            <Input
              placeholder="Serviços por mês"
              type="number"
              value={planoForm.quantidade_servicos_mes}
              onChange={(e) => setPlanoForm(p => ({ ...p, quantidade_servicos_mes: e.target.value }))}
            />
            <div className="flex gap-2">
              <Button onClick={handleAddPlano} size="sm" className="flex-1">
                <Check className="w-4 h-4" /> Salvar
              </Button>
              <Button variant="outline" onClick={() => setIsAddingPlano(false)} size="sm">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {planos.map((plano) => (
            <div key={plano.id} className="card-premium p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-foreground">{plano.nome}</h4>
                  {plano.descricao && <p className="text-xs text-muted-foreground">{plano.descricao}</p>}
                </div>
                <Button variant="ghost" size="iconSm" onClick={() => handleDeletePlano(plano.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-primary">R$ {plano.preco.toFixed(2)}</span>
                <span className="text-xs text-muted-foreground">/mês</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {plano.quantidade_servicos_mes} serviço(s) inclusos por mês
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar assinante..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Add Assinatura Form */}
      {isAddingAssinatura && (
        <div className="card-premium p-4 space-y-3 animate-slide-in-right">
          <h4 className="font-medium text-foreground">Nova Assinatura</h4>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Nome do cliente"
              value={assinaturaForm.cliente_nome}
              onChange={(e) => setAssinaturaForm(p => ({ ...p, cliente_nome: e.target.value }))}
            />
            <Input
              placeholder="Telefone"
              value={assinaturaForm.cliente_telefone}
              onChange={(e) => setAssinaturaForm(p => ({ ...p, cliente_telefone: e.target.value }))}
            />
          </div>
          <Select
            value={assinaturaForm.plano_id}
            onValueChange={(v) => setAssinaturaForm(p => ({ ...p, plano_id: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o plano" />
            </SelectTrigger>
            <SelectContent>
              {planos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome} - R$ {p.preco.toFixed(2)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Vencimento</Label>
              <Input
                type="date"
                value={assinaturaForm.data_vencimento}
                onChange={(e) => setAssinaturaForm(p => ({ ...p, data_vencimento: e.target.value }))}
              />
            </div>
          </div>
          <Textarea
            placeholder="Observações (opcional)"
            value={assinaturaForm.observacoes}
            onChange={(e) => setAssinaturaForm(p => ({ ...p, observacoes: e.target.value }))}
            className="min-h-[60px]"
          />
          <div className="flex gap-2">
            <Button onClick={handleAddAssinatura} size="sm" className="flex-1">
              <Check className="w-4 h-4" /> Salvar
            </Button>
            <Button variant="outline" onClick={() => setIsAddingAssinatura(false)} size="sm">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Assinaturas List */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Assinantes ({filteredAssinaturas.length})
        </h3>
        
        {filteredAssinaturas.length === 0 ? (
          <EmptyState 
            icon={CreditCard}
            title="Nenhum assinante"
            description="Adicione o primeiro assinante do clube"
          />
        ) : (
          <div className="space-y-2">
            {filteredAssinaturas.map((assinatura) => {
              const plano = getPlanoByAssinatura(assinatura);
              
              return (
                <div key={assinatura.id} className="card-premium p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">{assinatura.cliente_nome}</h4>
                        {plano && (
                          <p className="text-xs text-primary font-medium">{plano.nome}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={cn("text-xs", getStatusColor(assinatura.status))}>
                            {assinatura.status}
                          </Badge>
                          {plano && (
                            <span className="text-xs text-muted-foreground">
                              {assinatura.servicos_usados_mes}/{plano.quantidade_servicos_mes} usados
                            </span>
                          )}
                        </div>
                        {assinatura.data_vencimento && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Vence: {format(parseISO(assinatura.data_vencimento), "dd/MM/yyyy")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="iconSm" 
                        onClick={() => handleToggleStatus(assinatura)}
                        title={assinatura.status === 'ativa' ? 'Pausar' : 'Reativar'}
                      >
                        {assinatura.status === 'ativa' ? (
                          <Pause className="w-4 h-4 text-warning" />
                        ) : (
                          <Play className="w-4 h-4 text-success" />
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="iconSm" 
                        onClick={() => handleCancelar(assinatura.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}