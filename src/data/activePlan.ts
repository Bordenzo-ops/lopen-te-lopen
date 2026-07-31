// ─────────────────────────────────────────────
// activePlan — centrale plan-resolutie
// ─────────────────────────────────────────────
//
// Eén pure functie die bepaalt welk schema op dit moment "actief" is, zodat
// deze logica niet langer gedupliceerd hoeft te worden in elk scherm en in de
// store. Regels (bewust exact het bestaande gedrag voor training/race):
//
//  1. race-modus + racePlan aanwezig  → het wedstrijdschema (ongewijzigd).
//  2. training-modus + customPlan     → het eigen vrije schema ("Mijn schema").
//  3. anders (training-modus zonder customPlan, of race-modus zonder racePlan)
//     → het doelgebaseerde sjabloon (bestaand gedrag voor nieuwe gebruikers).

import type { GoalType, TrainingWeek } from './trainingPlans';
import { getTrainingPlan, remapWeekDays, addBonusRuns } from './trainingPlans';
import type { RacePlan } from './buildRacePlan';

export interface ActivePlan {
  weeks: TrainingWeek[];
  name: string;
  totalWeeks: number;
  /** True als het wedstrijdschema actief is. */
  isRace: boolean;
  /** True als het eigen vrije schema (customPlan) actief is. */
  isCustom: boolean;
}

export interface ResolveActivePlanArgs {
  schemaMode: 'training' | 'race';
  racePlan: RacePlan | null;
  customPlan: TrainingWeek[] | null;
  goal: GoalType;
  /** Zelfgekozen trainingsdagen (3–7 weekdagnummers, 1=ma..7=zo). Wordt
   *  gebruikt om sjabloon- en wedstrijdweken op de juiste dagen te zetten en
   *  aan te vullen met bonus-duurloopjes. Zonder waarde valt remapWeekDays
   *  terug op DEFAULT_TRAINING_DAYS. Een eigen vrij schema (customPlan)
   *  negeert dit veld: daar kiest de gebruiker de dag per sessie zelf. */
  trainingDays?: number[];
}

// Geen bonus-duurloopjes in de laatste taperweken (race-week + de twee
// afbouwweken ervoor): dat zijn bewust lichte weken, extra kilometers horen
// daar niet thuis.
const TAPER_WEEKS_ZONDER_BONUS = 3;

// Zet een reeks weken (sjabloon of wedstrijdschema) om naar de zelfgekozen
// trainingsdagen en vult de vrije dagen aan met optionele bonus-duurloopjes.
//
// BELANGRIJK: dit gebeurt hier centraal, in resolveActivePlan, en NIET meer
// in de schermen. Sessies worden elders opgezocht met
// `week.sessions.find(s => s.id === sessionId)` op het resultaat van
// resolveActivePlan. Zou de dag-/bonus-verwerking in de schermen blijven
// staan (zoals vóór deze wijziging), dan bevat de data die resolveActivePlan
// teruggeeft geen bonus-sessies en is een bonus-duurloop dus nooit te
// starten, ook al staat hij wel op het scherm. Elke aanroep van
// resolveActivePlan moet daarom dezelfde trainingDays meekrijgen als het
// scherm gebruikt om te tonen.
function prepareWeeks(weeks: TrainingWeek[], trainingDays?: number[]): TrainingWeek[] {
  return weeks.map((week, i) => {
    const remapped = remapWeekDays(week, trainingDays);
    const isTaper = i >= weeks.length - TAPER_WEEKS_ZONDER_BONUS;
    return isTaper ? remapped : addBonusRuns(remapped, trainingDays);
  });
}

export function resolveActivePlan({
  schemaMode,
  racePlan,
  customPlan,
  goal,
  trainingDays,
}: ResolveActivePlanArgs): ActivePlan {
  if (schemaMode === 'race' && racePlan) {
    return {
      weeks: prepareWeeks(racePlan.weeks, trainingDays),
      name: racePlan.race.name,
      totalWeeks: racePlan.totalWeeks,
      isRace: true,
      isCustom: false,
    };
  }

  if (schemaMode === 'training' && customPlan) {
    return {
      weeks: customPlan,
      name: 'Mijn schema',
      totalWeeks: customPlan.length,
      isRace: false,
      isCustom: true,
    };
  }

  const fallback = getTrainingPlan(goal);
  return {
    weeks: prepareWeeks(fallback.plan, trainingDays),
    name: fallback.name,
    totalWeeks: fallback.weeks,
    isRace: false,
    isCustom: false,
  };
}
