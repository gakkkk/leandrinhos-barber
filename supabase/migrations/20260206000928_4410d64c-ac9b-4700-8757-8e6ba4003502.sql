-- =============================================
-- MIGRAÇÃO: 10 Novas Funcionalidades
-- =============================================

-- 1. PROFISSIONAIS (para comissões)
CREATE TABLE public.profissionais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  comissao_padrao NUMERIC NOT NULL DEFAULT 50, -- % de comissão padrão
  ativo BOOLEAN NOT NULL DEFAULT true,
  pix_chave TEXT, -- Chave PIX para pagamentos
  foto_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on profissionais" ON public.profissionais
FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_profissionais_updated_at
  BEFORE UPDATE ON public.profissionais
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. COMISSÕES (registro de comissões por serviço)
CREATE TABLE public.comissoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  servico TEXT NOT NULL,
  valor_servico NUMERIC NOT NULL,
  percentual NUMERIC NOT NULL,
  valor_comissao NUMERIC NOT NULL,
  cliente_nome TEXT,
  observacoes TEXT,
  pago BOOLEAN NOT NULL DEFAULT false,
  pago_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on comissoes" ON public.comissoes
FOR ALL USING (true) WITH CHECK (true);

-- 3. GALERIA DE TRABALHOS
CREATE TABLE public.galeria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_nome TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  foto_antes_url TEXT,
  foto_depois_url TEXT NOT NULL,
  servico TEXT,
  profissional_id UUID REFERENCES public.profissionais(id) ON DELETE SET NULL,
  destaque BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.galeria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on galeria" ON public.galeria
FOR ALL USING (true) WITH CHECK (true);

-- 4. AVALIAÇÕES
CREATE TABLE public.avaliacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT,
  nota INTEGER NOT NULL CHECK (nota >= 1 AND nota <= 5),
  comentario TEXT,
  servico TEXT,
  profissional_id UUID REFERENCES public.profissionais(id) ON DELETE SET NULL,
  data_servico DATE,
  aprovado BOOLEAN NOT NULL DEFAULT false, -- Precisa de aprovação antes de exibir
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on avaliacoes" ON public.avaliacoes
FOR ALL USING (true) WITH CHECK (true);

-- 5. CUPONS E PROMOÇÕES
CREATE TABLE public.cupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL DEFAULT 'percentual', -- 'percentual' ou 'valor_fixo'
  valor NUMERIC NOT NULL, -- % ou valor em R$
  descricao TEXT,
  quantidade_maxima INTEGER, -- NULL = ilimitado
  quantidade_usada INTEGER NOT NULL DEFAULT 0,
  valido_ate DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  primeira_visita BOOLEAN NOT NULL DEFAULT false, -- Só para novos clientes
  aniversariante BOOLEAN NOT NULL DEFAULT false, -- Só para aniversariantes
  servicos_aplicaveis TEXT[], -- NULL = todos os serviços
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on cupons" ON public.cupons
FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_cupons_updated_at
  BEFORE UPDATE ON public.cupons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Uso de cupons
CREATE TABLE public.cupons_uso (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cupom_id UUID NOT NULL REFERENCES public.cupons(id) ON DELETE CASCADE,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT,
  valor_desconto NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cupons_uso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on cupons_uso" ON public.cupons_uso
FOR ALL USING (true) WITH CHECK (true);

-- 6. LISTA DE ESPERA
CREATE TABLE public.lista_espera (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  servico TEXT,
  data_preferida DATE NOT NULL,
  horario_preferido TEXT, -- Ex: "manhã", "tarde", "14:00"
  notificado BOOLEAN NOT NULL DEFAULT false,
  notificado_em TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'aguardando', -- 'aguardando', 'notificado', 'agendado', 'expirado'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lista_espera ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on lista_espera" ON public.lista_espera
FOR ALL USING (true) WITH CHECK (true);

-- 7. CAMPANHAS DE MARKETING
CREATE TABLE public.campanhas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'promocao', -- 'promocao', 'retorno', 'aniversario', 'personalizado'
  filtro_dias_inativo INTEGER, -- Para campanhas de retorno: clientes sem visita em X dias
  cupom_id UUID REFERENCES public.cupons(id) ON DELETE SET NULL,
  agendada_para TIMESTAMP WITH TIME ZONE,
  enviada BOOLEAN NOT NULL DEFAULT false,
  enviada_em TIMESTAMP WITH TIME ZONE,
  total_destinatarios INTEGER,
  total_enviados INTEGER DEFAULT 0,
  total_erros INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on campanhas" ON public.campanhas
FOR ALL USING (true) WITH CHECK (true);

-- Destinatários da campanha
CREATE TABLE public.campanhas_destinatarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campanha_id UUID NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  enviado BOOLEAN NOT NULL DEFAULT false,
  enviado_em TIMESTAMP WITH TIME ZONE,
  erro TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campanhas_destinatarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on campanhas_destinatarios" ON public.campanhas_destinatarios
FOR ALL USING (true) WITH CHECK (true);

-- 8. DESPESAS FIXAS
CREATE TABLE public.despesas_fixas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  dia_vencimento INTEGER NOT NULL DEFAULT 1, -- Dia do mês
  categoria TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.despesas_fixas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on despesas_fixas" ON public.despesas_fixas
FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_despesas_fixas_updated_at
  BEFORE UPDATE ON public.despesas_fixas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 9. CONFIGURAÇÕES PIX
CREATE TABLE public.pix_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_chave TEXT NOT NULL DEFAULT 'cpf', -- 'cpf', 'cnpj', 'email', 'telefone', 'aleatoria'
  chave TEXT NOT NULL,
  nome_beneficiario TEXT NOT NULL,
  cidade TEXT NOT NULL DEFAULT 'Sao Paulo',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pix_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on pix_config" ON public.pix_config
FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_pix_config_updated_at
  BEFORE UPDATE ON public.pix_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 10. HORÁRIOS DISPONÍVEIS PARA AGENDAMENTO ONLINE
CREATE TABLE public.agendamento_online_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ativo BOOLEAN NOT NULL DEFAULT true,
  antecedencia_minima_horas INTEGER NOT NULL DEFAULT 2, -- Horas mínimas de antecedência
  antecedencia_maxima_dias INTEGER NOT NULL DEFAULT 30, -- Dias máximos para agendar
  intervalo_minutos INTEGER NOT NULL DEFAULT 30, -- Intervalo entre horários
  mensagem_confirmacao TEXT DEFAULT 'Seu agendamento foi confirmado! Te esperamos na Leandrinho''s Barber.',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agendamento_online_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on agendamento_online_config" ON public.agendamento_online_config
FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_agendamento_online_config_updated_at
  BEFORE UPDATE ON public.agendamento_online_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Agendamentos feitos pelo cliente (antes de confirmar no Google Calendar)
CREATE TABLE public.agendamentos_pendentes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  servico TEXT NOT NULL,
  data DATE NOT NULL,
  horario TIME NOT NULL,
  profissional_id UUID REFERENCES public.profissionais(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'confirmado', 'recusado', 'expirado'
  observacoes TEXT,
  google_event_id TEXT, -- Preenchido após confirmação
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agendamentos_pendentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on agendamentos_pendentes" ON public.agendamentos_pendentes
FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_agendamentos_pendentes_updated_at
  BEFORE UPDATE ON public.agendamentos_pendentes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- SEED: Configurações iniciais
INSERT INTO public.agendamento_online_config (ativo, antecedencia_minima_horas, antecedencia_maxima_dias, intervalo_minutos)
VALUES (true, 2, 30, 30);

-- Inserir profissional principal (Leandrinho)
INSERT INTO public.profissionais (nome, comissao_padrao, ativo)
VALUES ('Leandrinho', 100, true);