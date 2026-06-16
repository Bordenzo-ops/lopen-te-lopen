/**
 * Premium configuratie — Routeplanner en feature-gating
 *
 * Setup:
 *  1. Registreer gratis op https://openrouteservice.org/ → kopieer je API-sleutel
 *  2. Vervang 'YOUR_ORS_API_KEY_HERE' hieronder door je eigen sleutel
 *  3. Voeg voor Android ook een Google Maps API-sleutel toe in app.json
 *     (android.config.googleMaps.apiKey) voor de kaartweergave
 *  4. Zet PAYWALL_ACTIVE op true als je de betaalmuur wilt activeren
 *
 * Alle limieten voor de gratis laag staan centraal in dit bestand, zodat je
 * ze op één plek kunt bijstellen. De feature-gating zelf gebruikt deze waarden
 * via de hook usePremium / usePremiumGate.
 */

import type { RaceDistance } from '../data/rotterdamRaces';

export const PREMIUM_CONFIG = {
  /** OpenRouteService API-sleutel — vul je eigen sleutel in */
  ORS_API_KEY: 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjdmODA3NjU4MTVmMzRlNjlhOTM3MDEzODFmYWVkOWI4IiwiaCI6Im11cm11cjY0In0=',

  /**
   * Betaalmuur actief?
   * false = iedereen kan alle premium features gebruiken (testfase)
   * true  = gratis gebruikers krijgen de basislaag, premium ontgrendelt alles
   */
  PAYWALL_ACTIVE: false,

  /**
   * Routeplanner: hoeveel routes mag een gratis gebruiker per week plannen?
   * Vriendelijke limiet zodat de routeplanner uitnodigend blijft, maar
   * onbeperkt plannen premium wordt. De teller reset elke kalenderweek
   * (maandag) en wordt gepersisteerd in de store.
   */
  FREE_ROUTE_PLANS_PER_WEEK: 3,

  /**
   * Wedstrijdschema's: welke afstanden mag een gratis gebruiker als
   * wedstrijddoel kiezen? Gratis krijgt toegang tot de halve marathon als
   * standaardschema. Premium ontgrendelt alle afstanden en wedstrijden.
   */
  FREE_RACE_DISTANCES: ['half_marathon'] as RaceDistance[],
} as const;

/**
 * Bepaalt of een gebruiker premium-toegang heeft, offline-first.
 *
 * Zolang de betaalmuur uit staat heeft iedereen toegang (testfase). Staat de
 * muur aan, dan telt alleen een actieve premium-status. Is die onbekend, dan
 * behandelen we de gebruiker bewust als gratis: nooit per ongeluk premium
 * weggeven, en nooit crashen.
 */
export function hasPremiumAccess(isPremium: boolean | undefined | null): boolean {
  if (!PREMIUM_CONFIG.PAYWALL_ACTIVE) return true;
  return isPremium === true;
}

/** Mag deze wedstrijdafstand zonder premium gekozen worden? */
export function isRaceDistanceFree(distance: RaceDistance): boolean {
  return PREMIUM_CONFIG.FREE_RACE_DISTANCES.includes(distance);
}
