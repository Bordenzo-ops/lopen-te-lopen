/**
 * shots.mjs: crops and resizes app screenshots for the website phone mockups.
 * Usage: node website/src/shots.mjs
 * Edit SHOTS to point at newer screenshots; output names stay fixed so the
 * pages never need to change.
 */
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Jimp = require('jimp-compact');
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const SHOT_DIR = join(ROOT, '_workspace');
const OUT = join(HERE, 'static', 'assets', 'shots');
const WIDTH = 600; // 2x the largest mockup width
const RATIO = 2.16; // height / width of the mockup screen

// top/bottom are fractions of the source height to cut off (status bar, nav bar).
const SHOTS = [
  { out: 'shot-vandaag.jpg', src: 'website/assets/screen-dashboard-2026-10.jpg', top: 0, bottom: 0 },
  { out: 'shot-start.jpg', src: 'Screenshots Android/Screenshot vrij schema.jpeg', top: 0.045, bottom: 0.13 },
  { out: 'shot-onderweg.jpg', src: 'Screenshots Android/WhatsApp Image 2026-11-03 at 19.03.27 (3).jpeg', top: 0.045, bottom: 0.055 },
  { out: 'shot-finish.jpg', src: 'Screenshots Android/Screenshot wedstrijd countdown.jpeg', top: 0.045, bottom: 0.055 },
  { out: 'shot-logboek.jpg', src: 'Screenshots Iphone/WhatsApp Image 2026-11-03 at 23.09.56.jpeg', top: 0.26, bottom: 0.0 },
];

for (const s of SHOTS) {
  const img = await Jimp.read(join(SHOT_DIR, s.src));
  const { width: w, height: h } = img.bitmap;
  const y = Math.round(h * s.top);
  const ch = Math.round(h * (1 - s.top - s.bottom));
  img.crop(0, y, w, ch).resize(WIDTH, Jimp.AUTO);
  const maxH = Math.round(WIDTH * RATIO);
  if (img.bitmap.height > maxH) img.crop(0, 0, WIDTH, maxH);
  img.quality(80);
  await img.writeAsync(join(OUT, s.out));
  console.log(s.out, img.bitmap.width + 'x' + img.bitmap.height);
}
