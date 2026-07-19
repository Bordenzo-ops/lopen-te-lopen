/**
 * voicePhrases — de zinnencatalogus voor de stempakketten
 *
 * Eén bron van waarheid voor zowel het (fase B) generatiescript als de app.
 * Zie `_workspace/notities/Stempakketten-ontwerp.md` voor de volledige
 * architectuur. Elke gesproken boodschap in de app bestaat straks uit een
 * rij van hele-zin-clips (`phraseId`'s) die na elkaar worden afgespeeld —
 * plakken op zinsniveau klinkt natuurlijk, op woordniveau niet. Zolang de
 * clips zelf nog niet bestaan (fase A/B) speelt de app altijd de
 * `fallbackText` af via de telefoonstem (expo-speech); zie `speakPhrases`
 * in `src/services/voiceService.ts`.
 *
 * `allPhrases()` enumereert ALLE clips die het generatiescript straks met
 * ElevenLabs moet aanmaken (±560 stuks). De compositiefuncties hieronder
 * (`kmSplitUtterance`, `finishUtterance`, enz.) bepalen welke clip-ids een
 * concrete boodschap tijdens het lopen gebruikt, plús de natuurlijke
 * volzin als vangnet.
 *
 * Afronding van dynamische delen is bewust ruw: het scherm toont exacte
 * waarden, de stem mag "ongeveer" zeggen. Zo blijft het aantal clips
 * eindig terwijl de gesproken boodschap toch natuurlijk klinkt. Zie de
 * toelichting bij elke groep hieronder.
 */

// ── Hulpfuncties voor afronding/klemmen ─────────────────────────────────────

/** Klemt een waarde tussen min en max (inclusief). */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Rondt af op de dichtstbijzijnde 0,5 en klemt tussen min en max. Gebruikt
 * voor "resterend"/"afgelegd"-afstanden: die lopen in stappen van een halve
 * kilometer (rem_/dist_-groepen).
 */
function roundHalfClamped(value: number, min: number, max: number): number {
  const rounded = Math.round(value * 2) / 2;
  return clamp(rounded, min, max);
}

/**
 * Zet een halve-kilometerwaarde (bv. 7 of 7.5) om in een phraseId-suffix
 * zonder punt/komma, bv. "7" of "7_5" — bestandsnamen mogen geen punt
 * bevatten en underscores lezen prettiger dan een letterlijke komma.
 */
function halfStepSuffix(value: number): string {
  const whole = Math.floor(value + 1e-9);
  const isHalf = value - whole >= 0.25;
  return isHalf ? `${whole}_5` : `${whole}`;
}

/**
 * Nederlandse getalnotatie voor een halve-kilometerwaarde in gesproken/
 * geschreven tekst: hele kilometers als "8", halve als "8,5" (komma, geen
 * punt — Nederlandse conventie).
 */
function formatHalfKm(value: number): string {
  const whole = Math.floor(value + 1e-9);
  const isHalf = value - whole >= 0.25;
  return isHalf ? `${whole},5` : `${whole}`;
}

// ── 1. Km-split — "5 kilometer." ────────────────────────────────────────────
// km_1 .. km_50. Verder dan 50 km komt in de praktijk niet voor (marathon +
// ruim); een langere afstand klemt op km_50 zodat er altijd een geldige clip-
// id is (de encouragement-rotatie hieronder blijft wel op de echte km-stand
// lopen, alleen de kilometer-clip zelf klemt).
const KM_SPLIT_MIN = 1;
const KM_SPLIT_MAX = 50;

// ── 2. Tempo — "Tempo 5 minuten en 30 seconden per kilometer." ──────────────
// Minuten geklemd 2..15 (sneller dan 2:00/km of trager dan 15:00/km komt bij
// hardlopen niet voor), seconden afgerond op een veelvoud van 5 (0,5,…,55).
const PACE_MIN_MIN = 2;
const PACE_MIN_MAX = 15;
const PACE_SEC_STEP = 5;

// ── 3. Aanmoediging per km-split — bestaande KM_MESSAGES (useVoiceGuidance) ─
const ENC_MESSAGES = [
  'Goed bezig, houd dit tempo aan.',
  'Super! Blijf gelijkmatig lopen.',
  'Uitstekend! Je loopt geweldig.',
  'Fantastisch! Je bent sterk.',
  'Geweldig! Bijna bij het doel.',
  'Ongelooflijk! Je bent een machine.',
];

// ── 4/5. Resterend / afgelegd — stappen van 0,5 km, 0,5..42 km ──────────────
// 42 km (marathon) als bovengrens; verder klemt de waarde op 42.
const KM_RANGE_MIN = 0.5;
const KM_RANGE_MAX = 42;

// ── 6. Tijd — "In 52 minuten." ──────────────────────────────────────────────
// 1..90 minuten per hele minuut (normale trainingsduur), daarboven per 5
// minuten (lange duurlopen/marathon), geklemd op 300 (5 uur).
const TIME_FINE_MAX = 90;
const TIME_STEP_ABOVE = 5;
const TIME_MAX = 300;

// ── 7. Zones — bestaande ZONE_DESCRIPTIONS (useVoiceGuidance) ──────────────
const ZONE_DESCRIPTIONS: Record<string, string> = {
  Z1: 'Herstelzone. Heel rustig tempo.',
  Z2: 'Aerobe zone. Comfortabel, je kunt praten.',
  Z3: 'Tempozone. Uitdagend maar houdbaar.',
  Z4: 'Drempelzone. Moeilijk, bijna geen gesprek mogelijk.',
  Z5: 'Maximale zone. Alles geven!',
};
const ZONE_IDS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'] as const;

// ── 8. Hartslagcoaching — bestaande drie zinnen (useHeartRateCoaching) ─────
const HR_TEXTS: Record<'high' | 'low' | 'ok', string> = {
  high: 'Je hartslag is wat hoog voor deze training. Doe een stapje terug.',
  low:  'Je hebt nog ruimte. Je mag iets versnellen.',
  ok:   'Mooi zo, precies goed.',
};

// ── 9. Mijlpalen — bestaande teksten (useRouteCoaching + useVoiceGuidance) ──
// mile_25/50/75 zijn de routevoortgangsmeldingen uit useRouteCoaching
// (MILESTONES). "halfway" is de aparte halverwege-melding uit
// useVoiceGuidance — dat is een ANDER concept (halverwege de geplande
// sessieafstand, niet halverwege de uitgestippelde route) met een eigen
// tekst. Let op de woordvolgorde: de oorspronkelijke zin is "Halverwege!
// Nog X kilometer te gaan. Je doet het geweldig." — met maar twee clip-ids
// beschikbaar (halfway + rem_X) is het niet mogelijk om "Je doet het
// geweldig" na de rem_-clip te laten volgen zonder een derde id. Daarom
// bevat de "halfway"-clip zelf beide bookend-zinnen ("Halverwege! Je doet
// het geweldig.") en klinkt rem_X ertussenin (fase C); dat is een bewuste
// afwijking van de exacte fallback-woordvolgorde, alleen relevant zodra de
// clips echt afgespeeld worden (fase C) — de fallbackText hieronder blijft
// woordelijk gelijk aan het huidige gedrag.
const MILE_TEXTS: Record<25 | 50 | 75, string> = {
  25: 'Een kwart van je route voltooid.',
  50: 'Halverwege de geplande route.',
  75: 'Driekwart onderweg. Bijna terug!',
};
const HALFWAY_TEXT = 'Halverwege! Je doet het geweldig.';

// ── 10. Navigatie — herkend uit de Nederlandse tekst van toNl() ────────────
// (src/services/routeService.ts). Geen straatnamen in de clips: alleen het
// type afslag wordt uitgesproken, de straatnaam blijft schermtekst/fallback.
const TURN_TEXTS: Record<string, string> = {
  turn_left:        'Sla links af.',
  turn_right:       'Sla rechts af.',
  turn_sharp_left:  'Sla scherp links af.',
  turn_sharp_right: 'Sla scherp rechts af.',
  turn_keep_left:   'Houd links aan.',
  turn_keep_right:  'Houd rechts aan.',
  turn_straight:    'Ga rechtdoor.',
  turn_uturn:       'Keer om.',
  turn_arrive:      'Doel bereikt.',
};

// Herkenningspatronen, in deze volgorde gecontroleerd (case-insensitive
// substring-match op de reeds vertaalde Nederlandse tekst). "scherp"- en
// "houd ... aan"-varianten staan bewust vóór de simpele "sla ... af", al
// overlappen ze toch niet als substring ("Sla scherp links af" bevat niet
// letterlijk "Sla links af"). "Keer om" komt in de huidige toNl() niet voor
// (ORS levert geen U-turn-instructie op onze routes), maar wordt hier al
// wel herkend zodat de catalogus toekomstvast is (zie ontwerpdoc).
const TURN_PATTERNS: Array<[string, string]> = [
  ['sla scherp links af',  'turn_sharp_left'],
  ['sla scherp rechts af', 'turn_sharp_right'],
  ['houd links aan',       'turn_keep_left'],
  ['houd rechts aan',      'turn_keep_right'],
  ['sla links af',         'turn_left'],
  ['sla rechts af',        'turn_right'],
  ['ga rechtdoor',         'turn_straight'],
  ['keer om',              'turn_uturn'],
  ['doel bereikt',         'turn_arrive'],
];

// ── 11. Nav-afstand — "Over 100 meter:" ─────────────────────────────────────
// Afgerond op 10 meter, geklemd 50..150 (binnen dat bereik wordt een afslag
// in useRouteCoaching aangekondigd; zie ANNOUNCE_AT_M).
const DIST_M_MIN = 50;
const DIST_M_MAX = 150;
const DIST_M_STEP = 10;

// ── 12. Vast — finish/well_done/greeting/preview ────────────────────────────
const FIXED_TEXTS: Record<string, string> = {
  finish:    'Sessie voltooid!',
  well_done: 'Geweldig gedaan!',
  greeting:  'Hoi! Ik ben je hardloopcoach. Samen gaan we trainen.',
  preview:   'Hoi! Ik ben je hardloopcoach. Zo klink ik tijdens het lopen.',
};

// ── Catalogus-enumeratie ─────────────────────────────────────────────────────

export interface CatalogPhrase {
  id: string;
  text: string;
}

/**
 * Geeft ALLE clips terug die het generatiescript (fase B) met ElevenLabs
 * moet aanmaken — ongeacht of ze ooit tijdens een sessie gebruikt worden.
 * Dit is de volledige catalogus uit het ontwerpdocument (±560 clips).
 */
export function allPhrases(): CatalogPhrase[] {
  const phrases: CatalogPhrase[] = [];

  // 1. Km-split
  for (let km = KM_SPLIT_MIN; km <= KM_SPLIT_MAX; km++) {
    phrases.push({ id: `km_${km}`, text: `${km} kilometer.` });
  }

  // 2. Tempo
  for (let min = PACE_MIN_MIN; min <= PACE_MIN_MAX; min++) {
    for (let sec = 0; sec <= 55; sec += PACE_SEC_STEP) {
      phrases.push({
        id: `pace_${min}_${sec}`,
        text: sec === 0
          ? `Tempo ${min} minuten per kilometer.`
          : `Tempo ${min} minuten en ${sec} seconden per kilometer.`,
      });
    }
  }

  // 3. Aanmoedigingen
  ENC_MESSAGES.forEach((text, i) => {
    phrases.push({ id: `enc_${i}`, text });
  });

  // 4. Resterend
  for (let km = KM_RANGE_MIN; km <= KM_RANGE_MAX + 1e-9; km += 0.5) {
    phrases.push({
      id: `rem_${halfStepSuffix(km)}`,
      text: `Nog ongeveer ${formatHalfKm(km)} kilometer te gaan.`,
    });
  }

  // 5. Afstand gelopen
  for (let km = KM_RANGE_MIN; km <= KM_RANGE_MAX + 1e-9; km += 0.5) {
    phrases.push({
      id: `dist_${halfStepSuffix(km)}`,
      text: `Je hebt ongeveer ${formatHalfKm(km)} kilometer gelopen.`,
    });
  }

  // 6. Tijd — enkelvoud voor precies 1 minuut ("In 1 minuut.")
  for (let m = 1; m <= TIME_FINE_MAX; m++) {
    phrases.push({ id: `time_${m}`, text: m === 1 ? 'In 1 minuut.' : `In ${m} minuten.` });
  }
  for (let m = TIME_FINE_MAX + TIME_STEP_ABOVE; m <= TIME_MAX; m += TIME_STEP_ABOVE) {
    phrases.push({ id: `time_${m}`, text: `In ${m} minuten.` });
  }

  // 7. Zones
  ZONE_IDS.forEach((zx, i) => {
    phrases.push({ id: `zone_${zx}`, text: `Zone ${i + 1}. ${ZONE_DESCRIPTIONS[zx]}` });
  });

  // 8. Hartslagcoaching
  (Object.keys(HR_TEXTS) as Array<keyof typeof HR_TEXTS>).forEach(key => {
    phrases.push({ id: `hr_${key}`, text: HR_TEXTS[key] });
  });

  // 9. Mijlpalen
  ([25, 50, 75] as const).forEach(pct => {
    phrases.push({ id: `mile_${pct}`, text: MILE_TEXTS[pct] });
  });
  phrases.push({ id: 'halfway', text: HALFWAY_TEXT });

  // 10. Navigatie
  Object.entries(TURN_TEXTS).forEach(([id, text]) => {
    phrases.push({ id, text });
  });

  // 11. Nav-afstand
  for (let m = DIST_M_MIN; m <= DIST_M_MAX; m += DIST_M_STEP) {
    phrases.push({ id: `dist_m_${m}`, text: `Over ${m} meter:` });
  }

  // 12. Vast
  Object.entries(FIXED_TEXTS).forEach(([id, text]) => {
    phrases.push({ id, text });
  });

  return phrases;
}

// ── Compositiefuncties ───────────────────────────────────────────────────────

/**
 * Eén gesproken boodschap: de clip-ids die (in fase C) na elkaar afgespeeld
 * worden, plús de volledige natuurlijke zin als vangnet voor de telefoonstem
 * (fase A: dit vangnet is altijd wat er daadwerkelijk klinkt).
 */
export type PhraseUtterance = {
  ids: string[];
  fallbackText: string;
};

/**
 * Km-split tijdens het lopen: "5 kilometer, tempo 5 minuten en 30 seconden
 * per kilometer. Super! Blijf gelijkmatig lopen."
 *
 * De fallbackText gebruikt het EXACTE tempo (niet afgerond) — precies zoals
 * useVoiceGuidance dat nu al doet. De clip-ids gebruiken het afgeronde tempo
 * (seconden op een veelvoud van 5) omdat anders elk denkbaar tempo een eigen
 * clip zou vergen.
 */
export function kmSplitUtterance(completedKm: number, paceSecPerKm: number): PhraseUtterance {
  const kmId = `km_${clamp(completedKm, KM_SPLIT_MIN, KM_SPLIT_MAX)}`;
  const encIndex = (completedKm - 1) % ENC_MESSAGES.length;
  const encId = `enc_${encIndex}`;

  const ids = [kmId];
  let paceStr = '';
  if (paceSecPerKm > 0) {
    // Clip-tempo: seconden afgerond op 5, met overloop naar de minuut.
    let totalSec = Math.round(paceSecPerKm);
    let min = Math.floor(totalSec / 60);
    let sec = Math.round((totalSec % 60) / PACE_SEC_STEP) * PACE_SEC_STEP;
    if (sec === 60) { sec = 0; min += 1; }
    min = clamp(min, PACE_MIN_MIN, PACE_MIN_MAX);
    ids.push(`pace_${min}_${sec}`);

    // Fallback-tempo: exact, niet afgerond (huidig gedrag).
    const paceMin = Math.floor(paceSecPerKm / 60);
    const paceSec = Math.round(paceSecPerKm % 60);
    paceStr = `, tempo ${paceMin} minuten en ${paceSec} seconden per kilometer`;
  }
  ids.push(encId);

  const encouragement = ENC_MESSAGES[encIndex];
  return {
    ids,
    fallbackText: `${completedKm} kilometer${paceStr}. ${encouragement}`,
  };
}

/**
 * Halverwege de geplande sessieafstand (niet te verwarren met de
 * routevoortgang van useRouteCoaching, zie milestoneUtterance). Zin: ids
 * [halfway, rem_X] — zie de toelichting bij HALFWAY_TEXT hierboven.
 */
export function halfwayUtterance(remainingKm: number): PhraseUtterance {
  const remId = `rem_${halfStepSuffix(roundHalfClamped(remainingKm, KM_RANGE_MIN, KM_RANGE_MAX))}`;
  const remaining = remainingKm.toFixed(1);
  return {
    ids: ['halfway', remId],
    fallbackText: `Halverwege! Nog ${remaining} kilometer te gaan. Je doet het geweldig.`,
  };
}

/**
 * Sessie voltooid: "Sessie voltooid! Je hebt 8,23 kilometer gelopen in 52
 * minuten. Geweldig gedaan!" Tijd in de clip-versie in hele/vijf minuten
 * (zie TIME_FINE_MAX/TIME_STEP_ABOVE), de fallback-tijd blijft exact
 * (minuten + seconden, huidig gedrag).
 */
export function finishUtterance(distanceKm: number, durationSeconds: number): PhraseUtterance {
  const distId = `dist_${halfStepSuffix(roundHalfClamped(distanceKm, KM_RANGE_MIN, KM_RANGE_MAX))}`;

  const totalMinutes = durationSeconds / 60;
  let timeMin = totalMinutes <= TIME_FINE_MAX
    ? Math.round(totalMinutes)
    : Math.round(totalMinutes / TIME_STEP_ABOVE) * TIME_STEP_ABOVE;
  timeMin = clamp(timeMin, 1, TIME_MAX);
  const timeId = `time_${timeMin}`;

  const km = distanceKm.toFixed(2);
  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;
  const timeStr = secs > 0 ? `${mins} minuten en ${secs} seconden` : `${mins} minuten`;

  return {
    ids: ['finish', distId, timeId, 'well_done'],
    fallbackText: `Sessie voltooid! Je hebt ${km} kilometer gelopen in ${timeStr}. Geweldig gedaan!`,
  };
}

/** Hartslagzone-overgang: "Zone 3. Tempozone. Uitdagend maar houdbaar." */
export function zoneUtterance(zone: string): PhraseUtterance {
  const desc = ZONE_DESCRIPTIONS[zone] ?? zone;
  const fallbackText = `Zone ${zone}. ${desc}`;
  // Onbekende/onverwachte zone-waarde: geen catalogusclip, alleen fallback
  // (verdedigend — kan in theorie niet gebeuren, ZONE_IDS dekt Z1..Z5).
  if (!(zone in ZONE_DESCRIPTIONS)) return { ids: [], fallbackText };
  return { ids: [`zone_${zone}`], fallbackText };
}

/** Hartslagcoaching: één van de drie vaste meldingen. */
export function hrUtterance(kind: 'high' | 'low' | 'ok'): PhraseUtterance {
  return { ids: [`hr_${kind}`], fallbackText: HR_TEXTS[kind] };
}

/**
 * Routevoortgangsmijlpaal (25/50/75% van de UITGESTIPPELDE route, zie
 * useRouteCoaching): "Een kwart van je route voltooid. Nog 7,5 kilometer te
 * gaan."
 */
export function milestoneUtterance(pct: 25 | 50 | 75, remainingKm: number): PhraseUtterance {
  const remId = `rem_${halfStepSuffix(roundHalfClamped(remainingKm, KM_RANGE_MIN, KM_RANGE_MAX))}`;
  const remaining = remainingKm.toFixed(1);
  return {
    ids: [`mile_${pct}`, remId],
    fallbackText: `${MILE_TEXTS[pct]} Nog ${remaining} kilometer te gaan.`,
  };
}

/**
 * Herkent het afslagtype uit de (al naar het Nederlands vertaalde)
 * instructietekst — dezelfde patronen als toNl() in routeService.ts.
 * Onherkend → null (dan spreekt alleen de fallback, geen catalogusclip).
 */
function detectTurnType(instructionText: string): string | null {
  const haystack = instructionText.toLowerCase();
  for (const [pattern, id] of TURN_PATTERNS) {
    if (haystack.includes(pattern)) return id;
  }
  return null;
}

/**
 * Turn-by-turn navigatie-aankondiging. Geen straatnamen in de clip-ids
 * (privacy/eindigheid) — de fallbackText bevat wel de volledige
 * instructietekst (incl. eventuele straatnaam) met dezelfde "Over X meter: "
 * -prefix als het huidige gedrag. `distM` is hier al de afgeronde afstand
 * (of undefined als er geen afstandsprefix gebruikt wordt) — zie de
 * aanroep in useRouteCoaching.ts. Onherkend instructietype → ids: [].
 */
export function navUtterance(instructionText: string, distM?: number): PhraseUtterance {
  const prefix = distM !== undefined ? `Over ${distM} meter: ` : '';
  const fallbackText = `${prefix}${instructionText}`;

  const turnId = detectTurnType(instructionText);
  if (!turnId) return { ids: [], fallbackText };

  const ids: string[] = [];
  if (distM !== undefined) {
    const rounded = clamp(Math.round(distM / 10) * 10, DIST_M_MIN, DIST_M_MAX);
    ids.push(`dist_m_${rounded}`);
  }
  ids.push(turnId);

  return { ids, fallbackText };
}

/** Onboarding-begroeting (stemkeuzescherm). */
export function greetingUtterance(): PhraseUtterance {
  return { ids: ['greeting'], fallbackText: FIXED_TEXTS.greeting };
}

/** Stem-preview in de instellingen. */
export function previewUtterance(): PhraseUtterance {
  return { ids: ['preview'], fallbackText: FIXED_TEXTS.preview };
}
