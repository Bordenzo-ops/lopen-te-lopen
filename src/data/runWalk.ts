// ─────────────────────────────────────────────
// Lopen/wandelen-sessies - pure hulpmodule
// ─────────────────────────────────────────────
//
// Segment-opbouw voor een run/walk-training (beginnersschema "Start vanaf
// nul") en de pure beslislogica voor de stemcues. Geen React, geen stem, geen
// state buiten wat de caller doorgeeft: het hele cueverloop van een sessie is
// daardoor in Node te simuleren. Hergebruikt het segmenttype en
// `intervalStateAt` uit intervals.ts; die module blijft ongewijzigd.

import type { HeartRateZone, RunWalkStructure, Session } from './trainingPlans';
import { intervalStateAt, intervalTotalSeconds } from './intervals';
import type { IntervalSegment } from './intervals';

// Lopen is rustig (Z2), wandelen is herstel (Z1).
const RUN_ZONE: HeartRateZone = 'Z2';
const REST_ZONE: HeartRateZone = 'Z1';

// Gemiddelde snelheden voor de afstandsschatting (alleen weektotalen/kaart).
const WALK_KMH = 5;
const RUN_KMH = 7;

// ── Segmenten ─────────────────────────────────

/**
 * Bouwt de segmentenlijst voor een run/walk-sessie en normaliseert daarbij:
 * - blokken met `sec <= 0` (of niet-eindig) vallen weg;
 * - aangrenzende blokken van dezelfde soort worden samengevoegd;
 * - wandelblokken aan het begin gaan op in de warming-up, wandelblokken aan
 *   het eind in de cooling-down.
 * Mapping op de bestaande fasen: warming-up = 'warmup' (Z1), lopen = 'work'
 * (Z2, met repIndex/repTotal/isLastWork), wandelen tussen loopblokken =
 * 'recovery' (Z1), uitwandelen = 'cooldown' (Z1).
 */
export function buildRunWalkSegments(rw: RunWalkStructure): IntervalSegment[] {
  // 1. Clean and merge.
  const merged: { kind: 'run' | 'walk'; sec: number }[] = [];
  for (const block of rw.blocks ?? []) {
    if (!Number.isFinite(block.sec) || block.sec <= 0) continue;
    const last = merged[merged.length - 1];
    if (last && last.kind === block.kind) last.sec += block.sec;
    else merged.push({ kind: block.kind, sec: block.sec });
  }

  // 2. Peel walks off the start and end.
  let leadingWalkSec = 0;
  while (merged.length > 0 && merged[0].kind === 'walk') leadingWalkSec += merged.shift()!.sec;
  let trailingWalkSec = 0;
  while (merged.length > 0 && merged[merged.length - 1].kind === 'walk') {
    trailingWalkSec += merged.pop()!.sec;
  }

  const warmupSec = Math.max(0, rw.warmupWalkMin ?? 0) * 60 + leadingWalkSec;
  const cooldownSec = Math.max(0, rw.cooldownWalkMin ?? 0) * 60 + trailingWalkSec;
  const runTotal = merged.filter(b => b.kind === 'run').length;

  // 3. Emit segments.
  const segments: IntervalSegment[] = [];
  if (warmupSec > 0) segments.push({ phase: 'warmup', durationSec: warmupSec, zone: REST_ZONE });

  let runIndex = 0;
  for (const block of merged) {
    if (block.kind === 'run') {
      runIndex += 1;
      segments.push({
        phase: 'work',
        durationSec: block.sec,
        zone: RUN_ZONE,
        repIndex: runIndex,
        repTotal: runTotal,
        isLastWork: runIndex === runTotal,
      });
    } else {
      segments.push({
        phase: 'recovery',
        durationSec: block.sec,
        zone: REST_ZONE,
        repIndex: runIndex,
        repTotal: runTotal,
      });
    }
  }

  if (cooldownSec > 0) segments.push({ phase: 'cooldown', durationSec: cooldownSec, zone: REST_ZONE });
  return segments;
}

export function runWalkTotalSeconds(rw: RunWalkStructure): number {
  return buildRunWalkSegments(rw).reduce((total, seg) => total + seg.durationSec, 0);
}

/**
 * Estimated total distance (walking 5 km/h, running 7 km/h), rounded DOWN to
 * 0.5 km, minimum 0.5. Conservative on purpose so a slow beginner still fills
 * the week ring. Only used for week totals and the session card.
 */
export function estimateRunWalkKm(rw: RunWalkStructure): number {
  let km = 0;
  for (const seg of buildRunWalkSegments(rw)) {
    km += (seg.durationSec / 3600) * (seg.phase === 'work' ? RUN_KMH : WALK_KMH);
  }
  return Math.max(0.5, Math.floor(km * 2) / 2);
}

/** Planned duration of a timed session (interval or run/walk), otherwise null. */
export function sessionPlannedSeconds(session: Session): number | null {
  if (session.type === 'interval' && session.interval) return intervalTotalSeconds(session.interval);
  if (session.type === 'runwalk' && session.runWalk) return runWalkTotalSeconds(session.runWalk);
  return null;
}

// ── Cues ──────────────────────────────────────

/**
 * Cue kinds and the voice-catalogue ids they map to:
 *   run             -> rw_run_1..4 (rotating)
 *   walk            -> rw_walk_1..4 (rotating)
 *   lastRun         -> rw_last_run
 *   getReady        -> rw_warn_run
 *   sessionHalf     -> rw_half
 *   runHalf         -> rw_half
 *   cooldown        -> rw_cooldown
 *   firstContinuous -> rw_first_continuous
 *   finalDone       -> rw_final_done
 * Not tick cues: the intro (rw_intro_1/2, or rw_intro_final for start-9-3,
 * followed by rw_warmup). There is no separate `done` cue: the end of the
 * session is already announced by `cooldown` at the start of the cool-down, and
 * the catalogue has no clip for the end of it. The hook can read the end of
 * the session from `intervalStateAt(...).done` if it wants a haptic tap.
 */
export type RunWalkCueKind =
  | 'run'
  | 'lastRun'
  | 'walk'
  | 'cooldown'
  | 'getReady'
  | 'sessionHalf'
  | 'runHalf'
  | 'firstContinuous'
  | 'finalDone';

export interface RunWalkCueState {
  lastSegmentIndex: number;
  /** Keys of one-off cues already fired (e.g. 'sessionHalf', 'ready:5'). */
  fired: ReadonlySet<string>;
  lastCueAtSec: number | null;
}

export interface RunWalkCueOptions {
  /** 10 s warning before a run block. The hook sets this from the week number (weeks 1-4). */
  warnBeforeRun: boolean;
  /**
   * One-off congratulation for this session (`RunWalkStructure.celebrate`).
   * Whether it is only played ONCE PER USER is the runtime's decision (the
   * hook passes `undefined` here once the user has heard it); this module only
   * decides the moment within a session.
   */
  celebrate?: RunWalkStructure['celebrate'];
}

export const GET_READY_SEC = 10;          // warn this many seconds before a run block
export const GET_READY_MIN_WALK_SEC = 60; // only if the preceding walk lasts at least this long
export const GET_READY_MIN_GAP_SEC = 4;   // minimum time since the previous cue
export const QUIET_WINDOW_SEC = 8;        // min. gap to previous cue and to next segment boundary
export const RUN_HALF_MIN_SEC = 300;      // runHalf only for a single run block of at least this length
export const FINAL_DONE_GAP_SEC = 10;     // delay of `cooldown` after `finalDone` (clip must finish first)

export function initialRunWalkCueState(): RunWalkCueState {
  return { lastSegmentIndex: -1, fired: new Set<string>(), lastCueAtSec: null };
}

const DEFAULT_OPTIONS: RunWalkCueOptions = { warnBeforeRun: false };

/**
 * Decides which cue (if any) must sound at `elapsedSec`. At most one cue per
 * tick. Priority: segment transitions first (they ignore the quiet window),
 * then getReady, sessionHalf, runHalf.
 */
export function decideRunWalkCue(
  segments: IntervalSegment[],
  elapsedSec: number,
  state: RunWalkCueState,
  opts: RunWalkCueOptions = DEFAULT_OPTIONS,
): { cue: RunWalkCueKind | null; state: RunWalkCueState } {
  if (segments.length === 0) return { cue: null, state };

  const st = intervalStateAt(segments, elapsedSec);
  if (st.done) {
    // Nothing to announce after the session (no `done` cue); just keep the index in sync.
    return { cue: null, state: { ...state, lastSegmentIndex: st.index } };
  }

  const fire = (cue: RunWalkCueKind, fireKey?: string, index = st.index): { cue: RunWalkCueKind; state: RunWalkCueState } => {
    const fired = new Set(state.fired);
    if (fireKey) fired.add(fireKey);
    return { cue, state: { lastSegmentIndex: index, fired, lastCueAtSec: elapsedSec } };
  };
  const quiet = (): { cue: null; state: RunWalkCueState } => ({
    cue: null,
    state: { ...state, lastSegmentIndex: st.index },
  });

  const seg = st.segment;
  const prev = st.index > 0 ? segments[st.index - 1] : undefined;

  // 1. Segment transition.
  if (st.index !== state.lastSegmentIndex) {
    if (seg.phase === 'work') {
      const isLastOfMany = seg.isLastWork === true && (seg.repTotal ?? 1) >= 2;
      return fire(isLastOfMany ? 'lastRun' : 'run');
    }
    if (seg.phase === 'recovery') {
      // End of the first long block: congratulation replaces the walk cue.
      if (opts.celebrate === 'firstContinuous' && prev?.phase === 'work' && prev.repIndex === 1) {
        return fire('firstContinuous');
      }
      return fire('walk');
    }
    if (seg.phase === 'cooldown') {
      // End of the final run block: congratulation first; `cooldown` follows
      // FINAL_DONE_GAP_SEC later (see below) so the clips do not cut each other off.
      if (opts.celebrate === 'finalDone' && prev?.phase === 'work' && prev.isLastWork) {
        return fire('finalDone', 'cooldownPending');
      }
      return fire('cooldown');
    }
    // Warm-up start: no cue, the intro covers it.
    return quiet();
  }

  // Delayed cooldown cue after `finalDone`.
  if (
    seg.phase === 'cooldown' &&
    state.fired.has('cooldownPending') &&
    !state.fired.has('cooldownDone') &&
    st.segmentElapsedSec >= FINAL_DONE_GAP_SEC
  ) {
    return fire('cooldown', 'cooldownDone');
  }

  const sinceLastCue = state.lastCueAtSec === null ? Infinity : elapsedSec - state.lastCueAtSec;

  // 2. getReady: 10 s before a run block, preceded by a walk of >= 60 s.
  //    The warm-up counts as the preceding walk before the first run block.
  if (opts.warnBeforeRun && (seg.phase === 'warmup' || seg.phase === 'recovery')) {
    const next = segments[st.index + 1];
    const key = `ready:${st.index}`;
    if (
      next?.phase === 'work' &&
      seg.durationSec >= GET_READY_MIN_WALK_SEC &&
      st.segmentRemainingSec <= GET_READY_SEC &&
      !state.fired.has(key) &&
      sinceLastCue >= GET_READY_MIN_GAP_SEC
    ) {
      return fire('getReady', key);
    }
  }

  const hasRoom = sinceLastCue >= QUIET_WINDOW_SEC && st.segmentRemainingSec >= QUIET_WINDOW_SEC;
  const runBlocks = segments.filter(s => s.phase === 'work');

  // 3. sessionHalf: once, when half of the run blocks is behind us. Only for
  //    sessions with 3+ run blocks (with 2 it coincides with the transition).
  //    Sounds during the walk after block ceil(n / 2); if the quiet window does
  //    not fit there it is retried in the next walk.
  if (
    runBlocks.length >= 3 &&
    seg.phase === 'recovery' &&
    (seg.repIndex ?? 0) >= Math.ceil(runBlocks.length / 2) &&
    !state.fired.has('sessionHalf') &&
    hasRoom
  ) {
    return fire('sessionHalf', 'sessionHalf');
  }

  // 4. runHalf: single run block, halfway through that block.
  if (
    runBlocks.length === 1 &&
    seg.phase === 'work' &&
    seg.durationSec >= RUN_HALF_MIN_SEC &&
    st.segmentElapsedSec >= seg.durationSec / 2 &&
    !state.fired.has('runHalf') &&
    hasRoom
  ) {
    return fire('runHalf', 'runHalf');
  }

  return quiet();
}
