/**
 * raceDataService
 *
 * Offline-first laag rond de racelijst. Wedstrijden staan van oudsher
 * hardgecodeerd in `rotterdamRaces.ts` (COUNTRIES) en zijn dus alleen te
 * wijzigen met een nieuwe app-build in beide stores. Deze service haalt in
 * plaats daarvan een actuele lijst op uit een publieke Supabase
 * Storage-bucket op `{SUPABASE_URL}/storage/v1/object/public/app-data/
 * races.json` — precies zoals `voicePackService.ts` dat al doet voor
 * stempakketten — zodat een externe agent de lijst wekelijks of maandelijks
 * kan bijwerken zonder app-release. Het document wordt lokaal bewaard in
 * `Paths.document/race-data/` (documentmap, niet de cache — mag niet zomaar
 * door het systeem gewist worden).
 *
 * Drietrapsraket, van vers naar definitief vangnet:
 *   1. server (net opgehaald en gevalideerd via `refreshRaceData`)
 *   2. lokale cache (een eerder gevalideerd document van schijf)
 *   3. gebundelde `COUNTRIES` uit `rotterdamRaces.ts`
 * Trap 3 verdwijnt nooit: een gebruiker zonder netwerk bij de eerste start
 * moet gewoon wedstrijden zien. Omdat `refreshRaceData` pas naar schijf
 * schrijft NADAT `validateRaceDocument` een document heeft goedgekeurd
 * (alles-of-niets, zie `raceDataSchema.ts`), kan trap 2 nooit een kapot of
 * half toegepast document bevatten — hooguit een verouderd, maar wel intern
 * consistent document.
 *
 * Alles stil, net als `voicePackService`/`healthConnectService`: geen
 * netwerk, geen Supabase-configuratie, ongeldige JSON, een document dat de
 * validatie niet haalt, of een schijffout → gewoon terugvallen, nooit
 * gooien, nooit iets zichtbaars voor de gebruiker.
 *
 * `getEffectiveCountries()` is synchroon: het lokale document wordt precies
 * één keer per appsessie van schijf gelezen en daarna in het geheugen
 * gehouden (`cachedDoc`), net zoals `voicePackService` dat met zijn manifest
 * doet. Schermen roepen deze functie zelf niet aan — dat zou `rotterdamRaces.ts`
 * dwingen om per render hierheen te bellen, en dus precies de circulaire
 * import opleveren die het registratiepatroon daar juist vermijdt (zie de
 * toelichting bij `setRaceCountriesOverride` in dat bestand). In plaats
 * daarvan roept `refreshRaceData()` hieronder `setRaceCountriesOverride()`
 * aan zodra er iets bruikbaars is (bestaande cache bij het begin van de
 * aanroep, een verse serverlijst na een geslaagde ophaalronde); schermen
 * blijven simpelweg `getAllRaces()`/`getCountries()` uit `rotterdamRaces.ts`
 * gebruiken en krijgen die override zo vanzelf mee.
 *
 * Vereist: expo-file-system (nieuwe File/Directory/Paths-API, al aanwezig in
 * dit project, zie `voicePackService.ts`/`exportService.ts`).
 */

// @ts-ignore: al geinstalleerd, zelfde importpatroon als voicePackService.ts
import { File, Directory, Paths } from 'expo-file-system';
import { validateRaceDocument, type RemoteRaceDocument } from '../data/raceDataSchema';
import { COUNTRIES, setRaceCountriesOverride, type RaceCountry } from '../data/rotterdamRaces';
import { sanitizeEnvValue, isHttpsUrl } from '../utils/env';

// ── Padopbouw ────────────────────────────────────────────────────────────────

function raceDataDir(): Directory {
  return new Directory(Paths.document, 'race-data');
}

function raceDataFile(): File {
  return new File(raceDataDir(), 'races.json');
}

function metaFile(): File {
  return new File(raceDataDir(), 'meta.json');
}

function ensureDir(): void {
  const dir = raceDataDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

// ── Ophaal-throttling ────────────────────────────────────────────────────────
//
// Racedata verandert hooguit wekelijks (de eigenaar werkt de bron wekelijks
// tot maandelijks bij via een agent) — een appstart die elke keer opnieuw
// het netwerk op gaat is dus pure verspilling. Eén dag is ruim vaak genoeg
// om een wijziging binnen een paar uur na publicatie op te pikken, en ruim
// onder de wekelijkse update-cadans om onnodige verzoeken te voorkomen. Het
// tijdstip van de laatste POGING (niet alleen een succesvolle) wordt
// persistent op schijf bewaard (`meta.json`), zodat het interval ook een
// koude app-herstart overleeft — anders zou elke app-start opnieuw een
// poging wagen omdat een in-memory teller bij herstart weer op nul staat.

const MIN_FETCH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 dag
const FETCH_TIMEOUT_MS = 10000;

interface RaceDataMeta {
  lastAttemptAt: number;
}

function isValidMetaShape(value: unknown): value is RaceDataMeta {
  return !!value && typeof value === 'object' && typeof (value as Record<string, unknown>).lastAttemptAt === 'number';
}

function readMeta(): RaceDataMeta | null {
  try {
    const file = metaFile();
    if (!file.exists) return null;
    const parsed = JSON.parse(file.textSync());
    return isValidMetaShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeMeta(meta: RaceDataMeta): void {
  try {
    ensureDir();
    metaFile().write(JSON.stringify(meta));
  } catch {
    // Stil: in het ergste geval wordt de volgende poging iets te vroeg gedaan.
  }
}

// ── In-memory cache ──────────────────────────────────────────────────────────
//
// `cachedDoc === undefined` betekent "nog niet van schijf gelezen deze
// sessie"; `null` betekent "gelezen, maar geen geldig lokaal document
// gevonden". `fetchedThisSession` onderscheidt trap 1 (server, net in deze
// appsessie succesvol opgehaald) van trap 2 (cache, een document van een
// eerdere sessie) voor `getRaceDataStatus()` — beide lezen uiteindelijk
// hetzelfde bestand op schijf, want een geslaagde verversing schrijft direct
// naar de cache.

let cachedDoc: RemoteRaceDocument | null | undefined;
let fetchedThisSession = false;

/** Leest (en valideert opnieuw, als extra verdedigingslaag) het lokale document. Null bij elke fout/afwezigheid. */
function readLocalDocument(): RemoteRaceDocument | null {
  try {
    const file = raceDataFile();
    if (!file.exists) return null;
    const parsed = JSON.parse(file.textSync());
    const validation = validateRaceDocument(parsed);
    return validation.ok ? validation.doc : null;
  } catch {
    return null;
  }
}

function ensureLoaded(): void {
  if (cachedDoc !== undefined) return;
  cachedDoc = readLocalDocument();
}

/**
 * Forceert dat de in-memory cache bij de volgende aanroep opnieuw van schijf
 * gelezen wordt. Wordt automatisch aangeroepen door `refreshRaceData()` na
 * een geslaagde verversing, en is daarnaast geëxporteerd zodat een scherm of
 * test de cache ook los kan laten herladen.
 */
export function reloadRaceDataCache(): void {
  cachedDoc = undefined;
}

// ── Publieke API ──────────────────────────────────────────────────────────────

/**
 * De racelijst die de app moet gebruiken: server (via een eerdere geslaagde
 * `refreshRaceData()`) > lokale cache > gebundelde `COUNTRIES`. Synchroon en
 * altijd een geldige, niet-lege lijst — geeft nooit een lege array terug,
 * want de gebundelde lijst is het definitieve vangnet.
 */
export function getEffectiveCountries(): RaceCountry[] {
  try {
    ensureLoaded();
    return cachedDoc?.countries ?? COUNTRIES;
  } catch {
    return COUNTRIES;
  }
}

/** Diagnostisch: waar komt de huidige lijst vandaan en hoe oud is hij? */
export function getRaceDataStatus(): { source: 'remote' | 'cache' | 'bundled'; generatedAt: string | null } {
  try {
    ensureLoaded();
    if (!cachedDoc) return { source: 'bundled', generatedAt: null };
    return { source: fetchedThisSession ? 'remote' : 'cache', generatedAt: cachedDoc.generatedAt };
  } catch {
    return { source: 'bundled', generatedAt: null };
  }
}

/**
 * Haalt (indien nodig) een verse racelijst op bij Supabase Storage, valideert
 * hem, en schrijft hem PAS naar schijf als de validatie slaagt — een kapot
 * of onvolledig document mag de bestaande cache nooit overschrijven (zie
 * "alles-of-niets" in `raceDataSchema.ts`). Volledig stil: geen enkele
 * faalroute gooit een fout of laat iets zichtbaars aan de UI zien. Bedoeld
 * om aan te roepen bij app-start en/of terugkeer naar de voorgrond; de
 * throttle hierboven zorgt dat dat in de praktijk hooguit één keer per dag
 * echt het netwerk op gaat.
 */
export async function refreshRaceData(): Promise<void> {
  try {
    // Activeer een eventueel al op schijf gecachet document METEEN, ongeacht
    // of de ophaal-throttle hieronder een nieuwe netwerkpoging deze keer
    // toestaat: zonder dit zou een gebruiker die de app een dag na de vorige
    // (geslaagde) verversing opnieuw opent één hele sessie lang de gebundelde
    // lijst te zien krijgen terwijl er allang een verse op schijf staat.
    // getEffectiveCountries() leest het lokale document synchroon (hooguit
    // één keer per sessie, zie ensureLoaded) en valt zelf terug op de
    // gebundelde lijst als er niets bruikbaars op schijf staat, dus deze
    // aanroep is altijd veilig en kan niet gooien.
    setRaceCountriesOverride(getEffectiveCountries());

    const meta = readMeta();
    const now = Date.now();
    if (meta && now - meta.lastAttemptAt < MIN_FETCH_INTERVAL_MS) return;

    // Poging meteen vastleggen (vóór de fetch): ook een mislukte of
    // hangende poging telt mee voor de throttle, anders zou een gebruiker
    // zonder netwerk bij elke app-start opnieuw een verzoek doen.
    writeMeta({ lastAttemptAt: now });

    const supabaseUrl = sanitizeEnvValue(process.env.EXPO_PUBLIC_SUPABASE_URL);
    if (!isHttpsUrl(supabaseUrl)) return;

    const url = `${supabaseUrl}/storage/v1/object/public/app-data/races.json`;

    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      return;
    }
    if (!response.ok) return;

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return;
    }

    const validation = validateRaceDocument(json);
    if (!validation.ok) return;

    try {
      ensureDir();
      raceDataFile().write(JSON.stringify(validation.doc));
    } catch {
      return;
    }

    fetchedThisSession = true;
    reloadRaceDataCache();
    // Meteen ook de zojuist opgehaalde (en al gevalideerde) lijst actief
    // maken, in plaats van te wachten tot de volgende getEffectiveCountries-
    // aanroep: validation.doc is hier al bewezen geldig, dus geen extra
    // schijf-rondje nodig.
    setRaceCountriesOverride(validation.doc.countries);
  } catch {
    // Volledig stil: een mislukte verversing mag nooit zichtbaar worden of
    // de rest van de app verstoren.
  }
}
