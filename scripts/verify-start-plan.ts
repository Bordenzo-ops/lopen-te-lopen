/**
 * verify-start-plan — Node verification of the "Start vanaf nul" run/walk plan:
 * schema data, normalisation and the full voice-cue timeline per session.
 * Only imports from `src/data/*`; no extra dependencies.
 *
 * USAGE (from the project root):
 *   npx tsx scripts/verify-start-plan.ts
 *
 * Exit code 0 = all checks passed, 1 = at least one check failed.
 */

import { trainingPlans, remapWeekDays, addBonusRuns } from '../src/data/trainingPlans';
import type { Session, TrainingWeek } from '../src/data/trainingPlans';
import { planStart } from '../src/data/startPlan';
import {
  buildRunWalkSegments,
  runWalkTotalSeconds,
  estimateRunWalkKm,
  decideRunWalkCue,
  initialRunWalkCueState,
  GET_READY_SEC,
  GET_READY_MIN_GAP_SEC,
  QUIET_WINDOW_SEC,
  FINAL_DONE_GAP_SEC,
} from '../src/data/runWalk';
import type { RunWalkCueKind, RunWalkCueState } from '../src/data/runWalk';

// ── Check bookkeeping ─────────────────────────

let failures = 0;
function fail(msg: string): void {
  failures += 1;
  console.log(`  FOUT: ${msg}`);
}
function check(cond: boolean, msg: string): void {
  if (!cond) fail(msg);
}
function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

const mmss = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// ── 1. Static plan data ───────────────────────

section('Schemadata');

check(trainingPlans[0]?.id === 'start', `trainingPlans[0].id is '${trainingPlans[0]?.id}', verwacht 'start'`);
check(planStart.length >= 8, `planStart heeft ${planStart.length} weken, minimaal 8 nodig`);
planStart.forEach((w, i) => check(w.weekNumber === i + 1, `week op index ${i} heeft weekNumber ${w.weekNumber}, verwacht ${i + 1}`));

// Cheap guard rail: no placeholder content may ship.
const hasPlaceholder = (text: string): boolean => /PLACEHOLDER/i.test(text);
for (const w of planStart) {
  check(!hasPlaceholder(w.focus), `week ${w.weekNumber}: focus bevat PLACEHOLDER`);
  for (const s of w.sessions) {
    check(!hasPlaceholder(s.description) && !hasPlaceholder(s.coachTip), `${s.id}: tekst bevat PLACEHOLDER`);
  }
}

// Session ids unique across ALL plans.
const seenIds = new Map<string, string>();
for (const plan of trainingPlans) {
  for (const w of plan.plan) {
    for (const s of w.sessions) {
      if (seenIds.has(s.id)) fail(`sessie-id '${s.id}' dubbel (plan ${plan.id} en ${seenIds.get(s.id)})`);
      seenIds.set(s.id, plan.id);
    }
  }
}

const allStartSessions: { week: TrainingWeek; session: Session }[] = [];
for (const w of planStart) {
  check(w.sessions.length === 3, `week ${w.weekNumber} heeft ${w.sessions.length} sessies, verwacht 3`);
  const sum = w.sessions.reduce((t, s) => t + s.distanceKm, 0);
  check(Math.abs(sum - w.totalKm) < 1e-9, `week ${w.weekNumber}: totalKm ${w.totalKm} wijkt af van som sessies ${sum}`);

  w.sessions.forEach((s, idx) => {
    allStartSessions.push({ week: w, session: s });
    check(/^start-\d+-\d+$/.test(s.id), `${s.id}: id volgt niet ^start-\\d+-\\d+$`);
    check(s.id === `start-${w.weekNumber}-${idx + 1}`, `${s.id}: id past niet bij week ${w.weekNumber} sessie ${idx + 1}`);
    check(s.type === 'runwalk' && !!s.runWalk, `${s.id}: geen type 'runwalk' met runWalk`);
    if (!s.runWalk) return;
    const rw = s.runWalk;
    check(rw.warmupWalkMin >= 0, `${s.id}: warmupWalkMin < 0`);
    check(rw.cooldownWalkMin >= 0, `${s.id}: cooldownWalkMin < 0`);
    rw.blocks.forEach((b, bi) => {
      check(Number.isInteger(b.sec) && b.sec > 0, `${s.id}: blok ${bi} heeft sec=${b.sec} (geen geheel getal > 0)`);
    });
    // Raw data must already be clean: alternating, starting and ending with a run.
    check(rw.blocks.length > 0 && rw.blocks[0].kind === 'run', `${s.id}: eerste blok is geen loopblok`);
    check(rw.blocks.length > 0 && rw.blocks[rw.blocks.length - 1].kind === 'run', `${s.id}: laatste blok is geen loopblok`);
    rw.blocks.forEach((b, bi) => {
      if (bi > 0 && rw.blocks[bi - 1].kind === b.kind) fail(`${s.id}: blok ${bi - 1} en ${bi} zijn beide '${b.kind}'`);
    });
    // Normalisation must not change the number of run blocks.
    const rawRuns = rw.blocks.filter(b => b.kind === 'run').length;
    const normRuns = buildRunWalkSegments(rw).filter(g => g.phase === 'work').length;
    check(rawRuns === normRuns, `${s.id}: ${rawRuns} loopblokken in data, ${normRuns} na normalisatie`);
    check(Math.abs(s.distanceKm - estimateRunWalkKm(rw)) < 1e-9, `${s.id}: distanceKm wijkt af van estimateRunWalkKm`);
  });
}

// Last week: a continuous run of >= 1800 s.
const lastWeek = planStart[planStart.length - 1];
const lastWeekMaxRun = Math.max(
  0,
  ...lastWeek.sessions.flatMap(s => (s.runWalk ? buildRunWalkSegments(s.runWalk) : []))
    .filter(g => g.phase === 'work')
    .map(g => g.durationSec),
);
check(lastWeekMaxRun >= 1800, `laatste week: langste aaneengesloten loopblok is ${lastWeekMaxRun} s, minimaal 1800 nodig`);

// Training-day mapping.
for (const w of planStart) {
  const all7 = [1, 2, 3, 4, 5, 6, 7];
  const remapped = remapWeekDays(w, all7);
  const withBonus = addBonusRuns(remapped, all7);
  check(withBonus.sessions.length === remapped.sessions.length, `week ${w.weekNumber}: addBonusRuns voegt ${withBonus.sessions.length - remapped.sessions.length} sessie(s) toe`);
  const days = remapped.sessions.map(s => s.day);
  check(new Set(days).size === days.length, `week ${w.weekNumber}: remapWeekDays zet twee sessies op dezelfde dag (${days.join(',')})`);
}

// ── 2. Cue simulation ─────────────────────────

interface CueEvent { t: number; cue: RunWalkCueKind }

function simulate(session: Session, weekNumber: number): { events: CueEvent[]; total: number } {
  const rw = session.runWalk!;
  const segments = buildRunWalkSegments(rw);
  const total = runWalkTotalSeconds(rw);
  const opts = { warnBeforeRun: weekNumber <= 4, celebrate: rw.celebrate };
  let state: RunWalkCueState = initialRunWalkCueState();
  const events: CueEvent[] = [];
  for (let t = 1; t <= total + 5; t++) {
    const res = decideRunWalkCue(segments, t, state, opts);
    state = res.state;
    if (res.cue) events.push({ t, cue: res.cue });
  }
  return { events, total };
}

section('Cue-simulatie (tick per seconde)');

const timelines = new Map<string, { events: CueEvent[]; total: number }>();
const count = (events: CueEvent[], kind: RunWalkCueKind): number => events.filter(e => e.cue === kind).length;

for (const { week, session } of allStartSessions) {
  if (!session.runWalk) continue;
  const id = session.id;
  const sim = simulate(session, week.weekNumber);
  timelines.set(id, sim);
  const { events } = sim;
  const segments = buildRunWalkSegments(session.runWalk);

  // Absolute start/end of every segment.
  let acc = 0;
  const bounds = segments.map(g => {
    const b = { phase: g.phase, start: acc, end: acc + g.durationSec };
    acc += g.durationSec;
    return b;
  });
  const works = bounds.filter(b => b.phase === 'work');
  const runBlocks = works.length;

  // Run cues: count and moment.
  const runCues = count(events, 'run') + count(events, 'lastRun');
  check(runCues === runBlocks, `${id}: ${runCues} run/lastRun-cues, maar ${runBlocks} loopblokken`);
  const runCueTimes = events.filter(e => e.cue === 'run' || e.cue === 'lastRun').map(e => e.t);
  works.forEach((b, i) => {
    // Tick 1 is the first sample, so a block starting at 0 is announced at t=1.
    const expected = Math.max(1, b.start);
    check(runCueTimes[i] === expected, `${id}: run-cue ${i + 1} op ${runCueTimes[i]} s, verwacht ${expected} s`);
  });

  // lastRun: exactly once for >= 2 blocks, never for 1 block.
  const lastRuns = count(events, 'lastRun');
  if (runBlocks >= 2) check(lastRuns === 1, `${id}: ${lastRuns}x lastRun bij ${runBlocks} loopblokken, verwacht 1`);
  else check(lastRuns === 0, `${id}: ${lastRuns}x lastRun bij ${runBlocks} loopblok, verwacht 0`);
  const lastRunEvent = events.find(e => e.cue === 'lastRun');
  if (lastRunEvent && works.length) {
    check(lastRunEvent.t === works[works.length - 1].start, `${id}: lastRun op ${lastRunEvent.t} s, niet aan start van laatste loopblok (${works[works.length - 1].start} s)`);
  }

  // cooldown: exactly once, after the last run block ends.
  const cooldowns = events.filter(e => e.cue === 'cooldown');
  check(cooldowns.length === 1, `${id}: ${cooldowns.length}x cooldown, verwacht 1`);
  const lastWorkEnd = works.length ? works[works.length - 1].end : 0;
  if (cooldowns[0]) check(cooldowns[0].t >= lastWorkEnd, `${id}: cooldown op ${cooldowns[0].t} s, vóór einde laatste loopblok (${lastWorkEnd} s)`);
  // No run/walk cue may sound after the cooldown cue (it is the last transition).
  if (cooldowns[0]) {
    const late = events.filter(e => e.t > cooldowns[0].t);
    check(late.length === 0, `${id}: cues na cooldown: ${late.map(e => `${mmss(e.t)} ${e.cue}`).join(', ')}`);
  }
  check(count(events, 'walk') === Math.max(0, runBlocks - 1) - count(events, 'firstContinuous'),
    `${id}: ${count(events, 'walk')} walk-cues bij ${runBlocks} loopblokken (+${count(events, 'firstContinuous')} firstContinuous)`);

  // getReady.
  const ready = events.filter(e => e.cue === 'getReady');
  if (week.weekNumber >= 5) check(ready.length === 0, `${id}: getReady in week ${week.weekNumber} (alleen weken 1-4)`);
  for (const e of ready) {
    const nextRun = works.find(b => b.start > e.t);
    if (!nextRun) { fail(`${id}: getReady op ${mmss(e.t)} zonder volgend loopblok`); continue; }
    check(nextRun.start - e.t === GET_READY_SEC, `${id}: getReady op ${mmss(e.t)} is ${nextRun.start - e.t} s vóór het loopblok, verwacht ${GET_READY_SEC} s`);
    const follow = events.find(x => x.t === nextRun.start);
    check(!!follow && (follow.cue === 'run' || follow.cue === 'lastRun'), `${id}: geen run/lastRun op ${mmss(nextRun.start)} na getReady`);
  }
  if (week.weekNumber <= 4) {
    // Every run block preceded by a walk (or warm-up) of >= 60 s must be announced.
    bounds.forEach((b, i) => {
      if (b.phase !== 'work' || i === 0) return;
      const before = segments[i - 1];
      if (before.durationSec >= 60) {
        check(ready.some(e => e.t === b.start - GET_READY_SEC), `${id}: geen getReady vóór loopblok op ${mmss(b.start)}`);
      }
    });
  }

  // Celebrations.
  const fc = count(events, 'firstContinuous');
  const fd = count(events, 'finalDone');
  if (id === 'start-6-2') check(fc === 1, `${id}: ${fc}x firstContinuous, verwacht 1`);
  else check(fc === 0, `${id}: ${fc}x firstContinuous, alleen toegestaan in start-6-2`);
  if (id === 'start-9-3') {
    check(fd === 1, `${id}: ${fd}x finalDone, verwacht 1`);
    const fdEvent = events.find(e => e.cue === 'finalDone');
    if (fdEvent && cooldowns[0]) {
      check(fdEvent.t < cooldowns[0].t, `${id}: finalDone (${mmss(fdEvent.t)}) niet vóór cooldown (${mmss(cooldowns[0].t)})`);
      check(cooldowns[0].t - fdEvent.t >= FINAL_DONE_GAP_SEC, `${id}: cooldown ${cooldowns[0].t - fdEvent.t} s na finalDone, minimaal ${FINAL_DONE_GAP_SEC} s`);
    }
  } else check(fd === 0, `${id}: ${fd}x finalDone, alleen toegestaan in start-9-3`);

  // Quiet window: voluntary cues must not crowd other cues.
  events.forEach((e, i) => {
    const prev = events[i - 1];
    const next = events[i + 1];
    if (e.cue === 'sessionHalf' || e.cue === 'runHalf') {
      if (prev) check(e.t - prev.t >= QUIET_WINDOW_SEC, `${id}: ${e.cue} op ${mmss(e.t)} slechts ${e.t - prev.t} s na ${prev.cue}`);
      if (next) check(next.t - e.t >= QUIET_WINDOW_SEC, `${id}: ${e.cue} op ${mmss(e.t)} slechts ${next.t - e.t} s voor ${next.cue}`);
    } else if (e.cue === 'getReady') {
      if (prev) check(e.t - prev.t >= GET_READY_MIN_GAP_SEC, `${id}: getReady op ${mmss(e.t)} slechts ${e.t - prev.t} s na ${prev.cue}`);
    }
  });
}

// ── 3. Longest continuous run progression ─────

section('Sprongen in langste aaneengesloten loopblok (tussen opeenvolgende sessies)');

const maxRunSec = (s: Session): number =>
  Math.max(0, ...buildRunWalkSegments(s.runWalk!).filter(g => g.phase === 'work').map(g => g.durationSec));

console.log('  van          naar         van     naar     sprong');
for (let i = 1; i < allStartSessions.length; i++) {
  const a = allStartSessions[i - 1].session;
  const b = allStartSessions[i].session;
  if (!a.runWalk || !b.runWalk) continue;
  const ma = maxRunSec(a);
  const mb = maxRunSec(b);
  const pct = ma > 0 ? ((mb - ma) / ma) * 100 : Infinity;
  const flag = pct > 50 ? '  <-- TE GROOT' : pct > 33 ? '  (let op)' : '';
  console.log(`  ${a.id.padEnd(12)} ${b.id.padEnd(12)} ${mmss(ma).padEnd(7)}  ${mmss(mb).padEnd(7)}  ${(pct >= 0 ? '+' : '') + pct.toFixed(0)}%${flag}`);
  check(pct <= 50, `sprong ${a.id} -> ${b.id}: ${pct.toFixed(0)}% (maximaal +50%)`);
}

// ── 4. Output for human review ────────────────

section('Weekoverzicht (minuten en geschatte km)');
for (const w of planStart) {
  const minutes = w.sessions.reduce((t, s) => t + (s.runWalk ? runWalkTotalSeconds(s.runWalk) : 0), 0) / 60;
  const perSession = w.sessions.map(s => `${s.runWalk ? Math.round(runWalkTotalSeconds(s.runWalk) / 60) : '?'}m/${s.distanceKm}km`).join('  ');
  console.log(`  Week ${w.weekNumber}: ${minutes.toFixed(1)} min totaal, ~${w.totalKm} km  [${perSession}]  ${w.focus}`);
}

section('Cue-tijdlijn sessie 1 per week (+ start-6-2 en start-9-3)');
const printIds = new Set<string>([...planStart.map(w => w.sessions[0]?.id), 'start-6-2', 'start-9-3']);
for (const { week, session } of allStartSessions) {
  if (!printIds.has(session.id)) continue;
  const sim = timelines.get(session.id);
  if (!sim) continue;
  const celebrate = session.runWalk?.celebrate ? `, celebrate=${session.runWalk.celebrate}` : '';
  console.log(`\n  ${session.id} (week ${week.weekNumber}, ${mmss(sim.total)} totaal, warnBeforeRun=${week.weekNumber <= 4}${celebrate}) - ${session.description}`);
  const segs = buildRunWalkSegments(session.runWalk!);
  let acc = 0;
  console.log(`    ${segs.map(g => { const s = `${g.phase}@${mmss(acc)}`; acc += g.durationSec; return s; }).join(' ')}`);
  for (const e of sim.events) console.log(`    ${mmss(e.t)}  ${e.cue}`);
}

// ── Result ────────────────────────────────────

console.log('');
if (failures > 0) {
  console.log(`MISLUKT: ${failures} fout(en).`);
  process.exit(1);
}
console.log('GESLAAGD: alle checks groen.');
