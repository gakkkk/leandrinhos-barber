-- Create variaveis_externas table
CREATE TABLE public.variaveis_externas (
  id INTEGER PRIMARY KEY,
  ativo BOOLEAN NOT NULL DEFAULT false,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default row with id 1
INSERT INTO public.variaveis_externas (id, ativo, descricao) 
VALUES (1, false, 'Variável de controle principal');

-- Disable RLS since this is a personal app without authentication
ALTER TABLE public.variaveis_externas ENABLE ROW LEVEL SECURITY;

-- Allow all operations (personal app, no auth)
CREATE POLICY "Allow all operations on variaveis_externas" 
ON public.variaveis_externas 
FOR ALL 
USING (true) 
WITH CHECK (true);