import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduleReminderPayload {
  eventId: string;
  /**
   * ID anterior do evento (ex.: quando reagenda e recria no calendário).
   * Se informado, tentaremos "migrar" o lembrete existente para o novo eventId.
   */
  previousEventId?: string;
  clientPhone: string;
  clientName: string;
  serviceName: string;
  appointmentTime: string; // ISO string
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const nowIso = new Date().toISOString();

    const storeContactMapping = async (args: {
      eventId: string;
      clientPhone: string;
      clientName: string;
      serviceName: string;
      appointmentTime: string;
      previousEventId?: string;
      reason: "reminders_disabled" | "reminder_time_passed";
    }) => {
      const { eventId, previousEventId, clientPhone, clientName, serviceName, appointmentTime, reason } = args;

      // 1) Se é reagendamento (previousEventId), tenta migrar qualquer registro existente
      // (mesmo sent=true), para manter o vínculo do telefone com o novo eventId.
      if (previousEventId && previousEventId !== eventId) {
        const { data: prevAny, error: prevAnyErr } = await supabase
          .from("scheduled_reminders")
          .select("id")
          .eq("event_id", previousEventId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (prevAnyErr) {
          console.error("[schedule-reminder] Error fetching previous mapping:", prevAnyErr);
        }

        if (prevAny?.id) {
          const { error: updatePrevAnyErr } = await supabase
            .from("scheduled_reminders")
            .update({
              event_id: eventId,
              client_phone: clientPhone,
              client_name: clientName,
              service_name: serviceName,
              appointment_time: appointmentTime,
              // Não queremos que o cron envie isso como lembrete:
              sent: true,
              sent_at: nowIso,
              // Campo usado pelo cron para claim: se não for null, ele não processa.
              error: `contact_only:${reason}`,
              // Coluna NOT NULL
              reminder_time: appointmentTime,
            })
            .eq("id", prevAny.id);

          if (updatePrevAnyErr) {
            console.error("[schedule-reminder] Error updating previous mapping:", updatePrevAnyErr);
          } else {
            return { stored: true, migratedFrom: previousEventId };
          }
        }
      }

      // 2) Se já existe algo para o eventId, atualiza o mais recente; senão, insere um registro sent=true.
      const { data: existingAny, error: existingAnyErr } = await supabase
        .from("scheduled_reminders")
        .select("id")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingAnyErr) {
        console.error("[schedule-reminder] Error fetching existing mapping:", existingAnyErr);
      }

      if (existingAny?.id) {
        const { error: updateErr } = await supabase
          .from("scheduled_reminders")
          .update({
            client_phone: clientPhone,
            client_name: clientName,
            service_name: serviceName,
            appointment_time: appointmentTime,
            sent: true,
            sent_at: nowIso,
            error: `contact_only:${reason}`,
            reminder_time: appointmentTime,
          })
          .eq("id", existingAny.id);

        if (updateErr) {
          console.error("[schedule-reminder] Error updating contact mapping:", updateErr);
          return { stored: false };
        }
        return { stored: true, updatedExisting: true };
      }

      const { error: insertErr } = await supabase.from("scheduled_reminders").insert({
        event_id: eventId,
        client_phone: clientPhone,
        client_name: clientName,
        service_name: serviceName,
        appointment_time: appointmentTime,
        reminder_time: appointmentTime,
        sent: true,
        sent_at: nowIso,
        error: `contact_only:${reason}`,
      });

      if (insertErr) {
        console.error("[schedule-reminder] Error inserting contact mapping:", insertErr);
        return { stored: false };
      }

      return { stored: true, inserted: true };
    };

    const payload = (await req.json()) as ScheduleReminderPayload;
    const { eventId, previousEventId, clientPhone, clientName, serviceName, appointmentTime } = payload;

    console.log(
      `[schedule-reminder] Scheduling for ${clientName} at ${appointmentTime}` +
        (previousEventId ? ` (previousEventId=${previousEventId})` : "")
    );

    if (!eventId || !clientPhone || !clientName || !serviceName || !appointmentTime) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar configurações de lembrete
    const { data: settings, error: settingsError } = await supabase
      .from("client_reminder_settings")
      .select("*")
      .limit(1)
      .single();

    if (settingsError) {
      console.error("[schedule-reminder] Error fetching settings:", settingsError);
      return new Response(
        JSON.stringify({ error: "Could not fetch reminder settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se lembretes estão desativados, não agendar
    if (!settings?.enabled) {
      console.log("[schedule-reminder] Reminders are disabled");

      // Mesmo com lembretes desligados, guardamos o vínculo (eventId -> telefone)
      // para que reagendar/excluir consiga resolver o número via eventId.
      const mapping = await storeContactMapping({
        eventId,
        previousEventId,
        clientPhone,
        clientName,
        serviceName,
        appointmentTime,
        reason: "reminders_disabled",
      });

      return new Response(
        JSON.stringify({ message: "Reminders are disabled", scheduled: false, contactStored: mapping.stored }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calcular hora do lembrete (X horas antes do agendamento)
    const appointmentDate = new Date(appointmentTime);
    const reminderHours = settings.reminder_hours || 10;
    const reminderTime = new Date(appointmentDate.getTime() - reminderHours * 60 * 60 * 1000);

    // Se o horário do lembrete já passou, não agendar
    if (reminderTime <= new Date()) {
      console.log("[schedule-reminder] Reminder time already passed, skipping");

      // Ainda assim, guardar contato para permitir envio por eventId.
      const mapping = await storeContactMapping({
        eventId,
        previousEventId,
        clientPhone,
        clientName,
        serviceName,
        appointmentTime,
        reason: "reminder_time_passed",
      });

      return new Response(
        JSON.stringify({ message: "Reminder time already passed", scheduled: false, contactStored: mapping.stored }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se veio de um reagendamento (evento antigo foi deletado e um novo foi criado),
    // tenta migrar o lembrete pendente do evento anterior para o novo.
    if (previousEventId && previousEventId !== eventId) {
      const { data: prevReminder, error: prevError } = await supabase
        .from("scheduled_reminders")
        .select("id")
        .eq("event_id", previousEventId)
        .eq("sent", false)
        .limit(1)
        .maybeSingle();

      if (prevError) {
        console.error("[schedule-reminder] Error fetching previous reminder:", prevError);
      }

      if (prevReminder?.id) {
        const { error: updatePrevError } = await supabase
          .from("scheduled_reminders")
          .update({
            event_id: eventId,
            client_phone: clientPhone,
            client_name: clientName,
            service_name: serviceName,
            appointment_time: appointmentTime,
            reminder_time: reminderTime.toISOString(),
          })
          .eq("id", prevReminder.id);

        if (updatePrevError) {
          console.error("[schedule-reminder] Error updating previous reminder:", updatePrevError);
          return new Response(
            JSON.stringify({ error: updatePrevError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`[schedule-reminder] Migrated reminder ${prevReminder.id} to new eventId=${eventId}`);
        return new Response(
          JSON.stringify({
            message: "Reminder migrated",
            scheduled: true,
            reminderTime: reminderTime.toISOString(),
            reminderHours,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Verificar se já existe um lembrete para este evento
    const { data: existingReminder } = await supabase
      .from("scheduled_reminders")
      .select("id")
      .eq("event_id", eventId)
      .eq("sent", false)
      .limit(1)
      .maybeSingle();

    if (existingReminder) {
      // Atualizar lembrete existente
      const { error: updateError } = await supabase
        .from("scheduled_reminders")
        .update({
          client_phone: clientPhone,
          client_name: clientName,
          service_name: serviceName,
          appointment_time: appointmentTime,
          reminder_time: reminderTime.toISOString(),
        })
        .eq("id", existingReminder.id);

      if (updateError) {
        console.error("[schedule-reminder] Error updating:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[schedule-reminder] Updated existing reminder for ${clientName}`);
      return new Response(
        JSON.stringify({ message: "Reminder updated", scheduled: true, reminderTime: reminderTime.toISOString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar novo lembrete
    const { error: insertError } = await supabase.from("scheduled_reminders").insert({
      event_id: eventId,
      client_phone: clientPhone,
      client_name: clientName,
      service_name: serviceName,
      appointment_time: appointmentTime,
      reminder_time: reminderTime.toISOString(),
    });

    if (insertError) {
      console.error("[schedule-reminder] Error inserting:", insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[schedule-reminder] Created reminder for ${clientName} at ${reminderTime.toISOString()}`);

    return new Response(
      JSON.stringify({ 
        message: "Reminder scheduled", 
        scheduled: true, 
        reminderTime: reminderTime.toISOString(),
        reminderHours 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[schedule-reminder] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
