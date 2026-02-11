import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// External Supabase configuration - using service role key to bypass RLS
const EXTERNAL_SUPABASE_URL = 'https://ekqjvkwzsdriukztucox.supabase.co';
const EXTERNAL_SUPABASE_SERVICE_KEY = 'sb_secret_jJCFinRCeXA2HDzlBtAx2w_uW2wLSoh';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { endpoint, method = 'GET', body } = await req.json();

    // For DELETE without a filter, add one to delete all rows
    let finalEndpoint = endpoint;
    if (method === 'DELETE' && !endpoint.includes('?')) {
      finalEndpoint = `${endpoint}?id=neq.00000000-0000-0000-0000-000000000000`;
    } else if (method === 'DELETE' && !endpoint.includes('id=')) {
      finalEndpoint = `${endpoint}&id=neq.00000000-0000-0000-0000-000000000000`;
    }

    console.log(`Proxy request: ${method} ${finalEndpoint}`);
    console.log(`Target URL: ${EXTERNAL_SUPABASE_URL}/rest/v1/${finalEndpoint}`);

    const url = `${EXTERNAL_SUPABASE_URL}/rest/v1/${finalEndpoint}`;
    
    const headers: HeadersInit = {
      'apikey': EXTERNAL_SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${EXTERNAL_SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Supabase error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`Proxy success: ${method} ${finalEndpoint} - returned ${Array.isArray(data) ? data.length : 1} items`);

    return new Response(
      JSON.stringify({ data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Proxy error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
