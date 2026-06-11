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
export type GoalType = '5km' | '10km' | 'half_marathon' | 'marathon';

export interface Session {
  id: string;
  day: number;          // dag van de week (1=ma, 3=wo, 6=za)
  type: 'easy' | 'tempo' | 'long' | 'rest' | 'cross';
  distanceKm: number;
  zone: HeartRateZone;
  description: string;
  coachTip: string;
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
    totalKm: 12,
    focus: 'Eerste 5 km voelen',
    sessions: [
      s('5k-3-1', 1, 'easy',  4, 'Z2', 'Rustige duurloop', 'Je went aan de afstand. Loop de route die je vorige week liep en voel het verschil.'),
      s('5k-3-2', 3, 'tempo', 3, 'Z3', 'Tempoduurloop', 'Probeer een vaste route iets sneller af te leggen dan vorige week.'),
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
    totalKm: 13,
    focus: 'Snelheid introduceren',
    sessions: [
      s('5k-5-1', 1, 'easy',  4, 'Z2', 'Duurloop', 'Stabiele duurloop, bouw niet op in de sessie.'),
      s('5k-5-2', 3, 'tempo', 4, 'Z3', 'Tempoduurloop', '4 km met een comfortabel hoog tempo. Niet de max geven.'),
      s('5k-5-3', 6, 'long',  5, 'Z2', 'Lange duurloop', 'Rustige 5 km. Bewuster dan week 3: let op loophouding.'),
    ],
  },
  {
    weekNumber: 6,
    totalKm: 14,
    focus: 'Consistentie opbouwen',
    sessions: [
      s('5k-6-1', 1, 'easy',  4, 'Z2', 'Duurloop', 'Controleer je gemiddeld tempo per km. Probeer elke km gelijk te lopen.'),
      s('5k-6-2', 3, 'tempo', 4, 'Z3', 'Tempoduurloop', 'Sneller dan je Z2 duurloopempo. Je moet na afloop voelen dat je hebt gelopen.'),
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
    totalKm: 8,
    focus: 'Race-week: afbouwen',
    sessions: [
      s('5k-8-1', 1, 'easy',  3, 'Z2', 'Afbouwloop', 'Lichte duurloop. Benen fris houden voor de race.'),
      s('5k-8-2', 3, 'easy',  2, 'Z1', 'Activeringsloopje', 'Korte, makkelijke loop. Benen losmaken, niet vermoeien.'),
      s('5k-8-3', 6, 'easy',  3, 'Z3', '5 KM RACE DAG!', 'Jij bent klaar. Geniet ervan. Loop de eerste km rustiger dan je denkt dat nodig is.'),
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
  { weekNumber: 3,  totalKm: 16, focus: 'Afstand vergroten', sessions: [
    s('10k-3-1', 1, 'easy',  5, 'Z2', 'Duurloop', 'Vijf km makkelijk. Let op je ademhaling.'),
    s('10k-3-2', 3, 'tempo', 4, 'Z3', 'Tempoduurloop', 'Laat je hartslag Z3 raken maar niet overschrijden.'),
    s('10k-3-3', 6, 'long',  7, 'Z2', 'Lange duurloop', 'Zeven km. Loop de eerste 3 km bewust langzaam.'),
  ]},
  { weekNumber: 4,  totalKm: 13, focus: 'Herstelweek', sessions: [
    s('10k-4-1', 1, 'easy',  4, 'Z1', 'Herstelloop', 'Heel rustig. Z1 betekent wandeltempo met looppassen.'),
    s('10k-4-2', 3, 'easy',  4, 'Z2', 'Duurloop', 'Techniek: elke stap gelijkmatig, niet stuiteren.'),
    s('10k-4-3', 6, 'long',  5, 'Z2', 'Rustige lange duurloop', 'Mindere week = groeien. Herstel is productief.'),
  ]},
  { weekNumber: 5,  totalKm: 18, focus: 'Halverwege 10 km aanraken', sessions: [
    s('10k-5-1', 1, 'easy',  5, 'Z2', 'Duurloop', 'Regelmatig tempo.'),
    s('10k-5-2', 3, 'tempo', 5, 'Z3', 'Tempoduurloop', 'Uitdagend maar houdbaar.'),
    s('10k-5-3', 6, 'long',  8, 'Z2', 'Lange duurloop: 8 km', 'Acht km! Loop rustig, houd iets over voor de laatste 2 km.'),
  ]},
  { weekNumber: 6,  totalKm: 20, focus: 'Consistentie en tempo', sessions: [
    s('10k-6-1', 1, 'easy',  6, 'Z2', 'Duurloop', 'Zes km vlot en stabiel.'),
    s('10k-6-2', 3, 'tempo', 5, 'Z3', 'Tempoduurloop', 'Probeer je gemiddeld tempo te verbeteren vs. week 5.'),
    s('10k-6-3', 6, 'long',  9, 'Z2', 'Lange duurloop: 9 km', 'Eén km voor het doel! Rustig blijven.'),
  ]},
  { weekNumber: 7,  totalKm: 22, focus: 'De 10 km halen', sessions: [
    s('10k-7-1', 1, 'easy',  6, 'Z2', 'Duurloop', 'Zelfverzekerd lopen. Je bent ver gekomen.'),
    s('10k-7-2', 3, 'tempo', 5, 'Z3', 'Tempoduurloop', 'Laatste tempoduurloop voor de 10 km.'),
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
  { weekNumber: 10, totalKm: 23, focus: 'Piek-opbouw', sessions: [
    s('10k-10-1', 1, 'easy',  6, 'Z2', 'Duurloop', 'Energiek en zelfverzekerd.'),
    s('10k-10-2', 3, 'tempo', 6, 'Z3', 'Tempoduurloop', 'Langste tempoduurloop van het schema.'),
    s('10k-10-3', 6, 'long', 11, 'Z2', 'Lange duurloop', 'Laatste lange loop. Je bent race-klaar.'),
  ]},
  { weekNumber: 11, totalKm: 16, focus: 'Afbouwen', sessions: [
    s('10k-11-1', 1, 'easy',  5, 'Z2', 'Duurloop', 'Fris en ontspannen.'),
    s('10k-11-2', 3, 'easy',  4, 'Z2', 'Duurloop', 'Niet te hard. Benen fris houden.'),
    s('10k-11-3', 6, 'long',  7, 'Z2', 'Rustige lange duurloop', 'Laatste langere loop. Daarna rusten.'),
  ]},
  { weekNumber: 12, totalKm: 10, focus: 'Race-week', sessions: [
    s('10k-12-1', 1, 'easy',  4, 'Z2', 'Afbouwloop', 'Lekker loopje. Benen losmaken.'),
    s('10k-12-2', 3, 'easy',  3, 'Z1', 'Activeringsloopje', 'Kort en makkelijk. Benen niet vermoeien.'),
    s('10k-12-3', 6, 'easy',  3, 'Z3', '10 KM RACE DAG!', 'Je bent hier klaar voor. Loop de eerste 3 km langzamer dan je wilt. Het loont.'),
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
  { weekNumber: 3,  totalKm: 21, focus: 'Afstand opbouwen', sessions: [
    s('hm-3-1', 1, 'easy',  6, 'Z2', 'Duurloop', 'Zes km vlot en ontspannen.'),
    s('hm-3-2', 3, 'tempo', 5, 'Z3', 'Tempoduurloop', 'Houd Z3 aan gedurende de hele 5 km.'),
    s('hm-3-3', 6, 'long', 10, 'Z2', 'Lange duurloop: 10 km', 'Eerste 10 km! Neem de tijd, bewaar energie.'),
  ]},
  { weekNumber: 4,  totalKm: 16, focus: 'Herstelweek', sessions: [
    s('hm-4-1', 1, 'easy',  5, 'Z1', 'Herstelloop', 'Makkelijk. Herstel is training.'),
    s('hm-4-2', 3, 'easy',  5, 'Z2', 'Duurloop', 'Techniek: korte, snelle passen vs. grote passen.'),
    s('hm-4-3', 6, 'long',  6, 'Z2', 'Rustige duurloop', 'Minder km. Meer herstel.'),
  ]},
  { weekNumber: 5,  totalKm: 24, focus: 'Duurvermogen opbouwen', sessions: [
    s('hm-5-1', 1, 'easy',  7, 'Z2', 'Duurloop', 'Zeven km makkelijk. Bewust langzaam de eerste 15 min.'),
    s('hm-5-2', 3, 'tempo', 6, 'Z3', 'Tempoduurloop', 'Zes km op hoog tempo. Je kunt nog net praten.'),
    s('hm-5-3', 6, 'long', 11, 'Z2', 'Lange duurloop', 'Elf km. Loop-pauze-strategie mag als je wil.'),
  ]},
  { weekNumber: 6,  totalKm: 26, focus: 'Tempo verhogen', sessions: [
    s('hm-6-1', 1, 'easy',  7, 'Z2', 'Duurloop', 'Stabiel en zelfverzekerd.'),
    s('hm-6-2', 3, 'tempo', 7, 'Z3', 'Tempoduurloop', 'Zeven km, de langste tempoduurloop tot nu toe.'),
    s('hm-6-3', 6, 'long', 12, 'Z2', 'Lange duurloop', 'Twaalf km. Voeding/gel meenemen na 60 minuten.'),
  ]},
  { weekNumber: 7,  totalKm: 28, focus: 'Kracht opbouwen', sessions: [
    s('hm-7-1', 1, 'easy',  8, 'Z2', 'Duurloop', 'Acht km. Je bent er klaar voor.'),
    s('hm-7-2', 3, 'tempo', 7, 'Z3', 'Tempoduurloop', 'Houd het tempo door. Tweede helft even snel als eerste.'),
    s('hm-7-3', 6, 'long', 13, 'Z2', 'Lange duurloop', 'Dertien km. Eerste keer boven de 10 km in de lange loop.'),
  ]},
  { weekNumber: 8,  totalKm: 21, focus: 'Herstelweek', sessions: [
    s('hm-8-1', 1, 'easy',  6, 'Z1', 'Herstelloop', 'Heel rustig. Spierherstel prioriteit.'),
    s('hm-8-2', 3, 'easy',  7, 'Z2', 'Duurloop', 'Looptechniek oefenen: cadans, armschommel.'),
    s('hm-8-3', 6, 'long',  8, 'Z2', 'Rustige lange duurloop', 'Adem in, adem uit. Geniet van het lopen.'),
  ]},
  { weekNumber: 9,  totalKm: 30, focus: 'Piekopbouw fase 1', sessions: [
    s('hm-9-1', 1, 'easy',  8, 'Z2', 'Duurloop', 'Stabiel, gelijkmatig, krachtig.'),
    s('hm-9-2', 3, 'tempo', 8, 'Z3', 'Tempoduurloop', 'Acht km op race-tempo. Dit is hoe het straks voelt.'),
    s('hm-9-3', 6, 'long', 14, 'Z2', 'Lange duurloop: 14 km', 'Veertig procent van de halve marathon!'),
  ]},
  { weekNumber: 10, totalKm: 32, focus: 'Piekopbouw fase 2', sessions: [
    s('hm-10-1', 1, 'easy',  8, 'Z2', 'Duurloop', 'Acht km makkelijk. Je lichaam kent het nu.'),
    s('hm-10-2', 3, 'tempo', 9, 'Z3', 'Tempoduurloop', 'Negen km. Tweede helft sneller dan eerste.'),
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
  { weekNumber: 13, totalKm: 35, focus: 'Hoogtepunt fase', sessions: [
    s('hm-13-1', 1, 'easy',  9, 'Z2', 'Duurloop', 'Negen km. Krachtig en consistent.'),
    s('hm-13-2', 3, 'tempo',10, 'Z3', 'Tempoduurloop', 'Tien km op tempopace. Langste temposessie.'),
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
    s('hm-19-3', 6, 'easy',  3, 'Z2', 'Dag-voor-race loopje', 'Drie km makkelijk. Morgen is het zover!'),
  ]},
  { weekNumber: 20, totalKm: 21, focus: 'RACE WEEK', sessions: [
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
  { weekNumber: 3,  totalKm: 36, focus: 'Duurvermogen vergroten', sessions: [
    s('m-3-1', 1, 'easy',  9, 'Z2', 'Duurloop', 'Ontspannen. Adem in, adem uit.'),
    s('m-3-2', 3, 'tempo', 9, 'Z3', 'Tempoduurloop', 'Negen km. Tweede helft even snel als eerste.'),
    s('m-3-3', 6, 'long', 18, 'Z2', 'Lange duurloop', 'Achttien km. Voeding testen die je tijdens de race wil gebruiken.'),
  ]},
  { weekNumber: 4,  totalKm: 26, focus: 'Herstelweek', sessions: [
    s('m-4-1', 1, 'easy',  8, 'Z1', 'Herstelloop', 'Rustig. Herstelweek: minder km, beter worden.'),
    s('m-4-2', 3, 'easy',  8, 'Z2', 'Duurloop', 'Techniek: cadans verhogen, kleine snelle passen.'),
    s('m-4-3', 6, 'long', 10, 'Z2', 'Rustige lange duurloop', 'Bewust minder. Rust is training.'),
  ]},
  { weekNumber: 5,  totalKm: 38, focus: 'Kracht opbouwen', sessions: [
    s('m-5-1', 1, 'easy', 10, 'Z2', 'Duurloop', 'Tien km. Je wordt sterker elke week.'),
    s('m-5-2', 3, 'tempo', 9, 'Z3', 'Tempoduurloop', 'Uitdagend. Loop de tweede helft iets sneller.'),
    s('m-5-3', 6, 'long', 19, 'Z2', 'Lange duurloop', 'Negentien km. Bewust rustig starten.'),
  ]},
  { weekNumber: 6,  totalKm: 41, focus: 'Eerste grote week', sessions: [
    s('m-6-1', 1, 'easy', 10, 'Z2', 'Duurloop', 'Stabiel en zelfverzekerd.'),
    s('m-6-2', 3, 'tempo',10, 'Z3', 'Tempoduurloop', 'Tien km op race-voorbereidingstempo.'),
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
  { weekNumber: 9,  totalKm: 46, focus: 'Piekopbouw fase 1', sessions: [
    s('m-9-1', 1, 'easy', 11, 'Z2', 'Duurloop', 'Elf km. Krachtig en consistent.'),
    s('m-9-2', 3, 'tempo',11, 'Z3', 'Tempoduurloop', 'Elf km. Langste temposessie tot nu toe.'),
    s('m-9-3', 6, 'long', 24, 'Z2', 'Lange duurloop: 24 km', 'Vierentwintig km. Voeding elk halfuur.'),
  ]},
  { weekNumber: 10, totalKm: 48, focus: 'Piekopbouw fase 2', sessions: [
    s('m-10-1', 1, 'easy', 12, 'Z2', 'Duurloop', 'Twaalf km makkelijk. Je lichaam kent het nu.'),
    s('m-10-2', 3, 'tempo',11, 'Z3', 'Tempoduurloop', 'Elf km. Tweede helft sneller dan eerste.'),
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
  { weekNumber: 13, totalKm: 51, focus: 'Hoogtepunt fase', sessions: [
    s('m-13-1', 1, 'easy', 12, 'Z2', 'Duurloop', 'Twaalf km. Krachtig en consistent.'),
    s('m-13-2', 3, 'tempo',12, 'Z3', 'Tempoduurloop', 'Twaalf km op tempopace.'),
    s('m-13-3', 6, 'long', 27, 'Z2', 'Lange duurloop: 27 km', 'Zevenentwintig km. Je bent klaar voor meer.'),
  ]},
  { weekNumber: 14, totalKm: 53, focus: 'Piek-week', sessions: [
    s('m-14-1', 1, 'easy', 12, 'Z2', 'Duurloop', 'Twaalf km rustig. Je loopt serieuze afstanden.'),
    s('m-14-2', 3, 'tempo',12, 'Z3', 'Tempoduurloop', 'Twaalf km. Jouw marathon-pace.'),
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
  { weekNumber: 17, totalKm: 54, focus: 'Bevestigingsweek', sessions: [
    s('m-17-1', 1, 'easy', 13, 'Z2', 'Duurloop', 'Dertien km. Je bent race-klaar aan het worden.'),
    s('m-17-2', 3, 'tempo',12, 'Z3', 'Tempoduurloop', 'Twaalf km op race-tempo. Goed gevoel vinden.'),
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
    s('m-23-3', 6, 'easy',  3, 'Z2', 'Dag-voor-race loopje', 'Drie km makkelijk. Morgen is het zover!'),
  ]},
  { weekNumber: 24, totalKm: 42, focus: 'RACE WEEK', sessions: [
    s('m-24-1', 1, 'easy',  3, 'Z1', 'Rustig loopje', 'Drie km heel rustig. Race is zondag.'),
    s('m-24-2', 3, 'easy',  3, 'Z1', 'Activeringsloop', 'Drie km. Techniek en ontspanning.'),
    s('m-24-3', 6, 'long', 42, 'Z3', 'MARATHON RACE DAG!', 'Vierentwintig weken. Tienduizenden meters. Nu is het moment. Loop de eerste 10 km langzamer dan je wilt. Daarna zet je aan. Geniet van elk kilometer.'),
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
