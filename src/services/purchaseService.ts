/**
 * purchaseService
 *
 * Offline-first laag rond RevenueCat (react-native-purchases) voor
 * premium-abonnementen via Play Billing. De app werkt volledig zonder
 * RevenueCat: zonder API-sleutel, zonder netwerk of bij een fout valt
 * alles stilletjes terug op "geen premium". Niets in de UI blokkeert
 * hierop en er wordt nooit gecrasht.
 *
 * De API-sleutel komt uit het .env-bestand in de projectroot:
 *  - EXPO_PUBLIC_REVENUECAT_API_KEY
 * Zie .env.example en docs/REVENUECAT_SETUP.md voor de opzet.
 *
 * Let op: na het aanpassen van .env moet de Metro-server opnieuw gestart
 * worden (npx expo start) om de nieuwe waarden te laden. RevenueCat is een
 * native module en vereist een nieuwe EAS dev build.
 *
 * Vereist: npx expo install react-native-purchases
 */

import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';
import { getCurrentUser } from './authService';

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';

/** Naam van het entitlement zoals ingesteld in RevenueCat. */
export const PREMIUM_ENTITLEMENT_ID = 'premium';

/** Identifier van de standaard offering met de abonnementsopties. */
export const DEFAULT_OFFERING_ID = 'default';

/** Vaste fallbackteksten als RevenueCat geen prijzen kan leveren. */
export const FALLBACK_PRICE_MONTHLY = 'EUR 5,99 per maand';
export const FALLBACK_PRICE_YEARLY = 'EUR 49 per jaar';

let configured = false;

/**
 * Is er een bruikbare RevenueCat-sleutel ingesteld? Zonder sleutel blijft
 * de app volledig werken en wordt RevenueCat niet geconfigureerd.
 */
export function isPurchasesConfigured(): boolean {
  return REVENUECAT_API_KEY.length > 0;
}

/**
 * Initialiseer RevenueCat eenmalig. Best-effort: faalt geruisloos terug
 * naar "geen premium" zonder sleutel, netwerk of bij een fout. Koppelt de
 * appUserID aan de Supabase-user-id wanneer die bekend is, zodat aankopen
 * aan hetzelfde account hangen op een nieuw toestel.
 */
export async function init(): Promise<void> {
  if (configured) return;
  if (!isPurchasesConfigured()) return;

  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.WARN);
    }

    // Koppel aan de Supabase-user-id als die er is, anders laat RevenueCat
    // zelf een anonieme appUserID genereren.
    let appUserID: string | undefined;
    try {
      const user = await getCurrentUser();
      appUserID = user?.id ?? undefined;
    } catch {
      appUserID = undefined;
    }

    Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID });
    configured = true;
  } catch {
    // Stil falen: app blijft werken zonder premium
    configured = false;
  }
}

/**
 * Koppel de RevenueCat-gebruiker alsnog aan de Supabase-user-id, bijvoorbeeld
 * nadat een gebruiker is ingelogd na de eerste app-start. Best-effort.
 */
export async function identifyUser(userId: string): Promise<void> {
  if (!configured || !userId) return;
  try {
    await Purchases.logIn(userId);
  } catch {
    // Negeer: aankopen blijven via de anonieme appUserID werken
  }
}

/**
 * Haal de standaard offering op met de beschikbare abonnementspakketten.
 * Geeft null terug als RevenueCat niet beschikbaar is of er geen offering is.
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? offerings.all[DEFAULT_OFFERING_ID] ?? null;
  } catch {
    return null;
  }
}

export interface PurchaseResult {
  ok: boolean;
  /** Werd het premium-entitlement na de aankoop actief? */
  isPremium: boolean;
  /** Heeft de gebruiker de aankoop zelf afgebroken? */
  cancelled?: boolean;
  /** Nederlandse melding, geschikt om in de UI te tonen. */
  message?: string;
}

/**
 * Koop een pakket. Vangt de annulering door de gebruiker netjes af en
 * crasht nooit. Geeft de nieuwe premium-status terug.
 */
export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<PurchaseResult> {
  if (!configured) {
    return { ok: false, isPremium: false, message: 'Aankopen zijn nu niet beschikbaar.' };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const premium = hasPremiumEntitlement(customerInfo);
    return {
      ok: true,
      isPremium: premium,
      message: premium ? 'Je premium is geactiveerd. Veel loopplezier.' : undefined,
    };
  } catch (e: any) {
    // RevenueCat markeert een door de gebruiker afgebroken aankoop.
    if (e?.userCancelled) {
      return { ok: false, isPremium: false, cancelled: true };
    }
    return {
      ok: false,
      isPremium: false,
      message: 'De aankoop is niet gelukt. Probeer het later opnieuw.',
    };
  }
}

/**
 * Herstel eerdere aankopen, bijvoorbeeld op een nieuw toestel. Best-effort.
 */
export async function restorePurchases(): Promise<PurchaseResult> {
  if (!configured) {
    return { ok: false, isPremium: false, message: 'Herstellen is nu niet beschikbaar.' };
  }
  try {
    const customerInfo = await Purchases.restorePurchases();
    const premium = hasPremiumEntitlement(customerInfo);
    return {
      ok: true,
      isPremium: premium,
      message: premium
        ? 'Je premium is hersteld.'
        : 'We konden geen actieve aankopen vinden op dit account.',
    };
  } catch {
    return {
      ok: false,
      isPremium: false,
      message: 'Herstellen lukte niet. Probeer het later opnieuw.',
    };
  }
}

/**
 * Helper: is het premium-entitlement actief in deze customerInfo?
 */
export function hasPremiumEntitlement(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  return customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
}

/**
 * Vraag de huidige premium-status op bij RevenueCat. Faalt stil naar false
 * zonder sleutel, netwerk of bij een fout.
 */
export async function isPremiumActive(): Promise<boolean> {
  if (!configured) return false;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return hasPremiumEntitlement(customerInfo);
  } catch {
    return false;
  }
}

export type { CustomerInfo, PurchasesOffering, PurchasesPackage };
