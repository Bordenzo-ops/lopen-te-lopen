/**
 * cloudMerge
 *
 * Pure functies (geen React, geen store-import, geen netwerk) voor het
 * samenvoegen van clouddata met de lokale staat bij het inloggen op een
 * bestaand account. Zie reconcileWithAccount in appStore.ts voor het gebruik.
 *
 * Uitgangspunten:
 *  - Runs: unie op clientRunId. Bij hetzelfde id wint de lokale run (die heeft
 *    route, splits en maxHeartRateBpm). Lokaal wordt nooit iets verwijderd.
 *  - Profiel: de cloud wint per veld (met validatie). Last-writer-wins op
 *    updated_at werkt hier niet: het verse onboardingprofiel van een nieuw
 *    toestel is altijd nieuwer dan het echte profiel. trainingDays en
 *    isPremium blijven lokaal (niet in de DB, resp. RevenueCat is de bron).
 */

import type { GoalType, TrainingWeek } from '../data/trainingPlans';
import { VOICES, type VoiceType } from '../config/voiceConfig';
import type { UserProfile, CompletedSession } from '../store/appStore';
import type { ProfileRow } from '../services/syncService';

const GOALS: ReadonlyArray<GoalType> = ['5km', '10km', '15km', 'half_marathon', 'marathon'];

/** Zelfde sleutel als clientRunId in syncService.ts (hier gedupliceerd om geen service te importeren). */
function runKey(run: CompletedSession): string {
  return `${run.sessionId}-${run.weekNumber}-${run.completedAt}`;
}

/**
 * Voegt remote runs toe aan de lokale runs. `added` is het aantal remote runs
 * dat lokaal nog niet bestond. Resultaat is gesorteerd op completedAt
 * (stabiel: bij gelijke of ongeldige tijdstippen blijft de oorspronkelijke
 * volgorde, lokaal eerst).
 */
export function mergeRuns(
  local: CompletedSession[],
  remote: CompletedSession[],
): { merged: CompletedSession[]; added: number } {
  const seen = new Set<string>(local.map(runKey));
  const merged = [...local];
  let added = 0;
  for (const run of remote) {
    const key = runKey(run);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(run);
    added += 1;
  }

  const stamp = (r: CompletedSession): number => {
    const ms = Date.parse(r.completedAt);
    return Number.isNaN(ms) ? 0 : ms;
  };
  // Array.prototype.sort is stabiel (ES2019), dus gelijke stempels houden hun volgorde.
  merged.sort((a, b) => stamp(a) - stamp(b));
  return { merged, added };
}

function positiveNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Voegt het remote profiel samen met het lokale. Zonder remote rij blijft het
 * lokale profiel ongemoeid. `goalChanged` is true als het doel door de merge
 * verandert (dan moet de trainingsweek opnieuw worden afgeleid).
 */
export function mergeProfile(
  local: UserProfile | null,
  remote: ProfileRow | null,
): { profile: UserProfile | null; goalChanged: boolean } {
  if (!remote) return { profile: local, goalChanged: false };

  const remoteName = typeof remote.name === 'string' && remote.name.trim().length > 0
    ? remote.name
    : null;
  const remoteGoal = GOALS.find(g => g === remote.goal) ?? null;
  const remoteStart = typeof remote.start_date === 'string' && !Number.isNaN(Date.parse(remote.start_date))
    ? remote.start_date
    : null;
  const remoteAge = positiveNumber(remote.age);
  const remoteMaxHr = positiveNumber(remote.max_heart_rate);
  const remoteVoiceGuidance = typeof remote.voice_guidance === 'boolean' ? remote.voice_guidance : null;
  const remoteVoiceType: VoiceType | null =
    VOICES.find(v => v.key === remote.voice_type)?.key ?? null;
  const remotePlanner = typeof remote.route_planner_enabled === 'boolean'
    ? remote.route_planner_enabled
    : null;

  if (!local) {
    // Defensief (nu niet bereikbaar): geen lokaal profiel, wel een remote rij.
    // Zonder geldig doel of startdatum is er niets bruikbaars om te herstellen.
    if (!remoteGoal || !remoteStart) return { profile: null, goalChanged: false };
    return {
      profile: {
        name: remoteName ?? '',
        goal: remoteGoal,
        startDate: remoteStart,
        maxHeartRate: remoteMaxHr ?? 0,
        age: remoteAge ?? 0,
        voiceGuidance: remoteVoiceGuidance ?? true,
        voiceType: remoteVoiceType ?? undefined,
        routePlannerEnabled: remotePlanner ?? undefined,
      },
      goalChanged: true,
    };
  }

  const goal = remoteGoal ?? local.goal;
  return {
    profile: {
      ...local,
      name: remoteName ?? local.name,
      goal,
      startDate: remoteStart ?? local.startDate,
      age: remoteAge ?? local.age,
      maxHeartRate: remoteMaxHr ?? local.maxHeartRate,
      voiceGuidance: remoteVoiceGuidance ?? local.voiceGuidance,
      voiceType: remoteVoiceType ?? local.voiceType,
      routePlannerEnabled: remotePlanner ?? local.routePlannerEnabled,
      // trainingDays en isPremium blijven lokaal (via ...local).
    },
    goalChanged: goal !== local.goal,
  };
}

/**
 * Leidt de trainingsweek af uit de voltooide runs, voor het standaardschema
 * (sessie-id's coderen de week). Het hoogste weeknummer waarvoor een voltooide
 * run een sessie uit die week van het plan heeft, is `w`. Zijn alle verplichte
 * sessies van week w voltooid, dan is het antwoord w + 1 (maximaal totalWeeks),
 * anders w. Zonder passende runs: 1.
 */
export function deriveTrainingWeek(
  planWeeks: TrainingWeek[],
  completed: Array<{ sessionId: string }>,
  totalWeeks: number,
): number {
  const maxWeek = Math.max(1, totalWeeks);
  const weekOfSession = new Map<string, number>();
  for (const week of planWeeks) {
    for (const session of week.sessions) {
      if (!weekOfSession.has(session.id)) weekOfSession.set(session.id, week.weekNumber);
    }
  }

  const doneIds = new Set<string>(completed.map(c => c.sessionId));
  let highest = 0;
  for (const id of doneIds) {
    const w = weekOfSession.get(id);
    if (w !== undefined && w > highest) highest = w;
  }
  if (highest === 0) return 1;

  const week = planWeeks.find(w => w.weekNumber === highest);
  const weekDone = week
    ? week.sessions.filter(s => !s.optional).every(s => doneIds.has(s.id))
    : false;
  return Math.min(weekDone ? highest + 1 : highest, maxWeek);
}
