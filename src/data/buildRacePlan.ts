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
 *
 * BEKENDE BEPERKING: wanneer het aantal beschikbare weken gelijk is aan of
 * kleiner is dan het basisprogramma (de "perfect past"- en "trim"-takken
 * hieronder), hergebruikt het wedstrijdschema de sessie-id's van het
 * doelgebaseerde sjabloon (bijv. 'hm-3-1') ongewijzigd. Voltooit een
 * gebruiker een sessie in training-modus en schakelt hij daarna over naar
 * race-modus (of andersom) met hetzelfde doel, dan kan een sessie met
 * toevallig hetzelfde id al als "voltooid" verschijnen. We prefixen deze
 * id's bewust niet: bestaande gebruikers hebben al voltooide race-sessies
 * onder deze ongewijzigde id's opgeslagen, en een prefix zou die matching
 * met terugwerkende kracht breken. Alleen de "extra opbouwweken"-tak
 * (buildExtraWeek) gebruikt al een 'extra-' prefix en is hier niet gevoelig
 * voor. Het introduceren van een eigen vrij schema (customPlan) is hier niet
 * door geraakt: dat genereert altijd gloednieuwe 'custom-' id's.
 */

import { getTrainingPlan } from './trainingPlans';
import type { TrainingWeek, Session, GoalType } from './trainingPlans';
import type { RotterdamRace } from './rotterdamRaces';
import { weeksUntilRace } from './rotterdamRaces';

// Minimale en maximale schema-lengte per afstand
const PLAN_BOUNDS: Record<GoalType, { min: number; base: number; max: number }> = {
  '5km':           { min: 4,  base: 8,  max: 14 },
  '10km':          { min: 6,  base: 12, max: 20 },
  '15km':          { min: 8,  base: 14, max: 22 },
  'half_marathon': { min: 10, base: 20, max: 28 },
  'marathon':      { min: 16, base: 24, max: 32 },
};

// Hoeveel weken taper + race altijd behouden worden
const TAPER_WEEKS = 3;

/** Bepaal het trainingsdoel op basis van de wedstrijdafstand. */
function goalForDistance(distance: RotterdamRace['distance']): GoalType {
  switch (distance) {
    case 'marathon':      return 'marathon';
    case 'half_marathon': return 'half_marathon';
    case '15km':          return '15km';
    case '10km':          return '10km';
    default:               return '5km';
  }
}

/** Afstand in km die bij een wedstrijdcategorie hoort, voor de racedag-sessie. */
function kmForDistance(distance: RotterdamRace['distance']): number {
  switch (distance) {
    case 'marathon':      return 42.2;
    case 'half_marathon': return 21.1;
    case '15km':          return 15;
    case '10km':          return 10;
    default:               return 5;
  }
}

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

/**
 * Pas de race-dag sessie-beschrijving aan met de wedstrijdnaam en de echte
 * wedstrijdafstand. De racedag is altijd de sessie met de hoogste `day` in
 * de laatste week (ongeacht type of afstand van het onderliggende sjabloon),
 * zodat dit ook werkt voor de korte schema's (5km/10km) waar de racesessie
 * geen 'long'-type of >=10 km heeft.
 */
function injectRaceName(
  week: TrainingWeek,
  raceName: string,
  goal: GoalType,
  raceKm: number,
): TrainingWeek {
  if (week.sessions.length === 0) return week;

  const raceIndex = week.sessions.reduce(
    (maxIdx, sess, idx, arr) => (sess.day > arr[maxIdx].day ? idx : maxIdx),
    0,
  );

  const isMarathon = goal === 'marathon';
  const coachTip = isMarathon
    ? `Vandaag ren je de ${raceName}. Loop de eerste 10 km langzamer dan je wilt. Voeding elk halfuur. Daarna kun je loslaten.`
    : goal === '15km'
      ? `Vandaag ren je de ${raceName}. Loop de eerste 3 km langzamer dan je wilt, dan lekker doortrekken.`
      : `Vandaag ren je de ${raceName}. Loop de eerste 5 km langzamer dan je wilt. Daarna kun je los.`;

  const sessions = week.sessions.map((sess, idx) =>
    idx === raceIndex
      ? { ...sess, description: `${raceName}: RACE DAG!`, distanceKm: raceKm, coachTip }
      : sess,
  );

  return {
    ...week,
    sessions,
    totalKm: Math.round(sessions.reduce((sum, sess) => sum + sess.distanceKm, 0) * 10) / 10,
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
  const goal: GoalType = goalForDistance(race.distance);

  const bounds       = PLAN_BOUNDS[goal];
  const availWeeks   = weeksUntilRace(race.date, today);
  const basePlan     = getTrainingPlan(goal);

  // Te weinig weken: minimaal TAPER_WEEKS + 1 nodig
  if (availWeeks < TAPER_WEEKS + 1) return null;

  // Klem de beschikbare weken binnen de max lengte. bounds.min is BEWUST hier
  // niet als ondergrens toegepast: Math.max(availWeeks, bounds.min) zou bij
  // te weinig beschikbare weken het schema optrekken tot bounds.min, waardoor
  // de racedag ná de wedstrijddatum zou vallen. bounds.min wordt alleen nog
  // gebruikt in canTrainForRace om de gebruiker te waarschuwen dat het krap is.
  const targetWeeks  = Math.min(availWeeks, bounds.max);
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

  // Injecteer wedstrijdnaam en -afstand in de race-week
  const raceKm = kmForDistance(race.distance);
  weeks = weeks.map((w, i) =>
    i === weeks.length - 1 ? injectRaceName(w, race.name, goal, raceKm) : w,
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
  const goal: GoalType = goalForDistance(race.distance);
  const { min } = PLAN_BOUNDS[goal];

  if (weeks < TAPER_WEEKS + 1) {
    return { possible: false, reason: 'De wedstrijd is te dichtbij voor een volwaardige voorbereiding.' };
  }
  if (weeks < min) {
    return { possible: true, reason: `Krap, maar haalbaar met een versneld ${weeks}-wekenschema.` };
  }
  return { possible: true };
}
