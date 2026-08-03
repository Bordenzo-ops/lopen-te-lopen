/**
 * useTechniqueCoaching
 *
 * Gesproken techniek-/houdingscoaching tijdens een lange duurloop (CP7, zie
 * Elevenlabs-creditplan-aug-2026.md). Puur tijdgedreven — geen hartslagmeter
 * nodig, in tegenstelling tot useHeartRateCoaching.ts — en daarom alleen
 * zinvol bij sessietype 'long' (of de RACE-dagsessie, die ook type 'long' is,
 * zie active.tsx): bij kortere trainingen is er geen ruimte/noodzaak voor.
 *
 * Gemaakte keuzes:
 *  - Eerste cue na 15 minuten (FIRST_CUE_SECONDS): vroeg in de loop is de
 *    loper nog niet moe genoeg om baat te hebben bij een houdingstip.
 *  - Daarna elke 15 minuten (INTERVAL_SECONDS), hooguit MAX_CUES keer per
 *    sessie. Een marathon duurt voor de meeste lopers 3-5 uur; elke 15
 *    minuten blijven doorpraten zou een coach zijn die zeurt, geen coach die
 *    je met rust laat als je eenmaal je ritme te pakken hebt. Na de laatste
 *    cue (rond het 1,5 uur-punt) blijft de hook stil.
 *  - Rouleert door TECH_TEXTS (modulo de lijstlengte, zie
 *    techniqueCueUtterance) zodat een lange duurloop niet steeds dezelfde tip
 *    herhaalt.
 *
 * Gebruik: `onTick(elapsedSeconds)` bij elke seconde van de sessietimer
 * (zelfde ref-patroon als useIntervalCoaching.onTick in active.tsx), alleen
 * terwijl de sessie daadwerkelijk loopt (niet gepauzeerd).
 */

import { useCallback, useRef } from 'react';
import * as voiceService from '../services/voiceService';
import type { VoiceType } from '../config/voiceConfig';
import { techniqueCueUtterance } from '../config/voicePhrases';

const FIRST_CUE_SECONDS = 900;
const INTERVAL_SECONDS = 900;
const MAX_CUES = 6;

export function useTechniqueCoaching(
  enabled: boolean,
  isLongRun: boolean,
  voiceType: VoiceType = 'female',
) {
  const cueCountRef = useRef(0);

  const onTick = useCallback((elapsedSeconds: number) => {
    if (!enabled || !isLongRun) return;
    if (cueCountRef.current >= MAX_CUES) return;
    if (elapsedSeconds < FIRST_CUE_SECONDS) return;
    if ((elapsedSeconds - FIRST_CUE_SECONDS) % INTERVAL_SECONDS !== 0) return;

    const variant = cueCountRef.current;
    cueCountRef.current += 1;
    voiceService.speakPhrases(techniqueCueUtterance(variant), voiceType);
  }, [enabled, isLongRun, voiceType]);

  return { onTick };
}
