/**
 * Premium configuratie: Routeplanner en feature-gating
 *
 * Setup:
 *  1. De OpenRouteService-sleutel staat NIET meer hier: die is verplaatst naar
 *     de Supabase edge function `route` als secret (ORS_API_KEY). Zie
 *     supabase/functions/route/index.ts. Zo staat er geen werkende sleutel
 *     meer in de app-bundel of in versiebeheer (WP3).
 *  2. Voeg voor Android een Google Maps API-sleutel toe in app.json
 *     (android.config.googleMaps.apiKey) voor de kaartweergave, en beperk die
 *     sleutel in de Google Cloud Console tot je app-signatures (zie WP3-notitie).
 *  3. Zet PAYWALL_ACTIVE op true als je de betaalmuur wilt activeren
 *
 * Alle limieten voor de gratis laag staan centraal in dit bestand, zodat je
 * ze op één plek kunt bijstellen. De feature-gating zelf gebruikt deze waarden
 * via de hook usePremium / usePremiumGate.
 */

import type { RaceDistance } from '../data/rotterdamRaces';

export const PREMIUM_CONFIG = {
  /**
   * Betaalmuur actief?
   * false = iedereen kan alle premium features gebruiken (testfase)
   * true  = gratis gebruikers krijgen de basislaag, premium ontgrendelt alles
   */
  PAYWALL_ACTIVE: true,

  /**
   * Routeplanner: hoeveel routes mag een gratis gebruiker per week plannen?
   * Vriendelijke limiet zodat de routeplanner uitnodigend blijft, maar
   * onbeperkt plannen premium wordt. De teller reset elke kalenderweek
   * (maandag) en wordt gepersisteerd in de store.
   */
  FREE_ROUTE_PLANS_PER_WEEK: 3,

  /**
   * Wedstrijdschema's: welke afstanden mag een gratis gebruiker als
   * wedstrijddoel kiezen? Alle standaardschema's per wedstrijd zijn gratis,
   * zodat de gratis laag volwaardig blijft. Premium zit in de personalisatie
   * (doeltijd-gestuurde tempo's), de premium-stemmen, onbeperkt routes plannen
   * en later de geavanceerde statistieken, niet in de basis-schema's.
   */
  FREE_RACE_DISTANCES: ['5km', '10km', '15km', 'half_marathon', 'marathon'] as RaceDistance[],

  /**
   * Bewaarde routes: hoeveel routes mag een gratis gebruiker bewaren?
   * Genoeg voor het vaste rondje plus wat variatie (bijvoorbeeld een korte en
   * een lange versie), zodat de gratis laag volwaardig blijft. Premium maakt
   * dit onbeperkt. Bewust gelijk aan FREE_ROUTE_PLANS_PER_WEEK, zodat "3
   * gratis" overal in de app hetzelfde, makkelijk te onthouden getal is.
   */
  FREE_SAVED_ROUTES: 3,
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

/** Mag er nog een route bewaard worden, gegeven het huidige aantal en de premium-status? */
export function canSaveAnotherRoute(
  currentSavedCount: number,
  isPremium: boolean | undefined | null,
): boolean {
  if (hasPremiumAccess(isPremium)) return true;
  return currentSavedCount < PREMIUM_CONFIG.FREE_SAVED_ROUTES;
}
