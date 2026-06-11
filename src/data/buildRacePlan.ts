/**
 * buildRacePlan
 *
 * Past een bestaand trainingsschema aan op een specifieke wedstrijddatum.
 *
 * Logica (zelfde opbouw als Strava Training Plans / Garmin Coach):
 *
 *  1. Bereken beschikbare weken = floor((raceDate - vandaag) / 7)
 *  2. Kies het best passende basisprogramma (5km / 10km / halve_marathon)
 *  3. Als er MEER weken zijn dan het basisprogramma: voeg opbouwweken toe aan het begin
 *  4. Als er MINDER weken zijn: trim rustiger weken aan het begin weg (bewaar altijd taper + race week)
 *  5. Herbereken weeknummers en pas de race-week sessie-beschrijving aan met de wedstrijdnaam
 *
 * De structuur van TrainingWeek/Session blijft identiek zodat bestaande UI gewoon werkt.
 */

import { getTrainingPlan } from './trainingPlans';
import type { TrainingWeek, Session, GoalType } from './trainingPlans';
import type { RotterdamRace } from './rotterdamRaces';
import { weeksUntilRace } from './rotterdamRaces';

// Minimale en maximale schema-lengte per afstand
const PLAN_BOUNDS: Record<GoalType, { min: number; base: number; max: number }> = {
  '5km':           { min: 4,  base: 8,  max: 14 },
  '10km':          { min: 6,  base: 12, max: 20 },
  'half_marathon': { min: 10, base: 20, max: 28 },
  'marathon':      { min: 16, base: 24, max: 32 },
};

// Hoeveel weken taper + race altijd behouden worden
const TAPER_WEEKS = 3;

export interface RacePlan {
  race: RotterdamRace;
  goal: GoalType;
  totalWeeks: number;
  /** ISO datum van week 1, maandag */
  startDate: string;
  weeks: TrainingWeek[];
  /** Uitleg waarom het schema deze lengte heeft */
  adaptationNote: string;
}

// ── Hulpfuncties ──────────────────────────────────────────────────────────────

/** Bouw één extra opbouwweek als kloon van week N met iets lagere km */
function buildExtraWeek(
  weekNumber: number,
  templateWeek: TrainingWeek,
  scaleFactor: number,
): TrainingWeek {
  return {
    weekNumber,
    totalKm:  Math.round(templateWeek.totalKm * scaleFactor),
    focus:    templateWeek.focus,
    sessions: templateWeek.sessions.map(s => ({
      ...s,
      id:         `extra-${weekNumber}-${s.id}`,
      distanceKm: Math.round(s.distanceKm * scaleFactor * 10) / 10,
    })),
  };
}

/** Pas de race-dag sessie-beschrijving aan met de wedstrijdnaam */
function injectRaceName(week: TrainingWeek, raceName: string, isMarathon: boolean): TrainingWeek {
  return {
    ...week,
    sessions: week.sessions.map(s =>
      s.type === 'long' && s.distanceKm >= 10
        ? {
            ...s,
            description: `${raceName}: RACE DAG!`,
            coachTip: isMarathon
              ? `Vandaag ren je de ${raceName}. Loop de eerste 10 km langzamer dan je wilt. Voeding elk halfuur. Daarna kun je loslaten.`
              : `Vandaag ren je de ${raceName}. Loop de eerste 5 km langzamer dan je wilt. Daarna kun je los.`,
          }
        : s,
    ),
  };
}

// ── Hoofd-export ──────────────────────────────────────────────────────────────

/**
 * Bouw een wedstrijdgericht trainingsschema.
 *
 * @param race            De gekozen wedstrijd
 * @param today           Optionele 'vandaag' voor tests
 * @param customStartDate Optionele vaste startdatum (ISO string). Standaard = today.
 */
export function buildRacePlan(
  race: RotterdamRace,
  today = new Date(),
  customStartDate?: string,
): RacePlan | null {
  // Bepaal doel op basis van afstand
  const goal: GoalType =
    race.distance === 'marathon'      ? 'marathon'      :
    race.distance === 'half_marathon' ? 'half_marathon' :
    race.distance === '10km'          ? '10km'          :
    '5km';

  const bounds       = PLAN_BOUNDS[goal];
  const availWeeks   = weeksUntilRace(race.date, today);
  const basePlan     = getTrainingPlan(goal);

  // Te weinig weken: minimaal TAPER_WEEKS + 1 nodig
  if (availWeeks < TAPER_WEEKS + 1) return null;

  // Klem de beschikbare weken binnen bounds
  const targetWeeks  = Math.min(Math.max(availWeeks, bounds.min), bounds.max);
  const baseWeeks    = basePlan.plan.length;

  let weeks: TrainingWeek[] = [...basePlan.plan];
  let adaptationNote: string;

  if (targetWeeks === baseWeeks) {
    // Perfect: schema past precies
    adaptationNote = `Standaard ${baseWeeks}-wekenschema, ideale voorbereiding voor deze datum.`;

  } else if (targetWeeks > baseWeeks) {
    // Meer tijd: voeg opbouwweken toe aan het begin
    const extraCount = targetWeeks - baseWeeks;
    const extraWeeks: TrainingWeek[] = [];
    for (let i = 0; i < extraCount; i++) {
      // Gebruik de eerste 3 weken als template, schaal langzaam op
      const templateIdx = i % 3;
      const scale       = 0.65 + (i / extraCount) * 0.25; // 65% → 90%
      extraWeeks.push(buildExtraWeek(i + 1, basePlan.plan[templateIdx], scale));
    }
    // Herbereken weeknummers van het origineel
    const renumbered = weeks.map((w, i) => ({ ...w, weekNumber: extraCount + i + 1 }));
    weeks = [...extraWeeks, ...renumbered];
    adaptationNote = `${extraCount} extra opbouwweken toegevoegd aan het begin, je hebt ruim de tijd.`;

  } else {
    // Minder tijd: trim vroege weken weg, bewaar altijd laatste TAPER_WEEKS
    const keepFromEnd = TAPER_WEEKS;
    const available   = targetWeeks - keepFromEnd;
    const skip        = baseWeeks - targetWeeks;
    const trimmed     = [
      ...weeks.slice(skip, baseWeeks - keepFromEnd).slice(0, available),
      ...weeks.slice(baseWeeks - keepFromEnd),
    ];
    weeks = trimmed.map((w, i) => ({ ...w, weekNumber: i + 1 }));
    adaptationNote = `Schema ingekort van ${baseWeeks} naar ${targetWeeks} weken: opbouw gecomprimeerd, taper behouden.`;
  }

  // Injecteer wedstrijdnaam in de race-week
  const isMarathon = goal === 'marathon';
  weeks = weeks.map((w, i) =>
    i === weeks.length - 1 ? injectRaceName(w, race.name, isMarathon) : w,
  );

  // Startdatum = customStartDate, of anders vandaag (snap naar aankomende maandag)
  const startDate = customStartDate ? new Date(customStartDate) : new Date(today);
  const dow = startDate.getDay();
  if (dow !== 1) {
    // Snap naar aankomende maandag (0=zo→+1, anders 8-dow dagen vooruit)
    startDate.setDate(startDate.getDate() + (dow === 0 ? 1 : 8 - dow));
  }

  return {
    race,
    goal,
    totalWeeks: weeks.length,
    startDate:  startDate.toISOString().split('T')[0],
    weeks,
    adaptationNote,
  };
}

/** Geeft aan of een gebruiker op tijd kan beginnen voor de wedstrijd */
export function canTrainForRace(
  race: RotterdamRace,
  today = new Date(),
): { possible: boolean; reason?: string } {
  const weeks = weeksUntilRace(race.date, today);
  const goal: GoalType =
    race.distance === 'marathon'      ? 'marathon'      :
    race.distance === 'half_marathon' ? 'half_marathon' :
    race.distance === '10km'          ? '10km'          : '5km';
  const { min } = PLAN_BOUNDS[goal];

  if (weeks < TAPER_WEEKS + 1) {
    return { possible: false, reason: 'De wedstrijd is te dichtbij voor een volwaardige voorbereiding.' };
  }
  if (weeks < min) {
    return { possible: true, reason: `Krap, maar haalbaar met een versneld ${weeks}-wekenschema.` };
  }
  return { possible: true };
}
