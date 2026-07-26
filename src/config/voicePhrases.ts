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
 * `allPhrases()` enumereert ALLE clips die het generatiescript met
 * ElevenLabs moet aanmaken (729 stuks sinds fase E, zie de "Uitbreiding"-
 * sectie onderaan het ontwerpdoc). De compositiefuncties hieronder
 * (`kmSplitUtterance`, `finishUtterance`, enz.) bepalen welke clip-ids een
 * concrete boodschap tijdens het lopen gebruikt, plús de natuurlijke
 * volzin als vangnet.
 *
 * Afronding van dynamische delen is bewust ruw: het scherm toont exacte
 * waarden, de stem mag "ongeveer" zeggen. Zo blijft het aantal clips
 * eindig terwijl de gesproken boodschap toch natuurlijk klinkt. Zie de
 * toelichting bij elke groep hieronder.
 */

import { getAllRaces } from '../data/rotterdamRaces';

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
// LET OP: index 0-5 zijn de OORSPRONKELIJKE zes teksten en blijven letterlijk
// staan — hun clips zijn al gegenereerd. Index 6-23 zijn de fase E-uitbreiding
// (18 nieuwe teksten, zelfde toon/lengte). De bestaande roulatie
// `(completedKm - 1) % ENC_MESSAGES.length` in kmSplitUtterance hieronder
// werkt ongewijzigd door met de langere lijst.
const ENC_MESSAGES = [
  'Goed bezig, houd dit tempo aan.',
  'Super! Blijf gelijkmatig lopen.',
  'Uitstekend! Je loopt geweldig.',
  'Fantastisch! Je bent sterk.',
  'Geweldig! Bijna bij het doel.',
  'Ongelooflijk! Je bent een machine.',
  'Sterk gedaan, blijf dit tempo vasthouden.',
  'Knap! Je loopt heel gelijkmatig.',
  'Wat een kracht, hou dit vast.',
  'Machtig! Je bent heerlijk bezig.',
  'Blijf zo doorgaan, het gaat goed.',
  'Topper! Dit tempo past bij je.',
  'Sterk bezig, hou deze lijn vast.',
  'Klasse! Je wordt steeds sterker.',
  'Volhouden, je bent bijna klaar.',
  'Indrukwekkend! Blijf zo lekker lopen.',
  'Je bent vandaag in topvorm.',
  'Prima tempo, hou dit erin.',
  'Wauw! Dit gaat je lukken.',
  'Sterke pas, blijf zo lopen.',
  'Chapeau! Je doet het fantastisch.',
  'Blijf ademen, blijf lopen, goed bezig.',
  'Kanjer! Nog even volhouden.',
  'Mooi ritme, ga zo verder.',
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

// ── 8. Hartslagcoaching — drie varianten per type (useHeartRateCoaching) ───
// Variant 0 van elk type is de OORSPRONKELIJKE tekst en blijft letterlijk
// staan (clip al gegenereerd als hr_high/hr_low/hr_ok — wordt bij de
// hernummering naar hr_{type}_0 opnieuw aangemaakt, zie generatiescript).
// Varianten 1/2 zijn de fase E-uitbreiding: zelfde strekking, andere
// woorden, zodat een gebruiker die vaker dezelfde coaching-melding hoort
// niet steeds identieke zinnen krijgt. useHeartRateCoaching.ts rouleert
// hierdoor per type met een eigen teller.
const HR_TEXTS: Record<'high' | 'low' | 'ok', [string, string, string]> = {
  high: [
    'Je hartslag is wat hoog voor deze training. Doe een stapje terug.',
    'Je zit boven je doelzone. Rustig aan, bouw het tempo af.',
    'Even gas terugnemen, je hartslag loopt op. Zoek je ritme weer.',
  ],
  low: [
    'Je hebt nog ruimte. Je mag iets versnellen.',
    'Je hartslag is nog laag. Je kunt best wat sneller.',
    'Er zit meer in. Voel je vrij om te versnellen.',
  ],
  ok: [
    'Mooi zo, precies goed.',
    'Prima tempo, dit is precies je zone.',
    'Goed zo, je zit weer helemaal in het juiste ritme.',
  ],
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

// ── 12. Vast — finish/well_done/greeting/preview/have_fun ───────────────────
const FIXED_TEXTS: Record<string, string> = {
  finish:    'Sessie voltooid!',
  well_done: 'Geweldig gedaan!',
  greeting:  'Hoi! Ik ben je hardloopcoach. Samen gaan we trainen.',
  preview:   'Hoi! Ik ben je hardloopcoach. Zo klink ik tijdens het lopen.',
  have_fun:  'Veel plezier!',
};

// ── 13. Sessie-intro — gesproken bij de start van een geplande sessie ──────
// Eén clip per trainingstype (rest-dagen worden nooit "gelopen" en krijgen
// dus geen intro, zie de aanroep in app/session/active.tsx).
const INTRO_TEXTS: Record<'easy' | 'tempo' | 'long' | 'cross', string> = {
  easy:  'Vandaag: een rustige duurloop.',
  tempo: 'Vandaag: een tempotraining.',
  long:  'Vandaag: een lange duurloop.',
  cross: 'Vandaag: een crosstraining.',
};

// ── 14. Doel — "Het doel is ongeveer 8,5 kilometer." ────────────────────────
// Zelfde halve-kilometersystematiek als rem_/dist_ hierboven (KM_RANGE_MIN..
// KM_RANGE_MAX, stappen van 0,5 km) — vergt dus geen eigen grenzen/helpers.

// ── 15b. Dagdeel-begroeting bij sessiestart — fase E-uitbreiding (CP4) ──────
// Twee tekstvarianten per dagdeel zodat de begroeting niet elke run identiek
// klinkt (zelfde rouleeropzet als ENC_MESSAGES/HR_TEXTS). Het dagdeel zelf
// wordt bepaald door de aanroeper (new Date().getHours(), zie active.tsx) —
// hier alleen de teksten en de grenzen in greetingForSessionStart hieronder.
const GREET_TEXTS: Record<'morning' | 'afternoon' | 'evening', [string, string]> = {
  morning:   ['Goedemorgen! Klaar voor je ochtendrun?', 'Goedemorgen! Tijd om de dag sportief te beginnen.'],
  afternoon: ['Goedemiddag! Klaar voor je training?', 'Goedemiddag! Mooi moment voor een run.'],
  evening:   ['Goedenavond! Klaar om nog even te lopen?', 'Goedenavond! Laten we deze dag sportief afsluiten.'],
};

// ── 15c. Finish-afsluiters — fase E-uitbreiding (CP4) ───────────────────────
// Index 0 ("Geweldig gedaan!") is de OORSPRONKELIJKE tekst en blijft
// letterlijk staan — zijn clip-id is en blijft 'well_done' (zie FIXED_TEXTS),
// niet hernoemen. Index 1-3 zijn de nieuwe varianten (finish_var_1..3, zie
// allPhrases hieronder); finishUtterance rouleert erover.
const FINISH_CLOSERS: [string, string, string, string] = [
  'Geweldig gedaan!',
  'Wat een prestatie!',
  'Dat heb je verdiend!',
  'Knap gelopen!',
];

// ── 15. Race-felicitaties — "Gefeliciteerd! Je hebt {race} uitgelopen!" ────
// Eén clip per wedstrijd uit rotterdamRaces.ts. getAllRaces() geeft de
// daadwerkelijk kiesbare "bladwedstrijden" terug (bij een evenement met
// subRaces tellen alleen die subRaces mee, niet de groepsrace zelf — precies
// wat een gebruiker in de racekiezer selecteert, zie buildRacePlan.ts). Begint
// de naam zelf al met een lidwoord ("De ..."/"Het ..."), dan geen extra "de"
// ervoor (zie raceNamePhrase).
const RACE_LIST = getAllRaces();

/**
 * Voegt "de" toe vóór een wedstrijdnaam, tenzij die zelf al met een lidwoord
 * begint (case-insensitief op "de"/"het", zodat "De Gouden Loop" niet
 * "de De Gouden Loop" wordt).
 */
function raceNamePhrase(raceName: string): string {
  return /^(de|het)\s/i.test(raceName) ? raceName : `de ${raceName}`;
}

// ── 16. Interval-cues — gesproken cues tijdens een intervaltraining ─────────
// Aparte cue-groep naast INTRO_TEXTS: 'interval' is geen gewoon trainingstype
// uit die tabel maar krijgt een eigen intro (intro_interval, via
// intervalIntroUtterance) en een eigen set cues die tíjdens het lopen klinken
// (warming-up, aftellen, aanzetten, halverwege, laatste tien seconden,
// herstellen, halverwege de reeks, cooling-down). Waar herhaling anders saai
// zou worden staan meerdere varianten die rouleren (zelfde rouleeropzet als
// ENC_MESSAGES/HR_TEXTS/GREET_TEXTS hierboven, modulo op de lengte van de
// lijst). "Drie, twee, één." (iv_countdown) is een vaste clip die vóór elke
// "ga"-cue klinkt; in de fallbackText schrijven we "een" zonder trema (leest
// voor de telefoonstem prettiger), de clip-tekst zelf houdt het trema aan.
const INTRO_INTERVAL_TEXT =
  'Vandaag: een intervaltraining. We wisselen stevige inspanning af met rustig herstel. Ik tel je overal doorheen, jij hoeft alleen maar te lopen.';

const IV_COUNTDOWN_FALLBACK = 'Drie, twee, een.';

const IV_FIXED_TEXTS: Record<string, string> = {
  iv_warmup: 'We beginnen met een rustige warming-up. Loop losjes in en maak je lichaam wakker.',
  iv_countdown: 'Drie, twee, één.',
  iv_go_last: 'Laatste interval. Alles wat je hebt, geef het nu.',
  iv_work_half: 'Halverwege. Blijf sterk en houd je vorm vast.',
  iv_set_half: 'Je bent op de helft van je intervallen. Lekker bezig.',
  iv_cooldown: 'Dat waren al je intervallen, sterk gewerkt. We sluiten af met een rustige cooling-down. Loop losjes uit.',
};

const IV_GET_READY_TEXTS: [string, string] = [
  'Bijna. Maak je klaar voor de volgende versnelling.',
  'Zet je schrap, we gaan zo weer aan.',
];

const IV_GO_TEXTS: [string, string, string, string] = [
  'Gaan! Zet aan.',
  'Nu versnellen. Sterk en soepel.',
  'Volle focus, dit is jouw interval.',
  'Aanzetten! Voel de kracht in je benen.',
];

const IV_WORK_END_TEXTS: [string, string] = [
  'Nog tien seconden. Volhouden.',
  'Bijna, laatste tien tellen. Doorzetten.',
];

const IV_RECOVER_TEXTS: [string, string, string, string] = [
  'Mooi. Loop nu rustig uit en herstel.',
  'Goed gedaan. Adem diep en laat je hartslag zakken.',
  'Sterk. Dribbel rustig door, klaar voor de volgende.',
  'Knap. Even bijkomen, schud je armen los.',
];

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

  // 8. Hartslagcoaching — drie varianten per type
  (Object.keys(HR_TEXTS) as Array<keyof typeof HR_TEXTS>).forEach(key => {
    HR_TEXTS[key].forEach((text, i) => {
      phrases.push({ id: `hr_${key}_${i}`, text });
    });
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

  // 13. Sessie-intro
  (Object.keys(INTRO_TEXTS) as Array<keyof typeof INTRO_TEXTS>).forEach(type => {
    phrases.push({ id: `intro_${type}`, text: INTRO_TEXTS[type] });
  });

  // 14. Doel
  for (let km = KM_RANGE_MIN; km <= KM_RANGE_MAX + 1e-9; km += 0.5) {
    phrases.push({
      id: `goal_${halfStepSuffix(km)}`,
      text: `Het doel is ongeveer ${formatHalfKm(km)} kilometer.`,
    });
  }

  // 15. Race-felicitaties
  RACE_LIST.forEach(race => {
    phrases.push({
      id: `race_${race.id}`,
      text: `Gefeliciteerd! Je hebt ${raceNamePhrase(race.name)} uitgelopen!`,
    });
  });

  // 15b. Dagdeel-begroeting
  (Object.keys(GREET_TEXTS) as Array<keyof typeof GREET_TEXTS>).forEach(period => {
    GREET_TEXTS[period].forEach((text, i) => {
      phrases.push({ id: `greet_${period}_${i}`, text });
    });
  });

  // 15c. Finish-afsluiters — index 0 is 'well_done' (al in FIXED_TEXTS), dus
  // hier alleen de 3 nieuwe varianten.
  FINISH_CLOSERS.slice(1).forEach((text, i) => {
    phrases.push({ id: `finish_var_${i + 1}`, text });
  });

  // 16. Interval-cues
  phrases.push({ id: 'intro_interval', text: INTRO_INTERVAL_TEXT });
  Object.entries(IV_FIXED_TEXTS).forEach(([id, text]) => {
    phrases.push({ id, text });
  });
  IV_GET_READY_TEXTS.forEach((text, i) => {
    phrases.push({ id: `iv_get_ready_${i}`, text });
  });
  IV_GO_TEXTS.forEach((text, i) => {
    phrases.push({ id: `iv_go_${i}`, text });
  });
  IV_WORK_END_TEXTS.forEach((text, i) => {
    phrases.push({ id: `iv_work_end_${i}`, text });
  });
  IV_RECOVER_TEXTS.forEach((text, i) => {
    phrases.push({ id: `iv_recover_${i}`, text });
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
 *
 * `variant` rouleert de afsluitzin (0 = "Geweldig gedaan!"/well_done, 1-3 de
 * fase E-varianten finish_var_1..3) zodat een gebruiker die vaak loopt niet
 * elke keer exact dezelfde felicitatie hoort — zie CP4 in
 * Elevenlabs-creditplan-aug-2026.md. De aanroeper (useVoiceGuidance) geeft
 * hiervoor het aantal voltooide sessies mee; deze functie klemt zelf modulo 4.
 */
export function finishUtterance(
  distanceKm: number,
  durationSeconds: number,
  variant: number = 0,
): PhraseUtterance {
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

  const idx = ((variant % 4) + 4) % 4;
  const closerId = idx === 0 ? 'well_done' : `finish_var_${idx}`;
  const closerText = FINISH_CLOSERS[idx];

  return {
    ids: ['finish', distId, timeId, closerId],
    fallbackText: `Sessie voltooid! Je hebt ${km} kilometer gelopen in ${timeStr}. ${closerText}`,
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

/**
 * Hartslagcoaching: één van de drie types, met een variant (0/1/2) zodat
 * herhaalde meldingen van hetzelfde type niet steeds identiek klinken. De
 * aanroeper (useHeartRateCoaching) rouleert de variant per type. Een
 * ongeldige/ontbrekende variant klemt terug naar 0..2 (modulo), zodat deze
 * functie nooit een niet-bestaande clip-id kan opleveren.
 */
export function hrUtterance(kind: 'high' | 'low' | 'ok', variant: number = 0): PhraseUtterance {
  const idx = ((variant % 3) + 3) % 3;
  return { ids: [`hr_${kind}_${idx}`], fallbackText: HR_TEXTS[kind][idx] };
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

/**
 * Dagdeel-begroeting bij sessiestart (fase E, CP4): "Goedemorgen! Klaar voor
 * je ochtendrun?" `hour` is 0-23 (de aanroeper geeft new Date().getHours()
 * mee — als parameter in plaats van intern opgevraagd, zodat deze functie
 * deterministisch test-baar blijft). Grenzen: ochtend 5-11, middag 12-17,
 * avond 18-4 (nacht/vroege ochtend telt als avond — geen aparte "nacht"-
 * variant, dat zou de catalogus vergroten voor een zeldzaam moment). `variant`
 * rouleert (modulo 2), zelfde opzet als de aanmoedigingen.
 */
export function greetingForSessionStart(hour: number, variant: number = 0): PhraseUtterance {
  const period: 'morning' | 'afternoon' | 'evening' =
    hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening';
  const idx = ((variant % 2) + 2) % 2;
  return { ids: [`greet_${period}_${idx}`], fallbackText: GREET_TEXTS[period][idx] };
}

/**
 * Gesproken sessie-intro bij de start van een geplande sessie (fase E, zie
 * app/session/active.tsx): "Goedemorgen! Klaar voor je ochtendrun? Vandaag:
 * een tempotraining. Het doel is ongeveer 8,5 kilometer. Zone 3. Tempozone.
 * Uitdagend maar houdbaar. Veel plezier!"
 *
 * `zone` is optioneel en alleen gebruikt als hij een bekende ZONE_IDS-waarde
 * is — een onbekende/ontbrekende zone laat de zone-clip gewoon weg (net als
 * de rest van deze catalogus: nooit een niet-bestaande clip-id opleveren).
 * De fallbackText gebruikt de EXACTE sessieafstand (niet afgerond, in
 * tegenstelling tot de clip-versie via goal_X) zodat de telefoonstem-fallback
 * dezelfde precisie heeft als het scherm.
 *
 * `greeting` is optioneel (CP4): meegeven om de dagdeel-begroeting vóór de
 * intro te laten klinken, als ÉÉN doorlopende uitspraak (twee losse
 * speakPhrases-aanroepen zouden elkaar afkappen, zie de toelichting bij
 * finish/raceFinishUtterance in active.tsx). Zonder dit argument (bijv. de
 * race-felicitatie-tak, die geen sessie-intro gebruikt) verandert er niets
 * aan bestaand gedrag.
 */
export function sessionIntroUtterance(
  type: 'easy' | 'tempo' | 'long' | 'cross',
  distanceKm: number,
  zone?: string,
  greeting?: { hour: number; variant?: number },
): PhraseUtterance {
  const ids: string[] = [];
  let greetSentence = '';
  if (greeting) {
    const g = greetingForSessionStart(greeting.hour, greeting.variant);
    ids.push(...g.ids);
    greetSentence = `${g.fallbackText} `;
  }

  const goalId = `goal_${halfStepSuffix(roundHalfClamped(distanceKm, KM_RANGE_MIN, KM_RANGE_MAX))}`;
  ids.push(`intro_${type}`, goalId);

  const hasZone = !!zone && zone in ZONE_DESCRIPTIONS;
  if (hasZone) ids.push(`zone_${zone}`);
  ids.push('have_fun');

  const zoneSentence = hasZone ? ` ${zoneUtterance(zone as string).fallbackText}` : '';
  return {
    ids,
    // Nederlandse notatie met komma (bv. "7,5"), anders leest de telefoonstem
    // de punt voor als "punt".
    fallbackText: `${greetSentence}${INTRO_TEXTS[type]} Het doel is ongeveer ${String(distanceKm).replace('.', ',')} kilometer.${zoneSentence} Veel plezier!`,
  };
}

/**
 * Race-felicitatie bij het uitlopen van de RACE-sessie van de laatste week
 * van een wedstrijdschema (fase E, zie app/session/active.tsx). Onbekende
 * `raceId` (race niet gevonden in rotterdamRaces.ts, bijvoorbeeld verwijderd
 * uit de racelijst na het bouwen van het schema) → `ids: []`, zodat er nooit
 * naar een niet-bestaande clip verwezen wordt; de fallbackText blijft wel
 * gewoon de volledige zin, met de meegegeven `raceName` (die zit al in het
 * opgeslagen racePlan, dus is altijd bekend ongeacht de catalogus).
 */
export function raceFinishUtterance(raceId: string, raceName: string): PhraseUtterance {
  const fallbackText = `Gefeliciteerd! Je hebt ${raceNamePhrase(raceName)} uitgelopen!`;
  const known = RACE_LIST.some(race => race.id === raceId);
  return { ids: known ? [`race_${raceId}`] : [], fallbackText };
}

/**
 * Gesproken intro bij de start van een intervalsessie (vervangt de gewone
 * sessie-intro voor type 'interval'). Optioneel met dagdeel-begroeting ervoor,
 * net als sessionIntroUtterance, en afgesloten met "Veel plezier!".
 */
export function intervalIntroUtterance(
  greeting?: { hour: number; variant?: number },
): PhraseUtterance {
  const ids: string[] = [];
  let greetSentence = '';
  if (greeting) {
    const g = greetingForSessionStart(greeting.hour, greeting.variant);
    ids.push(...g.ids);
    greetSentence = `${g.fallbackText} `;
  }

  ids.push('intro_interval', 'have_fun');

  return {
    ids,
    fallbackText: `${greetSentence}${INTRO_INTERVAL_TEXT} Veel plezier!`,
  };
}

/**
 * Eén interval-cue tijdens het lopen. `kind` bepaalt het moment; `opts.variant`
 * rouleert waar er varianten zijn (modulo), `opts.isLast` markeert de laatste
 * werkherhaling.
 */
export function intervalCueUtterance(
  kind: 'warmup' | 'getReady' | 'go' | 'workHalf' | 'workEnd' | 'recover' | 'setHalf' | 'cooldown',
  opts?: { variant?: number; isLast?: boolean },
): PhraseUtterance {
  const variant = opts?.variant ?? 0;

  switch (kind) {
    case 'warmup':
      return { ids: ['iv_warmup'], fallbackText: IV_FIXED_TEXTS.iv_warmup };

    case 'getReady': {
      const idx = ((variant % 2) + 2) % 2;
      return { ids: [`iv_get_ready_${idx}`], fallbackText: IV_GET_READY_TEXTS[idx] };
    }

    case 'go': {
      if (opts?.isLast) {
        return {
          ids: ['iv_countdown', 'iv_go_last'],
          fallbackText: `${IV_COUNTDOWN_FALLBACK} ${IV_FIXED_TEXTS.iv_go_last}`,
        };
      }
      const idx = ((variant % 4) + 4) % 4;
      return {
        ids: ['iv_countdown', `iv_go_${idx}`],
        fallbackText: `${IV_COUNTDOWN_FALLBACK} ${IV_GO_TEXTS[idx]}`,
      };
    }

    case 'workHalf':
      return { ids: ['iv_work_half'], fallbackText: IV_FIXED_TEXTS.iv_work_half };

    case 'workEnd': {
      const idx = ((variant % 2) + 2) % 2;
      return { ids: [`iv_work_end_${idx}`], fallbackText: IV_WORK_END_TEXTS[idx] };
    }

    case 'recover': {
      const idx = ((variant % 4) + 4) % 4;
      return { ids: [`iv_recover_${idx}`], fallbackText: IV_RECOVER_TEXTS[idx] };
    }

    case 'setHalf':
      return { ids: ['iv_set_half'], fallbackText: IV_FIXED_TEXTS.iv_set_half };

    case 'cooldown':
      return { ids: ['iv_cooldown'], fallbackText: IV_FIXED_TEXTS.iv_cooldown };
  }
}
