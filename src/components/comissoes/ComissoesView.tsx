import { useState, useEffect } from 'react';
import { DollarSign, Plus, Check } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Comissao, Profissional } from '@/types';

export function ComissoesView() {
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [filterProfissional, setFilterProfissional] = useState<string>('todos');
  const [formData, setFormData] = useState({
    profissional_id: '',
    servico: '',
    valor_servico: 0,
    percentual: 50,
    cliente_nome: '',
    data: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    loadData();
  }, [selectedMonth, filterProfissional]);

  const loadData = async () => {
    setIsLoading(true);
    
    const [year, month] = selectedMonth.split('-').map(Number);
    const start = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
    const end = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');

    const { data: profs } = await supabase
      .from('profissionais')
      .select('*')
      .order('nome');
    setProfissionais(profs || []);

    let query = supabase
      .from('comissoes')
      .select('*')
      .gte('data', start)
      .lte('data', end)
      .order('data', { ascending: false });

    if (filterProfissional !== 'todos') {
      query = query.eq('profissional_id', filterProfissional);
    }

    const { data: coms, error } = await query;
    if (error) {
      toast({ title: 'Erro ao carregar comissões', variant: 'destructive' });
    } else {
      // Enrich with profissional data
      const enriched = (coms || []).map(c => ({
        ...c,
        profissional: profs?.find(p => p.id === c.profissional_id),
      }));
      setComissoes(enriched);
    }
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.profissional_id || !formData.servico || formData.valor_servico <= 0) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    const valor_comissao = (formData.valor_servico * formData.percentual) / 100;

    const { error } = await supabase.from('comissoes').insert({
      ...formData,
      valor_comissao,
    });

    if (error) {
      toast({ title: 'Erro ao registrar comissão', variant: 'destructive' });
    } else {
      toast({ title: 'Comissão registrada!' });
      loadData();
      setIsDialogOpen(false);
      setFormData({
        profissional_id: '',
        servico: '',
        valor_servico: 0,
        percentual: 50,
        cliente_nome: '',
        data: format(new Date(), 'yyyy-MM-dd'),
      });
    }
  };

  const handleMarcarPago = async (id: string) => {
    const { error } = await supabase
      .from('comissoes')
      .update({ pago: true, pago_em: new Date().toISOString() })
      .eq('id', id);
    
    if (!error) {
      toast({ title: 'Marcado como pago!' });
      loadData();
    }
  };

  const totalComissoes = comissoes.reduce((acc, c) => acc + Number(c.valor_comissao), 0);
  const totalPendente = comissoes.filter(c => !c.pago).reduce((acc, c) => acc + Number(c.valor_comissao), 0);

  if (isLoading) return <LoadingSpinner message="Carregando comissões..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Comissões</h2>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> Registrar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Comissão</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Profissional *</Label>
                <Select
                  value={formData.profissional_id}
                  onValueChange={(v) => {
                    const prof = profissionais.find(p => p.id === v);
                    setFormData({
                      ...formData,
                      profissional_id: v,
                      percentual: prof?.comissao_padrao || 50,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {profissionais.filter(p => p.ativo).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Serviço *</Label>
                <Input
                  value={formData.servico}
                  onChange={(e) => setFormData({ ...formData, servico: e.target.value })}
                  placeholder="Ex: Corte + Barba"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor do Serviço (R$) *</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={formData.valor_servico}
                    onChange={(e) => setFormData({ ...formData, valor_servico: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Comissão (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={formData.percentual}
                    onChange={(e) => setFormData({ ...formData, percentual: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <Label>Cliente</Label>
                <Input
                  value={formData.cliente_nome}
                  onChange={(e) => setFormData({ ...formData, cliente_nome: e.target.value })}
                  placeholder="Nome do cliente (opcional)"
                />
              </div>
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                />
              </div>
              <div className="p-3 bg-primary/10 rounded-lg text-center">
                <span className="text-sm text-muted-foreground">Valor da comissão: </span>
                <span className="font-bold text-primary">
                  R$ {((formData.valor_servico * formData.percentual) / 100).toFixed(2)}
                </span>
              </div>
              <Button className="w-full" onClick={handleSubmit}>Registrar Comissão</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-40"
        />
        <Select value={filterProfissional} onValueChange={setFilterProfissional}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {profissionais.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card-premium p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Comissões</p>
          <p className="text-lg font-bold text-primary">R$ {totalComissoes.toFixed(2)}</p>
        </div>
        <div className="card-premium p-3 text-center">
          <p className="text-xs text-muted-foreground">Pendente</p>
          <p className="text-lg font-bold text-destructive">R$ {totalPendente.toFixed(2)}</p>
        </div>
      </div>

      {/* Lista */}
      {comissoes.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="Nenhuma comissão"
          description="Registre comissões dos atendimentos"
        />
      ) : (
        <div className="space-y-2">
          {comissoes.map((c) => (
            <div key={c.id} className={`card-premium p-3 ${c.pago ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{c.profissional?.nome || 'Profissional'}</span>
                    {c.pago && <Check className="w-4 h-4 text-green-500" />}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {c.servico} {c.cliente_nome && `• ${c.cliente_nome}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(c.data), 'dd/MM/yyyy')} • R$ {Number(c.valor_servico).toFixed(2)} × {c.percentual}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary">R$ {Number(c.valor_comissao).toFixed(2)}</p>
                  {!c.pago && (
                    <Button size="sm" variant="outline" onClick={() => handleMarcarPago(c.id)}>
                      Pagar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}