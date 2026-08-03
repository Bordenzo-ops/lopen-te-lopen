/**
 * raceDataSchema
 *
 * Vorm en validatie van het racedocument dat een externe agent wekelijks of
 * maandelijks publiceert in een publieke Supabase Storage-bucket (zie
 * `raceDataService.ts`). Dit bestand is bewust PUUR: geen imports uit
 * `expo-*` of `react*`, zodat het ook rechtstreeks in Node door het
 * generatiescript van die agent gebruikt kan worden om zijn eigen output te
 * controleren voordat die gepubliceerd wordt.
 *
 * Ontwerpkeuze — "alles of niets": één ongeldige wedstrijd (verkeerd type,
 * ontbrekend veld, dubbel id, ...) maakt het HELE document ongeldig. Deze
 * data voedt rechtstreeks `buildRacePlan.ts` (de schemagenerator) en de
 * sessie-/finish-koppeling in de app, die beide op race-`id` vertrouwen. Een
 * document dat voor de helft is toegepast — bijvoorbeeld provincies met
 * wedstrijden, maar een enkele stad waar een wedstrijd stilzwijgend is
 * overgeslagen — is onvoorspelbaar en dus gevaarlijker dan gewoon vasthouden
 * aan de laatst bekende (gecachete of gebundelde) lijst. Vandaar: bij de
 * eerste fout stopt de validatie meteen en valt de aanroeper terug op de
 * vorige lijst.
 */

import type { Race, RaceCity, RaceProvince, RaceCountry, RaceDistance } from './rotterdamRaces';

/** Documentvorm zoals gepubliceerd op `.../app-data/races.json`. */
export interface RemoteRaceDocument {
  /** Formaatversie van dit document, zodat de app een toekomstig, onbekend formaat kan weigeren. */
  version: number;
  /** ISO-tijdstip waarop het document gegenereerd is; puur informatief/diagnostisch. */
  generatedAt: string;
  countries: RaceCountry[];
}

/** Hoogste documentversie die deze app-versie begrijpt. */
export const SUPPORTED_RACE_DOC_VERSION = 1;

export type RaceDocValidation =
  | { ok: true; doc: RemoteRaceDocument }
  | { ok: false; reason: string };

// Handmatig gesynchroniseerd met de RaceDistance-union in rotterdamRaces.ts.
// Kan geen `import` van een runtime-waarde zijn omdat dat bestand alleen een
// type exporteert; dit is de enige plek die de toegestane afstanden kent.
const ALLOWED_DISTANCES: ReadonlySet<RaceDistance> = new Set<RaceDistance>([
  '5km', '10km', '15km', 'half_marathon', 'marathon',
]);

// ── Kleine, generieke typebewakers ──────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// Alleen ISO-datumnotatie (bv. "2026-09-20" of "2026-09-20T10:00:00Z")
// toestaan, niet elke string die new Date() toevallig weet te parsen (zoals
// "04/13/2026" in Amerikaanse notatie). Daarna moet new Date() er ook echt
// een geldige datum uit kunnen halen.
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}([T ].*)?$/;

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

// ── Race-validatie ───────────────────────────────────────────────────────────

/**
 * Valideert één Race op `path`. `allowSubRaces` is false zodra we al binnen
 * een subRaces-array zitten: geneste subRaces (een subRace met een eigen
 * `subRaces`-veld) worden expliciet VERBODEN in plaats van stilzwijgend
 * genegeerd of recursief toegestaan. De UI rendert maar één niveau diep (een
 * sub-dropdown per evenement) en geen enkele bestaande wedstrijd in
 * `rotterdamRaces.ts` nest subRaces — een tweede niveau zou dus hoe dan ook
 * stilzwijgend zoekraken in de UI. Expliciet afkeuren maakt die aanname
 * zichtbaar in plaats van een onopgemerkte databug in het generatiescript.
 */
function validateRace(
  raw: unknown,
  path: string,
  allowSubRaces: boolean,
  seenIds: Map<string, string>,
): { ok: true; race: Race } | { ok: false; reason: string } {
  if (!isPlainObject(raw)) {
    return { ok: false, reason: `${path} is geen object` };
  }

  if (!isNonEmptyString(raw.id)) {
    return { ok: false, reason: `${path}.id ontbreekt of is geen niet-lege string` };
  }
  const id = raw.id;

  const existingPath = seenIds.get(id);
  if (existingPath) {
    return { ok: false, reason: `${path}.id ("${id}") is niet uniek — komt al voor op ${existingPath}` };
  }
  seenIds.set(id, path);

  if (!isNonEmptyString(raw.name)) {
    return { ok: false, reason: `${path}.name ontbreekt of is geen niet-lege string` };
  }
  if (!isNonEmptyString(raw.description)) {
    return { ok: false, reason: `${path}.description ontbreekt of is geen niet-lege string` };
  }
  if (!isNonEmptyString(raw.location)) {
    return { ok: false, reason: `${path}.location ontbreekt of is geen niet-lege string` };
  }
  if (!isNonEmptyString(raw.accentColor)) {
    return { ok: false, reason: `${path}.accentColor ontbreekt of is geen niet-lege string` };
  }
  if (!isValidIsoDate(raw.date)) {
    return { ok: false, reason: `${path}.date ("${String(raw.date)}") is geen geldige ISO-datum` };
  }
  if (typeof raw.distance !== 'string' || !ALLOWED_DISTANCES.has(raw.distance as RaceDistance)) {
    return { ok: false, reason: `${path}.distance ("${String(raw.distance)}") is geen geldige afstand` };
  }

  if (raw.url !== undefined && typeof raw.url !== 'string') {
    return { ok: false, reason: `${path}.url is aanwezig maar geen string` };
  }
  if (raw.registrationOpen !== undefined && typeof raw.registrationOpen !== 'boolean') {
    return { ok: false, reason: `${path}.registrationOpen is aanwezig maar geen boolean` };
  }
  if (raw.featured !== undefined && typeof raw.featured !== 'boolean') {
    return { ok: false, reason: `${path}.featured is aanwezig maar geen boolean` };
  }

  let subRaces: Race[] | undefined;
  if (raw.subRaces !== undefined) {
    if (!allowSubRaces) {
      return { ok: false, reason: `${path}.subRaces is niet toegestaan (geneste subRaces binnen subRaces)` };
    }
    if (!Array.isArray(raw.subRaces)) {
      return { ok: false, reason: `${path}.subRaces is aanwezig maar geen array` };
    }
    subRaces = [];
    for (let i = 0; i < raw.subRaces.length; i++) {
      const sub = validateRace(raw.subRaces[i], `${path}.subRaces[${i}]`, false, seenIds);
      if (!sub.ok) return sub;
      subRaces.push(sub.race);
    }
  }

  const race: Race = {
    id,
    name: raw.name,
    date: raw.date,
    distance: raw.distance as RaceDistance,
    description: raw.description,
    location: raw.location,
    accentColor: raw.accentColor,
    ...(raw.url !== undefined ? { url: raw.url as string } : {}),
    ...(raw.registrationOpen !== undefined ? { registrationOpen: raw.registrationOpen as boolean } : {}),
    ...(raw.featured !== undefined ? { featured: raw.featured as boolean } : {}),
    ...(subRaces !== undefined ? { subRaces } : {}),
  };
  return { ok: true, race };
}

// ── Stad / provincie / land ─────────────────────────────────────────────────

function validateCity(
  raw: unknown,
  path: string,
  seenIds: Map<string, string>,
): { ok: true; city: RaceCity; raceCount: number } | { ok: false; reason: string } {
  if (!isPlainObject(raw)) return { ok: false, reason: `${path} is geen object` };
  if (!isNonEmptyString(raw.id)) return { ok: false, reason: `${path}.id ontbreekt of is geen niet-lege string` };
  if (!isNonEmptyString(raw.name)) return { ok: false, reason: `${path}.name ontbreekt of is geen niet-lege string` };
  if (!Array.isArray(raw.races)) return { ok: false, reason: `${path}.races ontbreekt of is geen array` };

  const races: Race[] = [];
  for (let i = 0; i < raw.races.length; i++) {
    const result = validateRace(raw.races[i], `${path}.races[${i}]`, true, seenIds);
    if (!result.ok) return result;
    races.push(result.race);
  }

  return { ok: true, city: { id: raw.id, name: raw.name, races }, raceCount: races.length };
}

function validateProvince(
  raw: unknown,
  path: string,
  seenIds: Map<string, string>,
): { ok: true; province: RaceProvince; raceCount: number } | { ok: false; reason: string } {
  if (!isPlainObject(raw)) return { ok: false, reason: `${path} is geen object` };
  if (!isNonEmptyString(raw.id)) return { ok: false, reason: `${path}.id ontbreekt of is geen niet-lege string` };
  if (!isNonEmptyString(raw.name)) return { ok: false, reason: `${path}.name ontbreekt of is geen niet-lege string` };
  if (!Array.isArray(raw.cities)) return { ok: false, reason: `${path}.cities ontbreekt of is geen array` };

  const cities: RaceCity[] = [];
  let raceCount = 0;
  for (let i = 0; i < raw.cities.length; i++) {
    const result = validateCity(raw.cities[i], `${path}.cities[${i}]`, seenIds);
    if (!result.ok) return result;
    cities.push(result.city);
    raceCount += result.raceCount;
  }

  return { ok: true, province: { id: raw.id, name: raw.name, cities }, raceCount };
}

function validateCountry(
  raw: unknown,
  path: string,
  seenIds: Map<string, string>,
): { ok: true; country: RaceCountry; raceCount: number } | { ok: false; reason: string } {
  if (!isPlainObject(raw)) return { ok: false, reason: `${path} is geen object` };
  if (!isNonEmptyString(raw.id)) return { ok: false, reason: `${path}.id ontbreekt of is geen niet-lege string` };
  if (!isNonEmptyString(raw.name)) return { ok: false, reason: `${path}.name ontbreekt of is geen niet-lege string` };
  if (!Array.isArray(raw.provinces)) return { ok: false, reason: `${path}.provinces ontbreekt of is geen array` };

  const provinces: RaceProvince[] = [];
  let raceCount = 0;
  for (let i = 0; i < raw.provinces.length; i++) {
    const result = validateProvince(raw.provinces[i], `${path}.provinces[${i}]`, seenIds);
    if (!result.ok) return result;
    provinces.push(result.province);
    raceCount += result.raceCount;
  }

  return { ok: true, country: { id: raw.id, name: raw.name, provinces }, raceCount };
}

// ── Documentvalidatie ────────────────────────────────────────────────────────

/**
 * Valideert een onbekende (netwerk-)waarde als `RemoteRaceDocument`.
 * Volledig defensief: elk veld wordt op aanwezigheid en type gecontroleerd,
 * er wordt nooit van de vorm uitgegaan. Stopt bij de EERSTE fout (zie
 * toelichting bovenaan dit bestand) en meldt in `reason` een pad naar de
 * plek waar het misging, zodat het generatiescript de fout meteen kan
 * lokaliseren.
 */
export function validateRaceDocument(input: unknown): RaceDocValidation {
  if (!isPlainObject(input)) {
    return { ok: false, reason: 'document is geen object' };
  }

  if (typeof input.version !== 'number' || !Number.isFinite(input.version)) {
    return { ok: false, reason: 'version ontbreekt of is geen getal' };
  }
  if (input.version > SUPPORTED_RACE_DOC_VERSION) {
    return {
      ok: false,
      reason: `version (${input.version}) wordt niet ondersteund door deze app-versie (max ${SUPPORTED_RACE_DOC_VERSION})`,
    };
  }

  if (typeof input.generatedAt !== 'string') {
    return { ok: false, reason: 'generatedAt ontbreekt of is geen string' };
  }

  if (!Array.isArray(input.countries)) {
    return { ok: false, reason: 'countries ontbreekt of is geen array' };
  }
  if (input.countries.length === 0) {
    return { ok: false, reason: 'countries is leeg: document bevat geen enkel land' };
  }

  const seenIds = new Map<string, string>();
  const countries: RaceCountry[] = [];
  let totalRaceCount = 0;

  for (let i = 0; i < input.countries.length; i++) {
    const result = validateCountry(input.countries[i], `countries[${i}]`, seenIds);
    if (!result.ok) return result;
    countries.push(result.country);
    totalRaceCount += result.raceCount;
  }

  if (totalRaceCount === 0) {
    return { ok: false, reason: 'document bevat geen enkele wedstrijd (alle landen zijn leeg)' };
  }

  return {
    ok: true,
    doc: { version: input.version, generatedAt: input.generatedAt, countries },
  };
}
