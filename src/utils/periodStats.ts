/**
 * periodStats
 *
 * Pure functies (geen React) om week-, maand-, kwartaal- en jaarstatistieken
 * te berekenen uit CompletedSession[], voor de deelbare periode-kaarten
 * (SharePeriodCard / SharePeriodSheet). Week loopt maandag t/m zondag,
 * consistent met `weekStartISO` in appStore.ts.
 */

import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subWeeks,
  subMonths,
  subQuarters,
  subYears,
  getISOWeek,
  getQuarter,
  isWithinInterval,
  format,
} from 'date-fns';
import type { CompletedSession } from '../store/appStore';

// ── Types ─────────────────────────────────────

export type PeriodType = 'week' | 'month' | 'quarter' | 'year';

export interface PeriodStats {
  period: PeriodType;
  /** bijv. "Week 29", "Juli 2026", "Q3 2026", "2026" (Nederlands) */
  label: string;
  startISO: string;   // YYYY-MM-DD (inclusief)
  endISO: string;     // YYYY-MM-DD (inclusief)
  runCount: number;
  totalKm: number;
  totalSeconds: number;
  avgPaceSecPerKm: number | null;   // null als geen runs
  longestRunKm: number | null;
  bestPaceSecPerKm: number | null;  // snelste gemiddelde tempo van één run
  activeDays: number;               // aantal unieke dagen met een run
  prevTotalKm: number | null;       // totale km van de vórige periode (null als geen data)
  kmDeltaPct: number | null;        // % verschil t.o.v. vorige periode (null als vorige periode 0 of geen data)
}

// ── Nederlandse maandnamen ────────────────────
const MAAND_NAMEN = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
];

// ── Hulpfuncties ──────────────────────────────

function dateOnlyISO(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Begin- en einddatum (inclusief) van de periode waarin refDate valt. */
function getPeriodBounds(period: PeriodType, refDate: Date): { start: Date; end: Date } {
  switch (period) {
    case 'week':
      return {
        start: startOfWeek(refDate, { weekStartsOn: 1 }),
        end: endOfWeek(refDate, { weekStartsOn: 1 }),
      };
    case 'month':
      return { start: startOfMonth(refDate), end: endOfMonth(refDate) };
    case 'quarter':
      return { start: startOfQuarter(refDate), end: endOfQuarter(refDate) };
    case 'year':
      return { start: startOfYear(refDate), end: endOfYear(refDate) };
  }
}

/** Referentiedatum die in de vórige periode valt. */
function getPrevPeriodRefDate(period: PeriodType, refDate: Date): Date {
  switch (period) {
    case 'week':    return subWeeks(refDate, 1);
    case 'month':   return subMonths(refDate, 1);
    case 'quarter': return subQuarters(refDate, 1);
    case 'year':    return subYears(refDate, 1);
  }
}

function getPeriodLabel(period: PeriodType, refDate: Date, start: Date): string {
  switch (period) {
    case 'week':
      return `Week ${getISOWeek(refDate)}`;
    case 'month':
      return `${MAAND_NAMEN[start.getMonth()]} ${start.getFullYear()}`;
    case 'quarter':
      return `Q${getQuarter(start)} ${start.getFullYear()}`;
    case 'year':
      return `${start.getFullYear()}`;
  }
}

// ── Hoofdfunctie ──────────────────────────────

export function getPeriodStats(
  sessions: CompletedSession[],
  period: PeriodType,
  refDate: Date = new Date(),
): PeriodStats {
  const { start, end } = getPeriodBounds(period, refDate);
  const prevRefDate = getPrevPeriodRefDate(period, refDate);
  const { start: prevStart, end: prevEnd } = getPeriodBounds(period, prevRefDate);

  const inRange = (session: CompletedSession, rangeStart: Date, rangeEnd: Date): boolean =>
    isWithinInterval(new Date(session.completedAt), { start: rangeStart, end: rangeEnd });

  const periodSessions = sessions.filter(s => inRange(s, start, end));
  const prevSessions = sessions.filter(s => inRange(s, prevStart, prevEnd));

  const runCount = periodSessions.length;
  const totalKm = periodSessions.reduce((sum, s) => sum + s.actualDistanceKm, 0);
  const totalSeconds = periodSessions.reduce((sum, s) => sum + s.durationSeconds, 0);

  const avgPaceSecPerKm = totalKm > 0 ? totalSeconds / totalKm : null;
  const longestRunKm = runCount > 0
    ? Math.max(...periodSessions.map(s => s.actualDistanceKm))
    : null;

  const validPaces = periodSessions
    .map(s => s.avgPaceSecPerKm)
    .filter((pace): pace is number => typeof pace === 'number' && pace > 0);
  const bestPaceSecPerKm = validPaces.length > 0 ? Math.min(...validPaces) : null;

  const activeDays = new Set(
    periodSessions.map(s => dateOnlyISO(new Date(s.completedAt))),
  ).size;

  // "Geen data" voor de vorige periode betekent: de gebruiker had op dat
  // moment nog geen enkele sessie geregistreerd (de vroegste sessie ligt ná
  // het einde van de vorige periode). Zo blijft 0 km in een vorige periode
  // waarin wél al gelopen werd (maar toevallig niets in die periode) een
  // geldige, betekenisvolle 0 in plaats van "geen data".
  const earliestSessionTime = sessions.length > 0
    ? Math.min(...sessions.map(s => new Date(s.completedAt).getTime()))
    : null;
  const hasHistoryForPrevPeriod = earliestSessionTime !== null && earliestSessionTime <= prevEnd.getTime();

  const prevTotalKm = hasHistoryForPrevPeriod
    ? prevSessions.reduce((sum, s) => sum + s.actualDistanceKm, 0)
    : null;

  const kmDeltaPct = prevTotalKm === null || prevTotalKm === 0
    ? null
    : ((totalKm - prevTotalKm) / prevTotalKm) * 100;

  return {
    period,
    label: getPeriodLabel(period, refDate, start),
    startISO: dateOnlyISO(start),
    endISO: dateOnlyISO(end),
    runCount,
    totalKm,
    totalSeconds,
    avgPaceSecPerKm,
    longestRunKm,
    bestPaceSecPerKm,
    activeDays,
    prevTotalKm,
    kmDeltaPct,
  };
}
