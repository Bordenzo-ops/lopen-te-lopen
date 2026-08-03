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
import { hasPremiumAccess } from '../config/premiumConfig';
import { useAppStore } from '../store/appStore';

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

/**
 * Haalt (netwerk, best-effort, timeout 10s) het externe manifest voor
 * `voice` op. Geeft `null` terug bij elke fout (geen Supabase-configuratie,
 * geen netwerk, timeout, HTTP-fout, ongeldige vorm) — gooit nooit. Gedeeld
 * door `isPackUpdateAvailable` en `maybeAutoUpdatePack` zodat de
 * netwerklogica maar op één plek staat.
 */
async function fetchRemoteManifest(voice: VoiceType): Promise<VoicePackManifest | null> {
  try {
    const supabaseUrl = sanitizeEnvValue(process.env.EXPO_PUBLIC_SUPABASE_URL);
    if (!isHttpsUrl(supabaseUrl)) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    let response: Response;
    try {
      response = await fetch(
        `${supabaseUrl}/storage/v1/object/public/voice-packs/${voice}/manifest.json`,
        { signal: controller.signal },
      );
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) return null;

    const remote = await response.json();
    if (!isValidManifestShape(remote)) return null;
    return remote;
  } catch {
    return null;
  }
}

/**
 * Vergelijkt een lokaal met een extern manifest (bestandsnamen bevatten een
 * content-hash, dus een naamverschil = echt andere/nieuwe audio).
 * `changedCount` telt de externe bestanden die nieuw zijn of van naam
 * veranderd t.o.v. het lokale manifest — precies de bestanden die
 * `downloadPack` daadwerkelijk zou moeten downloaden (bestaande bestanden
 * met een gelijke naam worden door `downloadPack` overgeslagen). `hasUpdate`
 * is tevens waar als er lokale bestanden zijn die extern niet meer bestaan
 * (aantal komt dan niet overeen), ook al hoeft daar niets voor gedownload te
 * worden — dat is het oorspronkelijke gedrag van `isPackUpdateAvailable`.
 */
function compareManifests(
  local: VoicePackManifest,
  remote: VoicePackManifest,
): { hasUpdate: boolean; changedCount: number } {
  const localFiles = local.files;
  const remoteFiles = remote.files;
  const remoteKeys = Object.keys(remoteFiles);

  let changedCount = 0;
  for (const key of remoteKeys) {
    if (localFiles[key] !== remoteFiles[key]) changedCount++;
  }

  const hasUpdate = Object.keys(localFiles).length !== remoteKeys.length || changedCount > 0;
  return { hasUpdate, changedCount };
}

/**
 * Controleert (netwerk, best-effort) of er op de server een nieuwere versie
 * van het stempakket staat dan wat lokaal gedownload is — bijvoorbeeld omdat
 * er nieuwe coachingzinnen aan de catalogus zijn toegevoegd.
 *
 * Alleen zinvol als er lokaal al een compleet pakket staat; in alle andere
 * gevallen (geen pakket, geen netwerk, fout) geeft dit `false` terug — de
 * aanroeper toont dan gewoon geen bijwerkknop. `downloadPack` is al
 * incrementeel, dus bijwerken = simpelweg opnieuw downloadPack aanroepen.
 */
export async function isPackUpdateAvailable(voice: VoiceType): Promise<boolean> {
  try {
    if (!isPackAvailable(voice)) return false;
    const local = readLocalManifest(voice);
    if (!local) return false;

    const remote = await fetchRemoteManifest(voice);
    if (!remote) return false;

    return compareManifests(local, remote).hasUpdate;
  } catch {
    return false;
  }
}

// ── Stille automatische update ──────────────────────────────────────────────
//
// Eén module-brede vlag voorkomt twee gelijktijdige updates (bv. app-start
// gevolgd door meteen terug naar de voorgrond). Een minimale tijd tussen
// twee controles per stem voorkomt dat snel heen-en-weer schakelen tussen
// apps een reeks netwerkverzoeken oplevert.
let autoUpdateRunning = false;
const lastAutoUpdateCheckAt = new Map<VoiceType, number>();

/** Minimale tijd tussen twee automatische bijwerk-controles, per stem. */
const AUTO_UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 uur

/**
 * Drempel (geschatte bytes) waaronder een stille achtergrond-update is
 * toegestaan. Een paar gewijzigde coachingzinnen (elk ±25 kB, zie
 * `getRemotePackSizeLabel`/ontwerpdoc) mag ongemerkt over mobiele data; een
 * (vrijwel) compleet nieuw pakket van ±14 MB absoluut niet — dat blijft de
 * bewuste keuze achter de bijwerkknop in Instellingen. 1 MB komt overeen met
 * enkele tientallen gewijzigde clips: ruim genoeg voor een normale
 * tekstcorrectie in een paar zinnen, ruim onder een substantieel deel van
 * het volledige pakket.
 */
const AUTO_UPDATE_MAX_ESTIMATED_BYTES = 1 * 1024 * 1024; // 1 MB

/**
 * Werkt het stempakket voor `voice` stil bij als dat kan en klein genoeg is
 * — zodat een gebruiker met een verouderd pakket niet zelf op de
 * bijwerkknop in Instellingen hoeft te tikken (zie `app/_layout.tsx`, bij
 * app-start en terugkeer naar de voorgrond). Doet NOOIT iets zichtbaars
 * (geen UI, geen melding, geen voortgangsindicatie) en gooit NOOIT: elke
 * voorwaarde hieronder is een losse, benoemde vroege return, en de hele
 * functie is bovendien in een try/catch gewikkeld als laatste vangnet.
 */
export async function maybeAutoUpdatePack(voice: VoiceType): Promise<void> {
  try {
    // 1. Premium: stempakketten worden alleen afgespeeld met premium (zie
    //    tryPlayPackClips in voiceService.ts) — zonder premium is elke
    //    gedownloade byte verspild.
    let premiumOk = false;
    try {
      premiumOk = hasPremiumAccess(useAppStore.getState().isPremium);
    } catch {
      premiumOk = false;
    }
    if (!premiumOk) return;

    // 2. Er staat al een pakket: alleen BIJWERKEN wat er is. Een eerste
    //    download blijft een bewuste keuze van de gebruiker in Instellingen.
    if (!isPackAvailable(voice)) return;

    // 3. Geen actieve sessie: nooit downloaden tijdens het hardlopen — dat
    //    kost bandbreedte en schijf-I/O terwijl er clips worden afgespeeld,
    //    en downloadPack vervangt/verwijdert bestanden terwijl de sessie
    //    ze mogelijk juist nodig heeft.
    if (useAppStore.getState().activeSession) return;

    // 6. Niet twee keer tegelijk (bv. app-start + meteen terug naar de
    //    voorgrond) en niet vaker dan één keer per interval controleren.
    if (autoUpdateRunning) return;
    const lastCheck = lastAutoUpdateCheckAt.get(voice) ?? 0;
    if (Date.now() - lastCheck < AUTO_UPDATE_CHECK_INTERVAL_MS) return;

    autoUpdateRunning = true;
    lastAutoUpdateCheckAt.set(voice, Date.now());
    try {
      const local = readLocalManifest(voice);
      if (!local) return;

      // 4. Er is daadwerkelijk iets veranderd — dezelfde vergelijking als
      //    isPackUpdateAvailable (hier hergebruikt via compareManifests(),
      //    niet gedupliceerd).
      const remote = await fetchRemoteManifest(voice);
      if (!remote) return;

      const { hasUpdate, changedCount } = compareManifests(local, remote);
      if (!hasUpdate) return;

      // 5. Het verschil moet klein genoeg zijn — de belangrijkste
      //    voorwaarde. Er is geen netwerktype-detectie beschikbaar
      //    (expo-network zit niet in dit project; toevoegen vereist een
      //    nieuwe native build), dus schat het verschil als aantal
      //    gewijzigde/nieuwe bestanden × gemiddelde bestandsgrootte
      //    (totalBytes / aantal bestanden). Dat is een schatting, geen
      //    exacte meting: coachingclips zijn korte, vergelijkbare zinnen,
      //    dus het gemiddelde ligt dicht genoeg bij elk individueel
      //    bestand om hier veilig op te varen — zelfs een factor 2-3
      //    afwijking per bestand verandert de conclusie niet bij het
      //    onderscheid dat hier telt (een handvol gewijzigde clips versus
      //    een nieuw volledig pakket).
      const remoteFileCount = Object.keys(remote.files).length;
      if (remoteFileCount === 0) return;
      const avgBytesPerFile = remote.totalBytes / remoteFileCount;
      const estimatedBytes = changedCount * avgBytesPerFile;
      if (estimatedBytes > AUTO_UPDATE_MAX_ESTIMATED_BYTES) return;

      // Nog steeds geen actieve sessie? De netwerkcontrole hierboven kan
      // even geduurd hebben; controleer daarom vlak voor het downloaden
      // opnieuw (zie voorwaarde 3).
      if (useAppStore.getState().activeSession) return;

      // Alle voorwaarden gehaald. downloadPack is al incrementeel (slaat
      // bestanden over die al op schijf staan) en schrijft het manifest als
      // allerlaatste stap, dus een halverwege afgebroken update laat nooit
      // een kapotte staat achter (zie toelichting bovenaan dit bestand) en
      // ververst zelf ook de in-memory caches bij succes.
      await downloadPack(voice);
    } finally {
      autoUpdateRunning = false;
    }
  } catch {
    // Volledig stil: een mislukte automatische update mag nooit zichtbaar
    // worden of de rest van de app verstoren.
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
