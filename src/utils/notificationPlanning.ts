/**
 * notificationPlanning
 *
 * Pure planningsregels voor de twee activatie- en retentiemeldingen
 * (eerste-run-duwtje en terugkomduwtje voor premium). Bewust zonder imports
 * van de store of van expo-notifications, zodat de regels los te testen zijn.
 * notificationService.ts bepaalt de inhoud (copy) en plant de meldingen in.
 */

/** Meldingen vallen nooit tussen 21:30 en 08:00: gehele uren van 8 t/m 21. */
export const NOTIFICATION_EARLIEST_HOUR = 8;
export const NOTIFICATION_LATEST_HOUR = 21;

/** Terugkomduwtje: aantal dagen na de laatste run, om 18:30. */
export const COMEBACK_DAYS = 5;
export const COMEBACK_HOUR = 18;
export const COMEBACK_MINUTE = 30;

/** Vangnet van het eerste-run-duwtje: aantal dagen na het eerste duwtje. */
export const FIRST_RUN_BACKUP_DAYS = 2;

/** Een echte run: een voltooide sessie met afstand > 0. */
export function hasRealRun(completed: ReadonlyArray<{ actualDistanceKm: number }>): boolean {
  return completed.some(c => c.actualDistanceKm > 0);
}

/** Tijdstip van de laatste echte run, of null als er nog geen is. */
export function lastRealRunAt(
  completed: ReadonlyArray<{ actualDistanceKm: number; completedAt: string }>,
): Date | null {
  let latest: Date | null = null;
  for (const c of completed) {
    if (!(c.actualDistanceKm > 0)) continue;
    const at = new Date(c.completedAt);
    if (Number.isNaN(at.getTime())) continue;
    if (!latest || at.getTime() > latest.getTime()) latest = at;
  }
  return latest;
}

/** Houdt een uur binnen het toegestane meldingsvenster (8 t/m 21 uur). */
export function clampNotificationHour(hour: number): number {
  const h = Number.isInteger(hour) ? hour : 18;
  return Math.min(NOTIFICATION_LATEST_HOUR, Math.max(NOTIFICATION_EARLIEST_HOUR, h));
}

function atTime(date: Date, hour: number, minute: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
}

function plusDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0, 0);
}

export interface FirstRunPlan {
  /** Eerste duwtje: de eerstvolgende geplande trainingsdag. */
  primary: Date;
  /** Vangnet, FIRST_RUN_BACKUP_DAYS dagen na `primary`, zelfde uur. */
  backup: Date;
}

/**
 * Eerste-run-duwtje. `upcomingReminderDates` zijn de (al in de toekomst
 * liggende) tijdstippen van de bestaande trainingsherinneringen, oplopend.
 * Geeft null als de gebruiker al een echte run heeft of er geen geplande
 * trainingsdag in het venster ligt (bijv. een wedstrijdschema dat nog niet is
 * begonnen): dan is er niets zinnigs om voor te nudgen.
 */
export function planFirstRun(
  hasRun: boolean,
  upcomingReminderDates: ReadonlyArray<Date>,
  now: Date,
): FirstRunPlan | null {
  if (hasRun || upcomingReminderDates.length === 0) return null;
  const first = upcomingReminderDates[0];
  const hour = clampNotificationHour(first.getHours());
  const primary = atTime(first, hour, 0);
  if (primary.getTime() <= now.getTime() + 60_000) return null;
  const backup = atTime(plusDays(primary, FIRST_RUN_BACKUP_DAYS), hour, 0);
  return { primary, backup };
}

/**
 * Terugkomduwtje voor premium: laatste echte run + 5 dagen om 18:30. Null als
 * de gebruiker geen premium is, geen echte run heeft, of dat moment al
 * voorbij is (dan is de gebruiker al terug in de app: geen tweede duwtje).
 */
export function planComeback(
  isPremium: boolean,
  lastRun: Date | null,
  now: Date,
): Date | null {
  if (!isPremium || !lastRun) return null;
  const fireAt = atTime(plusDays(lastRun, COMEBACK_DAYS), COMEBACK_HOUR, COMEBACK_MINUTE);
  if (fireAt.getTime() <= now.getTime() + 60_000) return null;
  return fireAt;
}
