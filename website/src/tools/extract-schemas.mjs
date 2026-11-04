/**
 * extract-schemas.mjs: fills the schedule tables in website/src/content/schemas/*.md
 * from the real app data (src/data/trainingPlans.ts + startPlan.ts).
 *
 *   node website/src/tools/extract-schemas.mjs           write the tables into the .md files
 *   node website/src/tools/extract-schemas.mjs --check   verify the tables against the TS source
 *
 * The .md files contain marker pairs:
 *   <!-- tabel:NAAM -->  ...generated table...  <!-- /tabel -->
 * Everything between the markers is replaced. No npm packages: the TS data is
 * compiled with the repo's own TypeScript into a temp folder and required.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const CONTENT = resolve(HERE, '..', 'content', 'schemas');
const CHECK = process.argv.includes('--check');

// ── Load the real data ────────────────────────────────────────────────────
const out = mkdtempSync(join(tmpdir(), 'schemas-'));
writeFileSync(join(out, 'package.json'), '{"type":"commonjs"}');
execFileSync(process.execPath, [
  join(REPO, 'node_modules', 'typescript', 'bin', 'tsc'),
  join(REPO, 'src', 'data', 'trainingPlans.ts'),
  '--outDir', out, '--module', 'node16', '--target', 'es2020',
  '--moduleResolution', 'node16', '--skipLibCheck', '--esModuleInterop', '--ignoreConfig',
], { stdio: 'inherit' });
const require = createRequire(import.meta.url);
const { trainingPlans, DEFAULT_TRAINING_DAYS } = require(join(out, 'trainingPlans.js'));
const plan = id => trainingPlans.find(p => p.id === id);

// ── Formatting helpers ────────────────────────────────────────────────────
const nl = n => String(Math.round(n * 100) / 100).replace('.', ',');
const min = sec => nl(sec / 60);
const RACE_KM = { '5km': 5, '10km': 10, marathon: 42.2 };

function focusText(f) {
  return f === f.toUpperCase() ? f.charAt(0) + f.slice(1).toLowerCase() : f;
}

function sessionCell(s, goal) {
  if (/RACE DAG/.test(s.description)) return `Racedag (${nl(RACE_KM[goal])} km)`;
  if (s.type === 'interval') return `${s.description}, ca. ${nl(s.distanceKm)} km`;
  return `${s.description.split(':')[0]} (${nl(s.distanceKm)} km)`;
}

function table(head, rows) {
  return [
    `| ${head.join(' | ')} |`,
    `|${head.map(() => '---').join('|')}|`,
    ...rows.map(r => `| ${r.join(' | ')} |`),
  ].join('\n');
}

// ── Table builders ────────────────────────────────────────────────────────
function weekTable(goal) {
  const p = plan(goal);
  const rows = p.plan.map(w => [
    String(w.weekNumber), focusText(w.focus),
    ...w.sessions.map(s => sessionCell(s, goal)),
    `${nl(w.totalKm)} km`,
  ]);
  return table(['Week', 'Focus', 'Training 1', 'Training 2', 'Training 3', 'Totaal'], rows);
}

function intervalTable(goal) {
  const seen = new Map();
  for (const w of plan(goal).plan) for (const s of w.sessions) {
    if (!s.interval) continue;
    const key = JSON.stringify(s.interval);
    if (!seen.has(key)) seen.set(key, { iv: s.interval, weeks: [] });
    seen.get(key).weeks.push(w.weekNumber);
  }
  const rows = [...seen.values()].map(({ iv, weeks }) => [
    `${iv.reps}×${min(iv.workSec)} min`,
    `${iv.warmupMin} min rustig`,
    `${min(iv.workSec)} min ${iv.workZone === 'Z5' ? 'zeer stevig' : 'stevig'}`,
    `${min(iv.recoverySec)} min rustig`,
    `${iv.cooldownMin} min rustig`,
    weeks.join(', '),
  ]);
  return table(['Interval', 'Inlopen', 'Snel', 'Herstel ertussen', 'Uitlopen', 'In week'], rows);
}

function blockText(rw) {
  const runs = rw.blocks.filter(b => b.kind === 'run').map(b => b.sec);
  const walks = [...new Set(rw.blocks.filter(b => b.kind === 'walk').map(b => b.sec))];
  if (walks.length > 1) throw new Error('wandelrust niet uniform in sessie');
  const uniform = new Set(runs).size === 1;
  let run;
  if (runs.length === 1) run = `${min(runs[0])} min lopen aan één stuk`;
  else if (uniform) run = `${runs.length}× ${min(runs[0])} min lopen`;
  else run = `${runs.slice(0, -1).map(min).join(', ')} en ${min(runs.at(-1))} min lopen`;
  return walks.length ? `${run}, ertussen ${min(walks[0])} min wandelen` : run;
}

function startOverview() {
  const rows = plan('start').plan.map(w => [
    String(w.weekNumber), w.focus,
    ...w.sessions.map(s => s.description),
    `${min(Math.max(...w.sessions.flatMap(s => s.runWalk.blocks.filter(b => b.kind === 'run').map(b => b.sec))))} min`,
  ]);
  return table(['Week', 'Focus', 'Training 1', 'Training 2', 'Training 3', 'Langste loopstuk'], rows);
}

function startDetail() {
  const rows = [];
  for (const w of plan('start').plan) w.sessions.forEach((s, i) => {
    const rw = s.runWalk;
    const runSec = rw.blocks.filter(b => b.kind === 'run').reduce((a, b) => a + b.sec, 0);
    const totalSec = rw.blocks.reduce((a, b) => a + b.sec, 0) + (rw.warmupWalkMin + rw.cooldownWalkMin) * 60;
    rows.push([String(w.weekNumber), String(i + 1), blockText(rw), `${min(runSec)} min`, `${min(totalSec)} min`]);
  });
  return table(['Week', 'Training', 'Opbouw', 'Totaal lopen', 'Hele training'], rows);
}

const TABLES = {
  'start-overzicht': startOverview,
  'start-detail': startDetail,
  '5km-weken': () => weekTable('5km'),
  '5km-intervallen': () => intervalTable('5km'),
  '10km-weken': () => weekTable('10km'),
  '10km-intervallen': () => intervalTable('10km'),
  'marathon-weken': () => weekTable('marathon'),
  'marathon-intervallen': () => intervalTable('marathon'),
};
const FILES = ['beginnen-met-hardlopen', '5-km', '10-km', 'marathon'];
const MARK = /<!-- tabel:([\w-]+) -->\n\n[\s\S]*?\n?\n?<!-- \/tabel -->/g;

// ── Write mode / compare mode ─────────────────────────────────────────────
const problems = [];
for (const f of FILES) {
  const path = join(CONTENT, `${f}.md`);
  const src = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  const next = src.replace(MARK, (_, name) => {
    if (!TABLES[name]) throw new Error(`${f}: onbekende tabel ${name}`);
    return `<!-- tabel:${name} -->\n\n${TABLES[name]()}\n\n<!-- /tabel -->`;
  });
  if (CHECK) { if (next !== src) problems.push(`${f}.md: tabellen lopen achter op de data (draai zonder --check)`); }
  else if (next !== src) { writeFileSync(path, next); console.log(`bijgewerkt: ${f}.md`); }
}

// ── Independent checks against the raw TS text ────────────────────────────
if (CHECK) {
  const ts = readFileSync(join(REPO, 'src', 'data', 'trainingPlans.ts'), 'utf8');
  const prefix = { '5km': '5k', '10km': '10k', marathon: 'm' };
  for (const goal of ['5km', '10km', 'marathon']) {
    const pre = prefix[goal];
    const raw = new Map();
    for (const m of ts.matchAll(new RegExp(`\\bs\\('${pre}-(\\d+)-(\\d+)', (\\d), '(\\w+)',\\s*([\\d.]+),`, 'g')))
      raw.set(`${m[1]}-${m[2]}`, { day: +m[3], type: m[4], km: +m[5] });
    for (const m of ts.matchAll(new RegExp(`\\biv\\('${pre}-(\\d+)-(\\d+)', (\\d), '([A-G])', ([\\d.]+)\\)`, 'g')))
      raw.set(`${m[1]}-${m[2]}`, { day: +m[3], type: 'interval', km: +m[5] });
    const p = plan(goal);
    let n = 0;
    for (const w of p.plan) {
      if (w.sessions.length !== 3) problems.push(`${goal} week ${w.weekNumber}: ${w.sessions.length} sessies`);
      w.sessions.forEach((s, i) => {
        const r = raw.get(`${w.weekNumber}-${i + 1}`);
        n++;
        if (!r || r.km !== s.distanceKm || r.type !== s.type || r.day !== s.day)
          problems.push(`${goal} week ${w.weekNumber} sessie ${i + 1}: data wijkt af van tekst`);
      });
      const sum = w.sessions.reduce((a, s) => a + s.distanceKm, 0);
      // Known in the source: totalKm is hand-rounded (e.g. 24,5 -> 25). Report, don't fail.
      if (sum !== w.totalKm) console.log(`let op: ${goal} week ${w.weekNumber}: totalKm ${w.totalKm}, som sessies ${sum}`);
    }
    if (raw.size !== n) problems.push(`${goal}: ${raw.size} sessies in tekst, ${n} in data`);
    console.log(`${goal}: ${p.weeks} weken (data: ${p.plan.length}), ${n} sessies, regex-controle klaar`);
  }
  const start = plan('start');
  const runs = s => s.runWalk.blocks.filter(b => b.kind === 'run').map(b => b.sec);
  const flat = start.plan.flatMap(w => w.sessions);
  let maxJump = 0, prev = null;
  for (const s of flat) {
    const longest = Math.max(...runs(s));
    if (prev) maxJump = Math.max(maxJump, longest / prev);
    prev = longest;
  }
  const cel = k => flat.find(s => s.runWalk.celebrate === k)?.id;
  console.log(`start: ${start.plan.length} weken, ${flat.length} sessies, grootste sprong langste loopstuk x${maxJump.toFixed(2)}`);
  console.log(`start: firstContinuous=${cel('firstContinuous')}, finalDone=${cel('finalDone')}, standaarddagen=${DEFAULT_TRAINING_DAYS}`);
  console.log(`start: langste loopstuk laatste sessie = ${min(Math.max(...runs(flat.at(-1))))} min`);
  if (problems.length) { console.error('PROBLEMEN:\n' + problems.join('\n')); process.exit(1); }
  console.log('Controle OK');
}
