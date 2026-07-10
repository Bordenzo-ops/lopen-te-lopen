/**
 * Supabase Edge Function: stats
 *
 * Geaggregeerde, anonieme appstatistieken voor het marketingdashboard en de
 * wekelijkse statsbriefing. Gebruikt de service-role key (door Supabase zelf
 * als omgevingsvariabele aan edge functions gegeven) om over RLS heen te
 * tellen, maar geeft uitsluitend totalen terug: nooit namen, routes of
 * andere gegevens van individuele gebruikers.
 *
 * Hardening (werkpakket 1):
 *  - Vereist het geheim STATS_SECRET, ofwel via header x-stats-secret,
 *    ofwel via de query-parameter ?s=. De query-parameter bestaat omdat de
 *    wekelijkse scheduled task (marketing-statsbriefing) alleen web_fetch
 *    tot haar beschikking heeft, en web_fetch kan geen custom headers
 *    versturen. Via de URL kan die task het geheim toch meesturen.
 *    Zonder geldige secret (header of query-param): 401.
 *  - Het resultaat wordt 10 minuten in-memory gecached (module-level), zodat
 *    niet elke aanroep opnieuw tienduizenden rijen uit de database scant.
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
 *   generatedAt, totalUsers, newUsers7d, premiumUsers,
 *   totalRuns, runs7d, activeUsers7d, totalKm,
 *   weeks: [{ weekStart: 'JJJJ-MM-DD', runs, km }]   // laatste 8 weken
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STATS_SECRET = Deno.env.get('STATS_SECRET') ?? '';

// In-memory cache: voorkomt dat elke aanroep opnieuw de volledige runs-tabel scant.
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

  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
  const d56 = new Date(now.getTime() - 56 * 24 * 3600 * 1000).toISOString();

  // Gebruikers
  const { count: totalUsers } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
  const { count: newUsers7d } = await supabase
    .from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', d7);
  const { count: premiumUsers } = await supabase
    .from('profiles').select('id', { count: 'exact', head: true }).eq('is_premium', true);

  // Runs (alleen de velden die we aggregeren; completed_at is een ISO-string)
  const { count: totalRuns } = await supabase.from('runs').select('id', { count: 'exact', head: true });
  const { data: recentRuns, error } = await supabase
    .from('runs')
    .select('user_id, completed_at, actual_distance_km')
    .gte('completed_at', d56)
    .limit(10000);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS });
  }

  // Totale kilometers over alles (aparte som, want recentRuns is beperkt tot 8 weken)
  const { data: kmRows } = await supabase.from('runs').select('actual_distance_km').limit(100000);
  const totalKm = (kmRows ?? []).reduce((s, r) => s + (r.actual_distance_km ?? 0), 0);

  // Weekemmers (laatste 8 weken, week start op maandag)
  const weeks: { weekStart: string; runs: number; km: number }[] = [];
  const monday = (d: Date) => {
    const x = new Date(d); const day = (x.getUTCDay() + 6) % 7;
    x.setUTCDate(x.getUTCDate() - day); x.setUTCHours(0, 0, 0, 0); return x;
  };
  const start = monday(now);
  for (let i = 7; i >= 0; i--) {
    const w = new Date(start.getTime() - i * 7 * 24 * 3600 * 1000);
    weeks.push({ weekStart: w.toISOString().slice(0, 10), runs: 0, km: 0 });
  }
  const active7d = new Set<string>();
  let runs7d = 0;
  for (const r of recentRuns ?? []) {
    const t = new Date(r.completed_at);
    if (isNaN(t.getTime())) continue;
    const ws = monday(t).toISOString().slice(0, 10);
    const bucket = weeks.find(w => w.weekStart === ws);
    if (bucket) { bucket.runs += 1; bucket.km += r.actual_distance_km ?? 0; }
    if (r.completed_at >= d7) { runs7d += 1; active7d.add(r.user_id); }
  }
  for (const w of weeks) w.km = Math.round(w.km * 10) / 10;

  const body = {
    generatedAt: now.toISOString(),
    totalUsers: totalUsers ?? 0,
    newUsers7d: newUsers7d ?? 0,
    premiumUsers: premiumUsers ?? 0,
    totalRuns: totalRuns ?? 0,
    runs7d,
    activeUsers7d: active7d.size,
    totalKm: Math.round(totalKm * 10) / 10,
    weeks,
  };

  cachedBody = body;
  cachedAt = requestTime;

  return new Response(JSON.stringify(body), { headers: CORS_HEADERS });
});
