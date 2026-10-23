/**
 * trainingWeek
 *
 * Pure functies (geen React, geen store-import) voor de weekvoortgang van de
 * TRAININGSMODUS. Een trainingsweek kan herhaald of teruggezet worden
 * (restartTrainingWeek/stepBackTrainingWeek in appStore.ts). Voltooiingen en
 * overslagen uit een eerdere "poging" van dezelfde week mogen de huidige
 * poging daarom niet als af laten tellen: een sessie telt alleen als
 * afgehandeld als hij na `weekStartedAt` is voltooid/overgeslagen. Streaks,
 * statistieken en logboek blijven op ALLE echte runs rekenen en gebruiken
 * deze helpers dus niet.
 */

export type SessionAttemptStatus = 'completed' | 'skipped' | null;

/** Minimale vorm van CompletedSession/SkippedSession die deze helpers nodig hebben. */
interface CompletedLike { sessionId: string; weekNumber: number; completedAt: string }
interface SkippedLike { sessionId: string; weekNumber: number; skippedAt: string }
interface WeekSessionLike { id: string; optional?: boolean }

/**
 * Zet een ISO-string om naar ms, of null bij ontbrekend/ongeldig. Zonder
 * (geldige) weekStartedAt filteren we niet op tijd: dan gedraagt alles zich
 * zoals vóór de poging-logica.
 */
function toMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

function inAttempt(at: string, startMs: number | null): boolean {
  if (startMs === null) return true;
  const ms = Date.parse(at);
  return !Number.isNaN(ms) && ms >= startMs;
}

/**
 * Status van één sessie van de HUIDIGE week binnen de huidige poging:
 * 'completed', 'skipped' of null (nog open). Voltooid wint van overgeslagen.
 */
export function getSessionAttemptStatus(
  sessionId: string,
  weekNumber: number,
  completed: CompletedLike[],
  skipped: SkippedLike[],
  weekStartedAt: string | null,
): SessionAttemptStatus {
  const startMs = toMs(weekStartedAt);
  if (completed.some(c =>
    c.sessionId === sessionId && c.weekNumber === weekNumber && inAttempt(c.completedAt, startMs))) {
    return 'completed';
  }
  if (skipped.some(s =>
    s.sessionId === sessionId && s.weekNumber === weekNumber && inAttempt(s.skippedAt, startMs))) {
    return 'skipped';
  }
  return null;
}

/** Is de sessie in de huidige poging van deze week voltooid of overgeslagen? */
export function isSessionHandledInCurrentAttempt(
  sessionId: string,
  weekNumber: number,
  completed: CompletedLike[],
  skipped: SkippedLike[],
  weekStartedAt: string | null,
): boolean {
  return getSessionAttemptStatus(sessionId, weekNumber, completed, skipped, weekStartedAt) !== null;
}

/**
 * Zijn alle VERPLICHTE sessies (niet optional) van de huidige week in de
 * huidige poging afgehandeld? Een lege week is triviaal af.
 */
export function isWeekHandledInCurrentAttempt(
  weekSessions: WeekSessionLike[],
  weekNumber: number,
  completed: CompletedLike[],
  skipped: SkippedLike[],
  weekStartedAt: string | null,
): boolean {
  return weekSessions
    .filter(s => !s.optional)
    .every(s => isSessionHandledInCurrentAttempt(s.id, weekNumber, completed, skipped, weekStartedAt));
}

/**
 * Schat weekStartedAt voor bestaande gebruikers (migratie v3). Voorkeur: de
 * vroegste voltooiing/overslag van de huidige week (die voortgang blijft dan
 * zichtbaar). Zonder stempels in de huidige week: de LAATSTE van week - 1
 * (vastgelopen gebruikers krijgen zo de terugkomkaart). Anders nu. Altijd
 * gecapt op nu.
 */
export function estimateWeekStartedAt(
  completed: CompletedLike[],
  skipped: SkippedLike[],
  week: number,
  now: Date,
): string {
  const stamps = (weekNumber: number): number[] => {
    const out: number[] = [];
    for (const c of completed) {
      const ms = Date.parse(c.completedAt);
      if (c.weekNumber === weekNumber && !Number.isNaN(ms)) out.push(ms);
    }
    for (const s of skipped) {
      const ms = Date.parse(s.skippedAt);
      if (s.weekNumber === weekNumber && !Number.isNaN(ms)) out.push(ms);
    }
    return out;
  };
  const nowMs = now.getTime();
  const current = stamps(week);
  if (current.length > 0) return new Date(Math.min(nowMs, ...current)).toISOString();
  const previous = stamps(week - 1);
  if (previous.length > 0) return new Date(Math.min(nowMs, Math.max(...previous))).toISOString();
  return new Date(nowMs).toISOString();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Aantal volledige dagen sinds weekStartedAt, of null als die ontbreekt/ongeldig is. */
export function daysSinceWeekStart(weekStartedAt: string | null, now: Date): number | null {
  const startMs = toMs(weekStartedAt);
  if (startMs === null) return null;
  return Math.floor((now.getTime() - startMs) / DAY_MS);
}

/**
 * Bepaalt of het dashboard de terugkomkaart moet tonen.
 * - null: geen kaart (geen/ongeldige weekStartedAt, minder dan 7 dagen
 *   geleden, of de week is al afgehandeld).
 * - 'short': 7 t/m 13 dagen na de start van de week.
 * - 'long': 14 dagen of meer.
 */
export function getWeekReturnState(
  weekStartedAt: string | null,
  now: Date,
  weekHandled: boolean,
): null | 'short' | 'long' {
  if (weekHandled) return null;
  const days = daysSinceWeekStart(weekStartedAt, now);
  if (days === null || days < 7) return null;
  return days >= 14 ? 'long' : 'short';
}
