import { useCallback } from 'react';
import { router } from 'expo-router';
import { useAppStore } from '../store/appStore';
import { hasPremiumAccess } from '../config/premiumConfig';
import { canShowPremiumIntro } from '../config/premiumIntroConfig';

/** Geeft een functie terug die het value-scherm opent als de gebruiker in aanmerking komt. Best-effort. */
export function useMaybeShowPremiumIntro() {
  return useCallback(() => {
    const s = useAppStore.getState();
    const eligible = canShowPremiumIntro({
      hasAccess: hasPremiumAccess(s.isPremium),
      dismissed: s.premiumIntroDismissed,
      shownCount: s.premiumIntroShownCount,
      lastShownAt: s.premiumIntroLastShownAt,
      now: Date.now(),
    });
    if (eligible) router.push('/premium-intro');
  }, []);
}
