/**
 * render.mjs — bakt de merk-assets uit HTML naar PNG.
 *
 * Waarom een browser en geen AI-beeld met tekst erin: de typografie moet
 * pixelscherp en foutloos zijn (Inter, exacte kleuren, exacte kerning).
 * Het AI-artwork levert alleen de achtergrondplaat; alle tekst wordt hier
 * gezet. Zo blijft "Lopen te Lopen" altijd goed gespeld en op-merk.
 *
 * Gebruik:  node scripts/brand-assets/render.mjs
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

// ── Chrome opsporen ───────────────────────────
const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const CHROME = CHROME_CANDIDATES.find(existsSync);
if (!CHROME) {
  console.error('Geen Chrome/Edge gevonden. Pas CHROME_CANDIDATES aan in render.mjs.');
  process.exit(1);
}

// ── Wat er gebakken wordt ─────────────────────
const TARGETS = [
  // Google Play store-asset
  { html: 'feature-graphic.html', out: 'store-assets/feature-graphic.png',                      w: 1024, h:  500 },

  // Set A — app-promo voor Instagram / TikTok
  { html: 'promo-story.html',     out: 'store-assets/social/promo-story-1080x1920.png',         w: 1080, h: 1920 },
  { html: 'promo-feed.html',      out: 'store-assets/social/promo-feed-1080x1350.png',          w: 1080, h: 1350 },

  // Set B — voorbeeld-deelkaart, toont het product in actie
  { html: 'card-story.html',      out: 'store-assets/social/deelkaart-story-1080x1920.png',     w: 1080, h: 1920 },
  { html: 'card-feed.html',       out: 'store-assets/social/deelkaart-feed-1080x1350.png',      w: 1080, h: 1350 },
  { html: 'card-run-story.html',  out: 'store-assets/social/deelkaart-run-story-1080x1920.png', w: 1080, h: 1920 },
  { html: 'card-period-chart-story.html', out: 'store-assets/social/deelkaart-verloop-story-1080x1920.png', w: 1080, h: 1920 },
];

for (const t of TARGETS) {
  const outPath = join(ROOT, t.out);
  mkdirSync(dirname(outPath), { recursive: true });

  execFileSync(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--allow-file-access-from-files',
    '--force-device-scale-factor=1',
    `--screenshot=${outPath}`,
    `--window-size=${t.w},${t.h}`,
    `file:///${join(HERE, t.html).replace(/\\/g, '/')}`,
  ], { stdio: 'ignore' });

  console.log(`✓ ${t.out}  (${t.w}x${t.h})`);
}

console.log('\nKlaar. Assets staan in store-assets/.');
