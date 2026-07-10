/**
 * useRouteCoaching
 *
 * Gesproken route-coaching die samenwerkt met de bestaande useVoiceGuidance.
 *
 * Twee soorten meldingen:
 *  1. Turn-by-turn: kondigt afbiegingen aan binnen 150 meter
 *  2. Voortgang:    25%, 50% en 75% van de geplande route
 *
 * Roep `onGpsUpdate` aan bij elke GPS-positiewijziging.
 *
 * Gebruik:
 *   const { onGpsUpdate } = useRouteCoaching(enabled, voiceEnabled, plannedRoute);
 */

import { useRef, useCallback } from 'react';
import * as voiceService from '../services/voiceService';
import type { VoiceType } from '../config/voiceConfig';
import { haversineMeters, PlannedRoute } from '../services/routeService';

// ── Constanten ────────────────────────────────────────────────────────────────

/** Afstand (meters) voor een afbieging om deze aan te kondigen */
const ANNOUNCE_AT_M = 150;

/** Voortgangsmijlpalen met bijbehorend bericht */
const MILESTONES: Array<[number, string]> = [
  [0.25, 'Een kwart van je route voltooid.'],
  [0.50, 'Halverwege de geplande route.'],
  [0.75, 'Driekwart onderweg. Bijna terug!'],
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

  const speak = useCallback((text: string) => {
    voiceService.speak(text, voiceType);
  }, [voiceType]);

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
        // Voeg afstandsprefix toe als nog ver genoeg weg
        const prefix = distM > 40
          ? `Over ${Math.round(distM / 10) * 10} meter: `
          : '';
        speak(`${prefix}${inst.text}`);
        spokenInstructions.current.add(i);
      }
    });

    // ── Voortgangsmijlpalen ───────────────────────────────────────────────
    const progress = totalDistanceKm / plannedRoute.totalDistanceKm;

    MILESTONES.forEach(([pct, msg]) => {
      if (spokenMilestones.current.has(pct)) return;
      if (progress < pct) return;

      const remaining = Math.max(0, plannedRoute.totalDistanceKm - totalDistanceKm).toFixed(1);
      speak(`${msg} Nog ${remaining} kilometer te gaan.`);
      spokenMilestones.current.add(pct);
    });
  }, [enabled, voiceEnabled, plannedRoute, speak]);

  const reset = useCallback(() => {
    spokenInstructions.current.clear();
    spokenMilestones.current.clear();
  }, []);

  return { onGpsUpdate, reset };
}
