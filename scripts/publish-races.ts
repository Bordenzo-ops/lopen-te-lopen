/**
 * publish-races — publiceert de wedstrijdlijst uit `src/data/rotterdamRaces.ts`
 * naar de publieke Supabase Storage-bucket `app-data` (bestand `races.json`),
 * zodat wedstrijden toegevoegd en verwijderd kunnen worden zonder een nieuwe
 * app-build. Zie `src/data/raceDataSchema.ts` (vorm/validatie van het
 * document) en `src/services/raceDataService.ts` (hoe de app dit document
 * ophaalt en toepast: server → lokale cache → gebundelde COUNTRIES).
 *
 * Dit script importeert de wedstrijdlijst en de validatie rechtstreeks uit
 * `src/` — er wordt nergens data of validatielogica gedupliceerd. Zowel
 * `raceDataSchema.ts` als `rotterdamRaces.ts` zijn bewust PUUR (geen
 * expo/react-imports), zodat ze hier in Node te gebruiken zijn.
 *
 * GEBRUIK (vanuit de projectroot; Node 18+ nodig i.v.m. de ingebouwde fetch):
 *
 *   Samenvatting bekijken + lokaal wegschrijven — geen sleutel nodig
 *   (standaardgedrag zonder --upload):
 *     npx tsx scripts/publish-races.ts
 *     npx tsx scripts/publish-races.ts --dry-run
 *
 *   Publiceren naar Supabase Storage (PowerShell):
 *     $env:SUPABASE_SERVICE_ROLE_KEY = 'eyJ...'
 *     npx tsx scripts/publish-races.ts --upload
 *     (SUPABASE_URL is optioneel: zonder die env-var valt het script terug op
 *     de production-URL uit eas.json en print het welke URL gebruikt is.)
 *
 *   Als SUPABASE_URL moet afwijken van eas.json (bv. een test-project),
 *   ook in PowerShell:
 *     $env:SUPABASE_URL = 'https://xxxx.supabase.co'
 *     $env:SUPABASE_SERVICE_ROLE_KEY = 'eyJ...'
 *     npx tsx scripts/publish-races.ts --upload
 *
 *   Andere lokale outputmap voor de dry-run:
 *     npx tsx scripts/publish-races.ts --out ./ergens-anders
 *
 * BENODIGDE ENV-VAR — ALTIJD alleen als tijdelijke shell-variabele tijdens
 * het draaien zetten. NOOIT in de repo, in app.json/eas.json of als
 * EAS-secret opslaan: deze sleutel hoort uitsluitend hier, publicatie-tijd,
 * op de eigen machine van wie publiceert.
 *   SUPABASE_SERVICE_ROLE_KEY  — verplicht bij --upload
 *   SUPABASE_URL               — optioneel bij --upload (fallback: eas.json)
 *
 * WERKWIJZE VOOR EEN TERUGKERENDE AGENT (wekelijks/maandelijks):
 *   1. Draai zonder --upload (dry-run). Bekijk de samenvatting, en met name
 *      de lijst "verlopen wedstrijden" — dat is precies wat er handmatig uit
 *      `src/data/rotterdamRaces.ts` verwijderd zou moeten worden bij de
 *      eerstvolgende codewijziging (dit script verwijdert zelf niets uit de
 *      bronlijst, het rapporteert alleen).
 *   2. Controleer het weggeschreven bestand (zie output voor het pad).
 *   3. Draai pas daarna met --upload, met SUPABASE_SERVICE_ROLE_KEY gezet.
 *   Bij een validatiefout stopt het script al bij stap 1 met exitcode 1 en
 *   wordt er niets weggeschreven of geüpload — dat is met opzet: de app valt
 *   bij een ontbrekend/falend document terug op de laatst bekende
 *   (gecachete of gebundelde) lijst (zie raceDataService.ts), dus een
 *   mislukte publicatie is nooit erger dan geen publicatie.
 */

/// <reference types="node" />
// Bovenstaande referentie is nodig omdat de app-tsconfig (expo/tsconfig.base)
// geen "types": ["node"] instelt — dat is prima voor de React Native-app zelf
// (die draait niet op Node), maar dit script draait wél op Node. Met deze
// regel ziet tsc de Node-globals (Buffer, node:fs, node:path) alleen binnen
// dít bestand, zonder de tsconfig van de rest van de app aan te passen.
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  validateRaceDocument,
  SUPPORTED_RACE_DOC_VERSION,
  type RemoteRaceDocument,
} from '../src/data/raceDataSchema';
import { COUNTRIES, type RaceCountry, type Race } from '../src/data/rotterdamRaces';

// ── Constantes ───────────────────────────────────────────────────────────────

const DEFAULT_OUT_DIR = '_workspace/race-publish-output';
const OUTPUT_FILENAME = 'races.json';
const STORAGE_BUCKET = 'app-data';
const STORAGE_OBJECT = 'races.json';

// ── CLI-argumenten ───────────────────────────────────────────────────────────

interface CliOptions {
  upload: boolean;
  dryRun: boolean;
  outDir: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    upload: false,
    dryRun: false,
    outDir: path.resolve(process.cwd(), DEFAULT_OUT_DIR),
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--upload':
        options.upload = true;
        break;
      case '--out': {
        const value = argv[++i];
        if (!value) {
          console.error('--out heeft een mappad nodig.');
          process.exit(1);
        }
        options.outDir = path.resolve(process.cwd(), value);
        break;
      }
      default:
        console.error(`Onbekend argument: "${arg}".`);
        process.exit(1);
    }
  }

  if (options.upload && options.dryRun) {
    console.error('Kies --upload of --dry-run, niet beide tegelijk.');
    process.exit(1);
  }

  return options;
}

// ── Document opbouwen ────────────────────────────────────────────────────────

function buildDocument(): RemoteRaceDocument {
  return {
    version: SUPPORTED_RACE_DOC_VERSION,
    generatedAt: new Date().toISOString(),
    countries: COUNTRIES,
  };
}

// ── Samenvatting (altijd getoond, ook bij --upload) ─────────────────────────

interface PastRace {
  name: string;
  date: string;
  location: string;
}

interface RaceStats {
  countries: number;
  provinces: number;
  cities: number;
  /** Aantal Race-objecten op topniveau in city.races (evenement-groepen tellen als 1). */
  topLevelRaces: number;
  /** Alle Race-objecten, inclusief losse subafstanden (subRaces). */
  totalRaceNodes: number;
  pastRaces: PastRace[];
}

function collectStats(countries: RaceCountry[], now: Date): RaceStats {
  let provinces = 0;
  let cities = 0;
  let topLevelRaces = 0;
  let totalRaceNodes = 0;
  const pastRaces: PastRace[] = [];

  // Loopt ook door subRaces heen: een subafstand kan een eigen datum hebben
  // die afwijkt van het moederevenement (zie bv. Baloise Antwerp 10 Miles,
  // waar de "5 Miles" een dag eerder start dan de hoofdafstand).
  function walkRace(race: Race): void {
    totalRaceNodes++;
    if (new Date(race.date).getTime() < now.getTime()) {
      pastRaces.push({ name: race.name, date: race.date, location: race.location });
    }
    if (race.subRaces) {
      for (const sub of race.subRaces) walkRace(sub);
    }
  }

  for (const country of countries) {
    for (const province of country.provinces) {
      provinces++;
      for (const city of province.cities) {
        cities++;
        topLevelRaces += city.races.length;
        for (const race of city.races) walkRace(race);
      }
    }
  }

  pastRaces.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return { countries: countries.length, provinces, cities, topLevelRaces, totalRaceNodes, pastRaces };
}

function printSummary(stats: RaceStats): void {
  console.log('=== Samenvatting ===');
  console.log(`  Landen: ${stats.countries}`);
  console.log(`  Provincies: ${stats.provinces}`);
  console.log(`  Steden: ${stats.cities}`);
  console.log(`  Wedstrijden (topniveau in het document): ${stats.topLevelRaces}`);
  console.log(`  Wedstrijden incl. losse subafstanden: ${stats.totalRaceNodes}`);
  console.log('');

  if (stats.pastRaces.length === 0) {
    console.log('Geen verlopen wedstrijden gevonden — niets om op te ruimen.\n');
    return;
  }

  console.log(
    `=== Verlopen wedstrijden (${stats.pastRaces.length}) — kandidaat om handmatig uit ` +
      'rotterdamRaces.ts te verwijderen ===',
  );
  for (const race of stats.pastRaces) {
    console.log(`  ${race.date}  ${race.name}  (${race.location})`);
  }
  console.log(
    'Let op: dit script verwijdert zelf NIETS uit de bronlijst en publiceert de bovenstaande ' +
      'wedstrijden dus gewoon mee — het rapporteert alleen.\n',
  );
}

// ── Uploaden naar Supabase Storage ───────────────────────────────────────────

function readEasProductionSupabaseUrl(): string | undefined {
  try {
    const easPath = path.resolve(process.cwd(), 'eas.json');
    const raw = fs.readFileSync(easPath, 'utf-8');
    const json = JSON.parse(raw);
    return json?.build?.production?.env?.EXPO_PUBLIC_SUPABASE_URL;
  } catch {
    return undefined;
  }
}

async function uploadDocument(supabaseUrl: string, serviceKey: string, body: Buffer): Promise<void> {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${STORAGE_OBJECT}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'x-upsert': 'true', // overschrijft een bestaand races.json
      'Content-Type': 'application/json',
    },
    // Zelfde tsc-vs-runtime kanttekening als in generate-voice-packs.ts: de
    // DOM-fetchtypering en de Node-Buffer-typering botsen puur op
    // typeniveau, runtime accepteert fetch een Buffer prima (het is een
    // Uint8Array). De cast wijzigt geen gedrag.
    body: body as unknown as BodyInit,
  });

  if (response.ok) return;

  const detail = await response.text().catch(() => '');

  // De bucket "app-data" bestaat mogelijk nog niet (dit script maakt hem
  // bewust niet automatisch aan — anders dan generate-voice-packs.ts voor
  // "voice-packs" doet). Supabase Storage geeft hiervoor een 404 met
  // "Bucket not found" terug: vertaal dat naar een duidelijke, actionable
  // melding in plaats van een kale HTTP-fout.
  if (response.status === 404 || /bucket not found/i.test(detail)) {
    throw new Error(
      `Bucket "${STORAGE_BUCKET}" bestaat niet (HTTP ${response.status}). Maak hem eenmalig aan in het ` +
        `Supabase-dashboard: Storage → New bucket → naam "${STORAGE_BUCKET}", "Public bucket" aanvinken. ` +
        'Draai dit script daarna opnieuw met --upload.',
    );
  }

  throw new Error(
    `Upload naar ${STORAGE_BUCKET}/${STORAGE_OBJECT} mislukt (HTTP ${response.status}): ${detail.slice(0, 200)}`,
  );
}

// ── Hoofdprogramma ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const doc = buildDocument();
  const validation = validateRaceDocument(doc);

  // Altijd valideren, ook bij een dry-run: faalt dit, dan stopt het script
  // meteen zonder ook maar iets weg te schrijven of te uploaden, met
  // exitcode 1 zodat een automatische agent dit betrouwbaar kan detecteren.
  if (!validation.ok) {
    console.error(`Validatie MISLUKT: ${validation.reason}`);
    console.error('Er is niets weggeschreven en niets geüpload.');
    process.exitCode = 1;
    return;
  }
  console.log('Validatie geslaagd (validateRaceDocument, alles-of-niets — zie raceDataSchema.ts).\n');

  const stats = collectStats(validation.doc.countries, new Date());
  printSummary(stats);

  // Publiceer het door validateRaceDocument teruggegeven (genormaliseerde)
  // document, niet het ruwe `doc` — zo bevat de output nooit onbedoelde
  // extra velden die toevallig op COUNTRIES stonden.
  const json = JSON.stringify(validation.doc, null, 2);
  const sizeKb = (Buffer.byteLength(json, 'utf-8') / 1024).toFixed(1);

  if (!options.upload) {
    fs.mkdirSync(options.outDir, { recursive: true });
    const outFile = path.join(options.outDir, OUTPUT_FILENAME);
    fs.writeFileSync(outFile, json);
    console.log(`Dry-run: document (${sizeKb} KB) weggeschreven naar:\n  ${outFile}`);
    console.log('\nEr is niets geüpload. Controleer het bestand en draai daarna met --upload om te publiceren.');
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? readEasProductionSupabaseUrl();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error(
      'Geen SUPABASE_URL gevonden (niet als env-var, en ook niet in eas.json production env). ' +
        'Uploaden overgeslagen.',
    );
    process.exitCode = 1;
    return;
  }
  if (!serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is niet gezet. Uploaden overgeslagen.');
    process.exitCode = 1;
    return;
  }

  console.log(
    `Gebruikte Supabase-URL: ${supabaseUrl} ` +
      `(${process.env.SUPABASE_URL ? 'uit env-var SUPABASE_URL' : 'uit eas.json production env (fallback)'})`,
  );
  console.log(`Uploaden naar Storage-bucket "${STORAGE_BUCKET}", object "${STORAGE_OBJECT}" (${sizeKb} KB)...`);

  try {
    await uploadDocument(supabaseUrl, serviceKey, Buffer.from(json, 'utf-8'));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\nUpload MISLUKT: ${message}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    '\nGeüpload. De app haalt dit document bij de volgende refresh op via raceDataService.refreshRaceData().',
  );
  if (stats.pastRaces.length > 0) {
    console.log(
      `Let op: er staan nog ${stats.pastRaces.length} verlopen wedstrijd(en) in het zojuist gepubliceerde ` +
        'document (zie de samenvatting hierboven) — overweeg die handmatig uit rotterdamRaces.ts te ' +
        'verwijderen bij de volgende codewijziging.',
    );
  }
}

main().catch((err) => {
  console.error('Onverwachte fout:', err);
  process.exitCode = 1;
});
