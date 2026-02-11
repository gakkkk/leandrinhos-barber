import { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subDays, addDays, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Plus, TrendingUp, TrendingDown, DollarSign, Calendar,
  ArrowUpCircle, ArrowDownCircle, Trash2, ChevronLeft, ChevronRight, Settings2, X, Download, PieChart as PieChartIcon, BarChart2
} from 'lucide-react';
import { Caixa } from '@/types';
import { fetchCaixa, createCaixa, deleteCaixa } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

const CATEGORIAS_ENTRADA_PADRAO = ['Serviço', 'Venda Produto', 'Outros'];
const CATEGORIAS_SAIDA_PADRAO = ['Produto', 'Aluguel', 'Conta de Luz', 'Conta de Água', 'Material', 'Outros'];
const LOCAL_STORAGE_KEY_ENTRADA = 'caixa_categorias_entrada';
const LOCAL_STORAGE_KEY_SAIDA = 'caixa_categorias_saida';
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

export function CaixaView() {
  const [movimentacoes, setMovimentacoes] = useState<Caixa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoriasDialogOpen, setCategoriasDialogOpen] = useState(false);

  // Filtros Avançados
  const [filtroPeriodo, setFiltroPeriodo] = useState<'dia' | 'semana' | 'mes' | 'custom'>('mes');
  const [dataInicio, setDataInicio] = useState<Date>(startOfMonth(new Date()));
  const [dataFim, setDataFim] = useState<Date>(endOfMonth(new Date()));

  // Categorias personalizadas
  const [categoriasEntrada, setCategoriasEntrada] = useState<string[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_ENTRADA);
    return saved ? JSON.parse(saved) : CATEGORIAS_ENTRADA_PADRAO;
  });
  const [categoriasSaida, setCategoriasSaida] = useState<string[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_SAIDA);
    return saved ? JSON.parse(saved) : CATEGORIAS_SAIDA_PADRAO;
  });
  const [novaCategoria, setNovaCategoria] = useState('');
  const [tipoCategoriaEdit, setTipoCategoriaEdit] = useState<'entrada' | 'saida'>('entrada');

  // Form state
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Salvar categorias no localStorage
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_ENTRADA, JSON.stringify(categoriasEntrada));
  }, [categoriasEntrada]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_SAIDA, JSON.stringify(categoriasSaida));
  }, [categoriasSaida]);

  useEffect(() => {
    ajustarDatasFiltro();
  }, [filtroPeriodo]);

  useEffect(() => {
    if (filtroPeriodo !== 'custom') {
      loadMovimentacoes();
    }
  }, [dataInicio, dataFim]);

  const ajustarDatasFiltro = () => {
    const hoje = new Date();
    if (filtroPeriodo === 'dia') {
      setDataInicio(hoje);
      setDataFim(hoje);
    } else if (filtroPeriodo === 'semana') {
      setDataInicio(startOfWeek(hoje, { locale: ptBR }));
      setDataFim(endOfWeek(hoje, { locale: ptBR }));
    } else if (filtroPeriodo === 'mes') {
      setDataInicio(startOfMonth(hoje));
      setDataFim(endOfMonth(hoje));
    }
    // Custom não altera automaticamente
  };

  const loadMovimentacoes = async () => {
    setIsLoading(true);
    const inicioStr = format(dataInicio, 'yyyy-MM-dd');
    const fimStr = format(dataFim, 'yyyy-MM-dd');

    const result = await fetchCaixa(inicioStr, fimStr);
    if (result.data) {
      setMovimentacoes(result.data);
    }
    setIsLoading(false);
  };

  const navegarPeriodo = (direcao: 'anterior' | 'proximo') => {
    if (filtroPeriodo === 'dia') {
      const dias = direcao === 'anterior' ? -1 : 1;
      setDataInicio(prev => addDays(prev, dias));
      setDataFim(prev => addDays(prev, dias));
    } else if (filtroPeriodo === 'semana') {
      const dias = direcao === 'anterior' ? -7 : 7;
      setDataInicio(prev => addDays(prev, dias));
      setDataFim(prev => addDays(prev, dias));
    } else if (filtroPeriodo === 'mes') {
      const meses = direcao === 'anterior' ? -1 : 1;
      setDataInicio(prev => {
        const d = new Date(prev);
        d.setMonth(d.getMonth() + meses);
        return startOfMonth(d);
      });
      setDataFim(prev => {
        const d = new Date(prev);
        d.setMonth(d.getMonth() + meses);
        return endOfMonth(d);
      });
    }
  };

  const adicionarCategoria = () => {
    if (!novaCategoria.trim()) return;

    if (tipoCategoriaEdit === 'entrada') {
      if (!categoriasEntrada.includes(novaCategoria.trim())) {
        setCategoriasEntrada([...categoriasEntrada, novaCategoria.trim()]);
      }
    } else {
      if (!categoriasSaida.includes(novaCategoria.trim())) {
        setCategoriasSaida([...categoriasSaida, novaCategoria.trim()]);
      }
    }
    setNovaCategoria('');
    toast({ title: 'Categoria adicionada!' });
  };

  const removerCategoria = (cat: string, tipoCategoria: 'entrada' | 'saida') => {
    if (tipoCategoria === 'entrada') {
      setCategoriasEntrada(categoriasEntrada.filter(c => c !== cat));
    } else {
      setCategoriasSaida(categoriasSaida.filter(c => c !== cat));
    }
    toast({ title: 'Categoria removida' });
  };

  const handleSubmit = async () => {
    if (!valor || !descricao) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    const result = await createCaixa({
      tipo,
      valor: parseFloat(valor),
      descricao,
      categoria: categoria || undefined,
      data,
    });

    if (result.error) {
      toast({ title: 'Erro ao adicionar', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: tipo === 'entrada' ? 'Entrada registrada!' : 'Saída registrada!' });
      setDialogOpen(false);
      setValor('');
      setDescricao('');
      setCategoria('');
      loadMovimentacoes();
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteCaixa(id);
    if (result.error) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    } else {
      toast({ title: 'Movimentação excluída' });
      loadMovimentacoes();
    }
  };

  // Cálculos para Gráficos e Resumos
  const dadosFinanceiros = useMemo(() => {
    const entradas = movimentacoes.filter(m => m.tipo === 'entrada').reduce((acc, m) => acc + m.valor, 0);
    const saidas = movimentacoes.filter(m => m.tipo === 'saida').reduce((acc, m) => acc + m.valor, 0);
    const saldo = entradas - saidas;

    // Ticket Médio (Entradas / Quantidade de Entradas)
    const qtdEntradas = movimentacoes.filter(m => m.tipo === 'entrada').length;
    const ticketMedio = qtdEntradas > 0 ? entradas / qtdEntradas : 0;

    // Categorias de Despesa
    const despesasPorCategoria = movimentacoes
      .filter(m => m.tipo === 'saida' && m.categoria)
      .reduce((acc, curr) => {
        const cat = curr.categoria || 'Outros';
        acc[cat] = (acc[cat] || 0) + curr.valor;
        return acc;
      }, {} as Record<string, number>);

    const chartDataPizza = Object.entries(despesasPorCategoria).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);

    // Maior Despesa
    const maiorDespesa = chartDataPizza.length > 0 ? chartDataPizza[0] : null;

    // Dados por Dia (Gráfico de Barras)
    const dadosPorDia = movimentacoes.reduce((acc, curr) => {
      const dataStr = format(new Date(curr.data), 'dd/MM');
      if (!acc[dataStr]) acc[dataStr] = { name: dataStr, entradas: 0, saidas: 0 };
      if (curr.tipo === 'entrada') acc[dataStr].entradas += curr.valor;
      else acc[dataStr].saidas += curr.valor;
      return acc;
    }, {} as Record<string, { name: string, entradas: number, saidas: number }>);

    // Converter para array e ordenar por data
    const chartDataBarras = Object.values(dadosPorDia).sort((a, b) => {
      // Ordenação simples considerando dd/MM do mesmo ano/mês
      return a.name.localeCompare(b.name);
    });

    return { entradas, saidas, saldo, ticketMedio, chartDataPizza, chartDataBarras, maiorDespesa };
  }, [movimentacoes]);

  const exportarRelatorio = () => {
    const header = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor'];
    const rows = movimentacoes.map(m => [
      format(new Date(m.data), 'dd/MM/yyyy'),
      m.descricao,
      m.categoria || '-',
      m.tipo,
      m.valor.toFixed(2).replace('.', ',')
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + header.join(";") + "\n"
      + rows.map(e => e.join(";")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_caixa_${format(new Date(), 'dd-MM-yyyy')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header e Filtros */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Select value={filtroPeriodo} onValueChange={(v) => setFiltroPeriodo(v as any)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dia">Hoje</SelectItem>
              <SelectItem value="semana">Esta Semana</SelectItem>
              <SelectItem value="mes">Este Mês</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {filtroPeriodo !== 'custom' && (
            <div className="flex items-center gap-1 bg-secondary/50 rounded-md p-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navegarPeriodo('anterior')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[100px] text-center px-2">
                {filtroPeriodo === 'dia' && format(dataInicio, "dd/MM", { locale: ptBR })}
                {filtroPeriodo === 'semana' && `${format(dataInicio, "dd/MM")} - ${format(dataFim, "dd/MM")}`}
                {filtroPeriodo === 'mes' && format(dataInicio, "MMMM", { locale: ptBR })}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navegarPeriodo('proximo')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {filtroPeriodo === 'custom' && (
            <Button variant="outline" size="sm" onClick={loadMovimentacoes}>
              Atualizar
            </Button>
          )}

          <Button variant="outline" size="icon" onClick={exportarRelatorio} title="Exportar CSV">
            <Download className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Dialog open={categoriasDialogOpen} onOpenChange={setCategoriasDialogOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="outline" title="Gerenciar Categorias">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            {/* ... Conteúdo do Dialog de Categorias (mantido igual, apenas renderizado se aberto) ... */}
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Categorias</DialogTitle>
              </DialogHeader>
              {/* Reaproveitando lógica de render do dialog de categorias */}
              <div className="space-y-4 pt-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={tipoCategoriaEdit === 'entrada' ? 'default' : 'outline'}
                    className={cn("flex-1", tipoCategoriaEdit === 'entrada' && "bg-emerald-600 hover:bg-emerald-700")}
                    onClick={() => setTipoCategoriaEdit('entrada')}
                  >
                    Entrada
                  </Button>
                  <Button
                    type="button"
                    variant={tipoCategoriaEdit === 'saida' ? 'default' : 'outline'}
                    className={cn("flex-1", tipoCategoriaEdit === 'saida' && "bg-red-600 hover:bg-red-700")}
                    onClick={() => setTipoCategoriaEdit('saida')}
                  >
                    Saída
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nova categoria..."
                    value={novaCategoria}
                    onChange={(e) => setNovaCategoria(e.target.value)}
                  />
                  <Button onClick={adicionarCategoria} size="icon"><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-auto">
                  {(tipoCategoriaEdit === 'entrada' ? categoriasEntrada : categoriasSaida).map((cat) => (
                    <div key={cat} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                      <span className="text-sm">{cat}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removerCategoria(cat, tipoCategoriaEdit)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="h-4 w-4" />
                Lançar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Movimentação</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={tipo === 'entrada' ? 'default' : 'outline'}
                    className={cn("flex-1 gap-2", tipo === 'entrada' && "bg-emerald-600 hover:bg-emerald-700")}
                    onClick={() => setTipo('entrada')}
                  >
                    <ArrowUpCircle className="h-4 w-4" /> Entrada
                  </Button>
                  <Button
                    type="button"
                    variant={tipo === 'saida' ? 'default' : 'outline'}
                    className={cn("flex-1 gap-2", tipo === 'saida' && "bg-red-600 hover:bg-red-700")}
                    onClick={() => setTipo('saida')}
                  >
                    <ArrowDownCircle className="h-4 w-4" /> Saída
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input type="number" placeholder="0.00" value={valor} onChange={(e) => setValor(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input placeholder="Ex: Corte" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {(tipo === 'entrada' ? categoriasEntrada : categoriasSaida).map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                </div>
                <Button onClick={handleSubmit} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-emerald-500 mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase">Entradas</span>
            </div>
            <p className="text-2xl font-bold font-mono text-emerald-500">R$ {dadosFinanceiros.entradas.toFixed(0)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-500 mb-2">
              <TrendingDown className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase">Saídas</span>
            </div>
            <p className="text-2xl font-bold font-mono text-red-500">R$ {dadosFinanceiros.saidas.toFixed(0)}</p>
          </CardContent>
        </Card>

        <Card className={cn("border-l-4", dadosFinanceiros.saldo >= 0 ? "border-l-emerald-500" : "border-l-red-500")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase">Saldo Líquido</span>
            </div>
            <p className={cn("text-2xl font-bold font-mono", dadosFinanceiros.saldo >= 0 ? "text-emerald-500" : "text-red-500")}>
              R$ {dadosFinanceiros.saldo.toFixed(0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <PieChartIcon className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase">Maior Despesa</span>
            </div>
            <p className="text-sm font-medium truncate">{dadosFinanceiros.maiorDespesa?.name || '-'}</p>
            <p className="text-lg font-bold text-red-500">
              {dadosFinanceiros.maiorDespesa ? `R$ ${dadosFinanceiros.maiorDespesa.value.toFixed(0)}` : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gráfico de Barras - Entradas vs Saídas */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              Fluxo Diário
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosFinanceiros.chartDataBarras}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Pizza - Despesas por Categoria */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-primary" />
              Despesas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dadosFinanceiros.chartDataPizza}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {dadosFinanceiros.chartDataPizza.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                  contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend layout="vertical" align="right" verticalAlign="middle" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Movimentações */}
      <div className="bg-card rounded-lg border border-border">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h3 className="font-semibold text-sm">Histórico Detalhado</h3>
          <Badge variant="outline">{movimentacoes.length} registros</Badge>
        </div>
        <div className="divide-y divide-border/50 max-h-[400px] overflow-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando dados...</div>
          ) : movimentacoes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum registro neste período.</div>
          ) : (
            movimentacoes.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).map((mov) => (
              <div key={mov.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                    mov.tipo === 'entrada' ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
                  )}>
                    {mov.tipo === 'entrada' ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{mov.descricao}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{format(new Date(mov.data), "dd/MM/yyyy")}</span>
                      {mov.categoria && (
                        <span className="px-1.5 py-0.5 rounded-full bg-secondary text-xs">{mov.categoria}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={cn(
                    "font-mono font-medium",
                    mov.tipo === 'entrada' ? "text-emerald-500" : "text-red-500"
                  )}>
                    {mov.tipo === 'entrada' ? '+' : '-'} R$ {mov.valor.toFixed(2)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => handleDelete(mov.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
