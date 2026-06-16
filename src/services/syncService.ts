/**
 * syncService
 *
 * Offline-first sync van lokale data naar Supabase. Lokaal blijft altijd
 * de bron van waarheid. Sync is best-effort: het mag de UI nooit blokkeren
 * en nooit crashen. Zonder sessie, sleutels of netwerk gebeurt er niets.
 *
 * Twee taken:
 *  1. pushProfile / pushRuns: zet het lokale profiel en de voltooide
 *     sessies naar de cloud (upsert, idempotent).
 *  2. migrateLocalData: bij de eerste account-koppeling alle bestaande
 *     lokale data eenmalig naar de cloud zetten.
 *
 * De DB-tabellen (profiles, runs) staan in supabase/migrations/.
 */

import { getSupabase } from './supabaseClient';
import { getCurrentUser } from './authService';
import type { UserProfile, CompletedSession } from '../store/appStore';

export interface SyncResult {
  ok: boolean;
  /** Aantal verwerkte runs, indien van toepassing */
  count?: number;
  /** Nederlandse melding voor logging of UI */
  message?: string;
}

const OK_NOOP: SyncResult = { ok: true, message: 'Niets te synchroniseren.' };

/**
 * Een stabiele client-id per voltooide sessie, zodat herhaalde pushes
 * dezelfde rij raken (idempotent) in plaats van duplicaten te maken.
 */
function clientRunId(run: CompletedSession): string {
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
    is_premium: profile.isPremium ?? null,
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
    route: run.route ?? null,
    source: run.source,
  };
}

/** Push het profiel naar de cloud. Best-effort, faalt stil. */
export async function pushProfile(profile: UserProfile | null): Promise<SyncResult> {
  if (!profile) return OK_NOOP;
  const supabase = getSupabase();
  if (!supabase) return OK_NOOP;

  try {
    const user = await getCurrentUser();
    if (!user) return OK_NOOP;

    const { error } = await supabase
      .from('profiles')
      .upsert(profileToRow(user.id, profile), { onConflict: 'id' });

    if (error) {
      return { ok: false, message: 'Profiel synchroniseren lukte niet.' };
    }
    return { ok: true, message: 'Profiel gesynchroniseerd.' };
  } catch {
    return { ok: false, message: 'Profiel synchroniseren lukte niet.' };
  }
}

/** Push alle voltooide sessies naar de cloud. Best-effort, faalt stil. */
export async function pushRuns(runs: CompletedSession[]): Promise<SyncResult> {
  if (!runs || runs.length === 0) return OK_NOOP;
  const supabase = getSupabase();
  if (!supabase) return OK_NOOP;

  try {
    const user = await getCurrentUser();
    if (!user) return OK_NOOP;

    const rows = runs.map(r => runToRow(user.id, r));
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
 * Algemene best-effort sync van profiel plus runs. Veilig om vaak aan te
 * roepen: zonder sessie of backend gebeurt er niets en crasht er niets.
 */
export async function syncAll(
  profile: UserProfile | null,
  runs: CompletedSession[],
): Promise<SyncResult> {
  const supabase = getSupabase();
  if (!supabase) return OK_NOOP;

  try {
    const user = await getCurrentUser();
    if (!user) return OK_NOOP;

    const profileResult = await pushProfile(profile);
    const runsResult = await pushRuns(runs);

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
 * Eenmalige migratie van alle lokale data bij de eerste account-koppeling.
 * Functioneel gelijk aan syncAll, maar apart benoemd zodat de aanroeper
 * dit bewust eenmaal kan doen direct na linkEmailAccount.
 */
export async function migrateLocalData(
  profile: UserProfile | null,
  runs: CompletedSession[],
): Promise<SyncResult> {
  return syncAll(profile, runs);
}
