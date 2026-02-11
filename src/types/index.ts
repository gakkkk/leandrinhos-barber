export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  observacoes?: string;
  created_at?: string;
}

export interface Servico {
  id: string;
  nome: string;
  descricao?: string;
  preco: number;
  duracao: number; // em minutos
  created_at?: string;
}

export interface Bloqueio {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  motivo?: string;
  created_at?: string;
}

export interface Ferias {
  id: string;
  data: string; // Data única (YYYY-MM-DD)
  descricao?: string;
  created_at?: string;
}

export interface Conhecimento {
  id: string;
  titulo: string;
  conteudo: string;
  created_at?: string;
  updated_at?: string;
}

export interface Agendamento {
  id: string;
  cliente_nome: string;
  servico: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  status: 'confirmado' | 'pendente' | 'cancelado';
}

export type ViewMode = 'dia' | 'semana';

export interface HorarioFuncionamento {
  id: string;
  dia_semana: number; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  hora_inicio: string | null;
  hora_fim: string | null;
  fechado: boolean;
  created_at?: string;
}

export interface Caixa {
  id: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  descricao: string;
  categoria?: string;
  data: string;
  created_at?: string;
}

export interface AniversarioCliente {
  id: string;
  cliente_nome: string;
  cliente_telefone?: string;
  data_aniversario: string;
  notificado_este_ano: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Estoque {
  id: string;
  nome: string;
  quantidade: number;
  quantidade_minima: number;
  preco_custo?: number;
  preco_venda?: number;
  categoria?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Meta {
  id: string;
  mes: number;
  ano: number;
  meta_faturamento: number;
  meta_atendimentos: number;
  created_at?: string;
  updated_at?: string;
}

export const DIAS_SEMANA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

// Clube de Assinatura
export interface PlanoAssinatura {
  id: string;
  nome: string;
  descricao?: string;
  preco: number;
  beneficios?: string[];
  servicos_incluidos?: string[];
  quantidade_servicos_mes: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Assinatura {
  id: string;
  cliente_nome: string;
  cliente_telefone?: string;
  plano_id?: string;
  plano?: PlanoAssinatura;
  data_inicio: string;
  data_vencimento?: string;
  status: 'ativa' | 'pausada' | 'cancelada' | 'vencida';
  servicos_usados_mes: number;
  ultimo_reset_mes: string;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AssinaturaUso {
  id: string;
  assinatura_id: string;
  data_uso: string;
  servico_utilizado: string;
  observacoes?: string;
  created_at?: string;
}

// Programa de Fidelidade
export interface FidelidadeConfig {
  id: string;
  pontos_por_real: number;
  valor_ponto_resgate: number;
  pontos_minimos_resgate: number;
  validade_pontos_dias?: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FidelidadePontos {
  id: string;
  cliente_nome: string;
  cliente_telefone?: string;
  pontos_acumulados: number;
  pontos_resgatados: number;
  pontos_expirados: number;
  created_at?: string;
  updated_at?: string;
}

export interface FidelidadeTransacao {
  id: string;
  cliente_id: string;
  tipo: 'acumulo' | 'resgate' | 'expiracao' | 'ajuste' | 'bonus';
  pontos: number;
  descricao?: string;
  referencia_servico?: string;
  valor_relacionado?: number;
  data_transacao: string;
  created_at?: string;
}

// Profissionais e Comissões
export interface Profissional {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  comissao_padrao: number;
  ativo: boolean;
  pix_chave?: string;
  foto_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Comissao {
  id: string;
  profissional_id: string;
  profissional?: Profissional;
  data: string;
  servico: string;
  valor_servico: number;
  percentual: number;
  valor_comissao: number;
  cliente_nome?: string;
  observacoes?: string;
  pago: boolean;
  pago_em?: string;
  created_at?: string;
}

// Galeria de Trabalhos
export interface GaleriaItem {
  id: string;
  cliente_nome?: string;
  titulo: string;
  descricao?: string;
  foto_antes_url?: string;
  foto_depois_url: string;
  servico?: string;
  profissional_id?: string;
  profissional?: Profissional;
  destaque: boolean;
  created_at?: string;
}

// Avaliações
export interface Avaliacao {
  id: string;
  cliente_nome: string;
  cliente_telefone?: string;
  nota: number;
  comentario?: string;
  servico?: string;
  profissional_id?: string;
  profissional?: Profissional;
  data_servico?: string;
  aprovado: boolean;
  created_at?: string;
}

// Cupons e Promoções
export interface Cupom {
  id: string;
  codigo: string;
  tipo: 'percentual' | 'valor_fixo';
  valor: number;
  descricao?: string;
  quantidade_maxima?: number;
  quantidade_usada: number;
  valido_ate?: string;
  ativo: boolean;
  primeira_visita: boolean;
  aniversariante: boolean;
  servicos_aplicaveis?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface CupomUso {
  id: string;
  cupom_id: string;
  cliente_nome: string;
  cliente_telefone?: string;
  valor_desconto: number;
  created_at?: string;
}

// Lista de Espera
export interface ListaEspera {
  id: string;
  cliente_nome: string;
  cliente_telefone: string;
  servico?: string;
  data_preferida: string;
  horario_preferido?: string;
  notificado: boolean;
  notificado_em?: string;
  status: 'aguardando' | 'notificado' | 'agendado' | 'expirado';
  created_at?: string;
}

// Campanhas de Marketing
export interface Campanha {
  id: string;
  nome: string;
  mensagem: string;
  tipo: 'promocao' | 'retorno' | 'aniversario' | 'personalizado';
  filtro_dias_inativo?: number;
  cupom_id?: string;
  cupom?: Cupom;
  agendada_para?: string;
  enviada: boolean;
  enviada_em?: string;
  total_destinatarios?: number;
  total_enviados?: number;
  total_erros?: number;
  created_at?: string;
}

export interface CampanhaDestinatario {
  id: string;
  campanha_id: string;
  cliente_nome: string;
  cliente_telefone: string;
  enviado: boolean;
  enviado_em?: string;
  erro?: string;
  created_at?: string;
}

// Despesas Fixas
export interface DespesaFixa {
  id: string;
  nome: string;
  valor: number;
  dia_vencimento: number;
  categoria?: string;
  ativo: boolean;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

// Configuração PIX
export interface PixConfig {
  id: string;
  tipo_chave: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';
  chave: string;
  nome_beneficiario: string;
  cidade: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

// Agendamento Online
export interface AgendamentoOnlineConfig {
  id: string;
  ativo: boolean;
  antecedencia_minima_horas: number;
  antecedencia_maxima_dias: number;
  intervalo_minutos: number;
  mensagem_confirmacao?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AgendamentoPendente {
  id: string;
  cliente_nome: string;
  cliente_telefone: string;
  servico: string;
  data: string;
  horario: string;
  profissional_id?: string;
  profissional?: Profissional;
  status: 'pendente' | 'confirmado' | 'recusado' | 'expirado';
  observacoes?: string;
  google_event_id?: string;
  created_at?: string;
  updated_at?: string;
}
