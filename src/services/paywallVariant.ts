/**
 * paywallVariant
 *
 * A/B-haakje voor de paywall (WP6). Elke installatie krijgt lokaal een
 * willekeurige variant ('A' of 'B') die gepersisteerd wordt, zodat dezelfde
 * gebruiker steeds dezelfde paywall ziet. De variant gaat als prop mee in de
 * paywall-events (zie analyticsService) zodat conversie per variant in
 * Supabase te vergelijken is.
 *
 * Best-effort: lukt opslaan of lezen niet, dan blijft de toewijzing in elk
 * geval consistent binnen de sessie en gebeurt er niets ergs.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type PaywallVariant = 'A' | 'B';

const STORAGE_KEY = 'paywall_variant_v1';

let cached: PaywallVariant | null = null;

export async function getPaywallVariant(): Promise<PaywallVariant> {
  if (cached) return cached;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === 'A' || stored === 'B') {
      cached = stored;
      return stored;
    }
  } catch {
    // Val terug op een nieuwe toewijzing hieronder.
  }
  const assigned: PaywallVariant = Math.random() < 0.5 ? 'A' : 'B';
  cached = assigned;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, assigned);
  } catch {
    // Niet bewaard: deze sessie blijft consistent via de cache.
  }
  return assigned;
}
