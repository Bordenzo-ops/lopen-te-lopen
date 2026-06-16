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

/** Ingebouwde telefoonstem als vangnet */
function fallbackSpeak(text: string): void {
  Speech.stop();
  Speech.speak(text, { language: 'nl-NL', pitch: 1.0, rate: 0.95 });
}

/** Audio dempen van muziek (ducking) en afspelen in stille modus (iOS) */
async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
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

/** Haalt mp3-audio op bij ElevenLabs */
async function fetchTts(voiceId: string, text: string): Promise<Uint8Array> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS.modelId,
        voice_settings: ELEVENLABS.voiceSettings,
      }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs antwoordde met status ${res.status}`);
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
    fallbackSpeak(text);
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
    fallbackSpeak(text);
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
