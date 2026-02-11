import { supabase } from '@/integrations/supabase/client';

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
}

export interface CalendarResponse {
  data: GoogleCalendarEvent[] | null;
  error: string | null;
}

export async function fetchGoogleCalendarEvents(
  timeMin: string,
  timeMax: string
): Promise<CalendarResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('google-calendar', {
      body: { timeMin, timeMax }
    });

    if (error) {
      console.error('Edge function error:', error);
      return { data: null, error: error.message };
    }

    if (data?.error) {
      console.warn('Não foi possível carregar eventos do Google Calendar:', data.error);
      return { data: null, error: data.error };
    }

    return { data: data?.data || [], error: null };
  } catch (error) {
    console.error('Google Calendar fetch error:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

// Extrair data e hora diretamente da string ISO sem conversão de timezone
function extractDateTimeFromISO(isoString: string): { date: string; time: string } {
  // Formato esperado: "2026-01-02T20:00:00-03:00" ou "2026-01-02T23:00:00Z"
  // Queremos extrair a data e hora LOCAL como aparecem antes do timezone
  
  // Se for um dateTime com timezone offset (ex: 2026-01-02T20:00:00-03:00)
  const dateTimeMatch = isoString.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (dateTimeMatch) {
    return {
      date: dateTimeMatch[1],
      time: dateTimeMatch[2]
    };
  }
  
  // Se for apenas uma data (all-day event)
  const dateMatch = isoString.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateMatch) {
    return {
      date: dateMatch[1],
      time: '00:00'
    };
  }
  
  // Fallback: usar Date parsing (pode ter problemas de timezone)
  const date = new Date(isoString);
  return {
    date: date.toISOString().split('T')[0],
    time: date.toTimeString().slice(0, 5)
  };
}

// Converter evento do Google Calendar para o formato do app
export function convertToAgendamento(event: GoogleCalendarEvent) {
  const startDateTime = event.start.dateTime || event.start.date || '';
  const endDateTime = event.end.dateTime || event.end.date || '';
  
  // Extrair data/hora diretamente da string para evitar problemas de timezone
  const start = extractDateTimeFromISO(startDateTime);
  const end = extractDateTimeFromISO(endDateTime);

  // O formato do título é "Serviço - Nome do Cliente"
  const summary = event.summary || 'Sem título';
  const parts = summary.split(' - ');
  
  // Se tiver o formato esperado, extrai serviço e cliente
  // Caso contrário, usa o título inteiro como cliente
  let servico = '';
  let clienteNome = summary;
  
  if (parts.length >= 2) {
    servico = parts[0].trim();
    clienteNome = parts.slice(1).join(' - ').trim(); // Junta caso o nome tenha " - "
  }

  return {
    id: event.id,
    cliente_nome: clienteNome,
    servico: servico || event.description || '',
    data: start.date,
    hora_inicio: start.time,
    hora_fim: end.time,
    status: 'confirmado' as const,
  };
}
