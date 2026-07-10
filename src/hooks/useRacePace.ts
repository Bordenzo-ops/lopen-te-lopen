/**
 * useRacePace
 *
 * Centraliseert de premium-gated berekening van het persoonlijke
 * trainingstempo. De tempo-weergave verschijnt alleen als:
 *   1. de gebruiker premium-toegang heeft (hasAccess), en
 *   2. er een wedstrijdschema actief is (schemaMode 'race' met een racePlan), en
 *   3. er een doeltijd is ingesteld (raceTargetSeconds).
 *
 * Zonder een van deze drie verandert er niets aan de weergave: de hook geeft
 * dan een functie terug die voor elk sessietype null oplevert.
 *
 * De afstanden en hartslagzones blijven ongemoeid; dit voegt enkel tempo toe.
 */

import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { usePremium } from './usePremium';
import { sessionTrainingPace, racePaceSecPerKm, raceDistanceToKm } from '../data/paceModel';
import type { Session } from '../data/trainingPlans';

export interface UseRacePace {
  /** Is de persoonlijke tempo-weergave actief (premium + race + doeltijd)? */
  enabled: boolean;
  /** Doeltijd in totale seconden, of null. */
  targetSeconds: number | null;
  /** Doel-racetempo in sec/km, of null. */
  racePaceSecPerKm: number | null;
  /**
   * Geeft het trainingstempo (sec/km) voor een sessietype, of null als er geen
   * tempo getoond mag worden (geen premium, geen doeltijd, of een type zonder
   * looptempo zoals rust of cross).
   */
  paceForType: (type: Session['type']) => number | null;
}

export function useRacePace(): UseRacePace {
  const { hasAccess } = usePremium();
  const schemaMode = useAppStore(s => s.schemaMode);
  const racePlan = useAppStore(s => s.racePlan);
  const targetSeconds = useAppStore(s => s.raceTargetSeconds);

  const isRaceMode = schemaMode === 'race' && !!racePlan;
  const raceKm = racePlan ? raceDistanceToKm(racePlan.race.distance) : null;

  const enabled =
    hasAccess &&
    isRaceMode &&
    targetSeconds !== null &&
    targetSeconds > 0 &&
    raceKm !== null;

  const racePace =
    enabled && targetSeconds !== null && raceKm !== null
      ? racePaceSecPerKm(targetSeconds, raceKm)
      : null;

  const paceForType = useCallback(
    (type: Session['type']): number | null => {
      if (!enabled || targetSeconds === null || raceKm === null) return null;
      return sessionTrainingPace(targetSeconds, raceKm, type);
    },
    [enabled, targetSeconds, raceKm],
  );

  return {
    enabled,
    targetSeconds: enabled ? targetSeconds : null,
    racePaceSecPerKm: racePace,
    paceForType,
  };
}
