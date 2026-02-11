import { supabase } from "@/integrations/supabase/client";

// URL do Lovable Cloud para chamar a edge function (Supabase externo via proxy)
const LOVABLE_CLOUD_URL = 'https://wtkxyofvbillvclkcvir.supabase.co';

interface SupabaseResponse<T> {
  data: T | null;
  error: string | null;
}

// Request para Supabase EXTERNO via proxy (clientes, serviços, bloqueios, etc)
async function supabaseRequest<T>(
  endpoint: string,
  options: { method?: string; body?: object } = {}
): Promise<SupabaseResponse<T>> {
  const url = `${LOVABLE_CLOUD_URL}/functions/v1/supabase-proxy`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint,
        method: options.method || 'GET',
        body: options.body,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: errorText };
    }

    const result = await response.json();
    
    if (result.error) {
      return { data: null, error: result.error };
    }
    
    return { data: result.data, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Request direto para Lovable Cloud (caixa, estoque, aniversarios, metas)
async function lovableCloudRequest<T>(
  table: string,
  options: { 
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; 
    body?: object;
    query?: Record<string, string>;
    order?: string;
  } = {}
): Promise<SupabaseResponse<T>> {
  try {
    const method = options.method || 'GET';
    
    if (method === 'GET') {
      let query = supabase.from(table as any).select('*');
      if (options.order) {
        const [col, dir] = options.order.split('.');
        query = query.order(col, { ascending: dir !== 'desc' });
      }
      if (options.query) {
        for (const [key, value] of Object.entries(options.query)) {
          if (value.startsWith('eq.')) {
            query = query.eq(key, value.replace('eq.', ''));
          } else if (value.startsWith('gte.')) {
            query = query.gte(key, value.replace('gte.', ''));
          } else if (value.startsWith('lte.')) {
            query = query.lte(key, value.replace('lte.', ''));
          }
        }
      }
      const { data, error } = await query;
      return { data: data as T, error: error?.message || null };
    }
    
    if (method === 'POST') {
      const { data, error } = await supabase.from(table as any).insert(options.body as any).select();
      return { data: data as T, error: error?.message || null };
    }
    
    if (method === 'PATCH' && options.query) {
      let query = supabase.from(table as any).update(options.body as any);
      for (const [key, value] of Object.entries(options.query)) {
        if (value.startsWith('eq.')) {
          query = query.eq(key, value.replace('eq.', ''));
        }
      }
      const { data, error } = await query.select();
      return { data: data as T, error: error?.message || null };
    }
    
    if (method === 'DELETE' && options.query) {
      let query = supabase.from(table as any).delete();
      for (const [key, value] of Object.entries(options.query)) {
        if (value.startsWith('eq.')) {
          query = query.eq(key, value.replace('eq.', ''));
        }
      }
      const { data, error } = await query;
      return { data: data as T, error: error?.message || null };
    }
    
    return { data: null, error: 'Invalid method' };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Clientes (tabela: dados_cliente) - coluna correta: nomewpp
export async function fetchClientes() {
  return supabaseRequest<any[]>('dados_cliente?order=nomewpp.asc');
}

export async function createCliente(cliente: { nome: string; telefone: string; observacoes?: string }) {
  // Mapear 'nome' para 'nomewpp' conforme estrutura do banco
  return supabaseRequest<any[]>('dados_cliente', {
    method: 'POST',
    body: { nomewpp: cliente.nome, telefone: cliente.telefone },
  });
}

export async function updateCliente(id: string, cliente: { nome: string; telefone: string; observacoes?: string }) {
  return supabaseRequest<any[]>(`dados_cliente?id=eq.${id}`, {
    method: 'PATCH',
    body: { nomewpp: cliente.nome, telefone: cliente.telefone },
  });
}

export async function deleteCliente(id: string) {
  return supabaseRequest<any[]>(`dados_cliente?id=eq.${id}`, {
    method: 'DELETE',
  });
}

// Serviços
export async function fetchServicos() {
  return supabaseRequest<any[]>('servicos?order=nome.asc');
}

export async function createServico(servico: { nome: string; descricao?: string; preco: number; duracao?: number }) {
  return supabaseRequest<any[]>('servicos', {
    method: 'POST',
    body: { nome: servico.nome, descricao: servico.descricao || '', preco: servico.preco, duracao_minutos: servico.duracao || 30 },
  });
}

export async function updateServico(id: string, servico: { nome: string; descricao?: string; preco: number; duracao?: number }) {
  return supabaseRequest<any[]>(`servicos?id=eq.${id}`, {
    method: 'PATCH',
    body: { nome: servico.nome, descricao: servico.descricao || '', preco: servico.preco, duracao_minutos: servico.duracao || 30 },
  });
}

export async function deleteServico(id: string) {
  return supabaseRequest<any[]>(`servicos?id=eq.${id}`, {
    method: 'DELETE',
  });
}

// Bloqueios (tabela correta: horarios_bloqueados)
export async function fetchBloqueios() {
  return supabaseRequest<any[]>('horarios_bloqueados?order=id.desc');
}

export async function createBloqueio(bloqueio: { data: string; hora_inicio: string; hora_fim: string; motivo?: string }) {
  // Estrutura do banco externo: inicio, fim, motivo
  return supabaseRequest<any[]>('horarios_bloqueados', {
    method: 'POST',
    body: {
      inicio: `${bloqueio.data}T${bloqueio.hora_inicio}:00`,
      fim: `${bloqueio.data}T${bloqueio.hora_fim}:00`,
      motivo: bloqueio.motivo,
    },
  });
}

export async function deleteBloqueio(id: string) {
  return supabaseRequest<any[]>(`horarios_bloqueados?id=eq.${id}`, {
    method: 'DELETE',
  });
}

// Férias - cada dia é uma row separada (coluna: data)
export async function fetchFerias() {
  return supabaseRequest<any[]>('ferias?order=data.asc');
}

export async function createFerias(ferias: { data: string; descricao?: string }) {
  return supabaseRequest<any[]>('ferias', {
    method: 'POST',
    body: {
      data: ferias.data,
      descricao: ferias.descricao,
    },
  });
}

export async function createMultipleFerias(dias: { data: string; descricao?: string }[]) {
  return supabaseRequest<any[]>('ferias', {
    method: 'POST',
    body: dias,
  });
}

export async function deleteFerias(id: string) {
  return supabaseRequest<any[]>(`ferias?id=eq.${id}`, {
    method: 'DELETE',
  });
}

// Conhecimentos (tabela correta: conhecimentos_ia)
export async function fetchConhecimentos() {
  return supabaseRequest<any[]>('conhecimentos_ia?order=id.desc');
}

export async function createConhecimento(conhecimento: { titulo: string; conteudo: string }) {
  return supabaseRequest<any[]>('conhecimentos_ia', {
    method: 'POST',
    body: conhecimento,
  });
}

export async function updateConhecimento(id: string, conhecimento: { titulo: string; conteudo: string }) {
  return supabaseRequest<any[]>(`conhecimentos_ia?id=eq.${id}`, {
    method: 'PATCH',
    body: conhecimento,
  });
}

export async function deleteConhecimento(id: string) {
  return supabaseRequest<any[]>(`conhecimentos_ia?id=eq.${id}`, {
    method: 'DELETE',
  });
}

// Horários de Funcionamento
export async function fetchHorariosFuncionamento() {
  return supabaseRequest<any[]>('horarios_funcionamento?order=dia_semana.asc');
}

export async function createHorarioFuncionamento(horario: { dia_semana: number; hora_inicio: string | null; hora_fim: string | null; fechado: boolean }) {
  return supabaseRequest<any[]>('horarios_funcionamento', {
    method: 'POST',
    body: horario,
  });
}

export async function updateHorarioFuncionamento(id: string, horario: { hora_inicio: string | null; hora_fim: string | null; fechado: boolean }) {
  return supabaseRequest<any[]>(`horarios_funcionamento?id=eq.${id}`, {
    method: 'PATCH',
    body: horario,
  });
}

export async function upsertHorariosFuncionamento(horarios: { dia_semana: number; hora_inicio: string | null; hora_fim: string | null; fechado: boolean }[]) {
  // Delete all existing and insert new
  await supabaseRequest<any[]>('horarios_funcionamento', {
    method: 'DELETE',
  });
  
  return supabaseRequest<any[]>('horarios_funcionamento', {
    method: 'POST',
    body: horarios,
  });
}

// Variáveis Externas - uses external Supabase via proxy (column: bot_ativo)
export async function fetchVariavelExterna(id: number = 1) {
  return supabaseRequest<any[]>(`variaveis_externas?id=eq.${id}`);
}

export async function updateVariavelExterna(id: number, bot_ativo: boolean) {
  return supabaseRequest<any[]>(`variaveis_externas?id=eq.${id}`, {
    method: 'PATCH',
    body: { bot_ativo },
  });
}

// ============ CAIXA (Controle Financeiro) - LOVABLE CLOUD ============
export async function fetchCaixa(dataInicio?: string, dataFim?: string) {
  const query: Record<string, string> = {};
  if (dataInicio) query.data = `gte.${dataInicio}`;
  if (dataFim) query.data = `lte.${dataFim}`;
  return lovableCloudRequest<any[]>('caixa', { order: 'data.desc', query });
}

export async function createCaixa(caixa: { tipo: 'entrada' | 'saida'; valor: number; descricao: string; categoria?: string; data?: string }) {
  return lovableCloudRequest<any[]>('caixa', {
    method: 'POST',
    body: {
      tipo: caixa.tipo,
      valor: caixa.valor,
      descricao: caixa.descricao,
      categoria: caixa.categoria,
      data: caixa.data || new Date().toISOString().split('T')[0],
    },
  });
}

export async function deleteCaixa(id: string) {
  return lovableCloudRequest<any[]>('caixa', {
    method: 'DELETE',
    query: { id: `eq.${id}` },
  });
}

// ============ ANIVERSÁRIOS DE CLIENTES - LOVABLE CLOUD ============
export async function fetchAniversarios() {
  return lovableCloudRequest<any[]>('aniversarios_clientes', { order: 'data_aniversario.asc' });
}

export async function createAniversario(aniversario: { cliente_nome: string; cliente_telefone?: string; data_aniversario: string }) {
  return lovableCloudRequest<any[]>('aniversarios_clientes', {
    method: 'POST',
    body: aniversario,
  });
}

export async function updateAniversario(id: string, aniversario: { cliente_nome?: string; cliente_telefone?: string; data_aniversario?: string; notificado_este_ano?: boolean }) {
  return lovableCloudRequest<any[]>('aniversarios_clientes', {
    method: 'PATCH',
    query: { id: `eq.${id}` },
    body: aniversario,
  });
}

export async function deleteAniversario(id: string) {
  return lovableCloudRequest<any[]>('aniversarios_clientes', {
    method: 'DELETE',
    query: { id: `eq.${id}` },
  });
}

// ============ ESTOQUE - LOVABLE CLOUD ============
export async function fetchEstoque() {
  return lovableCloudRequest<any[]>('estoque', { order: 'nome.asc' });
}

export async function createEstoque(item: { nome: string; quantidade: number; quantidade_minima?: number; preco_custo?: number; preco_venda?: number; categoria?: string }) {
  return lovableCloudRequest<any[]>('estoque', {
    method: 'POST',
    body: {
      nome: item.nome,
      quantidade: item.quantidade,
      quantidade_minima: item.quantidade_minima || 5,
      preco_custo: item.preco_custo,
      preco_venda: item.preco_venda,
      categoria: item.categoria,
    },
  });
}

export async function updateEstoque(id: string, item: { nome?: string; quantidade?: number; quantidade_minima?: number; preco_custo?: number; preco_venda?: number; categoria?: string }) {
  return lovableCloudRequest<any[]>('estoque', {
    method: 'PATCH',
    query: { id: `eq.${id}` },
    body: item,
  });
}

export async function deleteEstoque(id: string) {
  return lovableCloudRequest<any[]>('estoque', {
    method: 'DELETE',
    query: { id: `eq.${id}` },
  });
}

// ============ METAS - LOVABLE CLOUD ============
export async function fetchMetas() {
  return lovableCloudRequest<any[]>('metas', { order: 'ano.desc' });
}

export async function fetchMetaAtual(mes: number, ano: number) {
  return lovableCloudRequest<any[]>('metas', { 
    query: { mes: `eq.${mes}`, ano: `eq.${ano}` } 
  });
}

export async function fetchMetasByYear(ano: number) {
  return lovableCloudRequest<any[]>('metas', { 
    query: { ano: `eq.${ano}` },
    order: 'mes.asc'
  });
}

export async function upsertMeta(meta: { mes: number; ano: number; meta_faturamento: number; meta_atendimentos: number }) {
  const existing = await fetchMetaAtual(meta.mes, meta.ano);
  if (existing.data && existing.data.length > 0) {
    return lovableCloudRequest<any[]>('metas', {
      method: 'PATCH',
      query: { mes: `eq.${meta.mes}`, ano: `eq.${meta.ano}` },
      body: { meta_faturamento: meta.meta_faturamento, meta_atendimentos: meta.meta_atendimentos },
    });
  }
  return lovableCloudRequest<any[]>('metas', {
    method: 'POST',
    body: meta,
  });
}

// ============ CAIXA MENSAL (para gráficos) - LOVABLE CLOUD ============
export async function fetchCaixaMensal(ano: number) {
  const dataInicio = `${ano}-01-01`;
  const dataFim = `${ano}-12-31`;
  return lovableCloudRequest<any[]>('caixa', {
    query: { data: `gte.${dataInicio}` },
    order: 'data.asc'
  });
}
