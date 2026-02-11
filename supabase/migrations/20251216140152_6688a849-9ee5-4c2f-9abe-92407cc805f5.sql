-- Tabela para rastrear lembretes já enviados (evita duplicatas)
CREATE TABLE IF NOT EXISTS public.notified_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  reminder_minutes INTEGER NOT NULL,
  notified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, reminder_minutes)
);

-- Habilita RLS
ALTER TABLE public.notified_reminders ENABLE ROW LEVEL SECURITY;

-- Policy para permitir operações
CREATE POLICY "Allow all operations on notified_reminders" 
ON public.notified_reminders 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Adiciona coluna reminder_minutes na push_subscriptions para cada usuário configurar
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER DEFAULT 15;

-- Índice para limpeza de registros antigos
CREATE INDEX IF NOT EXISTS idx_notified_reminders_notified_at ON public.notified_reminders(notified_at);