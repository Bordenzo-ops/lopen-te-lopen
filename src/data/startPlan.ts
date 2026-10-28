// ─────────────────────────────────────────────
// "Start vanaf nul" - beginnersschema (9 weken)
// ─────────────────────────────────────────────
//
// Lopen en wandelen afwisselen, van 0 naar 30 minuten aan één stuk. Elke
// sessie: warming-up (stevig wandelen), blokken, cooling-down (wandelen).
// Inhoud: _workspace/notities/StartVanafNul-inhoud.md. `distanceKm` is een
// GESCHATTE afstand (estimateRunWalkKm), `totalKm` de som daarvan; de
// training zelf wordt door de timer gestuurd.

import type { RunWalkBlock, RunWalkStructure, Session, TrainingWeek } from './trainingPlans';
import { estimateRunWalkKm } from './runWalk';

const r = (sec: number): RunWalkBlock => ({ kind: 'run', sec });
const w = (sec: number): RunWalkBlock => ({ kind: 'walk', sec });

const rw = (
  id: string,
  day: number,
  warmupWalkMin: number,
  blocks: RunWalkBlock[],
  cooldownWalkMin: number,
  description: string,
  coachTip: string,
  celebrate?: RunWalkStructure['celebrate'],
): Session => {
  const runWalk: RunWalkStructure = { warmupWalkMin, blocks, cooldownWalkMin, ...(celebrate ? { celebrate } : {}) };
  return {
    id, day, type: 'runwalk', distanceKm: estimateRunWalkKm(runWalk), zone: 'Z2',
    description, coachTip, runWalk,
  };
};

const week = (weekNumber: number, focus: string, sessions: Session[]): TrainingWeek => ({
  weekNumber,
  totalKm: sessions.reduce((sum, s) => sum + s.distanceKm, 0),
  focus,
  sessions,
});

export const planStart: TrainingWeek[] = [
  week(1, 'Wennen aan bewegen: korte loopjes, ruime wandelrust', [
    rw('start-1-1', 1, 5, [r(60),w(120),r(60),w(120),r(60),w(120),r(60),w(120),r(60),w(120),r(60)], 5,
      '6× 1 min lopen',
      'Eén minuut is echt kort. Loop zo langzaam dat je er bijna niet van buiten adem raakt.'),
    rw('start-1-2', 3, 5, [r(60),w(90),r(60),w(90),r(60),w(90),r(60),w(90),r(60),w(90),r(60),w(90),r(60)], 5,
      '7× 1 min lopen',
      'Zelfde loopjes, iets meer herhalingen. Wandelen tussendoor hoort bij het schema, het is geen zwakte.'),
    rw('start-1-3', 6, 5, [r(60),w(90),r(60),w(90),r(60),w(90),r(60),w(90),r(60),w(90),r(60),w(90),r(60),w(90),r(60)], 5,
      '8× 1 min lopen',
      'Vandaag acht loopjes, je eerste week zit er bijna op. Als het zwaar voelt: kleinere pasjes, niet harder.'),
  ]),
  week(2, 'Iets langere loopstukjes', [
    rw('start-2-1', 1, 5, [r(90),w(90),r(90),w(90),r(90),w(90),r(90),w(90),r(90),w(90),r(90)], 5,
      '6× 1,5 min lopen',
      'Een halve minuut langer per loopstuk. Blijf op een tempo waarbij je nog kunt praten.'),
    rw('start-2-2', 3, 5, [r(90),w(90),r(90),w(90),r(90),w(90),r(90),w(90),r(90),w(90),r(90),w(90),r(90)], 5,
      '7× 1,5 min lopen',
      'Zelfde stukjes, een keer extra. Je lichaam went er nu echt aan.'),
    rw('start-2-3', 6, 5, [r(120),w(90),r(120),w(90),r(120),w(90),r(120),w(90),r(120),w(90),r(120)], 5,
      '6× 2 min lopen',
      'Twee minuten aan één stuk. Rustig starten, het eerste stukje voelt altijd het zwaarst.'),
  ]),
  week(3, 'Naar drie minuten aan één stuk', [
    rw('start-3-1', 1, 5, [r(120),w(60),r(120),w(60),r(120),w(60),r(120),w(60),r(120),w(60),r(120)], 5,
      '6× 2 min lopen',
      'Dezelfde twee minuten, maar met kortere wandelrust. Dat voelt een beetje anders, ga er rustig in mee.'),
    rw('start-3-2', 3, 5, [r(180),w(90),r(180),w(90),r(180),w(90),r(180)], 5,
      '4× 3 min lopen',
      'Drie minuten is een mooie stap. Er zijn minder loopstukken, dus je hebt meer tijd om te wennen.'),
    rw('start-3-3', 6, 5, [r(180),w(90),r(180),w(90),r(180),w(90),r(180),w(90),r(180)], 5,
      '5× 3 min lopen',
      'Vijf keer drie minuten. Dit is het punt waar veel beginnende lopers afhaken. Jij bouwt rustiger op.'),
  ]),
  week(4, 'Wisselend vier minuten', [
    rw('start-4-1', 1, 5, [r(180),w(90),r(240),w(90),r(180),w(90),r(240)], 5,
      '3, 4, 3 en 4 min lopen',
      'Een wisselend stuk: kort, lang, kort, lang. Zo wen je aan vier minuten zonder dat het zwaar wordt.'),
    rw('start-4-2', 3, 5, [r(240),w(90),r(240),w(90),r(240),w(90),r(240)], 5,
      '4× 4 min lopen',
      'Vier minuten per keer. Houd je schouders los en je pasjes klein.'),
    rw('start-4-3', 6, 5, [r(300),w(90),r(240),w(90),r(300),w(90),r(240)], 5,
      '5, 4, 5 en 4 min lopen',
      'Je eerste loopstuk van vijf minuten. Je mag langzamer dan je denkt, rustig is het doel.'),
  ]),
  week(5, 'Vasthouden en verlengen naar acht minuten', [
    rw('start-5-1', 1, 5, [r(300),w(90),r(300),w(90),r(300)], 5,
      '3× 5 min lopen',
      'Een rustige sessie om vijf minuten te laten landen. Voelt het zwaar? Herhaal gerust de vorige week.'),
    rw('start-5-2', 3, 5, [r(360),w(90),r(360),w(90),r(360)], 5,
      '3× 6 min lopen',
      'Zes minuten is geen sprint maar een duurloopje. Zoek een tempo dat je zo lang kunt volhouden.'),
    rw('start-5-3', 6, 5, [r(480),w(120),r(480)], 5,
      '2× 8 min lopen',
      'Twee keer acht minuten met twee minuten rust ertussen. Dit is een grote stap, dus loop echt rustig.'),
  ]),
  week(6, 'Tien minuten aan één stuk', [
    rw('start-6-1', 1, 5, [r(480),w(90),r(480),w(90),r(240)], 5,
      '8, 8 en 4 min lopen',
      'Een lange sessie met een kort laatste stuk. Het derde blok geeft je een zacht landingspunt.'),
    rw('start-6-2', 3, 5, [r(600),w(120),r(600)], 5,
      '2× 10 min lopen',
      'Je eerste tien minuten zonder wandelen. Denk niet aan de klok, let op je ademhaling.', 'firstContinuous'),
    rw('start-6-3', 6, 5, [r(600),w(90),r(720)], 5,
      '10 en 12 min lopen',
      'Het tweede stuk is twee minuten langer. Als het te zwaar voelt, loop het langzamer, niet korter.'),
  ]),
  week(7, 'Naar een kwartier aan één stuk', [
    rw('start-7-1', 1, 5, [r(720),w(60),r(720)], 5,
      '2× 12 min lopen',
      'Twee stukken van twaalf minuten met een korte rustpauze. Je loopt nu meer dan je wandelt.'),
    rw('start-7-2', 3, 5, [r(900),w(90),r(300)], 5,
      '15 en 5 min lopen',
      'Een kwartier aan één stuk. Daarna een kort stukje om af te ronden.'),
    rw('start-7-3', 6, 5, [r(900),w(60),r(600)], 5,
      '15 en 10 min lopen',
      'Dezelfde vijftien minuten, met nog een tweede stuk erachter. Houd je tempo gelijkmatig.'),
  ]),
  week(8, 'Eén lang loopstuk', [
    rw('start-8-1', 1, 5, [r(1080),w(60),r(360)], 5,
      '18 en 6 min lopen',
      'Achttien minuten aan één stuk. Je bent dichtbij het echte werk.'),
    rw('start-8-2', 3, 5, [r(1200)], 5,
      '20 min lopen',
      'Twintig minuten zonder wandelen. Begin extra rustig en laat je ademhaling het tempo bepalen.'),
    rw('start-8-3', 6, 5, [r(1320)], 5,
      '22 min lopen',
      'Nog twee minuten meer dan vorige keer. Je hebt dit stap voor stap opgebouwd, dat merk je nu.'),
  ]),
  week(9, 'De eindstreep: dertig minuten', [
    rw('start-9-1', 1, 5, [r(1500)], 5,
      '25 min lopen',
      'Vijfentwintig minuten aan één stuk. Houd het rustig, de laatste vijf komen vanzelf.'),
    rw('start-9-2', 3, 5, [r(1500)], 5,
      '25 min lopen',
      'Nog een keer vijfentwintig minuten. Voelt het vertrouwd? Dan ben je klaar voor je eindsessie.'),
    rw('start-9-3', 6, 5, [r(1800)], 5,
      '30 min lopen',
      'Dit is het moment waar je negen weken naartoe hebt gewerkt. Rustig starten, genieten van elke minuut.', 'finalDone'),
  ]),
];
