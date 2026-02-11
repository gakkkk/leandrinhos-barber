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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, body, data } = await req.json();
    
    console.log('Sending push notification:', { title, body });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (error) {
      console.error('Error fetching subscriptions:', error);
      throw error;
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions`);

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not configured');
    }

    const appServerKeys = await importVapidKeys(vapidPublicKey, vapidPrivateKey);

    const payload = JSON.stringify({
      title,
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data,
    });

    let successCount = 0;
    let failedCount = 0;
    const failedEndpoints: string[] = [];

    for (const sub of subscriptions || []) {
      const result = await sendPushNotification(
        appServerKeys,
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload
      );

      if (result.success) {
        successCount++;
        console.log(`Push sent to ${sub.endpoint.slice(0, 50)}...`);
      } else {
        failedCount++;
        console.error('Push error:', { status: result.status, error: result.error });

        if (result.status === 410 || result.status === 404) {
          failedEndpoints.push(sub.endpoint);
          console.log(`Subscription expired: ${sub.endpoint.slice(0, 50)}...`);
        }
      }
    }

    if (failedEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', failedEndpoints);
      console.log(`Removed ${failedEndpoints.length} expired subscriptions`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount, 
        failed: failedCount,
        message: `Sent ${successCount} notifications` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in send-push-notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
