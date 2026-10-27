/**
 * syncService
 *
 * Offline-first sync tussen lokale data en Supabase. Lokaal blijft altijd
 * de bron van waarheid. Sync is best-effort: het mag de UI nooit blokkeren
 * en nooit crashen. Zonder sessie, sleutels of netwerk gebeurt er niets.
 *
 * Twee taken:
 *  1. pushProfile / pushRuns / syncAll: zet het lokale profiel en de voltooide
 *     sessies naar de cloud (upsert, idempotent). De aanroeper (syncNow in
 *     appStore.ts) geeft de user-id expliciet mee, nadat hij heeft gecontroleerd
 *     dat dit toestel met dat account verzoend is (cloudDataUserId). Deze
 *     functies vragen de sessie dus bewust zelf NIET op: wisselt de sessie
 *     halverwege, dan weigert RLS de rij in plaats van dat de rest naar een
 *     ander account gaat.
 *  2. pullAccountData: haalt profiel en runs van een account op (alleen
 *     lezen). De merge zelf staat in utils/cloudMerge.ts.
 *
 * De DB-tabellen (profiles, runs) staan in supabase/migrations/.
 */

import { getSupabase } from './supabaseClient';
import type { UserProfile, CompletedSession } from '../store/appStore';

export interface SyncResult {
  ok: boolean;
  /** Aantal verwerkte runs, indien van toepassing */
  count?: number;
  /** Nederlandse melding voor logging of UI */
  message?: string;
}

/** Een rij uit public.profiles, zoals PostgREST hem teruggeeft (ongevalideerd). */
export interface ProfileRow {
  id?: unknown;
  name?: unknown;
  goal?: unknown;
  start_date?: unknown;
  max_heart_rate?: unknown;
  age?: unknown;
  voice_guidance?: unknown;
  voice_type?: unknown;
  route_planner_enabled?: unknown;
  updated_at?: unknown;
}

/** Een rij uit public.runs, zoals PostgREST hem teruggeeft (ongevalideerd). */
export interface RunRow {
  client_run_id?: unknown;
  session_id?: unknown;
  week_number?: unknown;
  completed_at?: unknown;
  actual_distance_km?: unknown;
  duration_seconds?: unknown;
  avg_pace_sec_per_km?: unknown;
  avg_heart_rate?: unknown;
  source?: unknown;
}

export type PullResult =
  | { ok: true; profile: ProfileRow | null; runs: RunRow[] }
  | { ok: false };

const OK_NOOP: SyncResult = { ok: true, message: 'Niets te synchroniseren.' };

/** PostgREST geeft standaard maximaal 1000 rijen per verzoek terug. */
const RUNS_PAGE_SIZE = 1000;

const RUN_SOURCES: ReadonlyArray<CompletedSession['source']> = [
  'app', 'strava', 'garmin', 'apple_health', 'google_fit', 'mi_fitness',
];

/**
 * Een stabiele client-id per voltooide sessie, zodat herhaalde pushes
 * dezelfde rij raken (idempotent) in plaats van duplicaten te maken.
 */
export function clientRunId(run: CompletedSession): string {
  return `${run.sessionId}-${run.weekNumber}-${run.completedAt}`;
}

/** Map een lokaal profiel naar een DB-rij voor de gegeven gebruiker. */
function profileToRow(userId: string, profile: UserProfile) {
  return {
    id: userId,
    name: profile.name,
    goal: profile.goal,
    start_date: profile.startDate,
    max_heart_rate: profile.maxHeartRate,
    age: profile.age,
    voice_guidance: profile.voiceGuidance,
    voice_type: profile.voiceType ?? null,
    route_planner_enabled: profile.routePlannerEnabled ?? null,
    // is_premium is niet meer client-side: de RevenueCat-webhook zet het via
    // public.entitlements (migratie 0007).
    updated_at: new Date().toISOString(),
  };
}

/** Map een voltooide sessie naar een DB-rij voor de gegeven gebruiker. */
function runToRow(userId: string, run: CompletedSession) {
  return {
    user_id: userId,
    client_run_id: clientRunId(run),
    session_id: run.sessionId,
    week_number: run.weekNumber,
    completed_at: run.completedAt,
    actual_distance_km: run.actualDistanceKm,
    duration_seconds: run.durationSeconds,
    avg_pace_sec_per_km: run.avgPaceSecPerKm,
    avg_heart_rate: run.avgHeartRate ?? null,
    // GPS-routes worden bewust niet naar de cloud gesynchroniseerd.
    // Ze blijven lokaal in AsyncStorage. Zo gaat locatiegeschiedenis
    // nooit een apparaat uit zonder expliciete keuze van de gebruiker.
    route: null,
    source: run.source,
  };
}

/** Getal uit een ongevalideerde DB-waarde, met fallback bij NaN of een ander type. */
function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Map een DB-rij terug naar een lokale voltooide sessie. Geeft null terug bij
 * een rij zonder bruikbaar sessie-id of tijdstip (zo'n rij zou toch nooit
 * dedupliceren). Route, splits en maxHeartRateBpm staan niet in de cloud en
 * blijven bewust undefined (niet null): de schermen gaan daar al mee om.
 */
export function rowToRun(row: RunRow): CompletedSession | null {
  if (typeof row.session_id !== 'string' || row.session_id.length === 0) return null;
  if (typeof row.completed_at !== 'string' || row.completed_at.length === 0) return null;

  const heartRate = toNumber(row.avg_heart_rate, 0);
  const source = RUN_SOURCES.find(s => s === row.source) ?? 'app';

  return {
    sessionId: row.session_id,
    weekNumber: toNumber(row.week_number, 0),
    // Letterlijk overnemen: clientRunId hangt hiervan af (dedupe).
    completedAt: row.completed_at,
    actualDistanceKm: toNumber(row.actual_distance_km, 0),
    durationSeconds: toNumber(row.duration_seconds, 0),
    avgPaceSecPerKm: toNumber(row.avg_pace_sec_per_km, 0),
    avgHeartRate: heartRate > 0 ? heartRate : undefined,
    source,
  };
}

/** Push het profiel naar de cloud. Best-effort, faalt stil. */
export async function pushProfile(userId: string, profile: UserProfile | null): Promise<SyncResult> {
  if (!profile) return OK_NOOP;
  const supabase = getSupabase();
  if (!supabase) return OK_NOOP;

  try {
    const { error } = await supabase
      .from('profiles')
      .upsert(profileToRow(userId, profile), { onConflict: 'id' });

    if (error) {
      return { ok: false, message: 'Profiel synchroniseren lukte niet.' };
    }
    return { ok: true, message: 'Profiel gesynchroniseerd.' };
  } catch {
    return { ok: false, message: 'Profiel synchroniseren lukte niet.' };
  }
}

/** Push alle voltooide sessies naar de cloud. Best-effort, faalt stil. */
export async function pushRuns(userId: string, runs: CompletedSession[]): Promise<SyncResult> {
  if (!runs || runs.length === 0) return OK_NOOP;
  const supabase = getSupabase();
  if (!supabase) return OK_NOOP;

  try {
    const rows = runs.map(r => runToRow(userId, r));
    const { error } = await supabase
      .from('runs')
      .upsert(rows, { onConflict: 'user_id,client_run_id' });

    if (error) {
      return { ok: false, message: 'Sessies synchroniseren lukte niet.' };
    }
    return { ok: true, count: rows.length, message: 'Sessies gesynchroniseerd.' };
  } catch {
    return { ok: false, message: 'Sessies synchroniseren lukte niet.' };
  }
}

/**
 * Algemene best-effort sync van profiel plus runs voor de opgegeven gebruiker.
 * Veilig om vaak aan te roepen: zonder backend gebeurt er niets en crasht er
 * niets. De aanroeper moet zelf hebben gecontroleerd dat het toestel met dit
 * account verzoend is (zie syncNow in appStore.ts).
 */
export async function syncAll(
  userId: string,
  profile: UserProfile | null,
  runs: CompletedSession[],
): Promise<SyncResult> {
  const supabase = getSupabase();
  if (!supabase) return OK_NOOP;

  try {
    const profileResult = await pushProfile(userId, profile);
    const runsResult = await pushRuns(userId, runs);

    const ok = profileResult.ok && runsResult.ok;
    return {
      ok,
      count: runsResult.count,
      message: ok ? 'Synchronisatie voltooid.' : 'Synchronisatie deels mislukt.',
    };
  } catch {
    return { ok: false, message: 'Synchronisatie mislukt.' };
  }
}

/**
 * Haal profiel en alle runs van een account op (alleen lezen). Pas als beide
 * gelukt zijn is het resultaat ok; bij een fout in een van de twee komt er
 * { ok: false } terug en moet de aanroeper niets toepassen. Runs worden in
 * blokken van 1000 opgehaald (de PostgREST-limiet per verzoek).
 */
export async function pullAccountData(userId: string): Promise<PullResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false };

  try {
    const profileRes = await supabase
      .from('profiles')
      .select('id,name,goal,start_date,max_heart_rate,age,voice_guidance,voice_type,route_planner_enabled,updated_at')
      .eq('id', userId)
      .maybeSingle();
    if (profileRes.error) return { ok: false };

    const runs: RunRow[] = [];
    for (let from = 0; ; from += RUNS_PAGE_SIZE) {
      const { data, error } = await supabase
        .from('runs')
        .select('client_run_id,session_id,week_number,completed_at,actual_distance_km,duration_seconds,avg_pace_sec_per_km,avg_heart_rate,source')
        .eq('user_id', userId)
        // Tweede sorteersleutel: completed_at is niet uniek, en paginering
        // heeft een stabiele volgorde nodig om niets te dubbelen of te missen.
        .order('completed_at', { ascending: true })
        .order('client_run_id', { ascending: true })
        .range(from, from + RUNS_PAGE_SIZE - 1);
      if (error || !data) return { ok: false };
      runs.push(...(data as RunRow[]));
      if (data.length < RUNS_PAGE_SIZE) break;
    }

    return { ok: true, profile: (profileRes.data as ProfileRow | null) ?? null, runs };
  } catch {
    return { ok: false };
  }
}
