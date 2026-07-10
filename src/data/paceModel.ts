/**
 * paceModel
 *
 * Persoonlijk tempo-model voor het wedstrijdgerichte trainingsschema.
 *
 * Idee: de gebruiker geeft een doeltijd (of een doeltempo) op voor een
 * wedstrijd. Daaruit leiden we per trainingssessie een verdedigbaar
 * trainingstempo af. De hartslagzones en afstanden blijven exact gelijk; dit
 * model voegt alleen tempo-informatie toe.
 *
 * Aannames (bewust eenvoudig en verdedigbaar):
 *
 * 1. Het doel-racetempo is de totale doeltijd gedeeld door de wedstrijdafstand.
 *    Bijvoorbeeld 2:00:00 over 21,1 km = 7200 s / 21,1 km, ongeveer 341 s/km,
 *    oftewel 5:41 per km.
 *
 * 2. Per sessietype rekenen we een factor op het racetempo. Een factor groter
 *    dan 1 betekent langzamer dan racetempo (meer seconden per km), een factor
 *    kleiner dan 1 sneller. De factoren volgen de gangbare trainingsleer
 *    (vergelijkbaar met Daniels en McMillan, maar bewust afgerond en simpel):
 *
 *      - easy  (rustige duurloop): 1.20, duidelijk langzamer dan racetempo.
 *                                  Het leeuwendeel van het volume hoort
 *                                  comfortabel te zijn.
 *      - long  (lange duurloop):   1.15, iets minder langzaam dan een easy,
 *                                  maar nog ruim onder racetempo.
 *      - tempo (tempoduurloop):    0.98, dicht bij of net onder racetempo;
 *                                  dit traint de wedstrijdsnelheid en de drempel.
 *      - cross en rest:            geen looptempo (deze sessies hebben geen
 *                                  afstandstempo).
 *
 *    Deze factoren zijn geen exacte fysiologie maar geven een herkenbare,
 *    nuttige richtlijn die nooit blokkeert.
 *
 * 3. Realiteitshint: voor een beginner is een heel laag racetempo (zeer snel)
 *    onrealistisch. We tonen een vriendelijke, NIET-blokkerende opmerking als
 *    het doel-racetempo onder een drempel ligt. De gebruiker mag altijd door.
 */

import type { Session } from './trainingPlans';
import type { RaceDistance } from './rotterdamRaces';

/**
 * Officiele afstand in kilometer per wedstrijdcategorie. Gebruikt om uit de
 * doeltijd het racetempo te berekenen.
 */
export const RACE_DISTANCE_KM: Record<RaceDistance, number> = {
  '5km':           5,
  '10km':          10,
  '15km':          15,
  'half_marathon': 21.0975,
  'marathon':      42.195,
};

/** Geeft de wedstrijdafstand in km voor een RaceDistance-categorie. */
export function raceDistanceToKm(distance: RaceDistance): number {
  return RACE_DISTANCE_KM[distance];
}

// Tempo-factoren per sessietype.
// Factor op het racetempo (sec/km). Groter dan 1 is langzamer, kleiner is sneller.
const PACE_FACTORS: Partial<Record<Session['type'], number>> = {
  easy:  1.20,
  long:  1.15,
  tempo: 0.98,
  // 'rest' en 'cross' krijgen geen looptempo.
};

/**
 * Bereken het doel-racetempo in seconden per kilometer.
 *
 * @param targetSeconds  Totale doeltijd voor de wedstrijd in seconden.
 * @param raceKm         Wedstrijdafstand in kilometer (bijv. 21.1).
 * @returns              Racetempo in sec/km, of null bij ongeldige invoer.
 */
export function racePaceSecPerKm(targetSeconds: number, raceKm: number): number | null {
  if (!Number.isFinite(targetSeconds) || !Number.isFinite(raceKm)) return null;
  if (targetSeconds <= 0 || raceKm <= 0) return null;
  return targetSeconds / raceKm;
}

/**
 * Leid het trainingstempo voor een sessietype af van het racetempo.
 *
 * @param raceSecPerKm  Doel-racetempo in sec/km.
 * @param type          Sessietype.
 * @returns             Trainingstempo in sec/km, of null als het type geen
 *                      looptempo heeft (rest of cross) of bij ongeldige invoer.
 */
export function trainingPaceSecPerKm(
  raceSecPerKm: number,
  type: Session['type'],
): number | null {
  if (!Number.isFinite(raceSecPerKm) || raceSecPerKm <= 0) return null;
  const factor = PACE_FACTORS[type];
  if (factor === undefined) return null;
  return Math.round(raceSecPerKm * factor);
}

/**
 * Gemak: bereken direct het trainingstempo voor een sessie uit de doeltijd.
 *
 * @param targetSeconds  Totale doeltijd voor de wedstrijd in seconden.
 * @param raceKm         Wedstrijdafstand in kilometer.
 * @param type           Sessietype.
 * @returns              Trainingstempo in sec/km, of null als er geen tempo is.
 */
export function sessionTrainingPace(
  targetSeconds: number,
  raceKm: number,
  type: Session['type'],
): number | null {
  const race = racePaceSecPerKm(targetSeconds, raceKm);
  if (race === null) return null;
  return trainingPaceSecPerKm(race, type);
}

// Formatteren en parsen

/**
 * Formatteer een tempo (sec/km) als "m:ss /km", bijvoorbeeld "5:41 /km".
 * Geeft een streepje terug bij ongeldige of nul-waarden.
 */
export function formatPacePerKm(secPerKm: number | null | undefined): string {
  if (secPerKm === null || secPerKm === undefined || !Number.isFinite(secPerKm) || secPerKm <= 0) {
    return '--:-- /km';
  }
  const total = Math.round(secPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

/**
 * Formatteer een totale tijd in seconden als "u:mm:ss" of "m:ss".
 * Geeft een streepje terug bij ongeldige waarden.
 */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '--:--';
  }
  const t = Math.round(totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Parse een tijd-string naar totaal aantal seconden.
 *
 * Accepteert "uu:mm:ss", "u:mm:ss", "mm:ss" en "m:ss". Spaties worden genegeerd.
 * Geeft null terug bij ongeldige invoer (bijvoorbeeld minuten of seconden
 * groter dan of gelijk aan 60).
 *
 * @param value  Tijd-string, bijvoorbeeld "1:45:00" of "5:30".
 */
export function parseTimeToSeconds(value: string): number | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;

  const parts = trimmed.split(':').map(p => p.trim());
  if (parts.length < 2 || parts.length > 3) return null;
  if (parts.some(p => p === '' || !/^\d+$/.test(p))) return null;

  const nums = parts.map(Number);

  let h = 0, m = 0, s = 0;
  if (nums.length === 3) {
    [h, m, s] = nums;
  } else {
    [m, s] = nums;
  }

  // Minuten en seconden moeten geldige klok-eenheden zijn.
  if (s >= 60 || (nums.length === 3 && m >= 60)) return null;

  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : null;
}

/**
 * Parse een tempo-string ("mm:ss" per km) naar seconden per kilometer.
 * Geeft null terug bij ongeldige invoer.
 *
 * @param value  Tempo-string, bijvoorbeeld "5:30".
 */
export function parsePaceToSecPerKm(value: string): number | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;

  const parts = trimmed.split(':').map(p => p.trim());
  if (parts.length !== 2) return null;
  if (parts.some(p => p === '' || !/^\d+$/.test(p))) return null;

  const [m, s] = parts.map(Number);
  if (s >= 60) return null;

  const total = m * 60 + s;
  return total > 0 ? total : null;
}

/**
 * Reken een doeltempo (sec/km) om naar een totale doeltijd (seconden) voor een
 * gegeven wedstrijdafstand.
 */
export function paceToTargetSeconds(paceSecPerKm: number, raceKm: number): number | null {
  if (!Number.isFinite(paceSecPerKm) || !Number.isFinite(raceKm)) return null;
  if (paceSecPerKm <= 0 || raceKm <= 0) return null;
  return Math.round(paceSecPerKm * raceKm);
}

// Realiteitshint

/**
 * Minimaal verdedigbaar racetempo (sec/km) voordat we het voor een beginner
 * als optimistisch beschouwen. 4:00 per km (240 s/km) is voor recreatieve
 * lopers al zeer snel; daaronder tonen we een vriendelijke hint. Dit blokkeert
 * nooit.
 */
const OPTIMISTIC_PACE_THRESHOLD = 240; // 4:00 per km

/**
 * Geeft een vriendelijke, NIET-blokkerende hint als de doeltijd erg snel lijkt
 * voor een beginner. Retourneert null als het doel realistisch oogt.
 *
 * @param targetSeconds  Totale doeltijd in seconden.
 * @param raceKm         Wedstrijdafstand in km.
 */
export function realismHint(targetSeconds: number, raceKm: number): string | null {
  const race = racePaceSecPerKm(targetSeconds, raceKm);
  if (race === null) return null;
  if (race < OPTIMISTIC_PACE_THRESHOLD) {
    return 'Dat is een stevig ambitieus doeltempo. Het mag, maar wees mild voor jezelf: kijk hoe het voelt en stel het gerust bij.';
  }
  return null;
}
