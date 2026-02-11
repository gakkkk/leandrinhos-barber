-- Drop the existing ferias table and recreate with individual days
DROP TABLE IF EXISTS public.ferias;

-- Create new ferias table with single date per row
CREATE TABLE public.ferias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ferias ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth in this app)
CREATE POLICY "Allow all operations on ferias" 
ON public.ferias 
FOR ALL 
USING (true) 
WITH CHECK (true);