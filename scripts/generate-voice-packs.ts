/**
 * generate-voice-packs — bouwt de stempakketten (mp3's + manifest.json) uit
 * de zinnencatalogus in `src/config/voicePhrases.ts`, met ElevenLabs als
 * spraak-engine. Zie `_workspace/notities/Stempakketten-ontwerp.md` (fase B)
 * voor de volledige architectuur. Dit script importeert de catalogus en de
 * ElevenLabs-config rechtstreeks uit `src/` — er wordt nergens tekst
 * gedupliceerd.
 *
 * GEBRUIK (vanuit de projectroot; Node 18+ nodig i.v.m. de ingebouwde fetch):
 *
 *   Alleen tellen/bekijken — geen API-key nodig:
 *     npx tsx scripts/generate-voice-packs.ts --dry-run
 *
 *   Genereren, beide stemmen (standaardoutput: _workspace/voice-packs-output):
 *     ELEVENLABS_API_KEY=sk_... npx tsx scripts/generate-voice-packs.ts
 *
 *   Genereren voor één stem (elke sleutel uit VOICES in voiceConfig.ts):
 *     ELEVENLABS_API_KEY=sk_... npx tsx scripts/generate-voice-packs.ts --voice female
 *     ELEVENLABS_API_KEY=sk_... npx tsx scripts/generate-voice-packs.ts --voice male
 *     ELEVENLABS_API_KEY=sk_... npx tsx scripts/generate-voice-packs.ts --voice flemish_female
 *     ELEVENLABS_API_KEY=sk_... npx tsx scripts/generate-voice-packs.ts --voice flemish_male
 *
 *   Genereren + direct uploaden naar Supabase Storage:
 *     ELEVENLABS_API_KEY=sk_... SUPABASE_SERVICE_ROLE_KEY=... \
 *       npx tsx scripts/generate-voice-packs.ts --upload
 *     (SUPABASE_URL is optioneel: zonder die env-var valt het script terug op
 *     de production-URL uit eas.json en print het welke URL gebruikt wordt.)
 *
 *   Andere outputmap:
 *     npx tsx scripts/generate-voice-packs.ts --out ./ergens-anders
 *
 * BENODIGDE ENV-VARS — ALTIJD alleen als tijdelijke shell-variabele tijdens
 * het draaien zetten. NOOIT in de repo, in app.json/eas.json of als
 * EAS-secret opslaan: deze sleutels horen uitsluitend hier, build-tijd, op
 * Lars' eigen machine.
 *   ELEVENLABS_API_KEY         — verplicht zodra er nog clips ontbreken
 *                                 (niet nodig bij --dry-run, en ook niet als
 *                                 alles al gegenereerd/gecached is)
 *   SUPABASE_SERVICE_ROLE_KEY  — verplicht bij --upload
 *   SUPABASE_URL               — optioneel bij --upload (fallback: eas.json)
 *
 * Idempotent: een bestaande mp3 (herkenbaar aan de bestandsnaam
 * "{phraseId}-{hash}.mp3") wordt nooit opnieuw opgehaald. Verandert de tekst
 * van een phraseId, dan wijkt de hash af — de oude mp3 wordt verwijderd en de
 * nieuwe wordt (opnieuw) gegenereerd. Zo kost een latere toevoeging aan de
 * catalogus alleen een API-call voor die ene nieuwe/gewijzigde zin.
 */

/// <reference types="node" />
// Bovenstaande referentie is nodig omdat de app-tsconfig (expo/tsconfig.base)
// geen "types": ["node"] instelt — dat is prima voor de React Native-app zelf
// (die draait niet op Node), maar dit script draait wél op Node. Met deze
// regel ziet tsc de Node-globals (Buffer, node:fs, node:crypto, node:path)
// alleen binnen dít bestand, zonder de tsconfig van de rest van de app aan
// te passen.
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { allPhrases, type CatalogPhrase } from '../src/config/voicePhrases';
import { ELEVENLABS, VOICES, voiceDefinition, type VoiceType } from '../src/config/voiceConfig';

// ── Constantes ───────────────────────────────────────────────────────────────

const MANIFEST_VERSION = 1;
const REQUEST_DELAY_MS = 200;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [5000, 15000, 30000];
const DEFAULT_OUT_DIR = '_workspace/voice-packs-output';

// ── CLI-argumenten ───────────────────────────────────────────────────────────

interface CliOptions {
  voice: VoiceType | 'all';
  dryRun: boolean;
  upload: boolean;
  outDir: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    voice: 'all',
    dryRun: false,
    upload: false,
    outDir: path.resolve(process.cwd(), DEFAULT_OUT_DIR),
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--voice': {
        const value = argv[++i];
        const validKeys = VOICES.map(v => v.key);
        if (value === 'all' || (validKeys as string[]).includes(value ?? '')) {
          options.voice = value as VoiceType | 'all';
        } else {
          console.error(`Onbekende --voice waarde: "${value}". Gebruik ${validKeys.join(', ')} of all.`);
          process.exit(1);
        }
        break;
      }
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

  return options;
}

// ── Indeling in groepen (alleen voor de --dry-run-rapportage) ──────────────
// Volgt de tabel uit het ontwerpdocument. Volgorde van de checks is
// belangrijk: "dist_m_" moet vóór "dist_" gecontroleerd worden.

function groupOf(id: string): string {
  if (/^km_\d+$/.test(id)) return 'Km-split';
  if (/^pace_\d+_\d+$/.test(id)) return 'Tempo';
  if (/^enc_\d+$/.test(id)) return 'Aanmoediging';
  if (/^rem_/.test(id)) return 'Resterend';
  if (/^dist_m_\d+$/.test(id)) return 'Nav-afstand';
  if (/^dist_/.test(id)) return 'Afstand gelopen';
  if (/^time_\d+$/.test(id)) return 'Tijd';
  if (/^zone_Z\d$/.test(id)) return 'Zones';
  if (/^hr_/.test(id)) return 'Hartslagcoaching';
  if (id === 'halfway' || /^mile_\d+$/.test(id)) return 'Mijlpalen';
  if (/^turn_/.test(id)) return 'Navigatie';
  return 'Vast';
}

function printDryRun(): void {
  const phrases = allPhrases();
  const groups = new Map<string, CatalogPhrase[]>();
  for (const phrase of phrases) {
    const group = groupOf(phrase.id);
    const list = groups.get(group) ?? [];
    list.push(phrase);
    groups.set(group, list);
  }

  console.log('=== Dry-run: volledige zinnencatalogus (ids/teksten zijn identiek voor elke stem) ===\n');
  for (const [group, list] of groups) {
    console.log(`--- ${group} (${list.length}) ---`);
    for (const phrase of list) {
      console.log(`  ${phrase.id}: ${phrase.text}`);
    }
    console.log('');
  }

  console.log('=== Telling per groep ===');
  for (const [group, list] of groups) {
    console.log(`  ${group}: ${list.length}`);
  }
  console.log(`  TOTAAL: ${phrases.length} clips per stem`);
}

// ── Hash / bestandsnaam ──────────────────────────────────────────────────────

/**
 * Eerste 8 hex-tekens van sha1 over tekst + voiceSettings + modelId + voiceId.
 * Verandert de tekst of de stemconfiguratie, dan verandert de hash mee — dat
 * is precies wat de opruimlogica hieronder gebruikt om verweesde mp3's te
 * herkennen.
 */
function computeHash(text: string, voiceId: string): string {
  const payload = text + JSON.stringify(ELEVENLABS.voiceSettings) + ELEVENLABS.modelId + voiceId;
  return createHash('sha1').update(payload).digest('hex').slice(0, 8);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── ElevenLabs-aanroep (zelfde format als supabase/functions/tts/index.ts) ──

async function fetchClip(voiceId: string, text: string): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY ?? '';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: ELEVENLABS.modelId,
          voice_settings: ELEVENLABS.voiceSettings,
        }),
      },
    );

    if (response.status === 429) {
      if (attempt >= MAX_RETRIES) {
        throw new Error('Herhaaldelijk HTTP 429 (rate limit) — maximum aantal pogingen bereikt.');
      }
      const delay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      console.warn(`    Rate limit (429), wacht ${delay / 1000}s en probeert opnieuw (poging ${attempt + 1}/${MAX_RETRIES})...`);
      await sleep(delay);
      continue;
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`ElevenLabs-fout ${response.status}: ${detail.slice(0, 200)}`);
    }

    return await response.arrayBuffer();
  }

  // Onbereikbaar in de praktijk (de lus eindigt hierboven altijd via return
  // of throw), maar TypeScript wil een pad dat altijd iets teruggeeft/gooit.
  throw new Error('Onverwachte fout bij het ophalen van een clip.');
}

// ── Genereren per stem ───────────────────────────────────────────────────────

interface FailedClip {
  voice: VoiceType;
  id: string;
  error: string;
}

async function processVoice(
  voice: VoiceType,
  outDir: string,
  failures: FailedClip[],
): Promise<void> {
  const voiceInfo = voiceDefinition(voice);
  const voiceDir = path.join(outDir, voice);
  fs.mkdirSync(voiceDir, { recursive: true });

  const phrases = allPhrases();
  console.log(`\n=== Stem: ${voiceInfo.name} (${voice}) — ${phrases.length} clips ===`);

  if (!voiceInfo.elevenVoiceId) {
    console.warn(
      `  Stem "${voice}" overgeslagen: voice-ID nog niet ingevuld in voiceConfig.ts — overgeslagen.`,
    );
    return;
  }

  // Gewenste staat: phraseId -> { bestandsnaam, tekst }
  const desired = new Map<string, { filename: string; text: string }>();
  for (const phrase of phrases) {
    const hash = computeHash(phrase.text, voiceInfo.elevenVoiceId);
    desired.set(phrase.id, { filename: `${phrase.id}-${hash}.mp3`, text: phrase.text });
  }

  // Verweesde bestanden opruimen: zelfde phraseId, andere hash (tekst is
  // gewijzigd sinds de vorige run) — geen API-call nodig om dit te bepalen.
  const existingFiles = fs.readdirSync(voiceDir).filter((f) => f.endsWith('.mp3'));
  for (const file of existingFiles) {
    const match = file.match(/^(.+)-([0-9a-f]{8})\.mp3$/);
    if (!match) continue;
    const id = match[1];
    const wanted = desired.get(id);
    if (wanted && wanted.filename !== file) {
      fs.rmSync(path.join(voiceDir, file));
      console.log(`  Verweesd bestand verwijderd (tekst gewijzigd): ${file}`);
    }
  }

  let generated = 0;
  let skipped = 0;
  for (const phrase of phrases) {
    const wanted = desired.get(phrase.id)!;
    const filePath = path.join(voiceDir, wanted.filename);

    if (fs.existsSync(filePath)) {
      skipped++;
      continue;
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      failures.push({ voice, id: phrase.id, error: 'ELEVENLABS_API_KEY niet gezet.' });
      continue;
    }

    try {
      const audio = await fetchClip(voiceInfo.elevenVoiceId, phrase.text);
      fs.writeFileSync(filePath, Buffer.from(audio));
      generated++;
      console.log(`  [${voice}] ${phrase.id} gegenereerd (${wanted.filename})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ voice, id: phrase.id, error: message });
      console.warn(`  [${voice}] ${phrase.id} MISLUKT: ${message}`);
    }

    // Alleen pauzeren ná een daadwerkelijke API-call, niet bij overslaan.
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`  ${generated} gegenereerd, ${skipped} al aanwezig (overgeslagen).`);

  // Manifest opbouwen op basis van wat nu daadwerkelijk op schijf staat —
  // ontbrekende (mislukte) clips komen dus niet in het manifest terecht.
  const files: Record<string, string> = {};
  let totalBytes = 0;
  for (const phrase of phrases) {
    const wanted = desired.get(phrase.id)!;
    const filePath = path.join(voiceDir, wanted.filename);
    if (fs.existsSync(filePath)) {
      files[phrase.id] = wanted.filename;
      totalBytes += fs.statSync(filePath).size;
    }
  }

  const manifest = {
    version: MANIFEST_VERSION,
    voice,
    voiceName: voiceInfo.name,
    modelId: ELEVENLABS.modelId,
    files,
    totalBytes,
  };
  fs.writeFileSync(path.join(voiceDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(
    `  manifest.json geschreven (${Object.keys(files).length}/${phrases.length} clips aanwezig, ` +
      `${(totalBytes / 1024 / 1024).toFixed(1)} MB).`,
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

async function ensureBucket(supabaseUrl: string, serviceKey: string): Promise<void> {
  const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'voice-packs', public: true }),
  });

  if (response.ok) {
    console.log('Bucket "voice-packs" aangemaakt.');
    return;
  }
  if (response.status === 409) {
    console.log('Bucket "voice-packs" bestaat al.');
    return;
  }
  const detail = await response.text().catch(() => '');
  console.warn(
    `Kon bucket "voice-packs" niet aanmaken (HTTP ${response.status}): ${detail.slice(0, 200)}. ` +
      `Ga ervan uit dat hij al bestaat en probeer toch te uploaden.`,
  );
}

function contentTypeFor(filename: string): string {
  return filename.endsWith('.json') ? 'application/json' : 'audio/mpeg';
}

async function uploadFile(
  supabaseUrl: string,
  serviceKey: string,
  voice: VoiceType,
  filename: string,
  body: Buffer,
): Promise<void> {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/voice-packs/${voice}/${filename}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'x-upsert': 'true',
      'Content-Type': contentTypeFor(filename),
    },
    // De DOM-fetchtypering (lib "dom") en de Node-Buffer-typering (@types/node
    // met generieke typed arrays) botsen hier puur op typeniveau — runtime
    // accepteert fetch een Buffer als body prima (het is een Uint8Array).
    // De cast is dus alleen om tsc tevreden te houden, geen gedragswijziging.
    body: body as unknown as BodyInit,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Upload van ${voice}/${filename} mislukt (HTTP ${response.status}): ${detail.slice(0, 200)}`);
  }
}

async function uploadVoice(
  supabaseUrl: string,
  serviceKey: string,
  voice: VoiceType,
  outDir: string,
  failures: FailedClip[],
): Promise<void> {
  const voiceDir = path.join(outDir, voice);
  const manifestPath = path.join(voiceDir, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    console.warn(`Geen manifest.json gevonden voor stem "${voice}" in ${voiceDir} — uploaden overgeslagen.`);
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const files: Record<string, string> = manifest.files ?? {};

  console.log(`\nUploaden naar Supabase Storage — stem "${voice}": ${Object.keys(files).length} clips...`);
  for (const [id, filename] of Object.entries(files)) {
    try {
      const body = fs.readFileSync(path.join(voiceDir, filename));
      await uploadFile(supabaseUrl, serviceKey, voice, filename, body);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ voice, id, error: message });
      console.warn(`  Upload MISLUKT voor ${id}: ${message}`);
    }
  }

  // Manifest als LAATSTE uploaden: zo heeft een halverwege afgebroken upload
  // nooit een manifest.json in Storage die naar ontbrekende clips verwijst.
  try {
    const manifestBody = fs.readFileSync(manifestPath);
    await uploadFile(supabaseUrl, serviceKey, voice, 'manifest.json', manifestBody);
    console.log(`  manifest.json geüpload voor stem "${voice}".`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    failures.push({ voice, id: 'manifest.json', error: message });
    console.warn(`  Upload van manifest.json MISLUKT voor stem "${voice}": ${message}`);
  }
}

// ── Hoofdprogramma ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.dryRun) {
    printDryRun();
    return;
  }

  const voicesToProcess: VoiceType[] =
    options.voice === 'all' ? VOICES.map(v => v.key) : [options.voice];
  const failures: FailedClip[] = [];

  if (!process.env.ELEVENLABS_API_KEY) {
    console.warn(
      'Let op: ELEVENLABS_API_KEY is niet gezet. Alleen al eerder gegenereerde (gecachte) clips ' +
        'worden hergebruikt; ontbrekende clips worden overgeslagen en verschijnen aan het eind ' +
        'in de lijst met mislukkingen.\n',
    );
  }

  fs.mkdirSync(options.outDir, { recursive: true });
  console.log(`Outputmap: ${options.outDir}`);

  for (const voice of voicesToProcess) {
    await processVoice(voice, options.outDir, failures);
  }

  if (options.upload) {
    const supabaseUrl = process.env.SUPABASE_URL ?? readEasProductionSupabaseUrl();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      console.error(
        '\nGeen SUPABASE_URL gevonden (niet als env-var, en ook niet in eas.json production env). ' +
          'Uploaden overgeslagen.',
      );
      process.exitCode = 1;
    } else if (!serviceKey) {
      console.error('\nSUPABASE_SERVICE_ROLE_KEY is niet gezet. Uploaden overgeslagen.');
      process.exitCode = 1;
    } else {
      console.log(
        `\nGebruikte Supabase-URL: ${supabaseUrl} ` +
          `(${process.env.SUPABASE_URL ? 'uit env-var SUPABASE_URL' : 'uit eas.json production env (fallback)'})`,
      );
      await ensureBucket(supabaseUrl, serviceKey);
      for (const voice of voicesToProcess) {
        await uploadVoice(supabaseUrl, serviceKey, voice, options.outDir, failures);
      }
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} clip(s) mislukt:`);
    for (const failure of failures) {
      console.error(`  [${failure.voice}] ${failure.id}: ${failure.error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\nKlaar.');
}

main().catch((err) => {
  console.error('Onverwachte fout:', err);
  process.exitCode = 1;
});
