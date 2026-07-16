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
import { getTrainingPlan } from './trainingPlans';
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
}

export function resolveActivePlan({
  schemaMode,
  racePlan,
  customPlan,
  goal,
}: ResolveActivePlanArgs): ActivePlan {
  if (schemaMode === 'race' && racePlan) {
    return {
      weeks: racePlan.weeks,
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
    weeks: fallback.plan,
    name: fallback.name,
    totalWeeks: fallback.weeks,
    isRace: false,
    isCustom: false,
  };
}
