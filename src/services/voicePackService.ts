/**
 * voicePackService
 *
 * Offline-first laag rond de gedownloade stempakketten (zie
 * `_workspace/notities/Stempakketten-ontwerp.md`, fase C). Een stempakket is
 * een map met vooraf door ElevenLabs gegenereerde mp3-clips plus een
 * `manifest.json` (`{ version, voice, voiceName, modelId, files: { phraseId:
 * "bestand.mp3" }, totalBytes }`), gehost in een publieke Supabase Storage-
 * bucket op `{SUPABASE_URL}/storage/v1/object/public/voice-packs/{female|
 * male}/manifest.json` (mp3's in dezelfde map). Deze service haalt dat op,
 * bewaart het lokaal in `Paths.document/voice-packs/{voice}/` (documentmap,
 * niet de cache — mag niet zomaar door het systeem gewist worden) en biedt
 * snelle, synchrone lookups tijdens het lopen.
 *
 * Offline-first/defensief, net als `healthConnectService.ts`: geen enkele
 * functie hier gooit een fout naar de UI. Zonder netwerk, zonder
 * Supabase-configuratie, zonder pakket op schijf of bij een onverwachte fout
 * degradeert alles stil (isPackAvailable false / getLocalClipUri null) zodat
 * `voiceService.speakPhrases` terugvalt op de ingebouwde telefoonstem.
 *
 * Belangrijkste ontwerpkeuze — "manifest.json als laatste schrijven": tijdens
 * downloadPack() wordt de lokale manifest.json pas geschreven nadat ALLE
 * clips van het (nieuwe) externe manifest succesvol op schijf staan. Breekt
 * de download halverwege af (geen netwerk, app gesloten), dan bestaat er dus
 * geen (bijgewerkte) lokaal manifest, is isPackAvailable() false, en negeert
 * de app de losse, half gedownloade mp3's volledig. Een volgende
 * downloadPack()-aanroep slaat bestanden die al op schijf staan gewoon over
 * (bestandsnamen bevatten een content-hash, dus gelijke naam = gelijke
 * inhoud) — de download "hervat" daardoor vanzelf waar hij was.
 *
 * In-memory caches (per stem) worden opgebouwd bij de EERSTE aanroep na app-
 * start en pas ongeldig gemaakt na een download of verwijdering. Zo blijft
 * `getLocalClipUri` tijdens het lopen een pure lookup zonder disk-access.
 *
 * Vereist: npx expo install expo-file-system (nieuwe File/Directory/Paths-API,
 * al aanwezig in dit project, zie `exportService.ts`).
 */

// @ts-ignore: al geinstalleerd, zelfde importpatroon als exportService.ts/voiceService.ts
import { File, Directory, Paths } from 'expo-file-system';
import type { VoiceType } from '../config/voiceConfig';
import { sanitizeEnvValue, isHttpsUrl } from '../utils/env';

// ── Manifestformaat (vastgelegd in het ontwerpdoc) ──────────────────────────

interface VoicePackManifest {
  version: number;
  voice: string;
  voiceName?: string;
  modelId?: string;
  /** phraseId -> bestandsnaam (bevat een content-hash), bv. "km_5-a1b2c3d4.mp3" */
  files: Record<string, string>;
  totalBytes: number;
}

function isValidManifestShape(value: unknown): value is VoicePackManifest {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.files === 'object' && v.files !== null && typeof v.totalBytes === 'number';
}

// ── Padopbouw ────────────────────────────────────────────────────────────────

function voiceDir(voice: VoiceType): Directory {
  return new Directory(Paths.document, 'voice-packs', voice);
}

function localManifestFile(voice: VoiceType): File {
  return new File(voiceDir(voice), 'manifest.json');
}

// ── In-memory caches per stem ────────────────────────────────────────────────
//
// manifestCache: het lokale manifest zoals gelezen van schijf (of null als er
// geen geldig lokaal manifest is). availabilityCache/clipUriIndexCache worden
// samen opgebouwd door ensureValidated() (één keer per stem per sessie): een
// volledige controle of ALLE bestanden uit het manifest ook echt bestaan,
// waarna alleen de daadwerkelijk aanwezige clips in de index komen.

const manifestCache = new Map<VoiceType, VoicePackManifest | null>();
const availabilityCache = new Map<VoiceType, boolean>();
const clipUriIndexCache = new Map<VoiceType, Record<string, string>>();

function invalidateCaches(voice: VoiceType): void {
  manifestCache.delete(voice);
  availabilityCache.delete(voice);
  clipUriIndexCache.delete(voice);
}

/** Leest (en cachet) het lokale manifest.json. Null bij elke fout/afwezigheid. */
function readLocalManifest(voice: VoiceType): VoicePackManifest | null {
  if (manifestCache.has(voice)) return manifestCache.get(voice) ?? null;

  let result: VoicePackManifest | null = null;
  try {
    const file = localManifestFile(voice);
    if (file.exists) {
      const parsed = JSON.parse(file.textSync());
      if (isValidManifestShape(parsed)) result = parsed;
    }
  } catch {
    result = null;
  }
  manifestCache.set(voice, result);
  return result;
}

/**
 * Bouwt eenmalig (per stem, gecachet) de volledige validatie op: leest het
 * lokale manifest en controleert of ELK bestand eruit echt op schijf staat.
 * Alleen daadwerkelijk aanwezige clips komen in de index terecht. Volledig
 * defensief: elke fout resulteert in "niet beschikbaar" i.p.v. een crash.
 */
function ensureValidated(voice: VoiceType): void {
  if (availabilityCache.has(voice) && clipUriIndexCache.has(voice)) return;

  const manifest = readLocalManifest(voice);
  const index: Record<string, string> = {};
  let allPresent = false;

  if (manifest) {
    try {
      const dir = voiceDir(voice);
      allPresent = true;
      for (const [phraseId, filename] of Object.entries(manifest.files)) {
        const file = new File(dir, filename);
        if (file.exists) {
          index[phraseId] = file.uri;
        } else {
          allPresent = false;
        }
      }
    } catch {
      allPresent = false;
    }
  }

  availabilityCache.set(voice, allPresent);
  clipUriIndexCache.set(voice, index);
}

// ── Publieke API ──────────────────────────────────────────────────────────────

/**
 * Staat het volledige stempakket voor `voice` lokaal klaar (manifest +
 * ALLE bestanden eruit bestaan)? Resultaat wordt in-memory gecachet per stem
 * tot de volgende download of verwijdering.
 */
export function isPackAvailable(voice: VoiceType): boolean {
  try {
    ensureValidated(voice);
    return availabilityCache.get(voice) ?? false;
  } catch {
    return false;
  }
}

/**
 * Snelle, synchrone lookup van het lokale bestandspad voor een clip-id.
 * Gebruikt de in-memory index (gebouwd uit het lokale manifest) — geen
 * disk-access per aanroep, dus veilig om tijdens het lopen herhaaldelijk aan
 * te roepen. Geeft null terug als het pakket of de specifieke clip niet
 * (meer) beschikbaar is.
 */
export function getLocalClipUri(voice: VoiceType, phraseId: string): string | null {
  try {
    ensureValidated(voice);
    return clipUriIndexCache.get(voice)?.[phraseId] ?? null;
  } catch {
    return null;
  }
}

export interface DownloadPackResult {
  ok: boolean;
  /** Nederlandse, gebruikersvriendelijke foutmelding. Alleen gezet als ok=false. */
  error?: string;
}

/**
 * Haalt het externe manifest op en downloadt alle ontbrekende/gewijzigde
 * clips naar `Paths.document/voice-packs/{voice}/`. Overslaat bestanden die
 * al op schijf staan (naam bevat content-hash, dus naam-gelijk =
 * inhoud-gelijk) — dit is zowel de idempotentie- als de hervattingslogica.
 * Ruimt na een geslaagde download verweesde oude bestanden op (bv. na een
 * nieuwe manifestversie) en schrijft het lokale manifest.json als ALLERLAATSTE
 * stap (zie toelichting bovenaan dit bestand).
 *
 * `onProgress(done, total)` telt in bestanden (niet bytes) en loopt al op
 * voor bestanden die al aanwezig waren — zo toont een hervatte download
 * meteen de voortgang van waar hij gebleven was.
 */
export async function downloadPack(
  voice: VoiceType,
  onProgress?: (done: number, total: number) => void,
): Promise<DownloadPackResult> {
  try {
    const supabaseUrl = sanitizeEnvValue(process.env.EXPO_PUBLIC_SUPABASE_URL);
    if (!isHttpsUrl(supabaseUrl)) {
      return { ok: false, error: 'Geen verbinding met de opslag geconfigureerd.' };
    }

    const baseUrl = `${supabaseUrl}/storage/v1/object/public/voice-packs/${voice}`;
    const manifestUrl = `${baseUrl}/manifest.json`;

    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        response = await fetch(manifestUrl, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      return { ok: false, error: 'Geen verbinding. Controleer je internetverbinding en probeer het opnieuw.' };
    }

    if (response.status === 404) {
      return { ok: false, error: 'Stempakket nog niet gepubliceerd.' };
    }
    if (!response.ok) {
      return { ok: false, error: `Kon stempakket niet ophalen (fout ${response.status}).` };
    }

    let remoteManifest: VoicePackManifest;
    try {
      const json = await response.json();
      if (!isValidManifestShape(json)) throw new Error('ongeldig manifest');
      remoteManifest = json;
    } catch {
      return { ok: false, error: 'Ongeldig stempakket ontvangen.' };
    }

    const dir = voiceDir(voice);
    try {
      if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    } catch {
      return { ok: false, error: 'Kon geen opslagruimte reserveren op dit toestel.' };
    }

    const entries = Object.entries(remoteManifest.files);
    const total = entries.length;
    let done = 0;

    for (const [, filename] of entries) {
      const destFile = new File(dir, filename);
      if (!destFile.exists) {
        try {
          await File.downloadFileAsync(`${baseUrl}/${filename}`, destFile, { idempotent: true });
        } catch {
          // Bewust GEEN lokaal manifest schrijven: de al gedownloade
          // bestanden blijven staan (naam = contenthash) zodat een volgende
          // poging alleen het ontbrekende restant opnieuw ophaalt.
          onProgress?.(done, total);
          return { ok: false, error: 'Geen verbinding. Download afgebroken, probeer het later opnieuw.' };
        }
      }
      done++;
      onProgress?.(done, total);
    }

    // Verweesde oude bestanden opruimen (bv. na een nieuwe versie met
    // vervangen/verwijderde clips) — alles behalve manifest.json en de
    // bestanden die in het NIEUWE manifest voorkomen.
    try {
      const keep = new Set(Object.values(remoteManifest.files));
      keep.add('manifest.json');
      for (const entry of dir.list()) {
        if (entry instanceof File && !keep.has(entry.name)) {
          entry.delete();
        }
      }
    } catch {
      // Niet kritiek: verweesde bestanden kosten alleen wat extra opslag
    }

    // Lokale manifest.json als LAATSTE stap schrijven (zie toelichting
    // bovenaan dit bestand).
    try {
      localManifestFile(voice).write(JSON.stringify(remoteManifest));
    } catch {
      return { ok: false, error: 'Kon het stempakket niet lokaal opslaan.' };
    }

    invalidateCaches(voice);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Onbekende fout bij downloaden.' };
  }
}

/** Verwijdert het volledige lokale stempakket voor `voice`. Faalt altijd stil. */
export function deletePack(voice: VoiceType): void {
  try {
    const dir = voiceDir(voice);
    if (dir.exists) dir.delete();
  } catch {
    // Stil falen: een mislukte verwijdering mag de UI nooit laten crashen
  } finally {
    invalidateCaches(voice);
  }
}

export interface VoicePackInfo {
  downloaded: boolean;
  totalBytes?: number;
  clipCount?: number;
}

/** Status van het lokale stempakket voor `voice`, voor gebruik in de instellingen-UI. */
export function getPackInfo(voice: VoiceType): VoicePackInfo {
  try {
    ensureValidated(voice);
    const downloaded = availabilityCache.get(voice) ?? false;
    if (!downloaded) return { downloaded: false };

    const manifest = manifestCache.get(voice) ?? null;
    return {
      downloaded: true,
      totalBytes: manifest?.totalBytes,
      clipCount: manifest ? Object.keys(manifest.files).length : undefined,
    };
  } catch {
    return { downloaded: false };
  }
}

/**
 * Vaste, geschatte pakketgrootte voor de UI ("± 14 MB", zie ontwerpdoc: ±560
 * clips à ±25 kB). Bewust geen netwerkcall — dit is alleen een indicatie
 * voordat er gedownload wordt.
 */
export function getRemotePackSizeLabel(): string {
  return '± 14 MB';
}
