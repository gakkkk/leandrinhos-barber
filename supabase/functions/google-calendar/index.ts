import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_CALENDAR_API_KEY = Deno.env.get('GOOGLE_CALENDAR_API_KEY');
    const GOOGLE_CALENDAR_ID = Deno.env.get('GOOGLE_CALENDAR_ID');

    console.log('API Key exists:', !!GOOGLE_CALENDAR_API_KEY);
    console.log('Calendar ID:', GOOGLE_CALENDAR_ID ? `${GOOGLE_CALENDAR_ID.substring(0, 10)}...` : 'NOT SET');

    if (!GOOGLE_CALENDAR_API_KEY || !GOOGLE_CALENDAR_ID) {
      return new Response(
        JSON.stringify({ error: 'Google Calendar não configurado', data: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { timeMin, timeMax } = await req.json();
    console.log('Fetching events from', timeMin, 'to', timeMax);

    // Tentar buscar o calendário primário se o ID parecer um email
    let calendarId = GOOGLE_CALENDAR_ID;
    
    // Se não tiver @, pode ser que o usuário colocou só o email sem o domínio completo
    if (!calendarId.includes('@') && !calendarId.includes('.calendar.google.com')) {
      calendarId = `${calendarId}@gmail.com`;
    }

    const encodedCalendarId = encodeURIComponent(calendarId);
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events?` +
      `key=${GOOGLE_CALENDAR_API_KEY}&` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `singleEvents=true&` +
      `orderBy=startTime`;

    console.log('Calling Google Calendar API with ID:', calendarId);
    
    const response = await fetch(url);
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('Google Calendar API error:', response.status, responseText);
      
      // Tentar mensagem de erro mais útil
      let errorMsg = `Erro ${response.status}`;
      if (response.status === 404) {
        errorMsg = 'Calendário não encontrado. Verifique se: 1) O ID do calendário está correto, 2) O calendário está configurado como público';
      } else if (response.status === 403) {
        errorMsg = 'Acesso negado. Verifique se a API Key está correta e tem permissão para Google Calendar API';
      }
      
      return new Response(
        JSON.stringify({ error: errorMsg, data: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = JSON.parse(responseText);
    console.log('Found', data.items?.length || 0, 'events');
    
    return new Response(
      JSON.stringify({ data: data.items || [], error: null }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido', data: null }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
