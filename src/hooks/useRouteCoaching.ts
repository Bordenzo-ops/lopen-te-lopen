/**
 * useRouteCoaching
 *
 * Gesproken route-coaching die samenwerkt met de bestaande useVoiceGuidance.
 *
 * Twee soorten meldingen:
 *  1. Turn-by-turn: kondigt afbiegingen aan binnen 150 meter
 *  2. Voortgang:    25%, 50% en 75% van de geplande route
 *
 * Sinds de stempakketten-omschakeling lopen beide via `speakPhrases` met
 * `navUtterance`/`milestoneUtterance` uit `src/config/voicePhrases.ts` — zie
 * `_workspace/notities/Stempakketten-ontwerp.md`. De gesproken navigatie
 * bevat geen straatnamen in de catalogus-clips (fase C); de fallbacktekst
 * (fase A/B, nu nog altijd wat er klinkt) bevat wél de volledige
 * instructietekst inclusief eventuele straatnaam, exact zoals voorheen.
 *
 * Roep `onGpsUpdate` aan bij elke GPS-positiewijziging.
 *
 * Gebruik:
 *   const { onGpsUpdate } = useRouteCoaching(enabled, voiceEnabled, plannedRoute);
 */

import { useRef, useCallback } from 'react';
import * as voiceService from '../services/voiceService';
import type { VoiceType } from '../config/voiceConfig';
import { navUtterance, milestoneUtterance } from '../config/voicePhrases';
import { haversineMeters, PlannedRoute } from '../services/routeService';

// ── Constanten ────────────────────────────────────────────────────────────────

/** Afstand (meters) voor een afbieging om deze aan te kondigen */
const ANNOUNCE_AT_M = 150;

/** Voortgangsmijlpalen: voortgangsfractie + bijbehorend catalogus-percentage */
const MILESTONES: Array<[number, 25 | 50 | 75]> = [
  [0.25, 25],
  [0.50, 50],
  [0.75, 75],
];

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseRouteCoachingReturn {
  /** Aanroepen bij elke GPS-update */
  onGpsUpdate: (lat: number, lon: number, totalDistanceKm: number) => void;
  /** Wist alle uitgesproken meldingen (gebruik bij sessie-reset) */
  reset: () => void;
}

export function useRouteCoaching(
  enabled:      boolean,
  voiceEnabled: boolean,
  plannedRoute: PlannedRoute | undefined,
  voiceType:    VoiceType = 'female',
): UseRouteCoachingReturn {
  const spokenInstructions = useRef<Set<number>>(new Set());
  const spokenMilestones   = useRef<Set<number>>(new Set());

  const onGpsUpdate = useCallback((
    lat:             number,
    lon:             number,
    totalDistanceKm: number,
  ) => {
    if (!enabled || !voiceEnabled || !plannedRoute) return;

    // ── Turn-by-turn instructies ──────────────────────────────────────────
    plannedRoute.instructions.forEach((inst, i) => {
      if (spokenInstructions.current.has(i)) return;

      const wp = plannedRoute.waypoints[inst.waypointIndex];
      if (!wp) return;

      const distM = haversineMeters(lat, lon, wp.lat, wp.lon);
      if (distM <= ANNOUNCE_AT_M) {
        // Afstandsprefix (afgerond op 10 m) alleen als nog ver genoeg weg,
        // net als voorheen — zie navUtterance voor de clip-ids-herkenning.
        const roundedDistM = distM > 40 ? Math.round(distM / 10) * 10 : undefined;
        voiceService.speakPhrases(navUtterance(inst.text, roundedDistM), voiceType);
        spokenInstructions.current.add(i);
      }
    });

    // ── Voortgangsmijlpalen ───────────────────────────────────────────────
    const progress = totalDistanceKm / plannedRoute.totalDistanceKm;

    MILESTONES.forEach(([pct, pctId]) => {
      if (spokenMilestones.current.has(pct)) return;
      if (progress < pct) return;

      const remaining = Math.max(0, plannedRoute.totalDistanceKm - totalDistanceKm);
      voiceService.speakPhrases(milestoneUtterance(pctId, remaining), voiceType);
      spokenMilestones.current.add(pct);
    });
  }, [enabled, voiceEnabled, plannedRoute, voiceType]);

  const reset = useCallback(() => {
    spokenInstructions.current.clear();
    spokenMilestones.current.clear();
  }, []);

  return { onGpsUpdate, reset };
}
