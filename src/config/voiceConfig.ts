/**
 * ElevenLabs spraakconfiguratie
 *
 * Sinds de overstap op vooraf gegenereerde stempakketten (zie
 * `_workspace/notities/Stempakketten-ontwerp.md`) is ElevenLabs GEEN
 * runtime-afhankelijkheid meer van de app. Deze configuratie (voice-ids en
 * voiceSettings) wordt uitsluitend nog gebruikt door het build-tijd-
 * generatiescript (fase B, `scripts/generate-voice-packs.ts`)
 * om éénmalig alle clips uit de zinnencatalogus (`voicePhrases.ts`) om te
 * zetten naar mp3's voor het stempakket. Tijdens het lopen spreekt de app
 * altijd óf een gedownload stempakket-clip (fase C) óf de ingebouwde
 * telefoonstem (expo-speech) — zie `src/services/voiceService.ts`.
 */

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
