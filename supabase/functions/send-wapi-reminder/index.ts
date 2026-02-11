import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderPayload {
  phone?: string;
  message: string;
  reminderId?: string;
  diagnosticMode?: boolean;
  eventId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const WAPI_INSTANCE_ID = Deno.env.get("WAPI_INSTANCE_ID");
    const WAPI_TOKEN = Deno.env.get("WAPI_TOKEN");

    if (!WAPI_INSTANCE_ID || !WAPI_TOKEN) {
      console.error("[send-wapi-reminder] Missing W-API credentials");
      return new Response(
        JSON.stringify({ 
          error: "W-API credentials not configured",
          diagnostics: {
            hasInstanceId: !!WAPI_INSTANCE_ID,
            hasToken: !!WAPI_TOKEN,
          }
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phone, message, reminderId, diagnosticMode, eventId } = (await req.json()) as ReminderPayload;

    if (!message || (!phone && !eventId)) {
      return new Response(
        JSON.stringify({ error: "Message is required, and either phone or eventId must be provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se não veio telefone, tenta resolver pelo eventId (usando registros de lembretes)
    let resolvedPhone = phone;
    if (!resolvedPhone && eventId) {
      const { data: reminderRow, error: reminderErr } = await supabase
        .from("scheduled_reminders")
        .select("client_phone")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reminderErr) {
        console.error("[send-wapi-reminder] Failed to resolve phone from scheduled_reminders:", reminderErr);
      }

      resolvedPhone = reminderRow?.client_phone ?? undefined;
    }

    if (!resolvedPhone) {
      return new Response(
        JSON.stringify({
          error: "Phone not found",
          details: { hasPhone: !!phone, hasEventId: !!eventId },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Formatar número de telefone (remover caracteres especiais)
    let formattedPhone = resolvedPhone.replace(/\D/g, "");
    
    // Se o número não começar com 55 (Brasil), adicionar
    if (!formattedPhone.startsWith("55") && formattedPhone.length <= 11) {
      formattedPhone = "55" + formattedPhone;
    }

    console.log(`[send-wapi-reminder] Original phone: ${resolvedPhone}`);
    console.log(`[send-wapi-reminder] Formatted phone: ${formattedPhone}`);

    // Endpoint W-API
    const wapiUrl = `https://api.w-api.app/v1/message/send-text?instanceId=${WAPI_INSTANCE_ID}`;

    const requestBody = {
      telefone: formattedPhone,
      phone: formattedPhone,
      mensagem: message,
      message: message,
      delayMessage: 15,
    };

    console.log(`[send-wapi-reminder] Using URL: ${wapiUrl}`);
    console.log(`[send-wapi-reminder] Request body:`, JSON.stringify(requestBody));

    const wapiResponse = await fetch(wapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Urso ${WAPI_TOKEN}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await wapiResponse.text();
    console.log(
      `[send-wapi-reminder] W-API raw response (status ${wapiResponse.status}):`,
      responseText.substring(0, 500)
    );

    let wapiResult;
    try {
      wapiResult = JSON.parse(responseText);
    } catch {
      console.error(`[send-wapi-reminder] W-API returned non-JSON response`);
      wapiResult = {
        error: "Invalid response from W-API",
        raw: responseText.substring(0, 200),
      };
    }

    // Salvar log de auditoria
    const logEntry = {
      phone: formattedPhone,
      message: message,
      endpoint: wapiUrl,
      request_payload: requestBody,
      response_status: wapiResponse.status,
      response_body: wapiResult,
      success: wapiResponse.ok,
      error_message: wapiResponse.ok ? null : (wapiResult?.message || wapiResult?.error || 'Unknown error'),
      reminder_id: reminderId || null,
    };

    await supabase.from("wapi_logs").insert(logEntry);
    console.log("[send-wapi-reminder] Audit log saved");

    // Atualizar o status do lembrete se tiver reminderId
    if (reminderId) {
      if (wapiResponse.ok) {
        await supabase
          .from("scheduled_reminders")
          .update({ sent: true, sent_at: new Date().toISOString() })
          .eq("id", reminderId);
      } else {
        await supabase
          .from("scheduled_reminders")
          .update({ error: JSON.stringify(wapiResult) })
          .eq("id", reminderId);
      }
    }

    // Resposta com diagnóstico completo se solicitado
    const diagnosticInfo = diagnosticMode ? {
      endpoint: wapiUrl,
      requestPayload: requestBody,
      responseStatus: wapiResponse.status,
      responseBody: wapiResult,
      formattedPhone,
      originalPhone: resolvedPhone,
      timestamp: new Date().toISOString(),
    } : undefined;

    if (!wapiResponse.ok) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to send message", 
          details: wapiResult,
          diagnostics: diagnosticInfo,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        result: wapiResult,
        diagnostics: diagnosticInfo,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-wapi-reminder] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
