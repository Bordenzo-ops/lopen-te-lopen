/**
 * usePremium
 *
 * Herbruikbare hook die de premium-status teruggeeft en een functie om naar
 * het paywall-scherm te navigeren. Dit is de infrastructuur voor de
 * feature-gating: de hook levert de status, de navigatie en een nette
 * upgrade-prompt.
 *
 * De premium-status komt uit de store (gevoed door RevenueCat). Voor het
 * verversen of zetten van de status zie src/store/appStore.ts.
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useAppStore } from '../store/appStore';
import { hasPremiumAccess } from '../config/premiumConfig';

export interface UsePremium {
  /** Is premium actief volgens RevenueCat (entitlement "premium")? */
  isPremium: boolean;
  /**
   * Heeft de gebruiker toegang tot premium features? True zolang de
   * betaalmuur uit staat (testfase) of als premium actief is. Offline-first:
   * een onbekende status telt als gratis.
   */
  hasAccess: boolean;
  /** Navigeer naar het paywall-scherm. */
  goToPaywall: () => void;
  /**
   * Toon een nette upgrade-prompt en navigeer bij bevestiging naar de paywall.
   * @param title    Korte titel van de prompt
   * @param message  Uitleg waarom dit premium is
   */
  promptUpgrade: (title: string, message: string) => void;
  /** Ververs de premium-status best-effort bij RevenueCat. */
  refreshPremium: () => Promise<void>;
}

export function usePremium(): UsePremium {
  const isPremium = useAppStore(s => s.isPremium);
  const refreshPremium = useAppStore(s => s.refreshPremium);

  const goToPaywall = useCallback(() => {
    router.push('/paywall');
  }, []);

  const promptUpgrade = useCallback((title: string, message: string) => {
    Alert.alert(title, message, [
      { text: 'Niet nu', style: 'cancel' },
      { text: 'Bekijk premium', onPress: () => router.push('/paywall') },
    ]);
  }, []);

  return {
    isPremium,
    hasAccess: hasPremiumAccess(isPremium),
    goToPaywall,
    promptUpgrade,
    refreshPremium,
  };
}
