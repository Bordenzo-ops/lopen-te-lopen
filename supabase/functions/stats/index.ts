/**
 * Supabase Edge Function: stats
 *
 * Geaggregeerde, anonieme appstatistieken voor het marketingdashboard en de
 * wekelijkse statsbriefing. Het rekenwerk gebeurt in de database, in de
 * functie public.app_stats() (zie supabase/migrations/0004_app_stats.sql).
 * Die functie is security definer en telt dus over RLS heen, maar geeft
 * uitsluitend totalen terug: nooit namen, routes of andere gegevens van
 * individuele gebruikers. Alleen de service-role key mag hem aanroepen.
 *
 * Waarom in de database en niet hier: eerder haalde deze functie tot
 * honderdduizend rijen op om ze in JavaScript op te tellen, en telde ze
 * gebruikers uit `profiles`. Dat ondertelde fors, want een profiel bestaat
 * pas na de onboarding terwijl elke installatie al een (anoniem) account in
 * auth.users heeft. Nu telt totalUsers de echte accounts en staat het aantal
 * afgeronde onboardings apart als onboardedUsers.
 *
 * Hardening (werkpakket 1):
 *  - Vereist het geheim STATS_SECRET, ofwel via header x-stats-secret,
 *    ofwel via de query-parameter ?s=. De query-parameter bestaat omdat de
 *    wekelijkse scheduled task (marketing-statsbriefing) alleen web_fetch
 *    tot haar beschikking heeft, en web_fetch kan geen custom headers
 *    versturen. Via de URL kan die task het geheim toch meesturen.
 *    Zonder geldige secret (header of query-param): 401.
 *  - Het resultaat wordt 10 minuten in-memory gecached (module-level).
 *
 * Deploy:
 *   supabase functions deploy stats --no-verify-jwt
 *   supabase secrets set STATS_SECRET=...
 *
 * Aanroep: GET https://<project>.supabase.co/functions/v1/stats
 *   Header: x-stats-secret: <STATS_SECRET>
 *   of: GET https://<project>.supabase.co/functions/v1/stats?s=<STATS_SECRET>
 *
 * Antwoord (JSON):
 * {
 *   generatedAt,
 *   totalUsers,      // alle accounts in auth.users (elke installatie er een)
 *   anonymousUsers,  // daarvan anoniem
 *   linkedAccounts,  // daarvan met Apple of Google gekoppeld
 *   newUsers7d, newUsers30d,
 *   onboardedUsers,  // profielen: onboarding afgerond
 *   premiumUsers,
 *   goals,           // { half_marathon: 5, '5km': 3, ... }
 *   totalRuns, realRuns, runs7d,
 *   activeUsers7d, activeUsers30d,
 *   totalKm,
 *   weeks: [{ weekStart: 'JJJJ-MM-DD', runs, km, users }],  // laatste 8 weken
 *   totalEvents, events   // funnel-events, unieke gebruikers per eventnaam
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STATS_SECRET = Deno.env.get('STATS_SECRET') ?? '';

// In-memory cache: voorkomt dat elke aanroep opnieuw de tabellen scant.
const CACHE_TTL_MS = 10 * 60 * 1000;
let cachedBody: unknown = null;
let cachedAt = 0;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stats-secret',
  'Content-Type': 'application/json',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS_HEADERS });
  }

  const headerSecret = req.headers.get('x-stats-secret') ?? '';
  const querySecret = new URL(req.url).searchParams.get('s') ?? '';
  if (!STATS_SECRET || (headerSecret !== STATS_SECRET && querySecret !== STATS_SECRET)) {
    return new Response(
      JSON.stringify({ error: 'Niet geautoriseerd.' }),
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const requestTime = Date.now();
  if (cachedBody && requestTime - cachedAt < CACHE_TTL_MS) {
    return new Response(JSON.stringify(cachedBody), { headers: CORS_HEADERS });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Al het telwerk gebeurt in een enkele databasefunctie.
  const { data, error } = await supabase.rpc('app_stats');
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS });
  }

  cachedBody = data;
  cachedAt = requestTime;

  return new Response(JSON.stringify(data), { headers: CORS_HEADERS });
});
