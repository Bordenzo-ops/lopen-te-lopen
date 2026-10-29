/**
 * Controleert de store-screenshots: exacte afmetingen en geen alfakanaal (PNG-kleurtype 2).
 * Gebruik: node scripts/brand-assets/verify-store-screenshots.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SETS = [
  { dir: 'app-store-6.9', w: 1320, h: 2868 },
  { dir: 'google-play', w: 1080, h: 2160 },
];
const count = JSON.parse(readFileSync(join(ROOT, 'scripts/brand-assets/store-screenshots.json'), 'utf8')).slides.length;
let bad = 0;
for (const s of SETS) {
  for (let i = 1; i <= count; i++) {
    const f = join(ROOT, 'store-assets/screenshots-2026-10', s.dir, `${String(i).padStart(2, '0')}.png`);
    if (!existsSync(f)) { console.log(`FOUT ${s.dir}/${i}: ontbreekt`); bad++; continue; }
    const b = readFileSync(f);
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20), ct = b[25];
    const ok = w === s.w && h === s.h && ct === 2;
    if (!ok) bad++;
    console.log(`${ok ? 'OK  ' : 'FOUT'} ${s.dir}/${String(i).padStart(2, '0')}.png  ${w}x${h}  kleurtype ${ct}`);
  }
}
process.exit(bad ? 1 : 0);
