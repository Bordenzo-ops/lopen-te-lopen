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
 * Gebruik:
 *   const { onKmUpdate, onZoneChange, onHalfway, onFinish } = useVoiceGuidance(enabled, sessionDistanceKm);
 */

import { useRef, useCallback } from 'react';
import * as Speech from 'expo-speech';

// ── Aanmoedigingen per km-split ────────────────────────────────────────────
const KM_MESSAGES = [
  'Goed bezig, houd dit tempo aan.',
  'Super! Blijf gelijkmatig lopen.',
  'Uitstekend! Je loopt geweldig.',
  'Fantastisch! Je bent sterk.',
  'Geweldig! Bijna bij het doel.',
  'Ongelooflijk! Je bent een machine.',
];

const ZONE_DESCRIPTIONS: Record<string, string> = {
  Z1: 'Herstelzone. Heel rustig tempo.',
  Z2: 'Aerobe zone. Comfortabel, je kunt praten.',
  Z3: 'Tempozone. Uitdagend maar houdbaar.',
  Z4: 'Drempelzone. Moeilijk, bijna geen gesprek mogelijk.',
  Z5: 'Maximale zone. Alles geven!',
};

function speak(text: string) {
  // Stop lopende uitspraak en start nieuwe
  Speech.stop();
  Speech.speak(text, {
    language: 'nl-NL',
    pitch:    1.0,
    rate:     0.95,
  });
}

export function useVoiceGuidance(enabled: boolean, targetDistanceKm: number) {
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

      const paceMin = Math.floor(paceSecPerKm / 60);
      const paceSec = Math.round(paceSecPerKm % 60);
      const paceStr = paceSecPerKm > 0
        ? `, tempo ${paceMin} minuten en ${paceSec} seconden per kilometer`
        : '';

      const encouragement = KM_MESSAGES[(completedKm - 1) % KM_MESSAGES.length];
      speak(`${completedKm} kilometer${paceStr}. ${encouragement}`);
    }

    // Halverwege-melding
    if (
      !halfwaySpoken.current &&
      targetDistanceKm > 0 &&
      distanceKm >= targetDistanceKm * 0.5 &&
      distanceKm < targetDistanceKm * 0.5 + 0.1
    ) {
      halfwaySpoken.current = true;
      const remaining = (targetDistanceKm - distanceKm).toFixed(1);
      speak(`Halverwege! Nog ${remaining} kilometer te gaan. Je doet het geweldig.`);
    }
  }, [enabled, targetDistanceKm]);

  /**
   * Aanroepen wanneer de hartslagzone verandert.
   */
  const onZoneChange = useCallback((newZone: string) => {
    if (!enabled) return;
    const desc = ZONE_DESCRIPTIONS[newZone] ?? newZone;
    speak(`Zone ${newZone}. ${desc}`);
  }, [enabled]);

  /**
   * Aanroepen wanneer de sessie voltooid is.
   */
  const onFinish = useCallback((distanceKm: number, durationSeconds: number) => {
    if (!enabled || finishSpoken.current) return;
    finishSpoken.current = true;

    const km    = distanceKm.toFixed(2);
    const mins  = Math.floor(durationSeconds / 60);
    const secs  = durationSeconds % 60;
    const timeStr = secs > 0 ? `${mins} minuten en ${secs} seconden` : `${mins} minuten`;

    speak(`Sessie voltooid! Je hebt ${km} kilometer gelopen in ${timeStr}. Geweldig gedaan!`);
  }, [enabled]);

  /**
   * Stop alle lopende uitspraak (bij pauze of annuleren).
   */
  const stop = useCallback(() => {
    Speech.stop();
  }, []);

  return { onKmUpdate, onZoneChange, onFinish, stop };
}
