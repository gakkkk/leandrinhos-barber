-- Tabela para auditoria de envios W-API
CREATE TABLE public.wapi_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_payload JSONB NOT NULL,
  response_status INTEGER,
  response_body JSONB,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  reminder_id UUID REFERENCES public.scheduled_reminders(id)
);

-- Enable RLS
ALTER TABLE public.wapi_logs ENABLE ROW LEVEL SECURITY;

-- Policy para permitir todas operações
CREATE POLICY "Allow all operations on wapi_logs" 
ON public.wapi_logs 
FOR ALL 
USING (true)
WITH CHECK (true);