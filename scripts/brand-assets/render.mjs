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
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

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

  // App Store Connect: Header- en Search Results-asset (twee kopvarianten per formaat)
  { html: 'app-store-header.html', query: 'v=a', out: 'store-assets/app-store-header/header-a-5244x2950.png', w: 5244, h: 2950 },
  { html: 'app-store-header.html', query: 'v=b', out: 'store-assets/app-store-header/header-b-5244x2950.png', w: 5244, h: 2950 },
  { html: 'app-store-search.html', query: 'v=a', out: 'store-assets/app-store-header/search-a-3840x2560.png', w: 3840, h: 2560 },
  { html: 'app-store-search.html', query: 'v=b', out: 'store-assets/app-store-header/search-b-3840x2560.png', w: 3840, h: 2560 },
];

// Optioneel filter: `node render.mjs app-store` bakt alleen targets waarvan het pad dat bevat.
// `store-screenshots` is een eigen target (zie onderaan) en wordt hier overgeslagen.
const FILTER = process.argv[2];
const ONLY_SCREENSHOTS = FILTER === 'store-screenshots';

for (const t of TARGETS.filter((x) => !ONLY_SCREENSHOTS && (!FILTER || x.out.includes(FILTER)))) {
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
    `file:///${join(HERE, t.html).replace(/\\/g, '/')}${t.query ? `?${t.query}` : ''}`,
  ], { stdio: 'ignore' });

  console.log(`✓ ${t.out}  (${t.w}x${t.h})`);
}

// ── Store-screenshots (Apple 6.9" + Google Play) en websitebeelden ──
// Gestuurd door store-screenshots.json. Zie README voor het toevoegen van een slide.
if (!FILTER || ONLY_SCREENSHOTS) renderStoreScreenshots();

/** Chrome rendert PNG met alfakanaal; Apple wil RGB. Herschrijft RGBA (type 6) naar RGB (type 2). */
function stripAlpha(file) {
  const buf = readFileSync(file);
  let pos = 8, ihdr = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') ihdr = data;
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4);
  const depth = ihdr[8], ctype = ihdr[9];
  if (depth !== 8 || ihdr[12] !== 0) throw new Error('Onverwacht PNG-formaat van Chrome');
  if (ctype === 2) return; // al RGB
  if (ctype !== 6) throw new Error(`Onverwacht PNG-kleurtype ${ctype}`);

  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = w * bpp;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  // Alfa weg, filter "Up" per rij voor een nette compressie.
  const out = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) {
    const o = y * (w * 3 + 1);
    out[o] = 2;
    for (let x = 0; x < w; x++) {
      for (let k = 0; k < 3; k++) {
        const cur = px[y * stride + x * 4 + k];
        const up = y > 0 ? px[(y - 1) * stride + x * 4 + k] : 0;
        out[o + 1 + x * 3 + k] = (cur - up) & 255;
      }
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const newIhdr = Buffer.from(ihdr); newIhdr[9] = 2;
  writeFileSync(file, Buffer.concat([
    buf.subarray(0, 8), chunk('IHDR', newIhdr), chunk('IDAT', deflateSync(out, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

function crc32(b) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < b.length; n++) {
    c = (crc ^ b[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return crc ^ 0xffffffff;
}

function renderStoreScreenshots() {
  const man = JSON.parse(readFileSync(join(HERE, 'store-screenshots.json'), 'utf8'));
  if (man.slides.length > 8) throw new Error('Meer dan 8 slides: Google Play staat er maximaal 8 toe.');
  const srcDir = join(ROOT, man.sourceDir);

  // Bronnen oplossen naar file://-URL's (pad bevat spaties; pathToFileURL codeert correct).
  const resolveSource = (id, lastBottom) => {
    const s = man.sources[id];
    if (!s) throw new Error(`Onbekende bron "${id}" in store-screenshots.json`);
    const parts = s.parts.map((p, i) => {
      const file = join(srcDir, p.file);
      if (!existsSync(file)) throw new Error(`Bronbestand ontbreekt: ${file}`);
      return { url: pathToFileURL(file).href, top: p.top, bottom: lastBottom && i === s.parts.length - 1 ? lastBottom : p.bottom, offset: p.offset || 0 };
    });
    return { parts, quality: s.quality };
  };

  const FORMATS = [
    { format: 'apple', dir: 'app-store-6.9', W: 1320, H: 2868 },
    { format: 'play',  dir: 'google-play',   W: 1080, H: 2160 },
  ];
  const warned = new Set();
  const chromeArgs = (extra) => [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    '--force-device-scale-factor=1', '--virtual-time-budget=15000', ...extra,
  ];
  const pageUrl = (page, cfg) => `${pathToFileURL(join(HERE, page)).href}?cfg=${encodeURIComponent(JSON.stringify(cfg))}`;

  man.slides.forEach((slide, i) => {
    const src = resolveSource(slide.source);
    if (src.quality === 'low' && !warned.has(slide.source)) {
      warned.add(slide.source);
      console.warn(`⚠ LAGE KWALITEIT: bron "${slide.source}" is te klein voor het telefoonvlak (opgeschaald). Vervang het origineel (zelfde bestandsnaam) en render opnieuw.`);
    }
    const n = String(i + 1).padStart(2, '0');
    // Bij een spread heeft elke helft een eigen kop; de pagina tekent beide in één dubbelbreed beeld.
    const sibling = (type) => man.slides.find((o) => o.source === slide.source && o.type === type);
    for (const f of FORMATS) {
      const outPath = join(ROOT, 'store-assets', 'screenshots-2026-10', f.dir, `${n}.png`);
      mkdirSync(dirname(outPath), { recursive: true });
      const cfg = { format: f.format, W: f.W, H: f.H, phoneAspect: man.phoneAspect, slide, src, leftSlide: sibling('spread-left'), rightSlide: sibling('spread-right') };
      execFileSync(CHROME, chromeArgs([`--screenshot=${outPath}`, `--window-size=${f.W},${f.H}`, pageUrl('store-screenshot.html', cfg)]), { stdio: 'ignore' });
      stripAlpha(outPath);
      console.log(`✓ store-assets/screenshots-2026-10/${f.dir}/${n}.png  (${f.W}x${f.H})  ${slide.type}  ${src.quality}`);
    }
    // App Store Connect "medium display" slot (6.1"/6.3") only accepts 1206x2622:
    // downscale the 6.9" render (same aspect within 0.06%) instead of a second layout.
    const bigPath = join(ROOT, 'store-assets', 'screenshots-2026-10', 'app-store-6.9', `${n}.png`);
    const medPath = join(ROOT, 'store-assets', 'screenshots-2026-10', 'app-store-6.3', `${n}.png`);
    mkdirSync(dirname(medPath), { recursive: true });
    const scaleHtml = join(dirname(medPath), '_scale.html');
    writeFileSync(scaleHtml, `<html><body style="margin:0;background:#0A0F1A"><img src="${pathToFileURL(bigPath).href}" style="display:block;width:1206px;height:2622px"></body></html>`);
    execFileSync(CHROME, chromeArgs([`--screenshot=${medPath}`, '--window-size=1206,2622', pathToFileURL(scaleHtml).href]), { stdio: 'ignore' });
    rmSync(scaleHtml);
    stripAlpha(medPath);
    console.log(`✓ store-assets/screenshots-2026-10/app-store-6.3/${n}.png  (1206x2622)`);
  });

  // Websitebeelden (JPEG, 620 breed) uit dezelfde bronnen.
  for (const w of man.website || []) {
    const src = resolveSource(w.source, w.bottom);
    if (src.quality === 'low') console.warn(`⚠ LAGE KWALITEIT: websitebeeld ${w.out} komt uit low-bron "${w.source}". Opnieuw renderen zodra het origineel er is.`);
    const cfg = { src, width: w.width, height: w.height, quality: w.quality };
    const dom = execFileSync(CHROME, chromeArgs(['--dump-dom', pageUrl('store-website-shot.html', cfg)]), { maxBuffer: 64 * 1024 * 1024 }).toString();
    const m = dom.match(/data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/);
    if (!m) throw new Error(`Websitebeeld ${w.out} mislukt: ${(dom.match(/ERROR[^<]*/) || ['geen data'])[0]}`);
    const outPath = join(ROOT, w.out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, Buffer.from(m[1], 'base64'));
    console.log(`✓ ${w.out}  (${w.width}x${w.height})`);
  }
}

console.log('\nKlaar. Assets staan in store-assets/.');
