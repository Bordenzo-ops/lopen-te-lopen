/**
 * voiceService
 *
 * Centrale spraakservice voor coaching en routebegeleiding.
 *
 * Sinds de overstap op vooraf gegenereerde stempakketten (zie
 * `_workspace/notities/Stempakketten-ontwerp.md`) loopt alle coachingtekst
 * via `speakPhrases(utterance, voice)`: de aanroeper geeft een rij
 * catalogus-clip-ids (`src/config/voicePhrases.ts`) plus een natuurlijke
 * volzin als vangnet mee. In fase A/B bestaan de clips nog niet, dus
 * spreekt de app altijd de vangnettekst uit via de ingebouwde telefoonstem
 * (expo-speech); fase C voegt hierboven het afspelen van de echte clips
 * toe (op het gemarkeerde punt in `speakPhrases` hieronder).
 *
 * Het oude runtime-pad naar ElevenLabs (premium-check → Supabase edge
 * function → mp3 downloaden → afspelen) is hier verwijderd: dat pad werkte
 * in de praktijk nooit hoorbaar (zie ontwerpdoc, "Waarom") en ElevenLabs is
 * nu alleen nog build-tijd-gereedschap voor het generatiescript (fase B).
 *
 * `speak(text, voice)` blijft bestaan voor vrije tekst (bv. toekomstige
 * losse meldingen) en doet altijd de telefoonstem.
 *
 * Vereist (voor fase C, nu al geïnstalleerd t.b.v. audiosessiebeheer):
 * npx expo install expo-audio expo-file-system
 */

import * as Speech from 'expo-speech';
// @ts-ignore: wordt geinstalleerd met "npx expo install expo-audio" — createAudioPlayer
// wordt pas in fase C gebruikt (afspelen van de gedownloade clips), maar staat hier al
// klaar zodat die fase geen importwijziging meer nodig heeft.
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { VoiceType } from '../config/voiceConfig';
import type { PhraseUtterance } from '../config/voicePhrases';

let currentPlayer: any = null;
let audioModeReady = false;

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
  // aan (dezelfde audiosessie die fase C straks ook voor clip-afspelen
  // gebruikt). Daarom eerst de audiosessie activeren. Defensief:
  // ensureAudioMode() faalt nooit hard.
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

// ── Publieke API ──────────────────────────────────────────────────────────────

/**
 * Spreekt een tekst uit met de gekozen stem.
 * Onderbreekt een eventueel lopende uitspraak. Alleen voor vrije tekst
 * (geen catalogus-ids) — gebruik voor coachingzinnen bij voorkeur
 * `speakPhrases`, zodat fase C die straks als clips kan afspelen.
 */
export async function speak(text: string, voice: VoiceType = 'female'): Promise<void> {
  stop();
  await fallbackSpeak(text, voice);
}

/**
 * Spreekt een catalogusboodschap uit (zie src/config/voicePhrases.ts):
 * een rij clip-ids plus een natuurlijke volzin als vangnet.
 *
 * Fase A/B: de clips bestaan nog niet, dus wordt altijd de vangnettekst
 * via de telefoonstem gesproken — functioneel identiek aan het bestaande
 * gedrag. Fase C voegt hierboven, vóór de fallback, het pad toe dat eerst
 * controleert of het stempakket voor `voice` compleet op schijf staat en zo
 * ja de clips in `utterance.ids` sequentieel afspeelt (expo-audio); pas als
 * dat niet lukt (geen pakket, ontbrekende clip, afspeelfout) valt het terug
 * op onderstaande fallbackSpeak-aanroep.
 */
export async function speakPhrases(utterance: PhraseUtterance, voice: VoiceType = 'female'): Promise<void> {
  stop();

  // ── FASE C: hier komt het clip-afspeelpad (voicePackService + expo-audio) ──
  // Zolang dat er niet is, spreekt de telefoonstem altijd de fallbackText.

  await fallbackSpeak(utterance.fallbackText, voice);
}

/** Stopt alle lopende spraak (clip-afspelen (fase C) en telefoonstem) */
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
