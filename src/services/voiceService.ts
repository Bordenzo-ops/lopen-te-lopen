/**
 * voiceService
 *
 * Centrale spraakservice voor coaching en routebegeleiding.
 *
 * Werking:
 *  1. Is er een ElevenLabs API-sleutel ingesteld (src/config/voiceConfig.ts)?
 *     Dan wordt de tekst omgezet naar natuurlijke spraak via ElevenLabs.
 *  2. Gegenereerde audio wordt op schijf gecachet, zodat herhaalde zinnen
 *     geen nieuwe API-aanroep (en dus geen extra kosten) veroorzaken.
 *  3. Geen sleutel, geen netwerk of een fout? Dan valt de app automatisch
 *     terug op de ingebouwde telefoonstem (expo-speech).
 *
 * Vereist: npx expo install expo-audio expo-file-system
 */

import * as Speech from 'expo-speech';
// @ts-ignore: wordt geinstalleerd met "npx expo install expo-audio"
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
// @ts-ignore: wordt geinstalleerd met "npx expo install expo-file-system"
import { File, Directory, Paths } from 'expo-file-system';
import { ELEVENLABS, isElevenLabsConfigured, VoiceType } from '../config/voiceConfig';
import { ensureAnonymousSession } from './authService';
import { hasPremiumAccess } from '../config/premiumConfig';
import { useAppStore } from '../store/appStore';

let currentPlayer: any = null;
let audioModeReady = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Eenvoudige stringhash (djb2) voor cache-bestandsnamen */
function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

// ── Stemkeuze voor de ingebouwde telefoonstem (vangnet) ─────────────────────
//
// expo-speech biedt geen "man"/"vrouw"-parameter, alleen een lijst losse
// systeemstemmen per taal. Om de man/vrouw-keuze uit de UI toch te laten
// doorwerken op het fallbackpad, wordt hieronder een benadering gemaakt op
// basis van de beschikbare Nederlandse stemmen en (als vangnet) toonhoogte.
//
// nl-NL-voorkeur: "Nederlandse stemmen" omvat op sommige toestellen (vooral
// iOS) ook nl-BE (Vlaams), bijvoorbeeld de standaard iOS-stemmen Xander
// (nl-NL) en Ellen (nl-BE). Zonder maatregelen kiest de gender-heuristiek
// dan een Vlaamse stem terwijl de gebruiker een Nederlandse verwacht.
// Daarom geldt: zodra er minstens één nl-NL-stem (ook nl_NL) bestaat, wordt
// nl-BE volledig genegeerd en gebeurt de man/vrouw-keuze uitsluitend binnen
// de nl-NL-stemmen. Ontbreekt daarbinnen een herkende vrouwen- of
// mannenstem, dan wordt het geslacht met pitch benaderd (vrouw hoger op
// 1.15, man lager op 0.85/0.8). Binnen gelijke taal krijgen stemmen met
// kwaliteit "Enhanced" voorrang boven "Default" (indien dat veld
// beschikbaar is). Alleen als er geen enkele nl-NL-stem bestaat, valt de
// keuze terug op de overige nl-varianten (zoals nl-BE).
//
// Belangrijke beperking: dit is en blijft een benadering. Android-stem-
// identifiers (bijvoorbeeld "nl-nl-x-bmd-local") hebben geen gestandaardiseerd
// geslacht in hun naam, dus op zulke toestellen leunt de keuze vaak alleen op
// het pitch-verschil. Het resultaat kan dus per toestel/OS-versie verschillen.
// Alles hieronder is defensief: bij elke fout of ontbrekende data valt de
// app terug op de standaard systeemstem met pitch 1.0 (het oude gedrag).

interface FallbackVoiceChoice {
  /** Stem-identifier voor Speech.speak's `voice`-optie, indien bekend. */
  voiceId?: string;
  pitch: number;
}

type FallbackVoiceChoices = { female: FallbackVoiceChoice; male: FallbackVoiceChoice };

/** Cache van de Nederlandse systeemstemmen. undefined = nog niet opgehaald,
 *  null = opgehaald maar geen (bruikbare) Nederlandse stemmen gevonden. */
let cachedDutchVoices: Speech.Voice[] | null | undefined;
let dutchVoicesPromise: Promise<Speech.Voice[] | null> | null = null;

/**
 * Haalt eenmalig (gecachet) de Nederlandse systeemstemmen op. Best-effort:
 * ook een mislukte of lege poging wordt gecachet, zodat niet bij elke
 * speak()-aanroep opnieuw de (mogelijk trage) native lijst wordt opgevraagd.
 */
function getDutchVoices(): Promise<Speech.Voice[] | null> {
  if (cachedDutchVoices !== undefined) return Promise.resolve(cachedDutchVoices);
  if (!dutchVoicesPromise) {
    dutchVoicesPromise = (async () => {
      try {
        const all = await Speech.getAvailableVoicesAsync();
        const dutch = (all ?? []).filter(v =>
          (v.language ?? '').toLowerCase().startsWith('nl'),
        );
        return dutch.length > 0 ? dutch : null;
      } catch {
        return null;
      }
    })().then(result => {
      cachedDutchVoices = result;
      return result;
    });
  }
  return dutchVoicesPromise;
}

/**
 * Normaliseert een taalcode voor vergelijking: kleine letters en "_"
 * vervangen door "-" (bv. "nl_NL" -> "nl-nl").
 */
function normalizeLanguageTag(language: string | undefined): string {
  return (language ?? '').toLowerCase().replace(/_/g, '-');
}

/**
 * Sorteert Nederlandse stemmen zodat nl-NL boven andere nl-varianten
 * (zoals het Vlaamse nl-BE) komt te staan, en binnen dezelfde taal de
 * "Enhanced"-kwaliteitsstemmen (indien bekend) voorrang krijgen boven
 * "Default". Alleen als er géén nl-NL-stemmen zijn, komen andere
 * nl-varianten aan bod. Volledig defensief: bij een onverwachte fout
 * wordt de oorspronkelijke (ongesorteerde) lijst teruggegeven.
 */
function sortDutchVoicesByPreference(voices: Speech.Voice[]): Speech.Voice[] {
  try {
    const rank = (voice: Speech.Voice): number =>
      normalizeLanguageTag(voice.language) === 'nl-nl' ? 0 : 1;
    // 'quality' bestaat in deze expo-speech-versie (VoiceQuality-enum);
    // defensief met optional chaining voor het geval dit veld ontbreekt.
    const qualityRank = (voice: Speech.Voice): number =>
      (voice as { quality?: string })?.quality === 'Enhanced' ? 0 : 1;

    return [...voices].sort((a, b) => {
      const langDiff = rank(a) - rank(b);
      if (langDiff !== 0) return langDiff;
      return qualityRank(a) - qualityRank(b);
    });
  } catch {
    return voices;
  }
}

/**
 * Ruwe geslachtsheuristiek op basis van de stem-identifier/naam. Geeft
 * 'female', 'male' of null (onbekend) terug. Nooit een uitzondering: bij
 * onverwachte data valt dit terug op null.
 */
function guessVoiceGender(voice: Speech.Voice): VoiceType | null {
  try {
    const haystack = `${voice.identifier ?? ''} ${voice.name ?? ''}`.toLowerCase();
    // Let op: "female" bevat "male" als substring, dus altijd eerst op
    // "female" controleren.
    if (haystack.includes('female')) return 'female';
    if (haystack.includes('male')) return 'male';
    // Bekende iOS Apple-stemnamen zonder expliciete gender-marker in de naam.
    if (haystack.includes('xander')) return 'male';
    if (haystack.includes('claire') || haystack.includes('ellen')) return 'female';
    return null;
  } catch {
    return null;
  }
}

/** Cache van de berekende man/vrouw-stemkeuze. undefined = nog niet berekend,
 *  null = geen bruikbare Nederlandse stem gevonden (gebruik systeemdefault). */
let cachedVoiceChoices: FallbackVoiceChoices | null | undefined;
let voiceChoicesPromise: Promise<FallbackVoiceChoices | null> | null = null;

/**
 * Kiest binnen één stemmenlijst (de "pool") een vrouw- en mannenstem.
 *
 * - Vrouw: een als 'female' herkende stem op pitch 1.0; anders de eerste
 *   stem uit de pool met `femaleFallbackPitch` als benadering.
 * - Man: een als 'male' herkende stem op pitch 1.0; anders een andere stem
 *   dan de vrouw-keuze op pitch 0.85; anders dezelfde stem op pitch 0.8,
 *   zodat alleen het pitch-verschil nog onderscheid maakt.
 */
function chooseVoicesFromPool(
  pool: Speech.Voice[],
  femaleFallbackPitch: number,
): FallbackVoiceChoices {
  const withGender = pool.map(voice => ({ voice, gender: guessVoiceGender(voice) }));

  const femaleEntry = withGender.find(v => v.gender === 'female');
  const femaleVoice = femaleEntry?.voice ?? pool[0];
  const female: FallbackVoiceChoice = {
    voiceId: femaleVoice.identifier,
    // Geen herkende vrouwenstem in de pool: benader een vrouwstem via een
    // hogere pitch (spiegelbeeld van het man-via-lagere-pitch-patroon).
    pitch: femaleEntry ? 1.0 : femaleFallbackPitch,
  };

  const maleEntry = withGender.find(v => v.gender === 'male');
  let male: FallbackVoiceChoice;
  if (maleEntry) {
    // Herkenbare mannenstem gevonden: de stem zelf klinkt al als man,
    // geen extra pitch-correctie nodig.
    male = { voiceId: maleEntry.voice.identifier, pitch: 1.0 };
  } else {
    const alternativeVoice = pool.find(v => v.identifier !== femaleVoice.identifier);
    if (alternativeVoice) {
      // Geen herkenbare mannenstem, maar wel een andere stem in de pool
      // beschikbaar: kies die met een lagere pitch zodat het geluid
      // hoorbaar verschilt van de vrouw-keuze.
      male = { voiceId: alternativeVoice.identifier, pitch: 0.85 };
    } else {
      // Maar één stem in de pool beschikbaar: alleen het pitch-verschil
      // kan hier nog een onderscheid maken.
      male = { voiceId: femaleVoice.identifier, pitch: 0.8 };
    }
  }

  return { female, male };
}

/**
 * Bepaalt eenmalig (gecachet) welke systeemstem/pitch bij 'female' en 'male'
 * hoort. Zodra er minstens één nl-NL-stem bestaat, wordt de man/vrouw-keuze
 * UITSLUITEND binnen de nl-NL-stemmen gemaakt; nl-BE (Vlaams) wordt dan
 * volledig genegeerd, ook als daar een herkende vrouwen-/mannenstem in zit
 * (iOS-standaard: Xander is nl-NL, Ellen is nl-BE en valt dan af). Gender
 * wordt binnen nl-NL zo nodig met pitch benaderd (vrouw hoger op 1.15, man
 * lager op 0.85/0.8). Alleen als er géén enkele nl-NL-stem is, vallen we
 * terug op de overige nl-varianten met de oude keuzelogica. Volledig
 * defensief: geeft bij elke fout of lege stemmenlijst null terug, zodat de
 * aanroeper op het oude standaardgedrag terugvalt.
 */
function getFallbackVoiceChoices(): Promise<FallbackVoiceChoices | null> {
  if (cachedVoiceChoices !== undefined) return Promise.resolve(cachedVoiceChoices);
  if (!voiceChoicesPromise) {
    voiceChoicesPromise = (async () => {
      try {
        const rawDutchVoices = await getDutchVoices();
        if (!rawDutchVoices || rawDutchVoices.length === 0) return null;
        // nl-NL eerst, daarna (bij gelijke taal) Enhanced-kwaliteit eerst.
        const dutchVoices = sortDutchVoicesByPreference(rawDutchVoices);

        // Minstens één nl-NL-stem? Dan kiezen we uitsluitend binnen die
        // subset, zodat nooit een Vlaamse (nl-BE) stem gekozen wordt terwijl
        // er een Nederlandse beschikbaar is. Vrouw-benadering gebeurt dan
        // desnoods via een hogere pitch (1.15) op een nl-NL-stem.
        const nlNlVoices = dutchVoices.filter(
          v => normalizeLanguageTag(v.language) === 'nl-nl',
        );
        if (nlNlVoices.length > 0) {
          return chooseVoicesFromPool(nlNlVoices, 1.15);
        }
        // Geen enkele nl-NL-stem: oude gedrag over alle nl-varianten, met
        // de eerste stem op pitch 1.0 als vrouw-fallback.
        return chooseVoicesFromPool(dutchVoices, 1.0);
      } catch {
        return null;
      }
    })().then(result => {
      cachedVoiceChoices = result;
      return result;
    });
  }
  return voiceChoicesPromise;
}

/** Ingebouwde telefoonstem als vangnet, met een benadering van de man/vrouw-keuze */
async function fallbackSpeak(text: string, voice: VoiceType): Promise<void> {
  Speech.stop();

  // Zonder actieve audiosessie speelt AVSpeechSynthesizer op iOS niets af
  // bij een vergrendeld scherm/achtergrond of met de stille-modus-schakelaar
  // aan. Daarom ook hier (net als op het ElevenLabs-pad) eerst de audiosessie
  // activeren. Defensief: ensureAudioMode() faalt nooit hard.
  await ensureAudioMode();

  let options: Speech.SpeechOptions = { language: 'nl-NL', pitch: 1.0, rate: 0.95 };
  try {
    const choices = await getFallbackVoiceChoices();
    const choice = choices?.[voice];
    if (choice) {
      options = {
        language: 'nl-NL',
        rate: 0.95,
        pitch: choice.pitch,
        ...(choice.voiceId ? { voice: choice.voiceId } : {}),
      };
    }
  } catch {
    // Terugvallen op de standaardopties hierboven (oude gedrag)
  }

  Speech.speak(text, options);
}

/**
 * Audio dempen van muziek (ducking), afspelen in stille modus (iOS) en
 * doorspelen als de app naar de achtergrond gaat/het scherm vergrendeld is
 * (nodig voor gesproken coaching tijdens een lopende hardloopsessie; de app
 * heeft hiervoor UIBackgroundModes "audio" in app.json).
 */
async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
      interruptionModeAndroid: 'duckOthers',
    });
  } catch {
    // Niet kritiek: zonder audio mode speelt het geluid alsnog af
  }
  audioModeReady = true;
}

function getCacheFile(voiceId: string, text: string): any {
  const dir = new Directory(Paths.cache, 'tts');
  try {
    dir.create({ intermediates: true, idempotent: true });
  } catch {
    // Map bestaat al
  }
  return new File(dir, `${voiceId}-${hashText(text)}.mp3`);
}

/** Haalt mp3-audio op via de Supabase TTS Edge Function (sleutel blijft serverside) */
async function fetchTts(voiceId: string, text: string): Promise<Uint8Array> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

  if (!supabaseUrl) throw new Error('Supabase URL niet geconfigureerd');

  // De TTS-function vereist een geldige Supabase-sessietoken (ook anoniem).
  // Belangrijk: premium-stemmen moeten óók werken als de gebruiker cloud-sync
  // nooit heeft aangezet. Daarom starten we hier zo nodig zelf een anonieme
  // sessie, puur voor deze TTS-aanroep. Er wordt daardoor niets gesynct:
  // syncNow/initBackend blijven achter de cloudSyncEnabled-toestemming zitten.
  // Lukt ook dat niet (offline, geen backend), dan gooien we hier, zodat
  // speak() terugvalt op de telefoonstem.
  const session = await ensureAnonymousSession();
  const accessToken = session?.access_token ?? '';
  if (!accessToken) throw new Error('Geen Supabase-sessie voor TTS');

  const res = await fetch(`${supabaseUrl}/functions/v1/tts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      voiceId,
      text,
      modelId: ELEVENLABS.modelId,
      voiceSettings: ELEVENLABS.voiceSettings,
    }),
  });
  if (!res.ok) throw new Error(`TTS-proxy antwoordde met status ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

// ── Publieke API ──────────────────────────────────────────────────────────────

/**
 * Spreekt een tekst uit met de gekozen stem.
 * Onderbreekt een eventueel lopende uitspraak.
 */
export async function speak(text: string, voice: VoiceType = 'female'): Promise<void> {
  stop();

  // Premium-stemmen (ElevenLabs) zitten achter de paywall. Gratis gebruikers
  // krijgen altijd de ingebouwde telefoonstem. Offline-first: een onbekende
  // premium-status telt als gratis. Lees de status defensief uit de store.
  let premiumVoices = false;
  try {
    premiumVoices = hasPremiumAccess(useAppStore.getState().isPremium);
  } catch {
    premiumVoices = hasPremiumAccess(false);
  }

  if (!premiumVoices || !isElevenLabsConfigured()) {
    await fallbackSpeak(text, voice);
    return;
  }

  try {
    const voiceId = ELEVENLABS.voices[voice].id;
    const file = getCacheFile(voiceId, text);

    if (!file.exists) {
      const audio = await fetchTts(voiceId, text);
      file.write(audio);
    }

    await ensureAudioMode();
    currentPlayer = createAudioPlayer({ uri: file.uri });
    currentPlayer.play();
  } catch {
    // Netwerk weg, quotum op of afspeelfout: telefoonstem als vangnet
    await fallbackSpeak(text, voice);
  }
}

/** Stopt alle lopende spraak (ElevenLabs en telefoonstem) */
export function stop(): void {
  Speech.stop();
  try {
    currentPlayer?.pause?.();
    currentPlayer?.remove?.();
  } catch {
    // Player was al opgeruimd
  }
  currentPlayer = null;
}
