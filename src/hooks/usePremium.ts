/**
 * usePremium
 *
 * Herbruikbare hook die de premium-status teruggeeft en een functie om naar
 * het paywall-scherm te navigeren. Dit is de infrastructuur voor latere
 * feature-gating: de hook zelf gate't niets, hij levert alleen de status en
 * de navigatie.
 *
 * De premium-status komt uit de store (gevoed door RevenueCat). Voor het
 * verversen of zetten van de status zie src/store/appStore.ts.
 */

import { useCallback } from 'react';
import { router } from 'expo-router';
import { useAppStore } from '../store/appStore';

export interface UsePremium {
  /** Is premium actief volgens RevenueCat (entitlement "premium")? */
  isPremium: boolean;
  /** Navigeer naar het paywall-scherm. */
  goToPaywall: () => void;
  /** Ververs de premium-status best-effort bij RevenueCat. */
  refreshPremium: () => Promise<void>;
}

export function usePremium(): UsePremium {
  const isPremium = useAppStore(s => s.isPremium);
  const refreshPremium = useAppStore(s => s.refreshPremium);

  const goToPaywall = useCallback(() => {
    router.push('/paywall');
  }, []);

  return { isPremium, goToPaywall, refreshPremium };
}
