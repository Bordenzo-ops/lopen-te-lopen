/**
 * useIntervalCoaching
 *
 * Gesproken cues tijdens een intervaltraining (type 'interval', zie
 * src/data/trainingPlans.ts en src/data/intervals.ts). Deze hook draait geen
 * eigen timer: app/session/active.tsx roept `onTick(elapsedRef.current)` elke
 * seconde aan, alleen terwijl de sessie daadwerkelijk loopt (niet gepauzeerd,
 * niet tijdens de countdown) - precies zoals de secondetimer daar al werkt.
 * Op basis van die verstreken tijd en `intervalStateAt` (intervals.ts) wordt
 * bepaald in welk segment de loper zit en welke cue daarbij hoort.
 *
 * Twee soorten momenten:
 *  - Segmentovergang: het moment waarop een nieuw segment begint (van
 *    warming-up naar de eerste herhaling, van werk naar herstel, enz.). Elke
 *    overgang vuurt hooguit één cue, bijgehouden met `lastSegmentIndexRef`.
 *    Het allereerste segment (index 0, de warming-up) vuurt bewust GEEN cue:
 *    de gesproken sessie-intro (intervalIntroUtterance, zie active.tsx) dekt
 *    de start al. Daarom begint `lastSegmentIndexRef` op 0 in plaats van -1.
 *  - Binnen-segment-cues: momenten die zich TIJDENS een segment voordoen
 *    (bijna zo ver, laatste 10 seconden, halverwege een lang werkinterval).
 *    Elk zo'n moment vuurt hooguit één keer per segment, bijgehouden met een
 *    Set van sleutels `${segmentIndex}:${soort}` in `firedFlagsRef`.
 *
 * Belangrijke regel: nooit twee `speakPhrases`-aanroepen in dezelfde tick.
 * Een tweede aanroep kapt de eerste af (zie voiceService.speakPhrases), dus
 * per `onTick`-aanroep spreekt deze hook hoogstens één cue uit. Dat wordt
 * geborgd met een lokale `firedThisTick`-vlag: zodra die tick al een cue
 * gesproken heeft, wordt elke volgende conditie in diezelfde aanroep
 * overgeslagen. De bijbehorende "al afgevuurd"-sleutel wordt in dat geval
 * NIET vastgelegd, zodat de cue de eerstvolgende tick (als de voorwaarde dan
 * nog geldt) alsnog aan de beurt komt in plaats van voorgoed over te slaan.
 *
 * Bijzonder geval: de start van de tweede helft van de herhalingen (bv. rep 4
 * van 6) valt op hetzelfde moment als de gewone "ga"-cue van die herhaling.
 * Bewuste keuze: op dat moment krijgt de motiverende "je bent op de helft"-
 * melding (setHalf) voorrang boven de gewone ga-cue - de ga-cue van precies
 * dát segment wordt dan overgeslagen (de loper hoort duidelijk dat het werk
 * begint via de toon van de melding, ook zonder de losse "Gaan!"-cue).
 *
 * Variant-tellers (go/recover/getReady/workEnd) rouleren net als in
 * useHeartRateCoaching.ts, zodat herhaalde cues van hetzelfde soort niet
 * steeds identiek klinken (zie intervalCueUtterance in voicePhrases.ts, die
 * zelf modulo op de varianten klemt).
 *
 * Zonder `enabled` of zonder `structure` doet de hook niets.
 *
 * Gebruik:
 *   const intervalCoaching = useIntervalCoaching(voiceEnabled, session?.interval, voiceType);
 *   // elke seconde, alleen als de sessie loopt:
 *   intervalCoaching.onTick(elapsedRef.current);
 *   // bij de start van de sessie (na de countdown):
 *   intervalCoaching.reset();
 */

import { useCallback, useMemo, useRef } from 'react';
import * as voiceService from '../services/voiceService';
import type { VoiceType } from '../config/voiceConfig';
import { intervalCueUtterance, type PhraseUtterance } from '../config/voicePhrases';
import { buildIntervalSegments, intervalStateAt } from '../data/intervals';
import type { IntervalStructure } from '../data/trainingPlans';

export function useIntervalCoaching(
  enabled: boolean,
  structure: IntervalStructure | undefined,
  voiceType: VoiceType = 'female',
) {
  // Eenmalig berekend zolang de structure ongewijzigd blijft (die staat vast
  // voor de duur van een sessie, zie de opmerking bij session in active.tsx).
  const segments = useMemo(
    () => (structure ? buildIntervalSegments(structure) : []),
    [structure],
  );

  // Index van het segment waar de vorige tick in zat. Begint op 0, niet -1:
  // zo vuurt het allereerste segment (de warming-up) geen cue af, zie de
  // toelichting bovenaan dit bestand.
  const lastSegmentIndexRef = useRef(0);
  // "Al afgevuurd"-sleutels voor de binnen-segment-cues, vorm
  // `${segmentIndex}:getReady|workEnd|workHalf`.
  const firedFlagsRef = useRef<Set<string>>(new Set());
  // Eenmalige "je bent op de helft van je intervallen"-melding, voor de hele
  // run (niet per segment) - zie reset() hieronder.
  const setHalfSpokenRef = useRef(false);
  // Variant-tellers voor de roulatie in intervalCueUtterance.
  const goVariantRef = useRef(0);
  const recoverVariantRef = useRef(0);
  const getReadyVariantRef = useRef(0);
  const workEndVariantRef = useRef(0);

  /** Zet alle interne toestand terug, bij de start van een nieuwe sessie. */
  const reset = useCallback(() => {
    lastSegmentIndexRef.current = 0;
    firedFlagsRef.current = new Set();
    setHalfSpokenRef.current = false;
    goVariantRef.current = 0;
    recoverVariantRef.current = 0;
    getReadyVariantRef.current = 0;
    workEndVariantRef.current = 0;
  }, []);

  const onTick = useCallback((elapsedSec: number) => {
    if (!enabled || segments.length === 0) return;

    const state = intervalStateAt(segments, elapsedSec);
    const flags = firedFlagsRef.current;
    // Hoogstens één cue per tick, zie de toelichting bovenaan dit bestand.
    let firedThisTick = false;

    const speakUtterance = (utterance: PhraseUtterance) => {
      firedThisTick = true;
      voiceService.speakPhrases(utterance, voiceType);
    };

    // ── Segmentovergang ────────────────────────────────────────────────────
    if (state.index !== lastSegmentIndexRef.current) {
      const seg = state.segment;

      if (seg.phase === 'work') {
        const isSecondHalfStart =
          !seg.isLastWork && seg.repIndex === Math.floor((seg.repTotal ?? 0) / 2) + 1;

        if (isSecondHalfStart && !setHalfSpokenRef.current) {
          // Voorrang aan de motiverende halverwege-melding, zie toelichting
          // bovenaan dit bestand: de ga-cue van dit segment slaan we dan over.
          setHalfSpokenRef.current = true;
          speakUtterance(intervalCueUtterance('setHalf'));
        } else if (seg.isLastWork) {
          speakUtterance(intervalCueUtterance('go', { isLast: true }));
        } else {
          speakUtterance(intervalCueUtterance('go', { variant: goVariantRef.current++ }));
        }
      } else if (seg.phase === 'recovery') {
        speakUtterance(intervalCueUtterance('recover', { variant: recoverVariantRef.current++ }));
      } else if (seg.phase === 'cooldown') {
        speakUtterance(intervalCueUtterance('cooldown'));
      }
      // seg.phase === 'warmup': niets, de gesproken intro dekt de start al.

      lastSegmentIndexRef.current = state.index;
    }

    // ── Binnen-segment-cues (elk hooguit één keer per segment) ─────────────

    // "Maak je klaar": huidig segment is warming-up of herstel, het volgende
    // segment is werk, en er is nog hoogstens 12 seconden te gaan.
    if (!firedThisTick && (state.phase === 'warmup' || state.phase === 'recovery')) {
      const key = `${state.index}:getReady`;
      const nextSegment = segments[state.index + 1];
      if (
        !flags.has(key) &&
        nextSegment?.phase === 'work' &&
        state.segmentRemainingSec <= 12
      ) {
        flags.add(key);
        speakUtterance(intervalCueUtterance('getReady', { variant: getReadyVariantRef.current++ }));
      }
    }

    // "Nog tien seconden": alleen bij werkintervallen van minstens 30 seconden.
    if (!firedThisTick && state.phase === 'work') {
      const key = `${state.index}:workEnd`;
      if (
        !flags.has(key) &&
        state.segment.durationSec >= 30 &&
        state.segmentRemainingSec <= 10
      ) {
        flags.add(key);
        speakUtterance(intervalCueUtterance('workEnd', { variant: workEndVariantRef.current++ }));
      }
    }

    // "Halverwege": alleen bij lange werkintervallen (minstens 3 minuten).
    if (!firedThisTick && state.phase === 'work') {
      const key = `${state.index}:workHalf`;
      if (
        !flags.has(key) &&
        state.segment.durationSec >= 180 &&
        state.segmentElapsedSec >= state.segment.durationSec / 2
      ) {
        flags.add(key);
        speakUtterance(intervalCueUtterance('workHalf'));
      }
    }
  }, [enabled, segments, voiceType]);

  return { onTick, reset };
}
