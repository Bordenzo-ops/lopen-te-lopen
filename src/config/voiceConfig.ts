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
 *
 * STEMMENLIJST: de sleutels hieronder ('female', 'male', ...) zijn ook de
 * padnamen in Supabase Storage (`voice-packs/{sleutel}/...`) — ze mogen dus
 * NOOIT hernoemd worden zolang er al gepubliceerde stempakketten onder die
 * naam bestaan. 'female' en 'male' zijn en blijven Roos en Adam (Nederlands);
 * nieuwe stemmen krijgen een nieuwe, eigen sleutel (bv. 'flemish_female').
 *
 * Een stem met een LEGE elevenVoiceId is nog niet geactiveerd: de UI
 * (instellingen + onboarding) verbergt hem en het generatiescript slaat hem
 * over. De ID invullen + het script draaien en uploaden is dus de enige
 * schakelaar om een nieuwe stem live te zetten.
 */

export type VoiceType = 'female' | 'male' | 'flemish_female' | 'flemish_male';

export interface VoiceDefinition {
  /** Identifier — tevens de padnaam in Supabase Storage (voice-packs/{key}/...). */
  key: VoiceType;
  /** Naam zoals getoond in de UI (bv. "Roos"). */
  name: string;
  /** Korte UI-sublabel, bv. 'Nederlands' of 'Vlaams'. */
  accentLabel: string;
  /** Voor de telefoonstem-fallback (man/vrouw-benadering, zie voiceService.ts). */
  gender: 'female' | 'male';
  /** ElevenLabs voice-id. Alleen gebruikt door scripts/generate-voice-packs.ts. */
  elevenVoiceId: string;
}

export const VOICES: VoiceDefinition[] = [
  {
    key: 'female',
    name: 'Roos',
    accentLabel: 'Nederlands',
    gender: 'female',
    elevenVoiceId: '7qdUFMklKPaaAVMsBTBt',
  },
  {
    key: 'male',
    name: 'Adam',
    accentLabel: 'Nederlands',
    gender: 'male',
    elevenVoiceId: 'pNInz6obpgDQGcFmaJgB',
  },
  {
    key: 'flemish_female',
    name: 'Elke',
    accentLabel: 'Vlaams',
    gender: 'female',
    elevenVoiceId: '7hSjFLTqJTvdLPxYg8Mj',
  },
  {
    key: 'flemish_male',
    name: 'Steven',
    accentLabel: 'Vlaams',
    gender: 'male',
    elevenVoiceId: 'W3tynvkIV6vLqFqVMaqT',
  },
];

/**
 * Zoekt de stemdefinitie bij een sleutel. Defensief: een onbekende/verouderde
 * persisted waarde (bv. een corrupte store) valt veilig terug op de eerste
 * stem in de lijst in plaats van te crashen.
 */
export function voiceDefinition(key: VoiceType): VoiceDefinition {
  return VOICES.find(v => v.key === key) ?? VOICES[0];
}

export const ELEVENLABS = {
  /** Meertalig model met goede ondersteuning voor Nederlands */
  modelId: 'eleven_multilingual_v2',

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
