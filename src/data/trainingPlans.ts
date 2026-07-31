// ─────────────────────────────────────────────
// Trainingsschema's — HalfMarathon Trainer
// ─────────────────────────────────────────────
//
// Methodiek: afstandsgebaseerd met hartslagzone-advies
// Uitgangspunt: 3 sessies per week
// Doelgroep: beginners tot licht gevorderden (3-4 km basis)
//
// Hartslagzones (% van max hartslag):
// Z1 Herstel:   50-60%
// Z2 Aeroob:    61-70%  ← meeste trainingen hier
// Z3 Tempo:     71-80%
// Z4 Drempel:   81-90%
// Z5 Max:       91-100%

export type HeartRateZone = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5';
export type GoalType = '5km' | '10km' | '15km' | 'half_marathon' | 'marathon';

export interface IntervalStructure {
  warmupMin:    number;        // rustig inlopen
  reps:         number;        // aantal werkherhalingen
  workSec:      number;        // duur werkinterval in seconden
  recoverySec:  number;        // duur herstel tussen herhalingen in seconden
  workZone:     HeartRateZone; // Z4 of Z5
  recoveryZone: HeartRateZone; // Z1
  cooldownMin:  number;        // rustig uitlopen
}

export interface Session {
  id: string;
  day: number;          // dag van de week (1=ma, 3=wo, 6=za)
  type: 'easy' | 'tempo' | 'long' | 'rest' | 'cross' | 'interval';
  distanceKm: number;
  zone: HeartRateZone;
  description: string;
  coachTip: string;
  interval?: IntervalStructure; // alleen aanwezig bij type === 'interval'
  /** True voor automatisch toegevoegde bonus-duurloopjes op vrije trainingsdagen.
   *  Optionele sessies tellen niet mee voor weekvoltooiing of weektotalen. */
  optional?: boolean;
}

export interface TrainingWeek {
  weekNumber: number;
  totalKm: number;
  focus: string;
  sessions: Session[];
}

export interface TrainingPlan {
  id: GoalType;
  name: string;
  weeks: number;
  targetDistance: number;
  description: string;
  plan: TrainingWeek[];
}

// ── Hulpfunctie ───────────────────────────────
const s = (
  id: string,
  day: number,
  type: Session['type'],
  distanceKm: number,
  zone: HeartRateZone,
  description: string,
  coachTip: string,
): Session => ({ id, day, type, distanceKm, zone, description, coachTip });

export type IntervalCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

// Progressieve intervalsjablonen. `zone` is de kopzone (kleur/badge) van de
// sessie; herstel is altijd Z1. `description` verschijnt op de sessiekaart.
const INTERVAL_TEMPLATES: Record<IntervalCode, {
  zone: HeartRateZone; description: string; coachTip: string; structure: IntervalStructure;
}> = {
  A: {
    zone: 'Z4',
    description: 'Intervaltraining: 6×1 min',
    coachTip: 'Je kennismaking met intervallen. De snelle stukjes zijn kort en de rust ruim. Loop de versnellingen vlot maar ontspannen, nog niet voluit.',
    structure: { warmupMin: 10, reps: 6, workSec: 60, recoverySec: 120, workZone: 'Z4', recoveryZone: 'Z1', cooldownMin: 10 },
  },
  B: {
    zone: 'Z4',
    description: 'Intervaltraining: 8×1 min',
    coachTip: 'Iets meer herhalingen, iets minder rust. Houd elke versnelling even sterk als de eerste en loop rustig uit tussendoor.',
    structure: { warmupMin: 10, reps: 8, workSec: 60, recoverySec: 90, workZone: 'Z4', recoveryZone: 'Z1', cooldownMin: 10 },
  },
  C: {
    zone: 'Z4',
    description: 'Intervaltraining: 6×2 min',
    coachTip: 'Nu twee minuten aan. Kies een tempo dat je alle zes keer kunt herhalen: beheerst starten, sterk eindigen.',
    structure: { warmupMin: 10, reps: 6, workSec: 120, recoverySec: 90, workZone: 'Z4', recoveryZone: 'Z1', cooldownMin: 10 },
  },
  D: {
    zone: 'Z4',
    description: 'Intervaltraining: 5×3 min',
    coachTip: 'Drie minuten stevig met ruime rust. Dit traint je VO2max. Blijf soepel lopen, ook als het zwaar wordt.',
    structure: { warmupMin: 10, reps: 5, workSec: 180, recoverySec: 120, workZone: 'Z4', recoveryZone: 'Z1', cooldownMin: 10 },
  },
  E: {
    zone: 'Z5',
    description: 'Intervaltraining: 4×4 min',
    coachTip: 'Lange, pittige intervallen op hoog tempo. Verdeel je kracht: de laatste herhaling moet net zo sterk zijn als de eerste.',
    structure: { warmupMin: 10, reps: 4, workSec: 240, recoverySec: 120, workZone: 'Z5', recoveryZone: 'Z1', cooldownMin: 10 },
  },
  F: {
    zone: 'Z4',
    description: 'Intervaltraining: 4×5 min',
    coachTip: 'Drempel-cruise: vijf minuten net onder wedstrijdintensiteit met korte rust. Comfortabel oncomfortabel, gelijkmatig tempo.',
    structure: { warmupMin: 10, reps: 4, workSec: 300, recoverySec: 90, workZone: 'Z4', recoveryZone: 'Z1', cooldownMin: 10 },
  },
  G: {
    zone: 'Z5',
    description: 'Intervaltraining: 5×3 min',
    coachTip: 'Je pieksessie: vijf keer drie minuten op hoog tempo. Vandaag mag het schuren, jij bent er klaar voor.',
    structure: { warmupMin: 12, reps: 5, workSec: 180, recoverySec: 120, workZone: 'Z5', recoveryZone: 'Z1', cooldownMin: 10 },
  },
};

// Bouwt een intervalsessie uit een sjabloon. `distanceKm` is de GESCHATTE
// totaalafstand (inloop + werk + herstel + uitloop), alleen voor weektotalen
// en de sessiekaart; de training zelf wordt door de timer gestuurd.
const iv = (id: string, day: number, code: IntervalCode, distanceKm: number): Session => {
  const t = INTERVAL_TEMPLATES[code];
  return { id, day, type: 'interval', distanceKm, zone: t.zone, description: t.description, coachTip: t.coachTip, interval: t.structure };
};

// ── 5 KM SCHEMA (8 weken) ─────────────────────
const plan5km: TrainingWeek[] = [
  {
    weekNumber: 1,
    totalKm: 9,
    focus: 'Basistempo opbouwen',
    sessions: [
      s('5k-1-1', 1, 'easy', 3, 'Z2', 'Rustige duurloop', 'Loop in een tempo waarbij je comfortabel kunt praten. Voelt makkelijk? Goed zo, zo hoort het.'),
      s('5k-1-2', 3, 'easy', 3, 'Z2', 'Rustige duurloop', 'Zelfde als maandag. Focus op gelijkmatig ademhalen.'),
      s('5k-1-3', 6, 'long',  3, 'Z2', 'Lange duurloop', 'Je langste sessie van de week. Neem de tijd, loop niet te hard.'),
    ],
  },
  {
    weekNumber: 2,
    totalKm: 10,
    focus: 'Duur verlengen',
    sessions: [
      s('5k-2-1', 1, 'easy',  3, 'Z2', 'Rustige duurloop', 'Begin rustig. De eerste 10 minuten voelen altijd het zwaarst.'),
      s('5k-2-2', 3, 'tempo', 3, 'Z3', 'Tempoduurloop', 'Iets sneller dan normaal, maar niet sprinten. Je kunt nog een paar woorden zeggen.'),
      s('5k-2-3', 6, 'long',  4, 'Z2', 'Lange duurloop', 'Rustig 4 km. Halverwege even water drinken als je dat hebt.'),
    ],
  },
  {
    weekNumber: 3,
    totalKm: 14,
    focus: 'Eerste 5 km voelen',
    sessions: [
      s('5k-3-1', 1, 'easy',  4, 'Z2', 'Rustige duurloop', 'Je went aan de afstand. Loop de route die je vorige week liep en voel het verschil.'),
      iv('5k-3-2', 3, 'A', 5),
      s('5k-3-3', 6, 'long',  5, 'Z2', 'Lange duurloop: 5 km!', 'Je eerste 5 km aan één stuk. Neem het rustig. Dit is een mijlpaal!'),
    ],
  },
  {
    weekNumber: 4,
    totalKm: 10,
    focus: 'Herstelweek',
    sessions: [
      s('5k-4-1', 1, 'easy',  3, 'Z1', 'Herstelloop', 'Lekker rustig. Herstelweek: minder km, beter worden.'),
      s('5k-4-2', 3, 'easy',  3, 'Z2', 'Rustige duurloop', 'Leg de focus op techniek: rechtop lopen, ontspannen schouders.'),
      s('5k-4-3', 6, 'long',  4, 'Z2', 'Rustiger lange duurloop', 'Bewust iets minder dan vorige week. Herstel is training.'),
    ],
  },
  {
    weekNumber: 5,
    totalKm: 14,
    focus: 'Snelheid introduceren',
    sessions: [
      s('5k-5-1', 1, 'easy',  4, 'Z2', 'Duurloop', 'Stabiele duurloop, bouw niet op in de sessie.'),
      iv('5k-5-2', 3, 'B', 5),
      s('5k-5-3', 6, 'long',  5, 'Z2', 'Lange duurloop', 'Rustige 5 km. Bewuster dan week 3: let op loophouding.'),
    ],
  },
  {
    weekNumber: 6,
    totalKm: 16,
    focus: 'Consistentie opbouwen',
    sessions: [
      s('5k-6-1', 1, 'easy',  4, 'Z2', 'Duurloop', 'Controleer je gemiddeld tempo per km. Probeer elke km gelijk te lopen.'),
      iv('5k-6-2', 3, 'C', 6),
      s('5k-6-3', 6, 'long',  6, 'Z2', 'Lange duurloop: 6 km', 'Nieuwe afstandsrecord! Loop bewust langzaam de eerste 2 km.'),
    ],
  },
  {
    weekNumber: 7,
    totalKm: 13,
    focus: 'Race-voorbereiding',
    sessions: [
      s('5k-7-1', 1, 'easy',  4, 'Z2', 'Duurloop', 'Laatste zware week voor de afbouw. Energiek lopen.'),
      s('5k-7-2', 3, 'tempo', 4, 'Z4', 'Drempelloop', 'Je moeilijkste sessie. Loop 20 minuten op een hoog maar houdbaar tempo.'),
      s('5k-7-3', 6, 'long',  5, 'Z2', 'Rustige lange duurloop', 'Rustig 5 km. Niet te hard, bewaar kracht voor volgende week.'),
    ],
  },
  {
    weekNumber: 8,
    totalKm: 10,
    focus: 'Race-week: afbouwen',
    sessions: [
      s('5k-8-1', 1, 'easy',  3, 'Z2', 'Afbouwloop', 'Lichte duurloop. Benen fris houden voor de race.'),
      s('5k-8-2', 3, 'easy',  2, 'Z1', 'Activeringsloopje', 'Korte, makkelijke loop. Benen losmaken, niet vermoeien.'),
      s('5k-8-3', 6, 'easy',  5, 'Z3', '5 KM RACE DAG!', 'Jij bent klaar. Geniet ervan. Loop de eerste km rustiger dan je denkt dat nodig is.'),
    ],
  },
];

// ── 10 KM SCHEMA (12 weken) ───────────────────
const plan10km: TrainingWeek[] = [
  { weekNumber: 1,  totalKm: 12, focus: 'Basisconditie bepalen', sessions: [
    s('10k-1-1', 1, 'easy',  4, 'Z2', 'Rustige duurloop', 'Start altijd rustiger dan je denkt. Dit tempo houd je 10 km vol.'),
    s('10k-1-2', 3, 'easy',  4, 'Z2', 'Rustige duurloop', 'Zelfde gevoel als maandag. Noteer je tempo, dit is je referentie.'),
    s('10k-1-3', 6, 'long',  4, 'Z2', 'Lange duurloop', 'Rustige 4 km. Langste sessie van de week.'),
  ]},
  { weekNumber: 2,  totalKm: 14, focus: 'Duurvermogen opbouwen', sessions: [
    s('10k-2-1', 1, 'easy',  4, 'Z2', 'Duurloop', 'Stabiel en ontspannen.'),
    s('10k-2-2', 3, 'tempo', 4, 'Z3', 'Tempoduurloop', 'Hogere intensiteit, maar gecontroleerd.'),
    s('10k-2-3', 6, 'long',  6, 'Z2', 'Lange duurloop', 'Rustige 6 km. Eerste stapje richting het doel.'),
  ]},
  { weekNumber: 3,  totalKm: 18, focus: 'Afstand vergroten', sessions: [
    s('10k-3-1', 1, 'easy',  5, 'Z2', 'Duurloop', 'Vijf km makkelijk. Let op je ademhaling.'),
    iv('10k-3-2', 3, 'A', 6),
    s('10k-3-3', 6, 'long',  7, 'Z2', 'Lange duurloop', 'Zeven km. Loop de eerste 3 km bewust langzaam.'),
  ]},
  { weekNumber: 4,  totalKm: 13, focus: 'Herstelweek', sessions: [
    s('10k-4-1', 1, 'easy',  4, 'Z1', 'Herstelloop', 'Heel rustig. Z1 betekent wandeltempo met looppassen.'),
    s('10k-4-2', 3, 'easy',  4, 'Z2', 'Duurloop', 'Techniek: elke stap gelijkmatig, niet stuiteren.'),
    s('10k-4-3', 6, 'long',  5, 'Z2', 'Rustige lange duurloop', 'Mindere week = groeien. Herstel is productief.'),
  ]},
  { weekNumber: 5,  totalKm: 20, focus: 'Halverwege 10 km aanraken', sessions: [
    s('10k-5-1', 1, 'easy',  5, 'Z2', 'Duurloop', 'Regelmatig tempo.'),
    iv('10k-5-2', 3, 'B', 6.5),
    s('10k-5-3', 6, 'long',  8, 'Z2', 'Lange duurloop: 8 km', 'Acht km! Loop rustig, houd iets over voor de laatste 2 km.'),
  ]},
  { weekNumber: 6,  totalKm: 22, focus: 'Consistentie en tempo', sessions: [
    s('10k-6-1', 1, 'easy',  6, 'Z2', 'Duurloop', 'Zes km vlot en stabiel.'),
    iv('10k-6-2', 3, 'C', 7),
    s('10k-6-3', 6, 'long',  9, 'Z2', 'Lange duurloop: 9 km', 'Eén km voor het doel! Rustig blijven.'),
  ]},
  { weekNumber: 7,  totalKm: 25, focus: 'De 10 km halen', sessions: [
    s('10k-7-1', 1, 'easy',  6, 'Z2', 'Duurloop', 'Zelfverzekerd lopen. Je bent ver gekomen.'),
    iv('10k-7-2', 3, 'D', 7.5),
    s('10k-7-3', 6, 'long', 11, 'Z2', 'Lange duurloop: 11 km', 'Voorbij het doel! Loop rustig. Dit geeft vertrouwen.'),
  ]},
  { weekNumber: 8,  totalKm: 18, focus: 'Herstelweek', sessions: [
    s('10k-8-1', 1, 'easy',  5, 'Z1', 'Herstelloop', 'Rustig herstel.'),
    s('10k-8-2', 3, 'easy',  5, 'Z2', 'Duurloop', 'Techniek en ontspanning.'),
    s('10k-8-3', 6, 'long',  8, 'Z2', 'Rustige lange duurloop', 'Mindere week zodat je fris bent voor de laatste opbouw.'),
  ]},
  { weekNumber: 9,  totalKm: 22, focus: 'Race-tempo oefenen', sessions: [
    s('10k-9-1', 1, 'easy',  6, 'Z2', 'Duurloop', 'Stabiel en sterk.'),
    s('10k-9-2', 3, 'tempo', 5, 'Z4', 'Drempelloop', 'Loop op race-tempo voor 5 km. Dit is je doel-pace.'),
    s('10k-9-3', 6, 'long', 11, 'Z2', 'Lange duurloop', 'Duurvermogen bevestigen.'),
  ]},
  { weekNumber: 10, totalKm: 25, focus: 'Piek-opbouw', sessions: [
    s('10k-10-1', 1, 'easy',  6, 'Z2', 'Duurloop', 'Energiek en zelfverzekerd.'),
    iv('10k-10-2', 3, 'F', 8),
    s('10k-10-3', 6, 'long', 11, 'Z2', 'Lange duurloop', 'Laatste lange loop. Je bent race-klaar.'),
  ]},
  { weekNumber: 11, totalKm: 16, focus: 'Afbouwen', sessions: [
    s('10k-11-1', 1, 'easy',  5, 'Z2', 'Duurloop', 'Fris en ontspannen.'),
    s('10k-11-2', 3, 'easy',  4, 'Z2', 'Duurloop', 'Niet te hard. Benen fris houden.'),
    s('10k-11-3', 6, 'long',  7, 'Z2', 'Rustige lange duurloop', 'Laatste langere loop. Daarna rusten.'),
  ]},
  { weekNumber: 12, totalKm: 17, focus: 'Race-week', sessions: [
    s('10k-12-1', 1, 'easy',  4, 'Z2', 'Afbouwloop', 'Lekker loopje. Benen losmaken.'),
    s('10k-12-2', 3, 'easy',  3, 'Z1', 'Activeringsloopje', 'Kort en makkelijk. Benen niet vermoeien.'),
    s('10k-12-3', 6, 'easy', 10, 'Z3', '10 KM RACE DAG!', 'Je bent hier klaar voor. Loop de eerste 3 km langzamer dan je wilt. Het loont.'),
  ]},
];

// ── HALVE MARATHON SCHEMA (20 weken) ─────────
const planHalfMarathon: TrainingWeek[] = [
  { weekNumber: 1,  totalKm: 16, focus: 'Startpunt bepalen', sessions: [
    s('hm-1-1', 1, 'easy',  5, 'Z2', 'Duurloop', 'Start langzamer dan je denkt. Zeker de eerste week.'),
    s('hm-1-2', 3, 'easy',  5, 'Z2', 'Duurloop', 'Let op je ademhaling. Neusgaten in, mond uit.'),
    s('hm-1-3', 6, 'long',  6, 'Z2', 'Lange duurloop', 'Wekelijkse lange loop. Rustig van start.'),
  ]},
  { weekNumber: 2,  totalKm: 18, focus: 'Ritme opbouwen', sessions: [
    s('hm-2-1', 1, 'easy',  5, 'Z2', 'Duurloop', 'Stabiel tempo. Elke km gelijk.'),
    s('hm-2-2', 3, 'tempo', 5, 'Z3', 'Tempoduurloop', 'Iets sneller dan je comfortzone.'),
    s('hm-2-3', 6, 'long',  8, 'Z2', 'Lange duurloop', 'Acht km. Drink water halverwege.'),
  ]},
  { weekNumber: 3,  totalKm: 22, focus: 'Afstand opbouwen', sessions: [
    s('hm-3-1', 1, 'easy',  6, 'Z2', 'Duurloop', 'Zes km vlot en ontspannen.'),
    iv('hm-3-2', 3, 'A', 6),
    s('hm-3-3', 6, 'long', 10, 'Z2', 'Lange duurloop: 10 km', 'Eerste 10 km! Neem de tijd, bewaar energie.'),
  ]},
  { weekNumber: 4,  totalKm: 16, focus: 'Herstelweek', sessions: [
    s('hm-4-1', 1, 'easy',  5, 'Z1', 'Herstelloop', 'Makkelijk. Herstel is training.'),
    s('hm-4-2', 3, 'easy',  5, 'Z2', 'Duurloop', 'Techniek: korte, snelle passen vs. grote passen.'),
    s('hm-4-3', 6, 'long',  6, 'Z2', 'Rustige duurloop', 'Minder km. Meer herstel.'),
  ]},
  { weekNumber: 5,  totalKm: 25, focus: 'Duurvermogen opbouwen', sessions: [
    s('hm-5-1', 1, 'easy',  7, 'Z2', 'Duurloop', 'Zeven km makkelijk. Bewust langzaam de eerste 15 min.'),
    iv('hm-5-2', 3, 'B', 6.5),
    s('hm-5-3', 6, 'long', 11, 'Z2', 'Lange duurloop', 'Elf km. Loop-pauze-strategie mag als je wil.'),
  ]},
  { weekNumber: 6,  totalKm: 26, focus: 'Tempo verhogen', sessions: [
    s('hm-6-1', 1, 'easy',  7, 'Z2', 'Duurloop', 'Stabiel en zelfverzekerd.'),
    iv('hm-6-2', 3, 'C', 7),
    s('hm-6-3', 6, 'long', 12, 'Z2', 'Lange duurloop', 'Twaalf km. Voeding/gel meenemen na 60 minuten.'),
  ]},
  { weekNumber: 7,  totalKm: 29, focus: 'Kracht opbouwen', sessions: [
    s('hm-7-1', 1, 'easy',  8, 'Z2', 'Duurloop', 'Acht km. Je bent er klaar voor.'),
    iv('hm-7-2', 3, 'D', 7.5),
    s('hm-7-3', 6, 'long', 13, 'Z2', 'Lange duurloop', 'Dertien km, je nieuwe afstandsrecord. Loop de eerste helft bewust rustig.'),
  ]},
  { weekNumber: 8,  totalKm: 21, focus: 'Herstelweek', sessions: [
    s('hm-8-1', 1, 'easy',  6, 'Z1', 'Herstelloop', 'Heel rustig. Spierherstel prioriteit.'),
    s('hm-8-2', 3, 'easy',  7, 'Z2', 'Duurloop', 'Looptechniek oefenen: cadans, armschommel.'),
    s('hm-8-3', 6, 'long',  8, 'Z2', 'Rustige lange duurloop', 'Adem in, adem uit. Geniet van het lopen.'),
  ]},
  { weekNumber: 9,  totalKm: 30, focus: 'Piekopbouw fase 1', sessions: [
    s('hm-9-1', 1, 'easy',  8, 'Z2', 'Duurloop', 'Stabiel, gelijkmatig, krachtig.'),
    iv('hm-9-2', 3, 'E', 7.5),
    s('hm-9-3', 6, 'long', 14, 'Z2', 'Lange duurloop: 14 km', 'Veertig procent van de halve marathon!'),
  ]},
  { weekNumber: 10, totalKm: 31, focus: 'Piekopbouw fase 2', sessions: [
    s('hm-10-1', 1, 'easy',  8, 'Z2', 'Duurloop', 'Acht km makkelijk. Je lichaam kent het nu.'),
    iv('hm-10-2', 3, 'F', 8),
    s('hm-10-3', 6, 'long', 15, 'Z2', 'Lange duurloop: 15 km', 'Vijftien km! Gelstrategie testen vandaag.'),
  ]},
  { weekNumber: 11, totalKm: 33, focus: 'Sterke fase', sessions: [
    s('hm-11-1', 1, 'easy',  9, 'Z2', 'Duurloop', 'Negen km vlot. Je bent sterk.'),
    s('hm-11-2', 3, 'tempo', 9, 'Z4', 'Drempelloop', 'Negen km op drempelintensiteit. Moeilijk maar doenbaar.'),
    s('hm-11-3', 6, 'long', 15, 'Z2', 'Lange duurloop', 'Herhaal 15 km. Beter dan vorige week?'),
  ]},
  { weekNumber: 12, totalKm: 25, focus: 'Herstelweek', sessions: [
    s('hm-12-1', 1, 'easy',  7, 'Z1', 'Herstelloop', 'Rustig. Spieren mogen rusten.'),
    s('hm-12-2', 3, 'easy',  8, 'Z2', 'Duurloop', 'Ontspannen duurloop.'),
    s('hm-12-3', 6, 'long', 10, 'Z2', 'Rustige lange duurloop', 'Tien km. Houd iets over.'),
  ]},
  { weekNumber: 13, totalKm: 33, focus: 'Hoogtepunt fase', sessions: [
    s('hm-13-1', 1, 'easy',  9, 'Z2', 'Duurloop', 'Negen km. Krachtig en consistent.'),
    iv('hm-13-2', 3, 'G', 8),
    s('hm-13-3', 6, 'long', 16, 'Z2', 'Lange duurloop: 16 km', 'Zestien km! Eten en drinken meenemen.'),
  ]},
  { weekNumber: 14, totalKm: 36, focus: 'Piek-week', sessions: [
    s('hm-14-1', 1, 'easy', 10, 'Z2', 'Duurloop', 'Tien km rustig. Je loopt nu serieuze afstanden.'),
    s('hm-14-2', 3, 'tempo',10, 'Z3', 'Tempoduurloop', 'Tien km tempo. Jouw race-pace.'),
    s('hm-14-3', 6, 'long', 16, 'Z2', 'Lange duurloop', 'Beste lange duurloop van het programma.'),
  ]},
  { weekNumber: 15, totalKm: 28, focus: 'Afbouwen fase 1', sessions: [
    s('hm-15-1', 1, 'easy',  8, 'Z2', 'Duurloop', 'Acht km. Fris voelen is het doel.'),
    s('hm-15-2', 3, 'tempo', 8, 'Z3', 'Tempoduurloop', 'Acht km op race-tempo. Lekker gevoel vinden.'),
    s('hm-15-3', 6, 'long', 12, 'Z2', 'Rustige lange duurloop', 'Twaalf km. Je bewaart energie voor de race.'),
  ]},
  { weekNumber: 16, totalKm: 24, focus: 'Afbouwen fase 2', sessions: [
    s('hm-16-1', 1, 'easy',  7, 'Z2', 'Duurloop', 'Zeven km. Benen fris houden.'),
    s('hm-16-2', 3, 'tempo', 7, 'Z3', 'Tempoduurloop', 'Zeven km op race-tempo. Eén van de laatste keer.'),
    s('hm-16-3', 6, 'long', 10, 'Z2', 'Rustige lange duurloop', 'Tien km. Rustig, genieten.'),
  ]},
  { weekNumber: 17, totalKm: 20, focus: 'Afbouwen fase 3', sessions: [
    s('hm-17-1', 1, 'easy',  6, 'Z2', 'Duurloop', 'Zes km makkelijk. Alles voelt licht.'),
    s('hm-17-2', 3, 'tempo', 6, 'Z3', 'Tempoduurloop', 'Zes km op race-tempo. Lekker ritme voelen.'),
    s('hm-17-3', 6, 'long',  8, 'Z2', 'Rustige lange duurloop', 'Acht km. Laatste echte duurloop.'),
  ]},
  { weekNumber: 18, totalKm: 16, focus: 'Afbouwen fase 4', sessions: [
    s('hm-18-1', 1, 'easy',  5, 'Z2', 'Duurloop', 'Vijf km. Makkelijk en ontspannen.'),
    s('hm-18-2', 3, 'easy',  5, 'Z2', 'Duurloop', 'Houd het rustig. Race nadert.'),
    s('hm-18-3', 6, 'long',  6, 'Z2', 'Korte lange duurloop', 'Zes km rustig. Benen hoeven niet te werken.'),
  ]},
  { weekNumber: 19, totalKm: 12, focus: 'Race-week voorbereiding', sessions: [
    s('hm-19-1', 1, 'easy',  5, 'Z2', 'Duurloop', 'Vijf km. Helemaal ontspannen.'),
    s('hm-19-2', 3, 'easy',  4, 'Z1', 'Activeringsloop', 'Vier km heel rustig. Benen losmaken.'),
    s('hm-19-3', 6, 'easy',  3, 'Z2', 'Dag-voor-race loopje', 'Drie km makkelijk. Volgende week is het zover — fris blijven.'),
  ]},
  { weekNumber: 20, totalKm: 27, focus: 'RACE WEEK', sessions: [
    s('hm-20-1', 1, 'easy',  3, 'Z1', 'Rustig loopje', 'Drie km heel rustig. Race is zondag.'),
    s('hm-20-2', 3, 'easy',  3, 'Z1', 'Activeringsloop', 'Drie km. Techniek en ontspanning.'),
    s('hm-20-3', 6, 'long', 21, 'Z3', 'HALVE MARATHON RACE DAG!', 'Twintig weken. Duizenden kilometers. Nu is het moment. Loop de eerste 5 km langzamer dan je wilt. Ga dan lekker.'),
  ]},
];

// ── MARATHON SCHEMA (24 weken) ────────────────
// Doelgroep: iemand die comfortabel de halve marathon loopt en de stap naar 42 km wil maken.
// Methodiek: progressieve opbouw, 3 sessies per week, langste lange loop 32-35 km, 3 taper-weken.
const planMarathon: TrainingWeek[] = [
  { weekNumber: 1,  totalKm: 30, focus: 'Basistempo bevestigen', sessions: [
    s('m-1-1', 1, 'easy',  8, 'Z2', 'Duurloop', 'Start rustig. De eerste week is het fundament, niet het plafond.'),
    s('m-1-2', 3, 'tempo', 8, 'Z3', 'Tempoduurloop', 'Acht km op een uitdagend maar houdbaar tempo.'),
    s('m-1-3', 6, 'long', 14, 'Z2', 'Lange duurloop', 'Lange duurloop. Loop de eerste 5 km bewust langzaam.'),
  ]},
  { weekNumber: 2,  totalKm: 33, focus: 'Ritme opbouwen', sessions: [
    s('m-2-1', 1, 'easy',  9, 'Z2', 'Duurloop', 'Negen km. Stabiel tempo, gelijke splits.'),
    s('m-2-2', 3, 'tempo', 8, 'Z3', 'Tempoduurloop', 'Houd Z3 vast gedurende de hele sessie.'),
    s('m-2-3', 6, 'long', 16, 'Z2', 'Lange duurloop', 'Zestien km. Gel meenemen na 60 minuten.'),
  ]},
  { weekNumber: 3,  totalKm: 33, focus: 'Duurvermogen vergroten', sessions: [
    s('m-3-1', 1, 'easy',  9, 'Z2', 'Duurloop', 'Ontspannen. Adem in, adem uit.'),
    iv('m-3-2', 3, 'A', 6),
    s('m-3-3', 6, 'long', 18, 'Z2', 'Lange duurloop', 'Achttien km. Voeding testen die je tijdens de race wil gebruiken.'),
  ]},
  { weekNumber: 4,  totalKm: 26, focus: 'Herstelweek', sessions: [
    s('m-4-1', 1, 'easy',  8, 'Z1', 'Herstelloop', 'Rustig. Herstelweek: minder km, beter worden.'),
    s('m-4-2', 3, 'easy',  8, 'Z2', 'Duurloop', 'Techniek: cadans verhogen, kleine snelle passen.'),
    s('m-4-3', 6, 'long', 10, 'Z2', 'Rustige lange duurloop', 'Bewust minder. Rust is training.'),
  ]},
  { weekNumber: 5,  totalKm: 36, focus: 'Kracht opbouwen', sessions: [
    s('m-5-1', 1, 'easy', 10, 'Z2', 'Duurloop', 'Tien km. Je wordt sterker elke week.'),
    iv('m-5-2', 3, 'C', 7),
    s('m-5-3', 6, 'long', 19, 'Z2', 'Lange duurloop', 'Negentien km. Bewust rustig starten.'),
  ]},
  { weekNumber: 6,  totalKm: 39, focus: 'Eerste grote week', sessions: [
    s('m-6-1', 1, 'easy', 10, 'Z2', 'Duurloop', 'Stabiel en zelfverzekerd.'),
    iv('m-6-2', 3, 'D', 7.5),
    s('m-6-3', 6, 'long', 21, 'Z2', 'Lange duurloop: halve marathon afstand', 'Eenentwintig km! Hetzelfde als de halve, maar nu als training.'),
  ]},
  { weekNumber: 7,  totalKm: 43, focus: 'Sterke fase', sessions: [
    s('m-7-1', 1, 'easy', 11, 'Z2', 'Duurloop', 'Elf km stabiel. Je benen weten wat ze doen.'),
    s('m-7-2', 3, 'tempo',10, 'Z4', 'Drempelloop', 'Tien km op drempelintensiteit. Moeilijk maar doenbaar.'),
    s('m-7-3', 6, 'long', 22, 'Z2', 'Lange duurloop', 'Tweeëntwintig km. Gel elke 45 minuten.'),
  ]},
  { weekNumber: 8,  totalKm: 30, focus: 'Herstelweek', sessions: [
    s('m-8-1', 1, 'easy',  9, 'Z1', 'Herstelloop', 'Rustig. Spieren mogen volledig herstellen.'),
    s('m-8-2', 3, 'easy',  9, 'Z2', 'Duurloop', 'Ontspannen. Focus op looptechniek.'),
    s('m-8-3', 6, 'long', 12, 'Z2', 'Rustige lange duurloop', 'Twaalf km. Lekker tempo, houd iets over.'),
  ]},
  { weekNumber: 9,  totalKm: 43, focus: 'Piekopbouw fase 1', sessions: [
    s('m-9-1', 1, 'easy', 11, 'Z2', 'Duurloop', 'Elf km. Krachtig en consistent.'),
    iv('m-9-2', 3, 'E', 7.5),
    s('m-9-3', 6, 'long', 24, 'Z2', 'Lange duurloop: 24 km', 'Vierentwintig km. Voeding elk halfuur.'),
  ]},
  { weekNumber: 10, totalKm: 45, focus: 'Piekopbouw fase 2', sessions: [
    s('m-10-1', 1, 'easy', 12, 'Z2', 'Duurloop', 'Twaalf km makkelijk. Je lichaam kent het nu.'),
    iv('m-10-2', 3, 'F', 8),
    s('m-10-3', 6, 'long', 25, 'Z2', 'Lange duurloop: 25 km', 'Vijfentwintig km. Gelstrategie verder verfijnen.'),
  ]},
  { weekNumber: 11, totalKm: 50, focus: 'Hoogste volume week', sessions: [
    s('m-11-1', 1, 'easy', 12, 'Z2', 'Duurloop', 'Twaalf km vlot. Je bent sterk.'),
    s('m-11-2', 3, 'tempo',11, 'Z4', 'Drempelloop', 'Elf km op drempelintensiteit.'),
    s('m-11-3', 6, 'long', 27, 'Z2', 'Lange duurloop: 27 km', 'Zevenentwintig km. Langste loop tot nu toe.'),
  ]},
  { weekNumber: 12, totalKm: 34, focus: 'Herstelweek', sessions: [
    s('m-12-1', 1, 'easy', 10, 'Z1', 'Herstelloop', 'Rustig. Lichaam mag bijkomen.'),
    s('m-12-2', 3, 'easy', 10, 'Z2', 'Duurloop', 'Ontspannen duurloop.'),
    s('m-12-3', 6, 'long', 14, 'Z2', 'Rustige lange duurloop', 'Veertien km. Genieten van het lopen.'),
  ]},
  { weekNumber: 13, totalKm: 47, focus: 'Hoogtepunt fase', sessions: [
    s('m-13-1', 1, 'easy', 12, 'Z2', 'Duurloop', 'Twaalf km. Krachtig en consistent.'),
    iv('m-13-2', 3, 'F', 8),
    s('m-13-3', 6, 'long', 27, 'Z2', 'Lange duurloop: 27 km', 'Zevenentwintig km. Je bent klaar voor meer.'),
  ]},
  { weekNumber: 14, totalKm: 49, focus: 'Piek-week', sessions: [
    s('m-14-1', 1, 'easy', 12, 'Z2', 'Duurloop', 'Twaalf km rustig. Je loopt serieuze afstanden.'),
    iv('m-14-2', 3, 'E', 7.5),
    s('m-14-3', 6, 'long', 29, 'Z2', 'Lange duurloop: 29 km', 'Negenentwintig km. Eén van je zwaarste trainingen.'),
  ]},
  { weekNumber: 15, totalKm: 55, focus: 'Absolute piek', sessions: [
    s('m-15-1', 1, 'easy', 13, 'Z2', 'Duurloop', 'Dertien km. Sterk en zelfverzekerd.'),
    s('m-15-2', 3, 'tempo',12, 'Z3', 'Tempoduurloop', 'Twaalf km. Laatste zware temposessie.'),
    s('m-15-3', 6, 'long', 30, 'Z2', 'Lange duurloop: 30 km', 'Dertig km. Je hebt de afstand in de benen.'),
  ]},
  { weekNumber: 16, totalKm: 37, focus: 'Herstelweek', sessions: [
    s('m-16-1', 1, 'easy', 11, 'Z1', 'Herstelloop', 'Elf km rustig. De zwaarste weken zijn voorbij.'),
    s('m-16-2', 3, 'easy', 11, 'Z2', 'Duurloop', 'Ontspannen. Benen mogen rusten.'),
    s('m-16-3', 6, 'long', 15, 'Z2', 'Rustige lange duurloop', 'Vijftien km. Fris voelen is het doel.'),
  ]},
  { weekNumber: 17, totalKm: 50, focus: 'Bevestigingsweek', sessions: [
    s('m-17-1', 1, 'easy', 13, 'Z2', 'Duurloop', 'Dertien km. Je bent race-klaar aan het worden.'),
    iv('m-17-2', 3, 'F', 8),
    s('m-17-3', 6, 'long', 29, 'Z2', 'Lange duurloop', 'Negenentwintig km. Laatste lange loop.'),
  ]},
  { weekNumber: 18, totalKm: 50, focus: 'Afbouwen fase 1', sessions: [
    s('m-18-1', 1, 'easy', 12, 'Z2', 'Duurloop', 'Twaalf km. Bewust iets minder.'),
    s('m-18-2', 3, 'tempo',11, 'Z3', 'Tempoduurloop', 'Elf km op race-tempo.'),
    s('m-18-3', 6, 'long', 27, 'Z2', 'Rustige lange duurloop', 'Zevenentwintig km. Energie bewaren.'),
  ]},
  { weekNumber: 19, totalKm: 44, focus: 'Afbouwen fase 2', sessions: [
    s('m-19-1', 1, 'easy', 11, 'Z2', 'Duurloop', 'Elf km. Fris en ontspannen.'),
    s('m-19-2', 3, 'tempo',10, 'Z3', 'Tempoduurloop', 'Tien km op race-tempo.'),
    s('m-19-3', 6, 'long', 23, 'Z2', 'Rustige lange duurloop', 'Drieëntwintig km. Laatste substantiële lange loop.'),
  ]},
  { weekNumber: 20, totalKm: 36, focus: 'Afbouwen fase 3', sessions: [
    s('m-20-1', 1, 'easy',  9, 'Z2', 'Duurloop', 'Negen km. Alles voelt licht.'),
    s('m-20-2', 3, 'tempo', 9, 'Z3', 'Tempoduurloop', 'Negen km op race-tempo. Laatste temposessie.'),
    s('m-20-3', 6, 'long', 18, 'Z2', 'Rustige lange duurloop', 'Achttien km rustig. Daarna gaat het echt afbouwen.'),
  ]},
  { weekNumber: 21, totalKm: 28, focus: 'Afbouwen fase 4', sessions: [
    s('m-21-1', 1, 'easy',  8, 'Z2', 'Duurloop', 'Acht km makkelijk.'),
    s('m-21-2', 3, 'easy',  8, 'Z2', 'Duurloop', 'Houd het rustig. Race nadert.'),
    s('m-21-3', 6, 'long', 12, 'Z2', 'Korte lange duurloop', 'Twaalf km. Benen hoeven niet te werken.'),
  ]},
  { weekNumber: 22, totalKm: 22, focus: 'Afbouwen fase 5', sessions: [
    s('m-22-1', 1, 'easy',  7, 'Z2', 'Duurloop', 'Zeven km. Helemaal ontspannen.'),
    s('m-22-2', 3, 'easy',  7, 'Z2', 'Duurloop', 'Zeven km rustig.'),
    s('m-22-3', 6, 'long',  8, 'Z2', 'Rustig loopje', 'Acht km. Benen fris houden.'),
  ]},
  { weekNumber: 23, totalKm: 14, focus: 'Race-week voorbereiding', sessions: [
    s('m-23-1', 1, 'easy',  6, 'Z2', 'Duurloop', 'Zes km. Helemaal ontspannen.'),
    s('m-23-2', 3, 'easy',  5, 'Z1', 'Activeringsloop', 'Vijf km heel rustig. Benen losmaken.'),
    s('m-23-3', 6, 'easy',  3, 'Z2', 'Dag-voor-race loopje', 'Drie km makkelijk. Volgende week is het zover — fris blijven.'),
  ]},
  { weekNumber: 24, totalKm: 48, focus: 'RACE WEEK', sessions: [
    s('m-24-1', 1, 'easy',  3, 'Z1', 'Rustig loopje', 'Drie km heel rustig. Race is zondag.'),
    s('m-24-2', 3, 'easy',  3, 'Z1', 'Activeringsloop', 'Drie km. Techniek en ontspanning.'),
    s('m-24-3', 6, 'long', 42, 'Z3', 'MARATHON RACE DAG!', 'Vierentwintig weken. Tienduizenden meters. Nu is het moment. Loop de eerste 10 km langzamer dan je wilt. Daarna zet je aan. Geniet van elk kilometer.'),
  ]},
];

// ── 15 KM / 10 MIJL SCHEMA (14 weken) ─────────
// Doelgroep: loopt al comfortabel 8-10 km en wil de stap naar 15 km / 10
// Engelse mijl maken (bijv. Zevenheuvelenloop, Tilburg Ten Miles).
const plan15km: TrainingWeek[] = [
  { weekNumber: 1, totalKm: 17, focus: 'Basis bevestigen', sessions: [
    s('15k-1-1', 1, 'easy',  5, 'Z2', 'Rustige duurloop', 'Vijf km op een prettig tempo. Dit wordt je basis voor de komende 14 weken.'),
    s('15k-1-2', 3, 'tempo', 4, 'Z3', 'Tempoduurloop', 'Vier km iets sneller dan je duurlooptempo. Je kunt nog een paar woorden zeggen.'),
    s('15k-1-3', 6, 'long',  8, 'Z2', 'Lange duurloop', 'Acht km rustig. Langste sessie van de week, neem de tijd.'),
  ]},
  { weekNumber: 2, totalKm: 19, focus: 'Ritme opbouwen', sessions: [
    s('15k-2-1', 1, 'easy',  5, 'Z2', 'Rustige duurloop', 'Zelfde gevoel als vorige week. Let op een gelijkmatige ademhaling.'),
    s('15k-2-2', 3, 'tempo', 5, 'Z3', 'Tempoduurloop', 'Vijf km op tempo. Probeer je ritme de hele sessie vast te houden.'),
    s('15k-2-3', 6, 'long',  9, 'Z2', 'Lange duurloop', 'Negen km. Eén stapje verder dan vorige week.'),
  ]},
  { weekNumber: 3, totalKm: 22, focus: 'Afstand opbouwen', sessions: [
    s('15k-3-1', 1, 'easy',  6, 'Z2', 'Duurloop', 'Zes km makkelijk. Je lichaam went aan de opbouw.'),
    iv('15k-3-2', 3, 'A', 6),
    s('15k-3-3', 6, 'long', 10, 'Z2', 'Lange duurloop: 10 km', 'Tien km! Mooie mijlpaal onderweg naar de 15.'),
  ]},
  { weekNumber: 4, totalKm: 16, focus: 'Herstelweek', sessions: [
    s('15k-4-1', 1, 'easy',  4, 'Z1', 'Herstelloop', 'Heel rustig. Herstelweek: minder km, beter worden.'),
    s('15k-4-2', 3, 'easy',  5, 'Z2', 'Duurloop', 'Vijf km ontspannen. Focus op techniek: rechtop lopen, losse schouders.'),
    s('15k-4-3', 6, 'long',  7, 'Z2', 'Rustige lange duurloop', 'Bewust minder dan vorige week. Herstel is training.'),
  ]},
  { weekNumber: 5, totalKm: 24, focus: 'Duurvermogen', sessions: [
    s('15k-5-1', 1, 'easy',  6, 'Z2', 'Duurloop', 'Zes km stabiel. Je basis wordt steeds sterker.'),
    iv('15k-5-2', 3, 'B', 6.5),
    s('15k-5-3', 6, 'long', 11, 'Z2', 'Lange duurloop', 'Elf km. Loop de eerste helft bewust rustig.'),
  ]},
  { weekNumber: 6, totalKm: 25, focus: 'Tempo verhogen', sessions: [
    s('15k-6-1', 1, 'easy',  6, 'Z2', 'Duurloop', 'Zes km vlot en ontspannen.'),
    iv('15k-6-2', 3, 'C', 7),
    s('15k-6-3', 6, 'long', 12, 'Z2', 'Lange duurloop', 'Twaalf km. Neem gel of water mee na 45 minuten.'),
  ]},
  { weekNumber: 7, totalKm: 28, focus: 'Kracht opbouwen', sessions: [
    s('15k-7-1', 1, 'easy',  7, 'Z2', 'Duurloop', 'Zeven km. Je bent er duidelijk sterker op geworden.'),
    iv('15k-7-2', 3, 'D', 7.5),
    s('15k-7-3', 6, 'long', 13, 'Z2', 'Lange duurloop: 13 km', 'Dertien km, je nieuwe afstandsrecord. Rustig starten, sterk eindigen.'),
  ]},
  { weekNumber: 8, totalKm: 19, focus: 'Herstelweek', sessions: [
    s('15k-8-1', 1, 'easy',  5, 'Z1', 'Herstelloop', 'Rustig. Spierherstel heeft nu prioriteit.'),
    s('15k-8-2', 3, 'easy',  6, 'Z2', 'Duurloop', 'Zes km ontspannen. Techniek: cadans en armschommel.'),
    s('15k-8-3', 6, 'long',  8, 'Z2', 'Rustige lange duurloop', 'Mindere week zodat je fris bent voor de laatste opbouw.'),
  ]},
  { weekNumber: 9, totalKm: 27, focus: 'Race-tempo oefenen', sessions: [
    s('15k-9-1', 1, 'easy',  7, 'Z2', 'Duurloop', 'Zeven km stabiel en krachtig.'),
    s('15k-9-2', 3, 'tempo', 6, 'Z4', 'Drempelloop op doeltempo', 'Zes km op je beoogde racetempo. Zo gaat het straks voelen.'),
    s('15k-9-3', 6, 'long', 14, 'Z2', 'Lange duurloop: 14 km', 'Veertien km. Bijna de wedstrijdafstand, mooi vertrouwen voor de piekweek.'),
  ]},
  { weekNumber: 10, totalKm: 30, focus: 'Piekweek', sessions: [
    s('15k-10-1', 1, 'easy',  7, 'Z2', 'Duurloop', 'Zeven km makkelijk. Je lichaam kent deze afstanden nu.'),
    iv('15k-10-2', 3, 'E', 7.5),
    s('15k-10-3', 6, 'long', 15, 'Z2', 'Lange duurloop: 15 km', 'Vijftien km, de volledige wedstrijdafstand! Rustig lopen, dit is puur duurvermogen bevestigen.'),
  ]},
  { weekNumber: 11, totalKm: 26, focus: 'Bevestigen', sessions: [
    s('15k-11-1', 1, 'easy',  7, 'Z2', 'Duurloop', 'Zeven km vlot. Je bent race-klaar aan het worden.'),
    s('15k-11-2', 3, 'tempo', 6, 'Z4', 'Drempelloop', 'Zes km op drempelintensiteit. Moeilijk maar doenbaar.'),
    s('15k-11-3', 6, 'long', 13, 'Z2', 'Lange duurloop', 'Dertien km. Herhaling van week 7, voel het verschil.'),
  ]},
  { weekNumber: 12, totalKm: 21, focus: 'Afbouwen fase 1', sessions: [
    s('15k-12-1', 1, 'easy',  6, 'Z2', 'Duurloop', 'Zes km. Bewust iets minder, energie sparen.'),
    s('15k-12-2', 3, 'tempo', 5, 'Z3', 'Tempoduurloop', 'Vijf km op race-tempo. Lekker gevoel vinden.'),
    s('15k-12-3', 6, 'long', 10, 'Z2', 'Rustige lange duurloop', 'Tien km rustig. Je bewaart energie voor de race.'),
  ]},
  { weekNumber: 13, totalKm: 17, focus: 'Afbouwen fase 2', sessions: [
    s('15k-13-1', 1, 'easy',  5, 'Z2', 'Duurloop', 'Vijf km. Benen fris houden.'),
    s('15k-13-2', 3, 'tempo', 4, 'Z3', 'Tempoduurloop', 'Vier km op race-tempo. Een van de laatste keer.'),
    s('15k-13-3', 6, 'long',  8, 'Z2', 'Rustige lange duurloop', 'Acht km rustig. Laatste echte duurloop voor de race.'),
  ]},
  { weekNumber: 14, totalKm: 22, focus: 'Race-week', sessions: [
    s('15k-14-1', 1, 'easy',  4, 'Z2', 'Afbouwloop', 'Vier km rustig. Benen fris houden voor de race.'),
    s('15k-14-2', 3, 'easy',  3, 'Z1', 'Activeringsloopje', 'Drie km heel rustig. Benen losmaken, niet vermoeien.'),
    s('15k-14-3', 6, 'easy', 15, 'Z3', '15 KM RACE DAG!', 'Veertien weken werk komen hier samen. Loop de eerste 3 km langzamer dan je wilt, dan lekker doortrekken.'),
  ]},
];

// ── Export ────────────────────────────────────
export const trainingPlans: TrainingPlan[] = [
  {
    id: '5km',
    name: '5 KM Comfortabel',
    weeks: 8,
    targetDistance: 5,
    description: 'Van 3-4 km naar een vlotte 5 km in 8 weken. Perfect als eerste stap.',
    plan: plan5km,
  },
  {
    id: '10km',
    name: '10 KM Comfortabel',
    weeks: 12,
    targetDistance: 10,
    description: 'Bouw op naar een comfortabele 10 km in 12 weken.',
    plan: plan10km,
  },
  {
    id: '15km',
    name: '15 KM / 10 Mijl',
    weeks: 14,
    targetDistance: 15,
    description: 'Van comfortabel 8-10 km naar 15 km (10 Engelse mijl) in 14 weken. Perfect voor de Zevenheuvelenloop of Tilburg Ten Miles.',
    plan: plan15km,
  },
  {
    id: 'half_marathon',
    name: 'Halve Marathon',
    weeks: 20,
    targetDistance: 21.1,
    description: 'Het ultieme doel: 21,1 km. Een serieus maar haalbaar avontuur van 20 weken.',
    plan: planHalfMarathon,
  },
  {
    id: 'marathon',
    name: 'Marathon',
    weeks: 24,
    targetDistance: 42.195,
    description: 'De ultieme uitdaging: 42,195 km. Een 24-weekse reis voor wie de halve marathon al loopt.',
    plan: planMarathon,
  },
];

// ── Trainingsdagen ────────────────────────────
// Standaard trainen op maandag, woensdag en zaterdag.
// Weekdagnummers: 1=ma, 2=di, 3=wo, 4=do, 5=vr, 6=za, 7=zo.
export const DEFAULT_TRAINING_DAYS = [1, 3, 6];

// Valideert een dagenkeuze: 3 t/m 7 unieke, gehele weekdagnummers (1-7).
// Gedeeld door remapWeekDays en addBonusRuns zodat beide functies exact
// dezelfde definitie van "geldige trainingsdagen" hanteren.
function isValidTrainingDays(days?: number[]): days is number[] {
  return (
    Array.isArray(days) &&
    days.length >= 3 &&
    days.length <= 7 &&
    days.every(d => Number.isInteger(d) && d >= 1 && d <= 7) &&
    new Set(days).size === days.length
  );
}

/** Geeft `count` oplopende, unieke indexen binnen [0, len-1], gelijkmatig
 *  gespreid en altijd beginnend op 0. */
function spreadIndices(count: number, len: number): number[] {
  if (count <= 0 || len <= 0) return [];
  if (count >= len) {
    return Array.from({ length: count }, (_, i) => Math.min(i, len - 1));
  }
  return Array.from({ length: count }, (_, i) => Math.round((i * (len - 1)) / count));
}

/**
 * Geeft een nieuwe TrainingWeek terug waarin de sessies op de zelfgekozen
 * trainingsdagen staan. De lange duurloop (type 'long', anders de sessie met
 * de grootste afstand) komt op de laatst gekozen dag (chronologisch). De
 * overige sessies behouden hun onderlinge volgorde en worden via
 * `spreadIndices` gelijkmatig over de eerdere gekozen dagen verdeeld.
 *
 * Controlevoorbeelden (moeten kloppen, zie ook spreadIndices hierboven):
 * - 3 dagen [a,b,c]: earlierDays = [a,b], count 2 → spreadIndices(2,2) = [0,1]
 *   → sessies op a en b, lange duurloop op c. Identiek aan het gedrag van
 *   vóór de generalisatie (dit was het enige ondersteunde geval).
 * - 5 dagen [1,2,3,5,6]: earlierDays = [1,2,3,5], count 2 →
 *   spreadIndices(2,4) = [0,2] → ma en wo, lange duurloop op za. Vrije
 *   dagen: di en vr.
 * - 7 dagen [1..7]: earlierDays = [1..6], count 2 → spreadIndices(2,6) =
 *   [0,3] → ma en do, lange duurloop op zo.
 *
 * Muteert niets: zowel de week als de sessies worden gekopieerd. Alleen het
 * veld `day` verandert, de sessie-id's blijven gelijk zodat voltooide-sessie-
 * matching blijft werken.
 *
 * @param week  De originele trainingsweek.
 * @param days  Drie tot zeven weekdagnummers (1 t/m 7), uniek. Bij een
 *              ongeldige invoer wordt teruggevallen op DEFAULT_TRAINING_DAYS.
 */
export function remapWeekDays(week: TrainingWeek, days?: number[]): TrainingWeek {
  const chosen = (isValidTrainingDays(days) ? days : DEFAULT_TRAINING_DAYS).slice().sort((a, b) => a - b);

  // Niet ingrijpen als de week geen sessies heeft (defensief).
  if (week.sessions.length === 0) {
    return { ...week, sessions: [] };
  }

  // Bepaal de lange-duurloop-sessie: bij voorkeur type 'long', anders de
  // sessie met de grootste afstand.
  let longIndex = week.sessions.findIndex(s => s.type === 'long');
  if (longIndex === -1) {
    longIndex = week.sessions.reduce(
      (maxIdx, s, idx, arr) => (s.distanceKm > arr[maxIdx].distanceKm ? idx : maxIdx),
      0,
    );
  }

  const lastDay = chosen[chosen.length - 1];
  const earlierDays = chosen.slice(0, chosen.length - 1);

  const remapped: Session[] = week.sessions.map(s => ({ ...s }));

  // Lange duurloop op de laatst gekozen dag.
  remapped[longIndex] = { ...remapped[longIndex], day: lastDay };

  // Overige sessies gelijkmatig over de eerdere dagen, in hun onderlinge
  // volgorde behouden.
  const earlierSessionIdxs = remapped.map((_, i) => i).filter(i => i !== longIndex);
  const positions = spreadIndices(earlierSessionIdxs.length, earlierDays.length);

  // Veiligheidsnet: spreadIndices garandeert unieke posities zolang er niet
  // meer sessies zijn dan eerdere dagen. Mocht dat toch gebeuren (een
  // toekomstig schema met meer sessies dan gekozen dagen), dan voorkomt dit
  // dat twee sessies op dezelfde dag belanden.
  const usedDays = new Set<number>([lastDay]);
  earlierSessionIdxs.forEach((sessionIdx, i) => {
    let day = earlierDays[positions[i]] ?? remapped[sessionIdx].day;
    if (usedDays.has(day)) {
      const fallbackDay = chosen.find(d => !usedDays.has(d));
      if (fallbackDay !== undefined) day = fallbackDay;
    }
    usedDays.add(day);
    remapped[sessionIdx] = { ...remapped[sessionIdx], day };
  });

  return { ...week, sessions: remapped };
}

// ── Afstemming van de bonus-duurloopjes ───────────────────────────────────
//
// Deze drie getallen bepalen samen hoeveel extra werk een gebruiker erbij
// krijgt als hij meer dan 3 dagen per week aanvinkt. Ze staan hier bij elkaar
// zodat ze te verantwoorden en in één plek bij te stellen zijn.

/** Maximaal deel van de weekkilometers dat aan bonusloopjes besteed mag worden.
 *  25% is de gangbare bovengrens voor het uitbreiden van een loopweek zonder
 *  de belangrijke sessies (interval, tempo, lange duurloop) te ondermijnen. */
const BONUS_BUDGET_FRACTIE = 0.25;

/** Ondergrens per bonusloop. Korter dan dit voelt niet als een training en is
 *  de moeite van het omkleden niet waard. */
const MIN_BONUS_KM = 2;

/** Bovengrens per bonusloop. Daarboven wordt het een echte training in plaats
 *  van een rustig extra rondje. */
const MAX_BONUS_KM = 6;

/**
 * Vult de vrije trainingsdagen van een week (na remapWeekDays) aan met
 * optionele, rustige bonus-duurloopjes. Bedoeld voor gebruikers die meer dan
 * 3 dagen per week willen trainen terwijl de schema's zelf altijd op 3
 * sessies gebaseerd blijven.
 *
 * Bonus-sessies tellen bewust niet mee in `week.totalKm`: dat veld blijft
 * uitsluitend de kilometers van het onderliggende schema, zodat weekvoort-
 * gang en -statistieken niet vervuild raken door een vrijblijvend aanbod.
 *
 * Bonus-id's zijn opgebouwd uit de ordinal (0, 1, 2, ...) van de bonus-
 * sessie, niet uit de gekozen dag. Verandert een gebruiker zijn trainings-
 * dagen, dan blijft een al voltooide bonusrun dus gewoon matchen.
 *
 * Muteert niets.
 *
 * @param week  Een trainingsweek die al door remapWeekDays is gehaald.
 * @param days  De zelfgekozen trainingsdagen (3 t/m 7).
 */
export function addBonusRuns(week: TrainingWeek, days?: number[]): TrainingWeek {
  if (!isValidTrainingDays(days) || days.length <= 3) return week;
  if (week.sessions.length === 0 || week.totalKm <= 0) return week;
  if (week.focus.toLowerCase().includes('herstel')) return week;

  const chosen = days.slice().sort((a, b) => a - b);
  const occupiedDays = new Set(week.sessions.map(s => s.day));
  const freeDays = chosen.filter(d => !occupiedDays.has(d));

  const shortestKm = week.sessions.reduce(
    (min, s) => (s.distanceKm > 0 && s.distanceKm < min ? s.distanceKm : min),
    Infinity,
  );
  // Geen enkele schema-sessie met een positieve afstand: er is niets om een
  // bonusafstand op te baseren (komt in de praktijk niet voor).
  if (!Number.isFinite(shortestKm)) return week;

  // Naar beneden afronden op halve kilometers: zo kan het totaal van de
  // bonusloopjes het weekbudget nooit overschrijden door afrondingsruis.
  const floorToHalf = (n: number) => Math.floor(n * 2) / 2;
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

  // Het budget is een percentage van de weekkilometers. Dat is de echte
  // veiligheidsrem: iemand die zeven dagen aanvinkt krijgt geen zeven volle
  // trainingen, maar wel meer loopmomenten binnen dezelfde extra belasting.
  const budgetKm = week.totalKm * BONUS_BUDGET_FRACTIE;

  // BELANGRIJK — verdeel het budget over zoveel mogelijk vrije dagen in plaats
  // van er één lange loop van te maken. Wie meer dagen kiest vraagt om vaker
  // lopen, niet om verder lopen; vier rondjes van 2 km dienen dat doel beter
  // dan één van 8 km, bij precies dezelfde weekbelasting. Deelden we het
  // budget niet, dan slokte de eerste bonusloop het in zijn eentje op en
  // leverde 7 dagen aanvinken evenveel loopdagen op als 4.
  const maxAantal = Math.min(freeDays.length, Math.floor(budgetKm / MIN_BONUS_KM));
  if (maxAantal <= 0) return week;

  // Lengte per bonusloop: het eerlijk verdeelde budget, maar nooit langer dan
  // 60% van de kortste schema-sessie (een bonusloop hoort een uitloopje te
  // zijn, geen tweede training) en nooit langer dan MAX_BONUS_KM. De ondergrens
  // van MIN_BONUS_KM is gegarandeerd haalbaar door de deling hierboven.
  const perBonusKm = clamp(
    floorToHalf(Math.min(budgetKm / maxAantal, shortestKm * 0.6, MAX_BONUS_KM)),
    MIN_BONUS_KM,
    MAX_BONUS_KM,
  );

  // Score per vrije dag: hoe hoger, hoe drukker die dag al omringd is door
  // zware trainingen. We kiezen straks de laagste (rustigste) scores.
  // - dag erna is de lange duurloop: +3 (rust vóór de lange duurloop).
  // - een aangrenzende dag (ervoor of erna) is interval/tempo: +2.
  // - een aangrenzende dag heeft een andere sessie: +1.
  // Elke aangrenzende dag telt voor precies één van deze categorieën mee,
  // dus dubbel tellen (bijv. +2 én +1 voor dezelfde tempo-sessie) gebeurt
  // niet.
  const scoreForDay = (day: number): number => {
    let score = 0;
    const prev = week.sessions.find(s => s.day === day - 1);
    const next = week.sessions.find(s => s.day === day + 1);

    if (next) {
      score += next.type === 'long' ? 3 : next.type === 'interval' || next.type === 'tempo' ? 2 : 1;
    }
    if (prev) {
      score += prev.type === 'interval' || prev.type === 'tempo' ? 2 : 1;
    }
    return score;
  };

  const scored = freeDays.map(day => ({ day, score: scoreForDay(day) }));
  // Laagste score wint; bij gelijke score de vroegste dag (freeDays is al
  // oplopend, dus een stabiele sort behoudt die volgorde vanzelf).
  scored.sort((a, b) => a.score - b.score || a.day - b.day);
  const bonusDays = scored.slice(0, maxAantal).map(x => x.day).sort((a, b) => a - b);

  const bonusSessions: Session[] = bonusDays.map((day, ordinal) => ({
    id: `bonus-${week.sessions[0].id}-${ordinal}`,
    day,
    type: 'easy',
    distanceKm: perBonusKm,
    zone: 'Z2',
    description: 'Bonus: rustige duurloop',
    coachTip:
      'Een extra rondje omdat je vaker wilt lopen. Houd het echt rustig, ' +
      'je moet er nog bij kunnen praten. Geen zin of moe? Sla hem gerust ' +
      'over, je schema is ook zonder deze loop compleet.',
    optional: true,
  }));

  const sessions = [...week.sessions.map(s => ({ ...s })), ...bonusSessions].sort((a, b) => a.day - b.day);

  return { ...week, sessions };
}

export const getTrainingPlan = (goal: GoalType): TrainingPlan =>
  trainingPlans.find(p => p.id === goal)!;

export const getWeek = (goal: GoalType, weekNumber: number): TrainingWeek | undefined =>
  getTrainingPlan(goal).plan.find(w => w.weekNumber === weekNumber);

export const zoneInfo = {
  Z1: { label: 'Herstel',   color: '#60A5FA', pct: '50-60%', description: 'Heel rustig. Je kunt makkelijk een gesprek voeren.' },
  Z2: { label: 'Aeroob',    color: '#34D399', pct: '61-70%', description: 'Comfortabel. Je kunt praten maar hebt een beetje moeite.' },
  Z3: { label: 'Tempo',     color: '#FBBF24', pct: '71-80%', description: 'Uitdagend. Je kunt een paar woorden zeggen.' },
  Z4: { label: 'Drempel',   color: '#F97316', pct: '81-90%', description: 'Moeilijk. Bijna geen gesprek meer mogelijk.' },
  Z5: { label: 'Maximaal',  color: '#EF4444', pct: '91-100%', description: 'Alles geven. Sprints en korte intervallen.' },
};
