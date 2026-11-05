/**
 * shoes
 *
 * Pure functions (no React, no store import at runtime, no network) for the shoe
 * counter: kilometres per pair, wear percentage, alert thresholds and the
 * default-shoe rules. The store (appStore.ts) and the UI both build on these.
 */

import type { Shoe, CompletedSession } from '../store/appStore';

/** Default wear limit for a new pair, in km. */
export const DEFAULT_SHOE_LIMIT_KM = 700;

/** Wear percentages at which the user gets a card after a run. */
export const WEAR_WARN_PCT = 80;
export const WEAR_LIMIT_PCT = 100;

export type WearThreshold = 80 | 100;

export function isActiveShoe(shoe: Shoe): boolean {
  return !shoe.retiredAt;
}

export function activeShoes(shoes: Shoe[]): Shoe[] {
  return shoes.filter(isActiveShoe);
}

export function retiredShoes(shoes: Shoe[]): Shoe[] {
  return shoes.filter(s => !isActiveShoe(s));
}

/** The active default shoe, or null when there is none. */
export function getDefaultShoe(shoes: Shoe[]): Shoe | null {
  return shoes.find(s => isActiveShoe(s) && s.isDefault) ?? null;
}

/** Total km on a pair: the km it already had plus all runs linked to it. */
export function shoeKm(shoe: Shoe, runs: ReadonlyArray<Pick<CompletedSession, 'shoeId' | 'actualDistanceKm'>>): number {
  let total = Number.isFinite(shoe.startKm) ? shoe.startKm : 0;
  for (const run of runs) {
    if (run.shoeId === shoe.id && Number.isFinite(run.actualDistanceKm)) {
      total += run.actualDistanceKm;
    }
  }
  return total;
}

/** Wear as a percentage of the limit (not rounded, can exceed 100). */
export function wearPercent(km: number, limitKm: number): number {
  if (!(limitKm > 0)) return 0;
  return (km / limitKm) * 100;
}

/** Km left until the limit; 0 once the limit is reached. */
export function kmUntilLimit(km: number, limitKm: number): number {
  return Math.max(0, limitKm - km);
}

/**
 * Rounds the remaining km to something readable for "over zo'n Y km":
 * steps of 10 (or 5 when little is left), never below one step.
 */
export function roundedRemainingKm(remainingKm: number): number {
  const step = remainingKm >= 20 ? 10 : 5;
  return Math.max(step, Math.round(remainingKm / step) * step);
}

/** Highest threshold reached by this wear percentage, or null below 80%. */
export function reachedThreshold(percent: number): WearThreshold | null {
  if (percent >= WEAR_LIMIT_PCT) return 100;
  if (percent >= WEAR_WARN_PCT) return 80;
  return null;
}

/**
 * Which wear card is due for this pair, if any. Each threshold is shown once:
 * a pair that jumps straight past 100% gets only the 100% card, and nothing
 * is due once the 100% card has been shown. Retired pairs never alert.
 */
export function pendingWearAlert(
  shoe: Shoe,
  runs: ReadonlyArray<Pick<CompletedSession, 'shoeId' | 'actualDistanceKm'>>,
): WearThreshold | null {
  if (!isActiveShoe(shoe)) return null;
  const reached = reachedThreshold(wearPercent(shoeKm(shoe, runs), shoe.limitKm));
  if (reached === null) return null;
  const shown = shoe.wearAlertsShown ?? {};
  if (shown.at100) return null;
  if (reached === 100) return 100;
  return shown.at80 ? null : 80;
}

/**
 * Gives a new run the default shoe when it has none yet. Returns the same
 * object when nothing changes. This is the one place the assignment rule lives
 * (called from completeSession in appStore.ts).
 */
export function assignDefaultShoe<T extends { shoeId?: string }>(run: T, shoes: Shoe[]): T {
  if (run.shoeId) return run;
  const def = getDefaultShoe(shoes);
  return def ? { ...run, shoeId: def.id } : run;
}

/**
 * After the default shoe was retired or deleted: no default remains, unless
 * exactly one other active pair is left, which then becomes the default.
 * Call only when the removed pair was the default.
 */
export function withDefaultFallback(shoes: Shoe[]): Shoe[] {
  const active = activeShoes(shoes);
  if (active.some(s => s.isDefault)) return shoes;
  if (active.length !== 1) return shoes;
  const only = active[0];
  return shoes.map(s => (s.id === only.id ? { ...s, isDefault: true } : s));
}

/** Makes one active pair the only default. */
export function setOnlyDefault(shoes: Shoe[], id: string): Shoe[] {
  return shoes.map(s => ({ ...s, isDefault: s.id === id && isActiveShoe(s) }));
}

/** Parses user input like "12,5" into a number, or null when it is not a number. */
export function parseKmInput(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
