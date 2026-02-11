import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[check-client-reminders] Starting check...");

    const now = new Date();

    // PASSO 1: Buscar lembretes pendentes e marcar como "em processamento" atomicamente
    // Usamos um campo de controle para evitar race condition entre múltiplas execuções do cron
    const processingId = crypto.randomUUID();
    
    // Marcar lembretes que serão processados AGORA (evita duplicatas)
    const { data: claimedReminders, error: claimError } = await supabase
      .from("scheduled_reminders")
      .update({ error: `processing:${processingId}` })
      .eq("sent", false)
      .is("error", null)
      .lte("reminder_time", now.toISOString())
      .select("*");

    if (claimError) {
      console.error("[check-client-reminders] Error claiming reminders:", claimError);
      return new Response(
        JSON.stringify({ error: claimError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se não conseguiu "reivindicar" nenhum lembrete, pode ser que já foram processados
    if (!claimedReminders || claimedReminders.length === 0) {
      console.log("[check-client-reminders] No reminders to process (already claimed or none pending)");
      return new Response(
        JSON.stringify({ message: "No pending reminders", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[check-client-reminders] Claimed ${claimedReminders.length} reminders for processing`);

    // PASSO 2: Filtrar duplicatas por event_id (manter apenas o mais recente por agendamento)
    const uniqueByEventId = new Map<string, typeof claimedReminders[0]>();
    for (const reminder of claimedReminders) {
      const existing = uniqueByEventId.get(reminder.event_id);
      if (!existing || new Date(reminder.created_at) > new Date(existing.created_at)) {
        uniqueByEventId.set(reminder.event_id, reminder);
      }
    }

    const remindersToProcess = Array.from(uniqueByEventId.values());
    const duplicateIds = claimedReminders
      .filter(r => !remindersToProcess.includes(r))
      .map(r => r.id);

    // Marcar duplicatas como já enviadas para evitar reprocessamento
    if (duplicateIds.length > 0) {
      console.log(`[check-client-reminders] Marking ${duplicateIds.length} duplicate reminders as sent`);
      await supabase
        .from("scheduled_reminders")
        .update({ sent: true, sent_at: now.toISOString(), error: "duplicate_skipped" })
        .in("id", duplicateIds);
    }

    console.log(`[check-client-reminders] Processing ${remindersToProcess.length} unique reminders`);

    // Buscar configurações de lembrete para pegar o template
    const { data: settings } = await supabase
      .from("client_reminder_settings")
      .select("*")
      .limit(1)
      .single();

    const messageTemplate = settings?.message_template || 
      "Olá {nome}! 👋\n\nLembrete: Você tem um horário marcado hoje às {hora} na Leandrinho's Barber.\n\nServiço: {servico}\n\nTe esperamos! 💈";

    let sentCount = 0;
    const errors: string[] = [];

    for (const reminder of remindersToProcess) {
      try {
        // Formatar a hora do agendamento
        const appointmentDate = new Date(reminder.appointment_time);
        const hora = appointmentDate.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Sao_Paulo",
        });

        // Substituir placeholders no template
        const message = messageTemplate
          .replace("{nome}", reminder.client_name)
          .replace("{hora}", hora)
          .replace("{servico}", reminder.service_name);

        // Enviar via edge function
        const response = await fetch(`${supabaseUrl}/functions/v1/send-wapi-reminder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            phone: reminder.client_phone,
            message,
            reminderId: reminder.id,
          }),
        });

        if (response.ok) {
          sentCount++;
          console.log(`[check-client-reminders] Sent reminder to ${reminder.client_name}`);
        } else {
          const errorData = await response.json();
          errors.push(`Failed to send to ${reminder.client_name}: ${JSON.stringify(errorData)}`);
          console.error(`[check-client-reminders] Failed:`, errorData);
          
          // Limpar o campo de erro para permitir reprocessamento em caso de falha
          await supabase
            .from("scheduled_reminders")
            .update({ error: JSON.stringify(errorData) })
            .eq("id", reminder.id);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Error sending to ${reminder.client_name}: ${errorMsg}`);
        console.error(`[check-client-reminders] Error:`, error);
        
        // Limpar o campo de erro para permitir reprocessamento
        await supabase
          .from("scheduled_reminders")
          .update({ error: errorMsg })
          .eq("id", reminder.id);
      }
    }

    console.log(`[check-client-reminders] Completed. Sent: ${sentCount}, Errors: ${errors.length}, Duplicates skipped: ${duplicateIds.length}`);

    return new Response(
      JSON.stringify({ 
        message: `Processed ${remindersToProcess.length} reminders`, 
        sent: sentCount, 
        duplicatesSkipped: duplicateIds.length,
        errors: errors.length > 0 ? errors : undefined 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[check-client-reminders] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
