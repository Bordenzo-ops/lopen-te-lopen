/**
 * animate.mjs — bakt de merkfilms uit HTML naar MP4.
 *
 * Werkwijze: elke pagina in anim/ definieert `window.renderAt(t)` die de
 * animatie als pure functie van tijd zet (zie anim/timeline.js). Deze driver
 * opent de pagina één keer, zet per frame de tijd en schiet een screenshot.
 * Daardoor is elk frame exact reproduceerbaar en kan een render worden
 * hervat zonder dat het beeld verspringt.
 *
 * Gebruik:
 *   node scripts/brand-assets/animate.mjs            # alles
 *   node scripts/brand-assets/animate.mjs card       # alleen de deelkaart
 *   node scripts/brand-assets/animate.mjs card 9x16  # één formaat
 *
 * Eenmalig installeren (bewust géén projectdependency, het is alleen
 * gereedschap voor marketingmateriaal):
 *   npm i --no-save playwright-core ffmpeg-static
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

// ── Gereedschap opzoeken ──────────────────────
let chromium, ffmpegPath;
try {
  ({ chromium } = require('playwright-core'));
  ffmpegPath = require('ffmpeg-static');
} catch {
  console.error(
    'Ontbrekend gereedschap. Installeer eerst:\n' +
    '  npm i --no-save playwright-core ffmpeg-static',
  );
  process.exit(1);
}

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
];
const CHROME = CHROME_CANDIDATES.find(existsSync);
if (!CHROME) {
  console.error('Geen Chrome gevonden. Pas CHROME_CANDIDATES aan.');
  process.exit(1);
}

const FPS = 30;

// ── Wat er gebakken wordt ─────────────────────
// Eén HTML per ontwerp; het formaat komt binnen als ?f= en bepaalt daar de
// layout. Zo blijft de regie (de timing) op één plek staan.
const TARGETS = [
  { design: 'card',  format: '9x16', w: 1080, h: 1920 },
  { design: 'card',  format: '4x5',  w: 1080, h: 1350 },
  { design: 'card',  format: '16x9', w: 1920, h: 1080 },
  { design: 'promo', format: '9x16', w: 1080, h: 1920 },
  { design: 'promo', format: '4x5',  w: 1080, h: 1350 },
  { design: 'promo', format: '16x9', w: 1920, h: 1080 },
];

const [wantDesign, wantFormat] = process.argv.slice(2);
const jobs = TARGETS.filter(t =>
  (!wantDesign || t.design === wantDesign) &&
  (!wantFormat || t.format === wantFormat),
).filter(t => existsSync(join(HERE, 'anim', `${t.design}.html`)));

if (!jobs.length) {
  console.error('Niets te doen — bestaat anim/<design>.html?');
  process.exit(1);
}

const outDir = join(ROOT, 'store-assets', 'social', 'video');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, args: ['--allow-file-access-from-files'] });

for (const job of jobs) {
  const label = `${job.design}-${job.format}`;
  const frameDir = join(HERE, '.frames', label);
  rmSync(frameDir, { recursive: true, force: true });
  mkdirSync(frameDir, { recursive: true });

  const page = await browser.newPage({
    viewport: { width: job.w, height: job.h },
    deviceScaleFactor: 1,
  });

  const url = `file:///${join(HERE, 'anim', `${job.design}.html`).replace(/\\/g, '/')}?f=${job.format}`;
  await page.goto(url, { waitUntil: 'networkidle' });

  // De pagina bepaalt zelf hoe lang hij duurt.
  const duration = await page.evaluate(() => window.ANIM.duration);
  const frames = Math.round(duration * FPS);

  for (let i = 0; i < frames; i++) {
    // Frames op t = i/FPS. Het laatste frame valt net vóór `duration`,
    // zodat de loop niet één dubbel frame krijgt bij het rondgaan.
    await page.evaluate(t => window.renderAt(t), i / FPS);
    await page.screenshot({ path: join(frameDir, `f${String(i).padStart(4, '0')}.png`) });
  }
  await page.close();

  const mp4 = join(outDir, `${label}.mp4`);
  execFileSync(ffmpegPath, [
    '-y', '-framerate', String(FPS),
    '-i', join(frameDir, 'f%04d.png'),
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '18',
    // yuv420p is nodig om overal af te spelen; zonder dit weigeren
    // Instagram en QuickTime de bestanden.
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    mp4,
  ], { stdio: 'ignore' });

  rmSync(frameDir, { recursive: true, force: true });
  console.log(`✓ ${label}.mp4  (${job.w}x${job.h}, ${frames} frames, ${(frames / FPS).toFixed(1)}s)`);
}

await browser.close();
console.log(`\nKlaar. Films staan in store-assets/social/video/.`);
