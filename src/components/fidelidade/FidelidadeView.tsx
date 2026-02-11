import { useState, useEffect } from 'react';
import { Plus, Gift, Star, Settings, Award, Search, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FidelidadeConfig, FidelidadePontos, FidelidadeTransacao } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function FidelidadeView() {
  const [config, setConfig] = useState<FidelidadeConfig | null>(null);
  const [clientes, setClientes] = useState<FidelidadePontos[]>([]);
  const [transacoes, setTransacoes] = useState<FidelidadeTransacao[]>([]);
  const [search, setSearch] = useState('');
  const [isAddingCliente, setIsAddingCliente] = useState(false);
  const [isAddingPontos, setIsAddingPontos] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<FidelidadePontos | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [_isLoading, setIsLoading] = useState(true);
  
  const [clienteForm, setClienteForm] = useState({
    cliente_nome: '',
    cliente_telefone: '',
  });
  
  const [pontosForm, setPontosForm] = useState({
    tipo: 'acumulo' as 'acumulo' | 'resgate' | 'bonus' | 'ajuste',
    pontos: '',
    descricao: '',
    valor_relacionado: '',
  });

  const [configForm, setConfigForm] = useState({
    pontos_por_real: '',
    valor_ponto_resgate: '',
    pontos_minimos_resgate: '',
    validade_pontos_dias: '',
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [configRes, clientesRes, transacoesRes] = await Promise.all([
        supabase.from('fidelidade_config').select('*').limit(1).single(),
        supabase.from('fidelidade_pontos').select('*').order('pontos_acumulados', { ascending: false }),
        supabase.from('fidelidade_transacoes').select('*').order('data_transacao', { ascending: false }).limit(100),
      ]);

      if (configRes.data) {
        setConfig(configRes.data as any);
        setConfigForm({
          pontos_por_real: String(configRes.data.pontos_por_real),
          valor_ponto_resgate: String(configRes.data.valor_ponto_resgate),
          pontos_minimos_resgate: String(configRes.data.pontos_minimos_resgate),
          validade_pontos_dias: String(configRes.data.validade_pontos_dias ?? ''),
        });
      }
      if (clientesRes.data) setClientes(clientesRes.data as any);
      if (transacoesRes.data) setTransacoes(transacoesRes.data as any);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddCliente = async () => {
    if (!clienteForm.cliente_nome) return;
    
    try {
      const { error } = await supabase.from('fidelidade_pontos').insert({
        cliente_nome: clienteForm.cliente_nome,
        cliente_telefone: clienteForm.cliente_telefone || null,
      });

      if (error) throw error;
      
      toast({ title: "Cliente cadastrado!" });
      setClienteForm({ cliente_nome: '', cliente_telefone: '' });
      setIsAddingCliente(false);
      fetchData();
    } catch (err: any) {
      if (err?.message?.includes('unique_cliente_fidelidade')) {
        toast({ title: "Cliente já cadastrado", variant: "destructive" });
      } else {
        toast({ title: "Erro ao cadastrar", variant: "destructive" });
      }
    }
  };

  const handleAddPontos = async () => {
    if (!selectedCliente || !pontosForm.pontos) return;
    
    const pontos = parseInt(pontosForm.pontos);
    if (isNaN(pontos) || pontos === 0) return;
    
    try {
      // Inserir transação
      const { error: transError } = await supabase.from('fidelidade_transacoes').insert({
        cliente_id: selectedCliente.id,
        tipo: pontosForm.tipo,
        pontos: pontosForm.tipo === 'resgate' ? -Math.abs(pontos) : Math.abs(pontos),
        descricao: pontosForm.descricao || null,
        valor_relacionado: pontosForm.valor_relacionado ? parseFloat(pontosForm.valor_relacionado) : null,
      });

      if (transError) throw transError;
      
      // Atualizar saldo
      const novoAcumulado = pontosForm.tipo === 'resgate' 
        ? selectedCliente.pontos_acumulados
        : selectedCliente.pontos_acumulados + Math.abs(pontos);
      
      const novoResgatado = pontosForm.tipo === 'resgate'
        ? selectedCliente.pontos_resgatados + Math.abs(pontos)
        : selectedCliente.pontos_resgatados;

      const { error: updateError } = await supabase
        .from('fidelidade_pontos')
        .update({ 
          pontos_acumulados: novoAcumulado,
          pontos_resgatados: novoResgatado,
        })
        .eq('id', selectedCliente.id);

      if (updateError) throw updateError;
      
      toast({ 
        title: pontosForm.tipo === 'resgate' 
          ? `${pontos} pontos resgatados!` 
          : `${pontos} pontos adicionados!` 
      });
      
      setPontosForm({ tipo: 'acumulo', pontos: '', descricao: '', valor_relacionado: '' });
      setIsAddingPontos(false);
      setSelectedCliente(null);
      fetchData();
    } catch (err) {
      toast({ title: "Erro ao processar pontos", variant: "destructive" });
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    
    try {
      const { error } = await supabase
        .from('fidelidade_config')
        .update({
          pontos_por_real: parseFloat(configForm.pontos_por_real) || 1,
          valor_ponto_resgate: parseFloat(configForm.valor_ponto_resgate) || 0.1,
          pontos_minimos_resgate: parseInt(configForm.pontos_minimos_resgate) || 100,
          validade_pontos_dias: configForm.validade_pontos_dias ? parseInt(configForm.validade_pontos_dias) : null,
        })
        .eq('id', config.id);

      if (error) throw error;
      
      toast({ title: "Configurações salvas!" });
      setShowConfig(false);
      fetchData();
    } catch (err) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const filteredClientes = clientes.filter(c => 
    c.cliente_nome.toLowerCase().includes(search.toLowerCase())
  );

  const getSaldoAtual = (cliente: FidelidadePontos) => 
    cliente.pontos_acumulados - cliente.pontos_resgatados - cliente.pontos_expirados;

  const getTransacoesByCliente = (clienteId: string) => 
    transacoes.filter(t => t.cliente_id === clienteId);

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'acumulo': return { label: 'Acumulado', color: 'bg-success/20 text-success' };
      case 'resgate': return { label: 'Resgate', color: 'bg-primary/20 text-primary' };
      case 'bonus': return { label: 'Bônus', color: 'bg-accent/20 text-accent-foreground' };
      case 'ajuste': return { label: 'Ajuste', color: 'bg-warning/20 text-warning' };
      case 'expiracao': return { label: 'Expirado', color: 'bg-destructive/20 text-destructive' };
      default: return { label: tipo, color: 'bg-secondary text-foreground' };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
          <Star className="w-5 h-5 text-primary" />
          Programa de Fidelidade
        </h2>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowConfig(true)}
            size="sm"
            variant="outline"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button 
            onClick={() => setIsAddingCliente(true)}
            disabled={isAddingCliente}
            size="sm"
          >
            <Plus className="w-4 h-4" />
            Cliente
          </Button>
        </div>
      </div>

      {/* Config Stats */}
      {config && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{config.pontos_por_real}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Pts/R$</p>
          </div>
          <div className="bg-success/10 border border-success/30 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-success">R$ {config.valor_ponto_resgate.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Valor/Pt</p>
          </div>
          <div className="bg-secondary border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{config.pontos_minimos_resgate}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Mín. Resgate</p>
          </div>
          <div className="bg-secondary border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{clientes.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Membros</p>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {showConfig && (
        <div className="card-premium p-4 space-y-4 animate-slide-in-right">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">Configurações</h3>
            <Button variant="ghost" size="iconSm" onClick={() => setShowConfig(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Pontos por R$</Label>
              <Input
                type="number"
                value={configForm.pontos_por_real}
                onChange={(e) => setConfigForm(p => ({ ...p, pontos_por_real: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Valor do ponto (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={configForm.valor_ponto_resgate}
                onChange={(e) => setConfigForm(p => ({ ...p, valor_ponto_resgate: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Mínimo para resgate</Label>
              <Input
                type="number"
                value={configForm.pontos_minimos_resgate}
                onChange={(e) => setConfigForm(p => ({ ...p, pontos_minimos_resgate: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Validade (dias)</Label>
              <Input
                type="number"
                placeholder="Sem validade"
                value={configForm.validade_pontos_dias}
                onChange={(e) => setConfigForm(p => ({ ...p, validade_pontos_dias: e.target.value }))}
              />
            </div>
          </div>
          <Button onClick={handleSaveConfig} size="sm" className="w-full">
            <Check className="w-4 h-4" /> Salvar Configurações
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Add Cliente Form */}
      {isAddingCliente && (
        <div className="card-premium p-4 space-y-3 animate-slide-in-right">
          <h4 className="font-medium text-foreground">Cadastrar Cliente</h4>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Nome do cliente"
              value={clienteForm.cliente_nome}
              onChange={(e) => setClienteForm(p => ({ ...p, cliente_nome: e.target.value }))}
            />
            <Input
              placeholder="Telefone"
              value={clienteForm.cliente_telefone}
              onChange={(e) => setClienteForm(p => ({ ...p, cliente_telefone: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAddCliente} size="sm" className="flex-1">
              <Check className="w-4 h-4" /> Cadastrar
            </Button>
            <Button variant="outline" onClick={() => setIsAddingCliente(false)} size="sm">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Add Pontos Modal */}
      {isAddingPontos && selectedCliente && (
        <div className="card-premium p-4 space-y-3 animate-slide-in-right">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">
              {pontosForm.tipo === 'resgate' ? 'Resgatar' : 'Adicionar'} Pontos
            </h4>
            <Badge className="bg-primary/20 text-primary">{selectedCliente.cliente_nome}</Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select
                value={pontosForm.tipo}
                onValueChange={(v) => setPontosForm(p => ({ ...p, tipo: v as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="acumulo">Acumular</SelectItem>
                  <SelectItem value="resgate">Resgatar</SelectItem>
                  <SelectItem value="bonus">Bônus</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Pontos</Label>
              <Input
                type="number"
                placeholder="100"
                value={pontosForm.pontos}
                onChange={(e) => setPontosForm(p => ({ ...p, pontos: e.target.value }))}
              />
            </div>
          </div>
          
          {pontosForm.tipo === 'acumulo' && (
            <div>
              <Label className="text-xs">Valor gasto (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="50.00"
                value={pontosForm.valor_relacionado}
                onChange={(e) => setPontosForm(p => ({ ...p, valor_relacionado: e.target.value }))}
              />
            </div>
          )}
          
          <Input
            placeholder="Descrição (opcional)"
            value={pontosForm.descricao}
            onChange={(e) => setPontosForm(p => ({ ...p, descricao: e.target.value }))}
          />
          
          <div className="flex gap-2">
            <Button onClick={handleAddPontos} size="sm" className="flex-1">
              <Check className="w-4 h-4" /> Confirmar
            </Button>
            <Button variant="outline" onClick={() => { setIsAddingPontos(false); setSelectedCliente(null); }} size="sm">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Clientes List */}
      {filteredClientes.length === 0 ? (
        <EmptyState 
          icon={Gift}
          title="Nenhum membro"
          description="Cadastre o primeiro cliente no programa"
        />
      ) : (
        <div className="space-y-2">
          {filteredClientes.map((cliente) => {
            const saldo = getSaldoAtual(cliente);
            const clienteTransacoes = getTransacoesByCliente(cliente.id);
            const podeResgatar = config && saldo >= config.pontos_minimos_resgate;
            
            return (
              <div key={cliente.id} className="card-premium p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Award className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{cliente.cliente_nome}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-lg font-bold text-primary">{saldo} pts</span>
                        {podeResgatar && (
                          <Badge className="bg-success/20 text-success text-xs">
                            Pode resgatar!
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>Acumulados: {cliente.pontos_acumulados}</span>
                        <span>Resgatados: {cliente.pontos_resgatados}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => { setSelectedCliente(cliente); setPontosForm(p => ({ ...p, tipo: 'acumulo' })); setIsAddingPontos(true); }}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => { setSelectedCliente(cliente); setPontosForm(p => ({ ...p, tipo: 'resgate' })); setIsAddingPontos(true); }}
                      disabled={!podeResgatar}
                    >
                      <Gift className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                
                {/* Últimas transações */}
                {clienteTransacoes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-xs text-muted-foreground mb-2">Últimas movimentações:</p>
                    <div className="space-y-1">
                      {clienteTransacoes.slice(0, 3).map((t) => {
                        const tipoInfo = getTipoLabel(t.tipo);
                        return (
                          <div key={t.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <Badge className={cn("text-[10px]", tipoInfo.color)}>{tipoInfo.label}</Badge>
                              <span className="text-muted-foreground">{t.descricao || t.referencia_servico || '-'}</span>
                            </div>
                            <span className={t.pontos > 0 ? 'text-success' : 'text-destructive'}>
                              {t.pontos > 0 ? '+' : ''}{t.pontos} pts
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}