import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generatePushHTTPRequest } from "https://esm.sh/webpush-webcrypto@1.0.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

// Decode base64url to Uint8Array
function decodeBase64URL(str: string): Uint8Array {
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Convert raw 32-byte private key to PKCS#8 format for P-256
function rawPrivateKeyToPkcs8(rawKey: Uint8Array): Uint8Array {
  return new Uint8Array([
    0x30, 0x41, // SEQUENCE, length 65
    0x02, 0x01, 0x00, // INTEGER version = 0
    0x30, 0x13, // SEQUENCE AlgorithmIdentifier
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID ecPublicKey
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID P-256
    0x04, 0x27, // OCTET STRING, length 39
    0x30, 0x25, // SEQUENCE ECPrivateKey
    0x02, 0x01, 0x01, // INTEGER version = 1
    0x04, 0x20, // OCTET STRING, length 32
    ...rawKey
  ]);
}

// Import VAPID keys from base64url strings
async function importVapidKeys(publicKeyB64: string, privateKeyB64: string) {
  const publicKeyRaw = decodeBase64URL(publicKeyB64);
  const privateKeyRaw = decodeBase64URL(privateKeyB64);
  
  const publicKey = await crypto.subtle.importKey(
    "raw",
    publicKeyRaw.buffer as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    []
  );
  
  const pkcs8 = rawPrivateKeyToPkcs8(privateKeyRaw);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8.buffer as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );
  
  return { publicKey, privateKey };
}

// Send push notification
async function sendPushNotification(
  keys: { publicKey: CryptoKey; privateKey: CryptoKey },
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const { headers, body, endpoint } = await generatePushHTTPRequest({
      applicationServerKeys: keys,
      payload,
      target: {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      adminContact: "mailto:vanducht111@hotmail.com",
      ttl: 86400,
      urgency: "high",
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      return { success: false, status: response.status, error: await response.text() };
    }

    return { success: true, status: response.status };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  }
}

// Busca eventos do Google Calendar
async function fetchGoogleCalendarEvents(): Promise<GoogleCalendarEvent[]> {
  const apiKey = Deno.env.get("GOOGLE_CALENDAR_API_KEY");
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID");

  if (!apiKey || !calendarId) {
    console.error("Missing Google Calendar configuration");
    return [];
  }

  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error("Google Calendar API error:", data.error);
      return [];
    }

    console.log(`Fetched ${data.items?.length || 0} upcoming events`);
    return data.items || [];
  } catch (error) {
    console.error("Error fetching Google Calendar:", error);
    return [];
  }
}

// Converte evento para dados de notificação
function parseEvent(event: GoogleCalendarEvent) {
  const startDateTime = event.start.dateTime || event.start.date || "";
  const endDateTime = event.end.dateTime || event.end.date || "";
  const startDate = new Date(startDateTime);
  const endDate = new Date(endDateTime);

  const summary = event.summary || "Sem título";
  const parts = summary.split(" - ");

  let servico = "";
  let clienteNome = summary;

  if (parts.length >= 2) {
    servico = parts[0].trim();
    clienteNome = parts.slice(1).join(" - ").trim();
  }

  return {
    id: event.id,
    cliente_nome: clienteNome,
    servico,
    data: startDate.toISOString().split("T")[0],
    hora_inicio: startDate.toTimeString().slice(0, 5),
    hora_fim: endDate.toTimeString().slice(0, 5),
    startTime: startDate,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("=== CHECK REMINDERS STARTED ===");
  console.log("Time:", new Date().toISOString());

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*");

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No push subscriptions found");
      return new Response(JSON.stringify({ success: true, message: "No subscriptions to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${subscriptions.length} push subscriptions`);

    const events = await fetchGoogleCalendarEvents();

    if (events.length === 0) {
      console.log("No upcoming events");
      return new Response(JSON.stringify({ success: true, message: "No upcoming events" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("VAPID keys not configured, cannot send push");
      return new Response(JSON.stringify({ success: false, error: "VAPID keys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appServerKeys = await importVapidKeys(vapidPublicKey, vapidPrivateKey);

    const now = new Date();
    let notificationsSent = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions) {
      const reminderMinutes = sub.reminder_minutes || 15;
      const reminderMs = reminderMinutes * 60 * 1000;

      for (const event of events) {
        const parsed = parseEvent(event);
        const timeDiff = parsed.startTime.getTime() - now.getTime();

        if (timeDiff > 0 && timeDiff <= reminderMs) {
          const { data: existing, error: existingError } = await supabase
            .from("notified_reminders")
            .select("id")
            .eq("event_id", event.id)
            .eq("reminder_minutes", reminderMinutes)
            .maybeSingle();

          if (existingError) {
            console.error("Error checking notified_reminders:", existingError);
          }

          if (existing) {
            console.log(`Already notified for event ${event.id} at ${reminderMinutes}min`);
            continue;
          }

          const minutesUntil = Math.round(timeDiff / 60000);
          const payload = JSON.stringify({
            title: `⏰ Agendamento em ${minutesUntil} min`,
            body: `${parsed.cliente_nome}\n${parsed.servico}\nHorário: ${parsed.hora_inicio} - ${parsed.hora_fim}`,
            icon: "/pwa-192x192.png",
            badge: "/pwa-192x192.png",
            data: { eventId: event.id },
          });

          console.log(`Sending reminder for event ${event.id} to ${sub.endpoint.slice(0, 50)}...`);

          const result = await sendPushNotification(
            appServerKeys,
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            payload
          );

          if (result.success) {
            notificationsSent++;

            const { error: insertError } = await supabase
              .from("notified_reminders")
              .insert({ event_id: event.id, reminder_minutes: reminderMinutes });

            if (insertError) {
              console.error("Error marking as notified:", insertError);
            }
          } else {
            console.error("Reminder push failed:", { status: result.status, error: result.error });

            if (result.status === 410 || result.status === 404) {
              expiredEndpoints.push(sub.endpoint);
            }
          }
        }
      }
    }

    if (expiredEndpoints.length > 0) {
      const uniqueExpired = [...new Set(expiredEndpoints)];
      await supabase.from("push_subscriptions").delete().in("endpoint", uniqueExpired);
      console.log(`Removed ${uniqueExpired.length} expired subscriptions`);
    }

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("notified_reminders").delete().lt("notified_at", yesterday);

    console.log(`=== CHECK REMINDERS COMPLETE: ${notificationsSent} notifications sent ===`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: notificationsSent,
        subscriptions: subscriptions.length,
        events: events.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error in check-reminders:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
