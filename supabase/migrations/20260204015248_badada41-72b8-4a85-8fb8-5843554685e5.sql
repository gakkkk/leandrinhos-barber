-- ============================================================
-- FUNÇÃO PARA ATUALIZAR updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- CLUBE DE ASSINATURA
-- ============================================================

-- Planos de assinatura disponíveis
CREATE TABLE public.planos_assinatura (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco DECIMAL(10,2) NOT NULL,
  beneficios JSONB DEFAULT '[]'::jsonb,
  servicos_incluidos TEXT[] DEFAULT '{}',
  quantidade_servicos_mes INTEGER DEFAULT 4,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Assinaturas ativas de clientes
CREATE TABLE public.assinaturas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT,
  plano_id UUID REFERENCES public.planos_assinatura(id) ON DELETE SET NULL,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE,
  status TEXT NOT NULL DEFAULT 'ativa',
  servicos_usados_mes INTEGER DEFAULT 0,
  ultimo_reset_mes DATE DEFAULT CURRENT_DATE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Histórico de uso das assinaturas
CREATE TABLE public.assinatura_uso (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assinatura_id UUID NOT NULL REFERENCES public.assinaturas(id) ON DELETE CASCADE,
  data_uso DATE NOT NULL DEFAULT CURRENT_DATE,
  servico_utilizado TEXT NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================
-- PROGRAMA DE FIDELIDADE
-- ============================================================

-- Configurações do programa de fidelidade
CREATE TABLE public.fidelidade_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pontos_por_real DECIMAL(10,2) NOT NULL DEFAULT 1,
  valor_ponto_resgate DECIMAL(10,4) NOT NULL DEFAULT 0.10,
  pontos_minimos_resgate INTEGER NOT NULL DEFAULT 100,
  validade_pontos_dias INTEGER DEFAULT 365,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Saldo de pontos por cliente
CREATE TABLE public.fidelidade_pontos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT,
  pontos_acumulados INTEGER NOT NULL DEFAULT 0,
  pontos_resgatados INTEGER NOT NULL DEFAULT 0,
  pontos_expirados INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_cliente_fidelidade UNIQUE (cliente_nome)
);

-- Histórico de transações de pontos
CREATE TABLE public.fidelidade_transacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.fidelidade_pontos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  pontos INTEGER NOT NULL,
  descricao TEXT,
  referencia_servico TEXT,
  valor_relacionado DECIMAL(10,2),
  data_transacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE public.planos_assinatura ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinatura_uso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fidelidade_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fidelidade_pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fidelidade_transacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on planos_assinatura" ON public.planos_assinatura FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on assinaturas" ON public.assinaturas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on assinatura_uso" ON public.assinatura_uso FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on fidelidade_config" ON public.fidelidade_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on fidelidade_pontos" ON public.fidelidade_pontos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on fidelidade_transacoes" ON public.fidelidade_transacoes FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER update_planos_assinatura_updated_at
  BEFORE UPDATE ON public.planos_assinatura
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assinaturas_updated_at
  BEFORE UPDATE ON public.assinaturas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fidelidade_config_updated_at
  BEFORE UPDATE ON public.fidelidade_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fidelidade_pontos_updated_at
  BEFORE UPDATE ON public.fidelidade_pontos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configuração padrão
INSERT INTO public.fidelidade_config (pontos_por_real, valor_ponto_resgate, pontos_minimos_resgate, validade_pontos_dias)
VALUES (1, 0.10, 100, 365);