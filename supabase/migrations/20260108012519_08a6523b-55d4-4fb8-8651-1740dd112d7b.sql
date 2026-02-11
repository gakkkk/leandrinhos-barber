-- Tabela para controle de caixa (entradas e saídas)
CREATE TABLE public.caixa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  valor DECIMAL(10,2) NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.caixa ENABLE ROW LEVEL SECURITY;

-- Policy for all operations
CREATE POLICY "Allow all operations on caixa" 
ON public.caixa 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Tabela para aniversários dos clientes
CREATE TABLE public.aniversarios_clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT,
  data_aniversario DATE NOT NULL,
  notificado_este_ano BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.aniversarios_clientes ENABLE ROW LEVEL SECURITY;

-- Policy for all operations
CREATE POLICY "Allow all operations on aniversarios_clientes" 
ON public.aniversarios_clientes 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Tabela para controle de estoque
CREATE TABLE public.estoque (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  quantidade_minima INTEGER NOT NULL DEFAULT 5,
  preco_custo DECIMAL(10,2),
  preco_venda DECIMAL(10,2),
  categoria TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;

-- Policy for all operations
CREATE POLICY "Allow all operations on estoque" 
ON public.estoque 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Tabela para metas mensais
CREATE TABLE public.metas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  meta_faturamento DECIMAL(10,2) NOT NULL DEFAULT 0,
  meta_atendimentos INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(mes, ano)
);

-- Enable RLS
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

-- Policy for all operations
CREATE POLICY "Allow all operations on metas" 
ON public.metas 
FOR ALL 
USING (true) 
WITH CHECK (true);