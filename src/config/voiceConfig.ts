/**
 * ElevenLabs spraakconfiguratie
 *
 * De coaching en routebegeleiding gebruiken ElevenLabs text-to-speech
 * voor een natuurlijke stem. Zonder API-sleutel valt de app automatisch
 * terug op de ingebouwde telefoonstem (expo-speech).
 */

export type VoiceType = 'female' | 'male';

export const ELEVENLABS = {
  /**
   * De API-sleutel komt uit het .env-bestand in de projectroot
   * (EXPO_PUBLIC_ELEVENLABS_API_KEY). Zie .env.example voor de opzet.
   * Geen sleutel? Dan gebruikt de app de ingebouwde telefoonstem.
   *
   * Let op: na het aanpassen van .env moet de Metro-server opnieuw
   * gestart worden (npx expo start) om de nieuwe waarde te laden.
   */
  apiKey: process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? '',

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

export const isElevenLabsConfigured = (): boolean => ELEVENLABS.apiKey.length > 0;
