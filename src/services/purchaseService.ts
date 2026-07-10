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

import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type CustomerInfoUpdateListener,
  type PurchasesOffering,
  type PurchasesPackage,
  type SubscriptionOption,
  LOG_LEVEL,
} from 'react-native-purchases';
import { getCurrentUser } from './authService';

/**
 * RevenueCat gebruikt per platform een aparte publieke API-sleutel:
 *  - iOS gebruikt de Apple-sleutel (appl_...) uit EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
 *  - Android gebruikt de Google-sleutel (goog_...) uit EXPO_PUBLIC_REVENUECAT_API_KEY
 * Ontbreekt de platform-specifieke sleutel, dan valt het terug op de Android-key
 * zodat bestaand gedrag niet breekt.
 */
const REVENUECAT_ANDROID_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
const REVENUECAT_IOS_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
const REVENUECAT_API_KEY =
  Platform.OS === 'ios'
    ? REVENUECAT_IOS_API_KEY || REVENUECAT_ANDROID_API_KEY
    : REVENUECAT_ANDROID_API_KEY;

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
 *
 * Doet bij een fout één automatische herhaalpoging na 1 seconde: een
 * tijdelijke netwerkhapering mag de paywall niet meteen op de fallbackprijzen
 * laten terugvallen. Faalt de herhaalpoging ook, dan geven we alsnog stil
 * null terug.
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? offerings.all[DEFAULT_OFFERING_ID] ?? null;
  } catch {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const offerings = await Purchases.getOfferings();
      return offerings.current ?? offerings.all[DEFAULT_OFFERING_ID] ?? null;
    } catch {
      return null;
    }
  }
}

/**
 * Zet aantal periode-eenheden (dag/week/maand/jaar) om naar een geschat
 * aantal dagen. Maand en jaar zijn benaderingen (30 resp. 365 dagen), net
 * als RevenueCat dit zelf documenteert voor afgeleide prijzen.
 */
function periodUnitToDays(unit: string, numberOfUnits: number): number {
  switch (unit) {
    case 'DAY':
      return numberOfUnits;
    case 'WEEK':
      return numberOfUnits * 7;
    case 'MONTH':
      return numberOfUnits * 30;
    case 'YEAR':
      return numberOfUnits * 365;
    default:
      return numberOfUnits;
  }
}

export interface TrialInfo {
  /** Heeft dit pakket een gratis proefperiode? */
  hasFreeTrial: boolean;
  /** Lengte van de proefperiode in dagen, of null als onbekend/niet van toepassing. */
  trialDays: number | null;
}

const NO_TRIAL: TrialInfo = { hasFreeTrial: false, trialDays: null };

/**
 * Platform-onafhankelijke helper die uitleest of een RevenueCat-pakket een
 * gratis proefperiode heeft, en zo ja hoeveel dagen.
 *
 * iOS levert dit via product.introPrice (een gratis fase heeft price === 0).
 * Android (Google Play) levert dit via product.subscriptionOptions, waarbij
 * elke optie een freePhase kan hebben met een eigen billingPeriod en
 * billingCycleCount. Volledig defensief: bij een onverwachte vorm van de
 * data of een ontbrekend pakket geven we gewoon "geen proefperiode" terug,
 * zodat de paywall nooit crasht en netjes terugvalt op het normale gedrag.
 */
export function getTrialInfo(pkg: PurchasesPackage | null | undefined): TrialInfo {
  if (!pkg) return NO_TRIAL;
  try {
    const product = pkg.product;
    if (!product) return NO_TRIAL;

    if (Platform.OS === 'ios') {
      const intro = product.introPrice;
      if (intro && intro.price === 0) {
        const cycles = Math.max(1, intro.cycles || 1);
        const days = periodUnitToDays(intro.periodUnit, intro.periodNumberOfUnits) * cycles;
        return days > 0 ? { hasFreeTrial: true, trialDays: days } : NO_TRIAL;
      }
      return NO_TRIAL;
    }

    // Android: zoek de gratis fase, eerst in de standaardoptie, anders in
    // de eerste beschikbare optie die er een heeft.
    const options: SubscriptionOption[] = product.subscriptionOptions ?? [];
    const candidates = [product.defaultOption, ...options].filter(
      (o): o is SubscriptionOption => !!o,
    );
    const withFreePhase = candidates.find(o => o.freePhase);
    const freePhase = withFreePhase?.freePhase;
    if (freePhase) {
      const cycles = Math.max(1, freePhase.billingCycleCount ?? 1);
      const days = periodUnitToDays(freePhase.billingPeriod.unit, freePhase.billingPeriod.value) * cycles;
      return days > 0 ? { hasFreeTrial: true, trialDays: days } : NO_TRIAL;
    }
    return NO_TRIAL;
  } catch {
    return NO_TRIAL;
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
 * Vraag de huidige premium-status op bij RevenueCat.
 *
 * Geeft zonder RevenueCat-sleutel altijd false terug (bewust: geen premium
 * mogelijk zonder configuratie). Bij een echte netwerk- of API-fout geven we
 * null terug in plaats van false: de aanroeper kan dan de laatst bekende
 * (gepersisteerde) status laten staan in plaats van een tijdelijke
 * netwerkhapering te verwarren met een verlopen abonnement.
 */
export async function isPremiumActive(): Promise<boolean | null> {
  if (!configured) return false;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return hasPremiumEntitlement(customerInfo);
  } catch {
    return null;
  }
}

/**
 * Log de huidige gebruiker uit bij RevenueCat, bijvoorbeeld bij het
 * uitloggen uit de app zelf. Best-effort: zonder configuratie of bij een
 * fout gebeurt er niets en blijft de app gewoon werken.
 */
export async function logOut(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // Stil falen: uitloggen bij RevenueCat mag de rest van het uitloggen
    // nooit blokkeren
  }
}

/** Actieve listener-referentie, nodig om hem later weer te kunnen verwijderen. */
let activeCustomerInfoListener: CustomerInfoUpdateListener | null = null;

/**
 * Registreert een listener die meeluistert met RevenueCat-updates van de
 * customerInfo (bijvoorbeeld een automatische verlenging, een verlopen
 * abonnement, of een aankoop op een ander toestel) en geeft de nieuwe
 * premium-status door aan de callback. Werkt alleen als RevenueCat
 * geconfigureerd is; anders gebeurt er niets. Vervangt een eventueel eerder
 * geregistreerde listener, zodat er nooit dubbele listeners actief zijn.
 */
export function addPremiumListener(callback: (isPremium: boolean) => void): void {
  if (!configured) return;
  try {
    removePremiumListener();
    const listener: CustomerInfoUpdateListener = (customerInfo) => {
      try {
        callback(hasPremiumEntitlement(customerInfo));
      } catch {
        // Stil falen: een fout in de callback mag RevenueCat nooit raken
      }
    };
    activeCustomerInfoListener = listener;
    Purchases.addCustomerInfoUpdateListener(listener);
  } catch {
    activeCustomerInfoListener = null;
  }
}

/** Verwijdert de geregistreerde customerInfo-listener, als die er is. Best-effort. */
export function removePremiumListener(): void {
  if (!activeCustomerInfoListener) return;
  try {
    Purchases.removeCustomerInfoUpdateListener(activeCustomerInfoListener);
  } catch {
    // Negeer: er is toch niets meer aan te doen
  } finally {
    activeCustomerInfoListener = null;
  }
}

export type { CustomerInfo, PurchasesOffering, PurchasesPackage };
