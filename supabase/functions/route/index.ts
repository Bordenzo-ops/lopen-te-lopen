/**
 * Supabase Edge Function: route
 *
 * Proxy tussen de app en de OpenRouteService (ORS) routing-API. De
 * ORS-sleutel wordt hier serverside opgeslagen als Supabase Secret
 * (ORS_API_KEY) en verlaat nooit de client. Zo staat er geen werkende
 * routeplanner-sleutel meer in de app-bundel of in versiebeheer (WP3).
 *
 * Zelfde hardening als de tts-functie:
 *  - JWT-verificatie: de Authorization header moet het access token van de
 *    ingelogde (of anonieme) Supabase-gebruiker bevatten, niet de kale anon
 *    key. Dat token wordt geverifieerd via supabase.auth.getUser.
 *  - Whitelist op endpoint: alleen de foot-walking directions-endpoint is
 *    toegestaan. Elke andere waarde wordt geweigerd.
 *  - Eenvoudige in-memory rate limit per gebruiker: max 20 verzoeken/minuut.
 *
 * Deploy:
 *   supabase functions deploy route
 *   supabase secrets set ORS_API_KEY=...    (je OpenRouteService-sleutel)
 *   (SUPABASE_URL en SUPABASE_ANON_KEY zijn binnen edge functions standaard
 *   al als omgevingsvariabelen beschikbaar)
 *
 * Aanroep vanuit de app (via routeService.ts):
 *   POST /functions/v1/route
 *   Authorization: Bearer <supabase-sessie-access-token>
 *   Content-Type: application/json
 *   Body: { endpoint: '/directions/foot-walking/geojson', body: { ... } }
 *
 * Geeft terug: de ORS GeoJSON-response, ongewijzigd doorgegeven.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ORS_API_KEY = Deno.env.get('ORS_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

// Toegestane ORS-endpoints. De app plant uitsluitend wandel-/looproutes;
// elke andere endpoint wordt geweigerd zodat de proxy niet als open ORS-relay
// misbruikt kan worden.
const ALLOWED_ENDPOINTS = new Set(['/directions/foot-walking/geojson']);

// Eenvoudige in-memory rate limit per user-id: max 20 verzoeken per minuut.
// Per edge function-instantie, geen verdeelde limiet, maar volstaat als
// eerste verdedigingslinie tegen misbruik of bugs die veel verzoeken afvuren.
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const requestLog = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const timestamps = requestLog.get(userId) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    requestLog.set(userId, recent);
    return true;
  }
  recent.push(now);
  requestLog.set(userId, recent);
  return false;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' };

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  if (!ORS_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Routeplanner niet geconfigureerd op de server.' }),
      { status: 503, headers: JSON_HEADERS },
    );
  }

  // JWT-verificatie: haal de Bearer token uit de Authorization header en
  // verifieer die bij Supabase. Anonieme Supabase-gebruikers zijn geldig,
  // de kale anon key als Bearer token is dat echter niet.
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(
      JSON.stringify({ error: 'Niet geautoriseerd.' }),
      { status: 401, headers: JSON_HEADERS },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData?.user) {
    return new Response(
      JSON.stringify({ error: 'Niet geautoriseerd.' }),
      { status: 401, headers: JSON_HEADERS },
    );
  }

  const userId = userData.user.id;

  if (isRateLimited(userId)) {
    return new Response(
      JSON.stringify({ error: 'Te veel verzoeken, probeer het over een minuut opnieuw.' }),
      { status: 429, headers: JSON_HEADERS },
    );
  }

  let payload: { endpoint?: string; body?: unknown };
  try {
    payload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Ongeldig JSON-verzoek.' }),
      { status: 400, headers: JSON_HEADERS },
    );
  }

  const { endpoint, body } = payload;

  if (!endpoint || typeof endpoint !== 'string' || !ALLOWED_ENDPOINTS.has(endpoint)) {
    return new Response(
      JSON.stringify({ error: 'Ongeldig of niet-toegestaan endpoint.' }),
      { status: 400, headers: JSON_HEADERS },
    );
  }

  if (!body || typeof body !== 'object') {
    return new Response(
      JSON.stringify({ error: 'Vereist veld ontbreekt: body.' }),
      { status: 400, headers: JSON_HEADERS },
    );
  }

  try {
    const orsResp = await fetch(`https://api.openrouteservice.org/v2${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: ORS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json, application/geo+json',
      },
      body: JSON.stringify(body),
    });

    // Response ongewijzigd doorgeven: zelfde status en body als ORS, zodat de
    // bestaande foutafhandeling in routeService.ts (403-daglimiet, 429, enz.)
    // blijft werken. Alleen de content-type nemen we over.
    const text = await orsResp.text();
    return new Response(text, {
      status: orsResp.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': orsResp.headers.get('Content-Type') ?? 'application/json',
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: 'Routeplanner is nu niet bereikbaar.' }),
      { status: 502, headers: JSON_HEADERS },
    );
  }
});
