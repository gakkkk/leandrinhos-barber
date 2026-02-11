-- Tabela para configurações de lembrete do cliente via WhatsApp
CREATE TABLE public.client_reminder_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  reminder_hours INTEGER NOT NULL DEFAULT 10,
  message_template TEXT NOT NULL DEFAULT 'Olá {nome}! 👋\n\nLembrete: Você tem um horário marcado hoje às {hora} na Leandrinho''s Barber.\n\nServiço: {servico}\n\nTe esperamos! 💈',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir configuração padrão
INSERT INTO public.client_reminder_settings (reminder_hours, message_template) 
VALUES (10, 'Olá {nome}! 👋\n\nLembrete: Você tem um horário marcado hoje às {hora} na Leandrinho''s Barber.\n\nServiço: {servico}\n\nTe esperamos! 💈');

-- Tabela para armazenar lembretes agendados
CREATE TABLE public.scheduled_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  appointment_time TIMESTAMP WITH TIME ZONE NOT NULL,
  reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
  sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reminders ENABLE ROW LEVEL SECURITY;

-- Policies para acesso público (app sem auth)
CREATE POLICY "Allow all operations on client_reminder_settings"
ON public.client_reminder_settings FOR ALL
USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on scheduled_reminders"
ON public.scheduled_reminders FOR ALL
USING (true) WITH CHECK (true);

-- Índice para busca de lembretes pendentes
CREATE INDEX idx_scheduled_reminders_pending ON public.scheduled_reminders (reminder_time) WHERE sent = false;