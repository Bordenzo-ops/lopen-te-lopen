// ─────────────────────────────────────────────
// Intervalsessies - pure hulpmodule
// ─────────────────────────────────────────────
//
// Bevat de segment-opbouw voor een intervaltraining en een functie die op
// basis van verstreken tijd bepaalt in welk segment je zit. Geen React,
// geen state - alleen pure functies, zodat dit los te testen is. De runtime
// (timer-scherm) gebruikt deze module om de sessie stap voor stap te sturen.

import type { HeartRateZone } from './trainingPlans';
import type { IntervalStructure } from './trainingPlans';

export type IntervalPhase = 'warmup' | 'work' | 'recovery' | 'cooldown';

export interface IntervalSegment {
  phase: IntervalPhase;
  durationSec: number;
  zone: HeartRateZone;
  repIndex?: number;   // 1-based, alleen bij work/recovery
  repTotal?: number;
  isLastWork?: boolean;
}

// Rustzone voor warming-up en cooling-down.
const RUST_ZONE: HeartRateZone = 'Z1';

// Segmentvolgorde: warming-up, dan per herhaling [werk, herstel] maar de
// herstel NA de laatste werkherhaling wordt weggelaten (je loopt direct de
// cooling-down in), dan cooling-down. Dus: WU, W, R, W, R, ..., W, CD.
export function buildIntervalSegments(s: IntervalStructure): IntervalSegment[] {
  const segments: IntervalSegment[] = [];

  // Defensief: negatieve of ontbrekende waarden clampen op 0.
  const warmupMin = Math.max(0, s.warmupMin ?? 0);
  const reps = Math.max(0, Math.floor(s.reps ?? 0));
  const workSec = Math.max(0, s.workSec ?? 0);
  const recoverySec = Math.max(0, s.recoverySec ?? 0);
  const cooldownMin = Math.max(0, s.cooldownMin ?? 0);

  if (warmupMin > 0) {
    segments.push({ phase: 'warmup', durationSec: warmupMin * 60, zone: RUST_ZONE });
  }

  for (let i = 1; i <= reps; i++) {
    segments.push({
      phase: 'work',
      durationSec: workSec,
      zone: s.workZone,
      repIndex: i,
      repTotal: reps,
      isLastWork: i === reps,
    });

    // Herstel na de laatste werkherhaling weglaten: direct de cooling-down in.
    if (i < reps) {
      segments.push({
        phase: 'recovery',
        durationSec: recoverySec,
        zone: s.recoveryZone,
        repIndex: i,
        repTotal: reps,
      });
    }
  }

  if (cooldownMin > 0) {
    segments.push({ phase: 'cooldown', durationSec: cooldownMin * 60, zone: RUST_ZONE });
  }

  return segments;
}

export function intervalTotalSeconds(s: IntervalStructure): number {
  return buildIntervalSegments(s).reduce((total, seg) => total + seg.durationSec, 0);
}

// Fallback-segment voor de defensieve gevallen (lege segmentenlijst). Wijst
// op een "klaar, niets te doen"-toestand zonder dat de caller met een
// optioneel segment hoeft om te gaan.
const EMPTY_SEGMENT: IntervalSegment = { phase: 'cooldown', durationSec: 0, zone: RUST_ZONE };

// Bepaalt op basis van de verstreken seconden in welk segment je zit.
// `done` is true zodra alle segmenten voorbij zijn; dan wijst `segment` naar
// het laatste segment met segmentRemainingSec 0.
export function intervalStateAt(segments: IntervalSegment[], elapsedSec: number): {
  index: number;
  segment: IntervalSegment;
  phase: IntervalPhase;
  segmentElapsedSec: number;
  segmentRemainingSec: number;
  done: boolean;
} {
  // Defensief: lege lijst of negatieve tijd.
  if (segments.length === 0) {
    return {
      index: 0,
      segment: EMPTY_SEGMENT,
      phase: EMPTY_SEGMENT.phase,
      segmentElapsedSec: 0,
      segmentRemainingSec: 0,
      done: true,
    };
  }

  const clampedElapsed = Math.max(0, elapsedSec);

  let cumulative = 0;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentEnd = cumulative + segment.durationSec;

    if (clampedElapsed < segmentEnd) {
      const segmentElapsedSec = clampedElapsed - cumulative;
      return {
        index: i,
        segment,
        phase: segment.phase,
        segmentElapsedSec,
        segmentRemainingSec: segment.durationSec - segmentElapsedSec,
        done: false,
      };
    }

    cumulative = segmentEnd;
  }

  // Alle segmenten zijn voorbij: wijs naar het laatste segment, volledig verstreken.
  const lastIndex = segments.length - 1;
  const lastSegment = segments[lastIndex];
  return {
    index: lastIndex,
    segment: lastSegment,
    phase: lastSegment.phase,
    segmentElapsedSec: lastSegment.durationSec,
    segmentRemainingSec: 0,
    done: true,
  };
}
