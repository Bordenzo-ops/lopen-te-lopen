/**
 * raceDetails
 *
 * Extra gegevens per wedstrijd die niet in de racelijst (`rotterdamRaces.ts`)
 * horen: parcoursinfo en een indicatief startvak-advies. Gekoppeld via
 * race-`id`, zodat de racelijst zelf (die ook van een server kan komen) niet
 * hoeft mee te veranderen. Een nieuwe race uitwerken = een entry toevoegen in
 * RACE_DETAILS; een race zonder entry krijgt op de racepagina gewoon de
 * basisgegevens uit de racelijst.
 *
 * Dit bestand is PUUR (geen React): de countdown-berekening staat hier ook,
 * zodat dashboardwidget, racepagina en deelkaart exact hetzelfde getal tonen.
 */

import { parseLocalISODate } from './raceSchedule';

// ── Bronnen die Lars nog moet invullen ──────────────────────────────────────

/**
 * TODO(Lars): bron voor de officiële startvak-indeling en het parcours van
 * Marathon Rotterdam (bijv. de pagina van de organisator met de
 * startvak-indeling per verwachte eindtijd). Zolang dit een TODO is, tonen we
 * het advies nadrukkelijk als "indicatief" en verzinnen we GEEN officiële
 * vaknamen of tijdgrenzen.
 */
export const ROTTERDAM_START_BLOCK_SOURCE_TODO: string | null = null;

// ── Types ───────────────────────────────────────────────────────────────────

export interface CourseFact {
  label: string;
  value: string;
}

/** Eén indicatieve groep in het startadvies: loopt tot `maxSeconds` (exclusief). */
export interface StartWave {
  /** Bovengrens van de doeltijd in seconden; null = alles daarboven. */
  maxSeconds: number | null;
  /** Beschrijvend (geen officiële vaknaam): "Voorin", "Middenveld", ... */
  label: string;
  hint: string;
}

export interface StartAdvice {
  waves: StartWave[];
  /** Officiële bron voor de echte indeling; null = nog in te vullen (TODO). */
  sourceUrl: string | null;
  /** Disclaimer onder het advies. */
  note: string;
}

export interface RaceDetails {
  raceId: string;
  /** Korte stad-/eventnaam voor deelkaart en widget, bijv. "Rotterdam". */
  shortName: string;
  courseFacts: CourseFact[];
  courseHighlights: string[];
  startAdvice?: StartAdvice;
}

// ── Data ────────────────────────────────────────────────────────────────────

const hm = (hours: number, minutes = 0) => hours * 3600 + minutes * 60;

/**
 * Indicatieve marathon-groepen op doeltijd. Bewust algemeen: dit is NIET de
 * officiële Rotterdam-indeling, maar een vuistregel (hoe sneller je verwachte
 * eindtijd, hoe verder naar voren).
 */
const MARATHON_WAVES: StartWave[] = [
  { maxSeconds: hm(3),     label: 'Helemaal voorin', hint: 'Je loopt een snel, strak tempo. Voorin starten voorkomt dat je langzamere lopers moet passeren.' },
  { maxSeconds: hm(3, 30), label: 'Voorin',          hint: 'Start in de voorste groepen en ga de eerste kilometers niet te snel van start.' },
  { maxSeconds: hm(4),     label: 'Voorste helft',   hint: 'Zoek je plek in de voorste helft van het veld, rond jouw tempogroep.' },
  { maxSeconds: hm(4, 30), label: 'Middenveld',      hint: 'Het middenveld past bij jouw tempo. Laat je niet meeslepen door het gedrang in het begin.' },
  { maxSeconds: hm(5),     label: 'Achterste helft', hint: 'Start rustig in de achterste helft, dan loop je ontspannen jouw eigen race.' },
  { maxSeconds: null,      label: 'Achteraan',       hint: 'Start achteraan en neem de tijd. Genieten staat voorop, de sfeer onderweg is de beloning.' },
];

const MARATHON_START_NOTE =
  'Dit is een indicatief advies op basis van je doeltijd, geen officiële indeling. '
  + 'Welk startvak voor jou geldt, staat op je startbewijs en op de website van de organisator.';

export const RACE_DETAILS: Record<string, RaceDetails> = {
  'nn-marathon-rotterdam-2027': {
    raceId: 'nn-marathon-rotterdam-2027',
    shortName: 'Rotterdam',
    // TODO(Lars): controleer en vul aan met de officiële parcoursgegevens
    // (zie ROTTERDAM_START_BLOCK_SOURCE_TODO). Hieronder staat alleen wat al
    // in de racebeschrijving staat of algemeen bekend is.
    courseFacts: [
      { label: 'Afstand', value: '42,195 km' },
      { label: 'Profiel', value: 'Plat en snel' },
      { label: 'Erkenning', value: 'World Athletics Platinum Label' },
      { label: 'Start en finish', value: 'Centrum Rotterdam' },
    ],
    courseHighlights: [
      'Een van de snelste marathons ter wereld: vlak, met brede straten.',
      'Je loopt over de Erasmusbrug, het icoon van de stad.',
      'Dikke sfeer langs de route, met veel publiek.',
    ],
    startAdvice: {
      waves: MARATHON_WAVES,
      sourceUrl: ROTTERDAM_START_BLOCK_SOURCE_TODO,
      note: MARATHON_START_NOTE,
    },
  },
};

export function getRaceDetails(raceId: string): RaceDetails | undefined {
  return RACE_DETAILS[raceId];
}

/** Zoekt de indicatieve startgroep bij een doeltijd in seconden. */
export function startWaveForTime(advice: StartAdvice, targetSeconds: number): StartWave {
  const wave = advice.waves.find(w => w.maxSeconds === null || targetSeconds < w.maxSeconds);
  return wave ?? advice.waves[advice.waves.length - 1];
}

// ── Countdown ───────────────────────────────────────────────────────────────

export interface RaceCountdown {
  /** Hele dagen tot de racedag (kalenderdagen, lokale tijd); negatief = geweest. */
  totalDays: number;
  weeks: number;
  /** Resterende dagen na de hele weken (0-6). */
  days: number;
  isToday: boolean;
  isPast: boolean;
}

/**
 * Kalenderdagen tot de wedstrijd. Rekent met LOKALE middernacht aan beide
 * kanten (zie parseLocalISODate), zodat het getal op de racedag zelf 0 is en
 * niet door tijdzone of tijdstip een dag afwijkt.
 */
export function raceCountdown(raceDate: string, today = new Date()): RaceCountdown {
  const race = parseLocalISODate(raceDate.slice(0, 10));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // Math.round vangt de 23/25-uursdagen rond de zomertijdwissel op.
  const totalDays = Math.round((race.getTime() - start.getTime()) / 86400000);
  const abs = Math.max(0, totalDays);
  return {
    totalDays,
    weeks: Math.floor(abs / 7),
    days: abs % 7,
    isToday: totalDays === 0,
    isPast: totalDays < 0,
  };
}

/** "12 weken en 3 dagen", "1 week", "5 dagen" — voor lopende tekst. */
export function countdownText(c: RaceCountdown): string {
  if (c.isPast) return 'Deze race is geweest';
  if (c.isToday) return 'Vandaag is het zover!';
  const weekPart = c.weeks > 0 ? `${c.weeks} ${c.weeks === 1 ? 'week' : 'weken'}` : '';
  const dayPart = c.days > 0 ? `${c.days} ${c.days === 1 ? 'dag' : 'dagen'}` : '';
  return [weekPart, dayPart].filter(Boolean).join(' en ');
}
