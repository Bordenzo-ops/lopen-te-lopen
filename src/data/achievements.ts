// ─────────────────────────────────────────────
// Lokale mijlpalen, persoonlijke records en reeksen
// ─────────────────────────────────────────────
//
// Alles wordt lokaal berekend uit de voltooide sessies. Niets wordt gedeeld of
// vergeleken met anderen: het past bij de privacy-vriendelijke opzet van de app
// en geeft de beginner kleine, persoonlijke beloningen tussen de trainingen door.

import type { CompletedSession } from '../store/appStore';

/** Maandag (lokale tijd) van de week van een datum, als YYYY-MM-DD. Puur, geen afhankelijkheden. */
function weekStartKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();              // 0 = zondag, 1 = maandag
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  // Lokale datum als sleutel (niet UTC), zodat weken niet verschuiven
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export interface RunStats {
  totalRuns: number;
  totalKm: number;
  longestRunKm: number;
  /** Beste (laagste) gemiddelde tempo in sec/km over een run, of null als nog geen geldige run. */
  bestPaceSecPerKm: number | null;
  bestWeekKm: number;
  /** Aantal aaneengesloten weken met minstens één training, eindigend op de meest recente actieve week. */
  currentWeekStreak: number;
}

/** Berekent de persoonlijke statistieken uit alle voltooide sessies. */
export function computeRunStats(completed: CompletedSession[]): RunStats {
  const totalRuns = completed.length;
  const totalKm = completed.reduce((sum, c) => sum + c.actualDistanceKm, 0);

  const longestRunKm = completed.reduce((max, c) => Math.max(max, c.actualDistanceKm), 0);

  // Beste tempo: alleen runs met een zinvolle afstand en een geldig tempo meetellen
  const paces = completed
    .filter(c => c.actualDistanceKm >= 1 && c.avgPaceSecPerKm > 0)
    .map(c => c.avgPaceSecPerKm);
  const bestPaceSecPerKm = paces.length > 0 ? Math.min(...paces) : null;

  // Beste week op basis van de echte voltooidatum (niet het weeknummer in het schema)
  const kmPerWeek = new Map<string, number>();
  for (const c of completed) {
    const key = weekStartKey(new Date(c.completedAt));
    kmPerWeek.set(key, (kmPerWeek.get(key) ?? 0) + c.actualDistanceKm);
  }
  const bestWeekKm = kmPerWeek.size > 0 ? Math.max(...kmPerWeek.values()) : 0;

  return {
    totalRuns,
    totalKm,
    longestRunKm,
    bestPaceSecPerKm,
    bestWeekKm,
    currentWeekStreak: computeWeekStreak(completed),
  };
}

/**
 * Aantal aaneengesloten weken met minstens één training. De reeks blijft "levend"
 * als de meest recente actieve week deze week of vorige week is, zodat de teller
 * niet meteen op nul staat halverwege een nieuwe week.
 */
export function computeWeekStreak(completed: CompletedSession[]): number {
  if (completed.length === 0) return 0;

  const activeWeeks = new Set(completed.map(c => weekStartKey(new Date(c.completedAt))));

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  let cursor = new Date();
  // Start deze week. Geen activiteit deze week? Dan mag de reeks nog levend zijn
  // als vorige week wel actief was.
  if (!activeWeeks.has(weekStartKey(cursor))) {
    cursor = new Date(cursor.getTime() - WEEK_MS);
    if (!activeWeeks.has(weekStartKey(cursor))) return 0;
  }

  let streak = 0;
  while (activeWeeks.has(weekStartKey(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - WEEK_MS);
  }
  return streak;
}

export interface Milestone {
  id: string;
  label: string;
  reached: boolean;
}

/**
 * Bepaalt welke persoonlijke mijlpalen zijn behaald op basis van de statistieken.
 *
 * `km-5` en `km-10` zijn bewust vroeg in de lijst gezet: ze tellen de
 * cumulatieve afstand over alle trainingen samen, dus een beginner haalt ze
 * al na een paar korte sessies, ruim voordat er een reeks staat of een lange
 * enkele run is gelopen. Dat geeft net in de eerste weken al een gevoel van
 * vooruitgang. Zie ook `detectCumulativeMilestone`, die hetzelfde moment
 * direct na de sessie op het samenvattingsscherm viert.
 */
export function computeMilestones(stats: RunStats): Milestone[] {
  return [
    { id: 'first-run', label: 'Eerste training',              reached: stats.totalRuns >= 1 },
    { id: 'km-5',      label: '5 km in totaal',                reached: stats.totalKm >= 5 },
    { id: 'first-5k',  label: 'Eerste 5 km in één keer',      reached: stats.longestRunKm >= 5 },
    { id: 'km-10',     label: '10 km in totaal',               reached: stats.totalKm >= 10 },
    { id: 'runs-10',   label: '10 trainingen gelopen',        reached: stats.totalRuns >= 10 },
    { id: 'first-10k', label: 'Eerste 10 km in één keer',     reached: stats.longestRunKm >= 10 },
    { id: 'km-50',     label: '50 km in totaal',              reached: stats.totalKm >= 50 },
    { id: 'runs-25',   label: '25 trainingen gelopen',        reached: stats.totalRuns >= 25 },
    { id: 'km-100',    label: '100 km in totaal',             reached: stats.totalKm >= 100 },
    { id: 'half',      label: 'Halve marathon-afstand (21 km)', reached: stats.longestRunKm >= 21 },
  ];
}

/**
 * Bepaalt of een zojuist voltooide run een persoonlijk record is, door hem te
 * vergelijken met alle eerdere runs (dus exclusief de run zelf).
 */
export function detectPersonalRecords(
  current: CompletedSession,
  previous: CompletedSession[],
): { longestRun: boolean; fastestPace: boolean } {
  const priorLongest = previous.reduce((max, c) => Math.max(max, c.actualDistanceKm), 0);
  const longestRun =
    current.actualDistanceKm >= 1 &&
    current.actualDistanceKm > priorLongest &&
    previous.length > 0; // eerste run viert alleen de eerste-training-mijlpaal, geen langste-afstand-PR

  const priorPaces = previous
    .filter(c => c.actualDistanceKm >= 1 && c.avgPaceSecPerKm > 0)
    .map(c => c.avgPaceSecPerKm);
  const priorBestPace = priorPaces.length > 0 ? Math.min(...priorPaces) : null;
  const fastestPace =
    current.actualDistanceKm >= 1 &&
    current.avgPaceSecPerKm > 0 &&
    (priorBestPace === null || current.avgPaceSecPerKm < priorBestPace) &&
    previous.length > 0; // pas vanaf de tweede run een tempo-PR tonen

  return { longestRun, fastestPace };
}

/** Vroeg, laagdrempelig cumulatief mijlpaal-moment, direct na een sessie te vieren. */
export type CumulativeMilestone = 'first-run' | 'km-5' | 'km-10' | null;

/**
 * Bepaalt of de zojuist voltooide sessie de allereerste training is, of de
 * cumulatieve afstand over 5 km resp. 10 km heen tilt. Geeft er hoogstens één
 * terug (de grootste net behaalde stap), zodat er nooit twee vieringen
 * tegelijk verschijnen op het samenvattingsscherm.
 */
export function detectCumulativeMilestone(
  current: CompletedSession,
  previous: CompletedSession[],
): CumulativeMilestone {
  if (previous.length === 0) return 'first-run';

  const priorTotalKm = previous.reduce((sum, c) => sum + c.actualDistanceKm, 0);
  const newTotalKm = priorTotalKm + current.actualDistanceKm;

  if (priorTotalKm < 10 && newTotalKm >= 10) return 'km-10';
  if (priorTotalKm < 5 && newTotalKm >= 5) return 'km-5';
  return null;
}
