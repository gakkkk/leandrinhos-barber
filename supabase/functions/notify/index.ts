import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generatePushHTTPRequest } from "https://esm.sh/webpush-webcrypto@1.0.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Decode base64url to Uint8Array
function decodeBase64URL(str: string): Uint8Array {
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Encode Uint8Array to base64url
function encodeBase64URL(arr: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Convert raw 32-byte private key to PKCS#8 format for P-256
function rawPrivateKeyToPkcs8(rawKey: Uint8Array): Uint8Array {
  // PKCS#8 structure for P-256 EC key
  const prefix = new Uint8Array([
    0x30, 0x81, 0x87, // SEQUENCE, length 135
    0x02, 0x01, 0x00, // INTEGER version = 0
    0x30, 0x13, // SEQUENCE AlgorithmIdentifier
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID 1.2.840.10045.2.1 (ecPublicKey)
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID 1.2.840.10045.3.1.7 (prime256v1/P-256)
    0x04, 0x6d, // OCTET STRING, length 109
    0x30, 0x6b, // SEQUENCE ECPrivateKey
    0x02, 0x01, 0x01, // INTEGER version = 1
    0x04, 0x20, // OCTET STRING, length 32 (the private key)
  ]);
  
  const suffix = new Uint8Array([
    0xa1, 0x44, // [1] publicKey (we'll skip this, length 68)
    0x03, 0x42, 0x00, // BIT STRING, length 66
  ]);
  
  // For a simpler approach, just build the minimal structure
  const pkcs8 = new Uint8Array([
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
  
  return pkcs8;
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, body, type, data } = await req.json();

    console.log('Received notification request:', { title, body, type });

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: 'title and body are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert notification into the notifications table
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        title,
        body,
        type: type || 'info',
        data: data || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting notification:', error);
      throw error;
    }

    console.log('Notification created:', notification);

    // === PUSH NOTIFICATIONS ===
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    let pushSent = 0;
    let pushFailed = 0;

    if (vapidPublicKey && vapidPrivateKey) {
      const appServerKeys = await importVapidKeys(vapidPublicKey, vapidPrivateKey);

      const { data: subscriptions, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*');

      if (subError) {
        console.error('Error fetching push subscriptions:', subError);
      } else if (subscriptions && subscriptions.length > 0) {
        console.log(`Found ${subscriptions.length} push subscriptions, sending...`);

        const pushPayload = JSON.stringify({
          title,
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          data: data || {},
        });

        const expiredIds: string[] = [];

        for (const sub of subscriptions) {
          const result = await sendPushNotification(
            appServerKeys,
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            pushPayload
          );

          if (result.success) {
            pushSent++;
            console.log(`Push sent to subscription ${sub.id}`);
          } else {
            pushFailed++;
            console.error('Push send failed:', { id: sub.id, status: result.status, error: result.error });

            if (result.status === 410 || result.status === 404) {
              expiredIds.push(sub.id);
            }
          }
        }

        // Remove expired subscriptions
        if (expiredIds.length > 0) {
          await supabase.from('push_subscriptions').delete().in('id', expiredIds);
          console.log(`Removed ${expiredIds.length} expired subscriptions`);
        }
      } else {
        console.log('No push subscriptions found');
      }
    } else {
      console.log('VAPID keys not configured, skipping push notifications');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notification,
        push: { sent: pushSent, failed: pushFailed },
        message: 'Notification sent successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in notify function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
