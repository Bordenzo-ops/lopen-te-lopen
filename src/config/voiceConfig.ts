/**
 * ElevenLabs spraakconfiguratie
 *
 * De coaching en routebegeleiding gebruiken ElevenLabs text-to-speech
 * voor een natuurlijke stem. De API-aanroep loopt via een Supabase Edge
 * Function (supabase/functions/tts) zodat de ElevenLabs-sleutel nooit
 * in de app-bundel terechtkomt. Zonder actieve Supabase-configuratie
 * valt de app automatisch terug op de ingebouwde telefoonstem (expo-speech).
 */

import { sanitizeEnvValue, isHttpsUrl } from '../utils/env';

export type VoiceType = 'female' | 'male';

export const ELEVENLABS = {
  /** Meertalig model met goede ondersteuning voor Nederlands */
  modelId: 'eleven_multilingual_v2',

  /**
   * Stemkeuzes. Roos is een native Nederlandse stem uit de Voice Library
   * (fris, warm en vrolijk). Andere stem? Zoek er een in de Voice Library
   * op elevenlabs.io, voeg hem toe aan My Voices en vervang hieronder het id.
   */
  voices: {
    female: { id: '7qdUFMklKPaaAVMsBTBt', name: 'Roos' },
    male:   { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam' },
  } as Record<VoiceType, { id: string; name: string }>,

  /**
   * Steminstellingen:
   * - lagere stability geeft een levendigere, expressievere voordracht
   * - style voegt extra energie toe (0 = neutraal, 1 = maximaal)
   */
  voiceSettings: {
    stability: 0.4,
    similarity_boost: 0.75,
    style: 0.45,
    use_speaker_boost: true,
  },
};

/**
 * TTS is beschikbaar zodra de Supabase Edge Function bereikbaar is.
 * De Supabase URL is publiek (EXPO_PUBLIC_), de ElevenLabs-sleutel
 * staat serverside als Supabase Secret en zit nooit in de bundel.
 *
 * Zelfde hardening als isSupabaseConfigured() in supabaseClient.ts: een
 * niet-geexpandeerde placeholder ("$EXPO_PUBLIC_SUPABASE_URL") wordt eerst
 * gesaneerd tot een lege string, en de overgebleven waarde moet met
 * "https://" beginnen om als geldig te tellen.
 */
export const isElevenLabsConfigured = (): boolean =>
  isHttpsUrl(sanitizeEnvValue(process.env.EXPO_PUBLIC_SUPABASE_URL));
