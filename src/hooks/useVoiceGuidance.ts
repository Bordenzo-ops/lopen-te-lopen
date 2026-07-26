/**
 * useVoiceGuidance
 *
 * Geeft gesproken aanwijzingen tijdens een hardloopsessie.
 *
 * Triggers:
 *  - Elke voltooide kilometer → km-split + aanmoediging
 *  - Zone-overgang           → welke zone en wat dat betekent
 *  - Halverwege de sessie    → motivatieboodschap
 *  - Sessie voltooid         → felicitatie
 *
 * Sinds de stempakketten-omschakeling (zie
 * `_workspace/notities/Stempakketten-ontwerp.md`) lopen al deze meldingen
 * via `speakPhrases` met de compositiefuncties uit
 * `src/config/voicePhrases.ts` (catalogus-clip-ids + natuurlijke
 * fallback-volzin). Zolang de stempakketten er niet zijn (fase A/B) hoort
 * de gebruiker exact dezelfde tekst als voorheen, via de telefoonstem.
 *
 * Gebruik:
 *   const { onKmUpdate, onZoneChange, onHalfway, onFinish } = useVoiceGuidance(enabled, sessionDistanceKm);
 */

import { useRef, useCallback } from 'react';
import * as voiceService from '../services/voiceService';
import type { VoiceType } from '../config/voiceConfig';
import { kmSplitUtterance, halfwayUtterance, zoneUtterance, finishUtterance } from '../config/voicePhrases';

export function useVoiceGuidance(
  enabled: boolean,
  targetDistanceKm: number,
  voiceType: VoiceType = 'female',
) {
  const lastSpokenKm   = useRef(0);
  const halfwaySpoken  = useRef(false);
  const finishSpoken   = useRef(false);

  /**
   * Aanroepen elke keer dat de afstand bijgewerkt wordt.
   * Spreekt een km-split uit zodra een nieuwe volledige km bereikt is.
   */
  const onKmUpdate = useCallback((distanceKm: number, paceSecPerKm: number) => {
    if (!enabled) return;

    const completedKm = Math.floor(distanceKm);
    if (completedKm > 0 && completedKm > lastSpokenKm.current) {
      lastSpokenKm.current = completedKm;
      voiceService.speakPhrases(kmSplitUtterance(completedKm, paceSecPerKm), voiceType);
    }

    // Halverwege-melding
    if (
      !halfwaySpoken.current &&
      targetDistanceKm > 0 &&
      distanceKm >= targetDistanceKm * 0.5 &&
      distanceKm < targetDistanceKm * 0.5 + 0.1
    ) {
      halfwaySpoken.current = true;
      const remaining = targetDistanceKm - distanceKm;
      voiceService.speakPhrases(halfwayUtterance(remaining), voiceType);
    }
  }, [enabled, targetDistanceKm, voiceType]);

  /**
   * Aanroepen wanneer de hartslagzone verandert.
   */
  const onZoneChange = useCallback((newZone: string) => {
    if (!enabled) return;
    voiceService.speakPhrases(zoneUtterance(newZone), voiceType);
  }, [enabled, voiceType]);

  /**
   * Aanroepen wanneer de sessie voltooid is. `finishVariant` (CP4, optioneel)
   * rouleert de afsluitzin ("Geweldig gedaan!" / varianten) — de aanroeper
   * geeft hiervoor het aantal eerder voltooide sessies mee, zodat de variant
   * over meerdere runs heen rouleert in plaats van binnen één sessie.
   */
  const onFinish = useCallback((distanceKm: number, durationSeconds: number, finishVariant: number = 0) => {
    if (!enabled || finishSpoken.current) return;
    finishSpoken.current = true;
    voiceService.speakPhrases(finishUtterance(distanceKm, durationSeconds, finishVariant), voiceType);
  }, [enabled, voiceType]);

  /**
   * Stop alle lopende uitspraak (bij pauze of annuleren).
   */
  const stop = useCallback(() => {
    voiceService.stop();
  }, []);

  return { onKmUpdate, onZoneChange, onFinish, stop };
}
