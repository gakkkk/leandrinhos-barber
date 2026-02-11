import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BirthdayAlertPayload {
  phone: string;
  clientName: string;
  customMessage?: string;
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
      console.error("[send-birthday-alert] Missing W-API credentials");
      return new Response(
        JSON.stringify({ error: "W-API credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phone, clientName, customMessage } = (await req.json()) as BirthdayAlertPayload;

    if (!phone || !clientName) {
      return new Response(
        JSON.stringify({ error: "Phone and clientName are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Formatar número de telefone
    let formattedPhone = phone.replace(/\D/g, "");
    if (!formattedPhone.startsWith("55") && formattedPhone.length <= 11) {
      formattedPhone = "55" + formattedPhone;
    }

    // Mensagem padrão de aniversário
    const defaultMessage = `Parabéns, ${clientName}! 🎂🎉\n\nA Leandrinho's Barber deseja a você um feliz aniversário! Como presente especial, você tem 10% de desconto no seu próximo corte! 💈✨\n\nAgende seu horário conosco!`;
    const message = customMessage || defaultMessage;

    console.log(`[send-birthday-alert] Sending birthday alert to: ${formattedPhone}`);

    const wapiUrl = `https://api.w-api.app/v1/message/send-text?instanceId=${WAPI_INSTANCE_ID}`;

    const requestBody = {
      telefone: formattedPhone,
      phone: formattedPhone,
      mensagem: message,
      message: message,
      delayMessage: 15,
    };

    const wapiResponse = await fetch(wapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Urso ${WAPI_TOKEN}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await wapiResponse.text();
    console.log(`[send-birthday-alert] W-API response (status ${wapiResponse.status}):`, responseText.substring(0, 500));

    let wapiResult;
    try {
      wapiResult = JSON.parse(responseText);
    } catch {
      wapiResult = { error: "Invalid response", raw: responseText.substring(0, 200) };
    }

    // Log da operação
    await supabase.from("wapi_logs").insert({
      phone: formattedPhone,
      message: message,
      endpoint: wapiUrl,
      request_payload: requestBody,
      response_status: wapiResponse.status,
      response_body: wapiResult,
      success: wapiResponse.ok,
      error_message: wapiResponse.ok ? null : (wapiResult?.message || wapiResult?.error || 'Unknown error'),
    });

    if (!wapiResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to send birthday alert", details: wapiResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, result: wapiResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-birthday-alert] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
