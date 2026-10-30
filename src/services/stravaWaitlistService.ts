/**
 * stravaWaitlistService
 *
 * Wachtlijst voor de Strava-atletenlimiet. Zolang Strava onze capaciteits-
 * aanvraag niet goedkeurt, geeft de token-exchange een 403. De gebruiker kan
 * zich dan op de wachtlijst zetten (tabel strava_waitlist) en krijgt een
 * seintje op het dashboard zodra de vlag strava_open in app_config op true
 * staat. Geen push: de app leest de vlag zelf.
 *
 * Eigen bestand (niet in stravaService) zodat de Supabase- en auth-imports de
 * OAuth-service niet verzwaren; stravaService importeert alleen
 * leaveStravaWaitlist. Alle functies falen stil en gooien nooit: het is
 * geen kritieke data en de koppelflow zelf blijft ongewijzigd.
 */

import { useAppStore } from '../store/appStore';
import { getSupabase } from './supabaseClient';
import { getCurrentUser } from './authService';
import { trackEvent } from './analyticsService';

/** Insert van de eigen rij; bestaat hij al dan gebeurt er niets. */
async function insertOwnRow(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const user = await getCurrentUser();
    if (!user) return false;
    const { error } = await supabase
      .from('strava_waitlist')
      .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Zet de gebruiker op de wachtlijst. De lokale vlag gaat altijd aan, ook als
 * de insert mislukt (offline): checkStravaWaitlistOpen probeert het later
 * opnieuw.
 */
export async function joinStravaWaitlist(): Promise<void> {
  useAppStore.getState().setStravaWaitlisted(true);
  void trackEvent('strava_waitlist_joined');
  await insertOwnRow();
}

/** Staat Strava-koppelen weer open? Fouten tellen als false. */
export async function isStravaOpen(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'strava_open')
      .maybeSingle();
    if (error || !data) return false;
    return data.value === true;
  } catch {
    return false;
  }
}

/**
 * Haalt de gebruiker van de wachtlijst: verwijdert de eigen rij en zet de
 * lokale vlag uit. Aanroepen na een geslaagde koppeling en bij "niet meer
 * tonen". De vlag gaat ook uit als het verwijderen mislukt.
 */
export async function leaveStravaWaitlist(): Promise<void> {
  useAppStore.getState().setStravaWaitlisted(false);
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const user = await getCurrentUser();
    if (!user) return;
    await supabase.from('strava_waitlist').delete().eq('user_id', user.id);
  } catch {
    // Best-effort: een achtergebleven rij is onschuldig
  }
}

/**
 * Voor het dashboard: probeert eerst een eerder mislukte insert opnieuw
 * (offline aangemeld) en geeft daarna terug of koppelen weer kan. Alleen
 * relevant voor wie op de wachtlijst staat en nog niet gekoppeld is.
 */
export async function checkStravaWaitlistOpen(): Promise<boolean> {
  const { stravaWaitlisted, stravaConnected } = useAppStore.getState();
  if (!stravaWaitlisted || stravaConnected) return false;
  await insertOwnRow();
  return isStravaOpen();
}
