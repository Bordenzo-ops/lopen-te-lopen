/**
 * useRunWalkCoaching
 *
 * Gesproken cues en haptiek tijdens een lopen/wandelen-sessie (type 'runwalk',
 * beginnersschema "Start vanaf nul"). Net als useIntervalCoaching draait deze
 * hook geen eigen timer: app/session/active.tsx roept `onTick(elapsed)` elke
 * seconde aan, alleen terwijl de sessie loopt.
 *
 * De beslissing welke cue wanneer klinkt zit in de pure functie
 * `decideRunWalkCue` (src/data/runWalk.ts); deze hook vertaalt de cue naar een
 * utterance en spreekt die uit. Hooguit één `speakPhrases` per tick, want een
 * tweede aanroep kapt de eerste af (zie voiceService.speakPhrases).
 *
 * Haptiek: een tik bij elke segmentovergang (lopen/wandelen/uitwandelen) en
 * een afsluitende tik aan het eind van de sessie. Dat werkt ook als de stem
 * uit staat: een beginner die zonder geluid loopt moet toch voelen wanneer hij
 * moet wisselen.
 *
 * Gebruik:
 *   const rwCoaching = useRunWalkCoaching(voiceEnabled, session?.runWalk, voiceType, count, { warnBeforeRun, celebrate });
 *   rwCoaching.onTick(elapsedRef.current); // elke seconde
 *   rwCoaching.reset();                    // bij de start (na de countdown)
 */

import { useCallback, useMemo, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import * as voiceService from '../services/voiceService';
import type { VoiceType } from '../config/voiceConfig';
import { runWalkCueUtterance } from '../config/voicePhrases';
import {
  buildRunWalkSegments,
  decideRunWalkCue,
  initialRunWalkCueState,
  type RunWalkCueState,
} from '../data/runWalk';
import { intervalStateAt } from '../data/intervals';
import type { RunWalkStructure } from '../data/trainingPlans';

// Number of variants the run/walk counters shift per session (same idea as
// IV_VARIANT_STRIDE; 3 is coprime with the list length 4).
const RW_VARIANT_STRIDE = 3;

export interface RunWalkCoachingOptions {
  /** 10 s warning before a run block (weeks 1-4). */
  warnBeforeRun: boolean;
  /** One-off congratulation; pass undefined once the user has heard it. */
  celebrate?: RunWalkStructure['celebrate'];
}

export function useRunWalkCoaching(
  enabled: boolean,
  structure: RunWalkStructure | undefined,
  voiceType: VoiceType = 'female',
  runOffset: number = 0,
  options: RunWalkCoachingOptions = { warnBeforeRun: false },
) {
  const variantBase = runOffset * RW_VARIANT_STRIDE;
  const { warnBeforeRun, celebrate } = options;
  const segments = useMemo(
    () => (structure ? buildRunWalkSegments(structure) : []),
    [structure],
  );

  // The intro covers the start of the first segment, so a first tick in
  // segment 0 must not fire a cue (decideRunWalkCue handles a warm-up itself;
  // without a warm-up we start the bookkeeping at 0 so the intro is not cut off).
  const initialState = useCallback((): RunWalkCueState => {
    const state = initialRunWalkCueState();
    return segments[0] && segments[0].phase !== 'warmup' ? { ...state, lastSegmentIndex: 0 } : state;
  }, [segments]);

  const stateRef = useRef<RunWalkCueState>(initialRunWalkCueState());
  const hapticIndexRef = useRef(0);
  const doneHapticRef = useRef(false);
  const runVariantRef = useRef(0);
  const walkVariantRef = useRef(0);

  /** Resets all internal state, at the start of a new session. */
  const reset = useCallback(() => {
    stateRef.current = initialState();
    hapticIndexRef.current = 0;
    doneHapticRef.current = false;
    runVariantRef.current = 0;
    walkVariantRef.current = 0;
  }, [initialState]);

  const onTick = useCallback((elapsedSec: number) => {
    if (segments.length === 0) return;

    // Haptics: always, also with the voice off.
    const st = intervalStateAt(segments, elapsedSec);
    if (st.done) {
      if (!doneHapticRef.current) {
        doneHapticRef.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } else if (st.index !== hapticIndexRef.current) {
      hapticIndexRef.current = st.index;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }

    const { cue, state } = decideRunWalkCue(segments, elapsedSec, stateRef.current, { warnBeforeRun, celebrate });
    stateRef.current = state;
    if (!cue) return;

    // Count variants even with the voice off, so the rotation stays in step.
    let variant = 0;
    if (cue === 'run') variant = variantBase + runVariantRef.current++;
    else if (cue === 'walk') variant = variantBase + walkVariantRef.current++;
    if (!enabled) return;

    void voiceService.speakPhrases(runWalkCueUtterance(cue, { variant }), voiceType);
  }, [enabled, segments, voiceType, variantBase, warnBeforeRun, celebrate]);

  return { onTick, reset };
}
