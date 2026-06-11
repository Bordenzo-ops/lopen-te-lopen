/**
 * Premium configuratie — Routeplanner
 *
 * Setup:
 *  1. Registreer gratis op https://openrouteservice.org/ → kopieer je API-sleutel
 *  2. Vervang 'YOUR_ORS_API_KEY_HERE' hieronder door je eigen sleutel
 *  3. Voeg voor Android ook een Google Maps API-sleutel toe in app.json
 *     (android.config.googleMaps.apiKey) voor de kaartweergave
 *  4. Zet PAYWALL_ACTIVE op true als je de betaalmuur wilt activeren
 */
export const PREMIUM_CONFIG = {
  /** OpenRouteService API-sleutel — vul je eigen sleutel in */
  ORS_API_KEY: 'YOUR_ORS_API_KEY_HERE',

  /**
   * Betaalmuur actief?
   * false = iedereen kan de routeplanner gebruiken (testfase)
   * true  = alleen gebruikers met isPremium = true hebben toegang
   */
  PAYWALL_ACTIVE: false,
} as const;
