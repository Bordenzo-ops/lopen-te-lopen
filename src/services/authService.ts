/**
 * authService
 *
 * Offline-first auth rond Supabase. De app werkt volledig zonder login.
 *
 * Werking:
 *  1. Zijn er Supabase-sleutels? Dan starten we stilletjes een anonieme
 *     sessie (signInAnonymously) zodat data alvast in de cloud kan staan.
 *  2. Geen sleutels, geen netwerk of een fout? Dan faalt alles stil en
 *     blijft de app lokaal werken. Niets in de UI blokkeert hierop.
 *  3. Optioneel kan de gebruiker later een e-mailaccount koppelen
 *     (e-mail plus wachtwoord). Daarmee is de data te herstellen op een
 *     nieuw toestel. De anonieme gebruiker wordt daarbij geupgraded, dus
 *     bestaande cloud-data blijft aan hetzelfde account hangen.
 *
 * Alle functies vangen hun eigen fouten af en geven een resultaatobject
 * terug. Ze gooien nooit, zodat de UI nooit crasht op een netwerkfout.
 */

import { Platform } from 'react-native';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  GoogleSignin,
  statusCodes,
  isSuccessResponse,
  isCancelledResponse,
} from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID } from '../config/authConfig';

export interface AuthResult {
  ok: boolean;
  /** Nederlandse melding, geschikt om in de UI te tonen */
  message?: string;
  session?: Session | null;
}

/** Huidige sessie ophalen, of null als er geen is of geen backend. */
export async function getCurrentSession(): Promise<Session | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  } catch {
    return null;
  }
}

/** Huidige gebruiker ophalen, of null. */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

/** Is de huidige gebruiker anoniem (nog geen e-mail gekoppeld)? */
export async function isAnonymous(): Promise<boolean> {
  const user = await getCurrentUser();
  // Supabase markeert anonieme gebruikers met is_anonymous; valt terug
  // op het ontbreken van een e-mailadres als dat veld er niet is.
  if (!user) return false;
  if (typeof user.is_anonymous === 'boolean') return user.is_anonymous;
  return !user.email;
}

/**
 * Start stilletjes een anonieme sessie als die er nog niet is. Best-effort:
 * faalt geruisloos terug naar offline als er geen sleutels of netwerk zijn.
 */
export async function ensureAnonymousSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const existing = await getCurrentSession();
    if (existing) return existing;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) return null;
    return data.session ?? null;
  } catch {
    // Stil falen: app blijft offline werken
    return null;
  }
}

/**
 * Koppel een e-mailaccount aan de huidige (mogelijk anonieme) gebruiker.
 * Is de gebruiker anoniem, dan upgraden we via updateUser zodat de cloud-
 * data behouden blijft. Is er geen sessie, dan maken we een nieuw account.
 */
export async function linkEmailAccount(
  email: string,
  password: string,
): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: 'Synchronisatie staat niet ingesteld.' };
  }
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: 'Synchronisatie staat niet ingesteld.' };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { ok: false, message: 'Vul een e-mailadres en wachtwoord in.' };
  }
  if (password.length < 8) {
    return { ok: false, message: 'Kies een wachtwoord van minstens 8 tekens.' };
  }

  try {
    const anon = await isAnonymous();

    if (anon) {
      // Upgrade de anonieme gebruiker, zodat bestaande cloud-data blijft.
      const { data, error } = await supabase.auth.updateUser({
        email: cleanEmail,
        password,
      });
      if (error) {
        return { ok: false, message: vertaalAuthFout(error.message) };
      }
      return {
        ok: true,
        message:
          'Account gekoppeld. Bevestig eventueel je e-mailadres via de mail die we sturen.',
        session: await getCurrentSession(),
      };
    }

    // Geen anonieme gebruiker: maak een nieuw account aan.
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    });
    if (error) {
      return { ok: false, message: vertaalAuthFout(error.message) };
    }
    return {
      ok: true,
      message: 'Account aangemaakt. Bevestig je e-mailadres via de mail die we sturen.',
      session: data.session,
    };
  } catch {
    return {
      ok: false,
      message: 'Koppelen lukte niet. Probeer het later opnieuw.',
    };
  }
}

/**
 * Log in op een bestaand e-mailaccount, bijvoorbeeld om data te herstellen
 * op een nieuw toestel.
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: 'Synchronisatie staat niet ingesteld.' };
  }
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: 'Synchronisatie staat niet ingesteld.' };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { ok: false, message: 'Vul een e-mailadres en wachtwoord in.' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error) {
      return { ok: false, message: vertaalAuthFout(error.message) };
    }
    return { ok: true, message: 'Ingelogd.', session: data.session };
  } catch {
    return {
      ok: false,
      message: 'Inloggen lukte niet. Probeer het later opnieuw.',
    };
  }
}

/**
 * Zorgt dat GoogleSignin eenmalig geconfigureerd is met de publieke
 * client-ID's. Meerdere aanroepen zijn goedkoop/onschadelijk, maar we
 * beperken het toch tot eenmaal per app-sessie.
 */
let googleConfigured = false;
function ensureGoogleConfigured(): void {
  if (googleConfigured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });
  googleConfigured = true;
}

/**
 * Log in met Google via de native Google Sign-In-flow en koppel de
 * verkregen idToken aan Supabase via signInWithIdToken. Werkt op zowel
 * Android als iOS.
 *
 * Volledig defensief: annulering door de gebruiker is geen fout en geeft
 * {ok:false} zonder alarmerende message terug, zodat de UI niets storends
 * toont. Deze library (v16+) geeft een annulering terug als een resultaat
 * met type 'cancelled' in plaats van een geworpen fout; we controleren
 * daarnaast ook op de statusCodes.SIGN_IN_CANCELLED-foutcode, mocht een
 * onderliggende native laag toch een fout gooien. Andere fouten (geen Play
 * Services, geen netwerk, ontbrekende configuratie) worden vertaald naar
 * een nette Nederlandse melding.
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: 'Synchronisatie staat niet ingesteld.' };
  }
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: 'Synchronisatie staat niet ingesteld.' };
  }

  try {
    ensureGoogleConfigured();

    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const response = await GoogleSignin.signIn();

    if (isCancelledResponse(response)) {
      // Gebruiker annuleerde zelf: geen fout, stil afhandelen.
      return { ok: false };
    }
    if (!isSuccessResponse(response) || !response.data.idToken) {
      return {
        ok: false,
        message: 'Inloggen met Google lukte niet. Probeer het later opnieuw.',
      };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: response.data.idToken,
    });
    if (error) {
      return { ok: false, message: vertaalAuthFout(error.message) };
    }
    return { ok: true, message: 'Ingelogd met Google.', session: data.session };
  } catch (e: any) {
    // Gebruiker annuleerde zelf (oudere native foutcode): geen fout, stil afhandelen.
    if (e?.code === statusCodes.SIGN_IN_CANCELLED) {
      return { ok: false };
    }
    return {
      ok: false,
      message: 'Inloggen met Google lukte niet. Probeer het later opnieuw.',
    };
  }
}

/**
 * Log in met Apple via de native "Sign in with Apple"-flow (alleen iOS) en
 * koppel de verkregen identityToken aan Supabase via signInWithIdToken.
 *
 * Volgt de door Supabase aanbevolen flow met een nonce: we genereren zelf
 * een willekeurige "rauwe" nonce, geven de SHA256-hash daarvan mee aan
 * Apple (verplicht door Apple's beveiligingsmodel), en geven de rauwe nonce
 * mee aan Supabase zodat die de hash kan herleiden en het token kan
 * verifieren.
 *
 * Volledig defensief: alleen beschikbaar op iOS en als isAvailableAsync true
 * is. Annulering door de gebruiker (ERR_REQUEST_CANCELED) is geen fout en
 * geeft {ok:false} zonder alarmerende message terug.
 */
export async function signInWithApple(): Promise<AuthResult> {
  if (Platform.OS !== 'ios') {
    return { ok: false, message: 'Inloggen met Apple is alleen beschikbaar op iOS.' };
  }
  if (!isSupabaseConfigured()) {
    return { ok: false, message: 'Synchronisatie staat niet ingesteld.' };
  }
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, message: 'Synchronisatie staat niet ingesteld.' };
  }

  try {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      return { ok: false, message: 'Inloggen met Apple is niet beschikbaar op dit toestel.' };
    }

    // Rauwe nonce genereren en hashen: Apple krijgt de hash, Supabase krijgt
    // de rauwe waarde om de hash zelf te kunnen herleiden en verifieren.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return {
        ok: false,
        message: 'Inloggen met Apple lukte niet. Probeer het later opnieuw.',
      };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) {
      return { ok: false, message: vertaalAuthFout(error.message) };
    }
    return { ok: true, message: 'Ingelogd met Apple.', session: data.session };
  } catch (e: any) {
    // Gebruiker annuleerde zelf: geen fout, stil afhandelen.
    if (e?.code === 'ERR_REQUEST_CANCELED') {
      return { ok: false };
    }
    return {
      ok: false,
      message: 'Inloggen met Apple lukte niet. Probeer het later opnieuw.',
    };
  }
}

/** Log uit. Best-effort, faalt stil. */
export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch {
    // Negeer fouten bij uitloggen
  }
}

/**
 * Abonneer op auth-wijzigingen. Geeft een opzegfunctie terug, of een
 * lege functie als er geen backend is.
 */
export function onAuthChange(
  callback: (session: Session | null) => void,
): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};
  try {
    const { data } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        callback(session);
      },
    );
    return () => data.subscription.unsubscribe();
  } catch {
    return () => {};
  }
}

/** Vertaal de bekendste Supabase-foutmeldingen naar het Nederlands. */
function vertaalAuthFout(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Dit e-mailadres is al in gebruik. Log in om je data te herstellen.';
  }
  if (m.includes('invalid login credentials')) {
    return 'E-mailadres of wachtwoord klopt niet.';
  }
  if (m.includes('password')) {
    return 'Het wachtwoord voldoet niet. Kies minstens 8 tekens.';
  }
  if (m.includes('email')) {
    return 'Controleer het e-mailadres en probeer het opnieuw.';
  }
  return 'Er ging iets mis. Probeer het later opnieuw.';
}
