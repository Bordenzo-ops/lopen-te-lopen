/**
 * useHeartRateCoaching
 *
 * Gesproken hartslagcoaching tijdens een hardloopsessie (fase B, bouwt voort
 * op de live BLE-hartslagmeting uit fase A, zie bleHeartRateService.ts en
 * app/session/active.tsx). Vergelijkt de actuele hartslagzone met de doelzone
 * van de sessie en spreekt af en toe een korte aanwijzing uit als de hartslag
 * structureel afwijkt.
 *
 * Bewust rustig gedoseerd — dit moet een coach zijn, geen zeurende monitor.
 * Gemaakte keuzes:
 *  - De eerste 3 minuten (WARMUP_SECONDS) geen coaching: de hartslag is dan
 *    nog niet representatief (opwarmen, beginnende inspanning).
 *  - Alleen ingrijpen bij een AANHOUDENDE afwijking: minstens ~30 seconden
 *    (SUSTAINED_SECONDS) ononderbroken buiten de doelzone in dezelfde
 *    richting (te hoog of te laag). Bijgehouden met refs en de meegegeven
 *    elapsedSeconds — geen nieuwe timers nodig, de metingen komen zelf al
 *    ~1x/seconde binnen via de BLE-service.
 *  - Een te lage hartslag wordt alleen gemeld als de doelzone Z3 of hoger is:
 *    bij een rustige duurloop (Z1/Z2) is een lage hartslag juist de bedoeling.
 *  - Cooldown van 2 minuten (COOLDOWN_SECONDS) tussen elke hartslagmelding,
 *    van welk type dan ook. Daarnaast hooguit MAX_PER_TYPE meldingen van
 *    hetzelfde type (te hoog/te laag) per run — een wissel naar het andere
 *    type telt apart en blijft dus mogelijk.
 *  - Eenmaal gemeld voor een aaneengesloten afwijking ("episode"), niet
 *    opnieuw zolang die afwijking aanhoudt: pas weer een nieuwe melding na
 *    terugkeer naar de doelzone of een wissel van richting.
 *  - Na een "te hoog"-melding, zodra de hartslag terug in de doelzone is:
 *    één korte bevestiging ("Mooi zo, precies goed."), ook met cooldown.
 *
 * Zonder maxHr, zonder enabled, zonder doelzone of zonder (geldige) metingen
 * doet de hook niets.
 *
 * Gebruik:
 *   const { onHeartRateUpdate } = useHeartRateCoaching(voiceEnabled, session?.zone, maxHrForZones, voiceType);
 *   // bij elke bpm-meting, alleen als de sessie niet gepauzeerd is:
 *   onHeartRateUpdate(bpm, elapsedRef.current);
 */

import { useCallback, useRef } from 'react';
import * as voiceService from '../services/voiceService';
import type { VoiceType } from '../config/voiceConfig';
import { hrUtterance } from '../config/voicePhrases';
import type { HeartRateZone } from '../data/trainingPlans';

// Geen coaching in de eerste 3 minuten: de hartslag is dan nog niet
// representatief voor de trainingsinspanning (opwarmen).
const WARMUP_SECONDS = 180;

// Minstens dit aantal seconden ononderbroken buiten de doelzone voordat er
// iets gezegd wordt — een korte piek (verkeerslicht, drempeltje) mag niet
// meteen een melding triggeren.
const SUSTAINED_SECONDS = 30;

// Niet vaker dan dit interval een hartslagmelding, van welk type dan ook.
const COOLDOWN_SECONDS = 120;

// Hooguit dit aantal meldingen van hetzelfde type (te hoog/te laag) per run.
const MAX_PER_TYPE = 2;

const ZONE_ORDER: HeartRateZone[] = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];

// Zelfde grenzen als heartRateZoneFromPct in app/session/active.tsx (fase A):
// Z1 <60%, Z2 60-70%, Z3 70-80%, Z4 80-90%, Z5 >90% van de maximale hartslag.
function zoneFromBpm(bpm: number, maxHr: number): HeartRateZone {
  const pct = bpm / maxHr;
  if (pct < 0.6) return 'Z1';
  if (pct < 0.7) return 'Z2';
  if (pct < 0.8) return 'Z3';
  if (pct < 0.9) return 'Z4';
  return 'Z5';
}

type Direction = 'high' | 'low' | null;

export function useHeartRateCoaching(
  enabled: boolean,
  targetZone: HeartRateZone | undefined,
  maxHr: number | null,
  voiceType: VoiceType = 'female',
) {
  // Richting en starttijd (in elapsedSeconds) van de huidige aaneengesloten
  // afwijking. Null zolang de hartslag in de doelzone zit.
  const directionRef = useRef<Direction>(null);
  const sinceRef      = useRef<number | null>(null);
  // Voorkomt herhaalde meldingen binnen dezelfde aaneengesloten afwijking.
  const notifiedForEpisodeRef = useRef(false);
  // Laatste keer (elapsedSeconds) dat er iets gezegd is — voor de cooldown.
  const lastSpokenAtRef = useRef<number | null>(null);
  // Aantal meldingen per type, deze run.
  const highCountRef = useRef(0);
  const lowCountRef  = useRef(0);
  // Na een "te hoog"-melding wachten we op terugkeer naar de doelzone om één
  // keer een korte bevestiging te geven.
  const awaitingReturnConfirmationRef = useRef(false);

  // Spreekt een hartslagcoaching-melding uit via de catalogus (zie
  // src/config/voicePhrases.ts) — 'high'/'low'/'ok' matchen de drie vaste
  // teksten hieronder.
  const speak = useCallback((kind: 'high' | 'low' | 'ok') => {
    voiceService.speakPhrases(hrUtterance(kind), voiceType);
  }, [voiceType]);

  /** Zet alle interne toestand terug, bijvoorbeeld bij een nieuwe sessie. */
  const reset = useCallback(() => {
    directionRef.current = null;
    sinceRef.current = null;
    notifiedForEpisodeRef.current = false;
    lastSpokenAtRef.current = null;
    highCountRef.current = 0;
    lowCountRef.current = 0;
    awaitingReturnConfirmationRef.current = false;
  }, []);

  /**
   * Aanroepen bij elke bpm-meting van de gekoppelde hartslagmeter, met de
   * verstreken looptijd in seconden. Roep dit niet aan terwijl de sessie
   * gepauzeerd is — dat bepaalt de aanroeper (active.tsx).
   */
  const onHeartRateUpdate = useCallback((bpm: number, elapsedSeconds: number) => {
    if (!enabled || !maxHr || !targetZone || bpm <= 0) return;
    if (elapsedSeconds < WARMUP_SECONDS) return;

    const cooldownOk = () =>
      lastSpokenAtRef.current == null || elapsedSeconds - lastSpokenAtRef.current >= COOLDOWN_SECONDS;

    const currentZone = zoneFromBpm(bpm, maxHr);
    const currentIdx  = ZONE_ORDER.indexOf(currentZone);
    const targetIdx   = ZONE_ORDER.indexOf(targetZone);
    const direction: Direction = currentIdx > targetIdx ? 'high' : currentIdx < targetIdx ? 'low' : null;

    // ── Terug in de doelzone: eventueel de bevestiging geven, episode sluiten
    if (direction === null) {
      if (awaitingReturnConfirmationRef.current && cooldownOk()) {
        speak('ok');
        lastSpokenAtRef.current = elapsedSeconds;
        awaitingReturnConfirmationRef.current = false;
      }
      directionRef.current = null;
      sinceRef.current = null;
      notifiedForEpisodeRef.current = false;
      return;
    }

    // ── Nieuwe afwijking of wissel van richting: episode opnieuw starten ──
    if (directionRef.current !== direction) {
      directionRef.current = direction;
      sinceRef.current = elapsedSeconds;
      notifiedForEpisodeRef.current = false;
      return;
    }

    // Nog niet lang genoeg aaneengesloten buiten de doelzone
    const since = sinceRef.current ?? elapsedSeconds;
    if (elapsedSeconds - since < SUSTAINED_SECONDS) return;

    // Al gemeld voor deze aaneengesloten afwijking: niet nog een keer zeuren
    if (notifiedForEpisodeRef.current) return;

    if (direction === 'high') {
      if (highCountRef.current >= MAX_PER_TYPE) return;
      if (!cooldownOk()) return;
      speak('high');
      lastSpokenAtRef.current = elapsedSeconds;
      highCountRef.current += 1;
      notifiedForEpisodeRef.current = true;
      awaitingReturnConfirmationRef.current = true;
      return;
    }

    // direction === 'low': alleen relevant vanaf Z3 (tempozone) en hoger —
    // bij een rustige duurloop (Z1/Z2) is een lage hartslag juist de bedoeling.
    if (targetIdx < ZONE_ORDER.indexOf('Z3')) return;
    if (lowCountRef.current >= MAX_PER_TYPE) return;
    if (!cooldownOk()) return;
    speak('low');
    lastSpokenAtRef.current = elapsedSeconds;
    lowCountRef.current += 1;
    notifiedForEpisodeRef.current = true;
  }, [enabled, targetZone, maxHr, speak]);

  return { onHeartRateUpdate, reset };
}
