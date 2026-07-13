/**
 * supabaseClient
 *
 * Centrale Supabase-client voor auth en datasync. De app is volledig
 * offline-first: zonder geldige sleutels of netwerk blijft alles lokaal
 * werken. De client wordt daarom alleen aangemaakt als er sleutels zijn.
 *
 * Sleutels komen uit het .env-bestand in de projectroot:
 *  - EXPO_PUBLIC_SUPABASE_URL
 *  - EXPO_PUBLIC_SUPABASE_ANON_KEY
 * Zie .env.example en docs/SUPABASE_SETUP.md voor de opzet.
 *
 * Let op: na het aanpassen van .env moet de Metro-server opnieuw gestart
 * worden (npx expo start) om de nieuwe waarden te laden.
 *
 * Vereist: npx expo install @supabase/supabase-js react-native-url-polyfill
 */

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sanitizeEnvValue, isHttpsUrl } from '../utils/env';

const SUPABASE_URL = sanitizeEnvValue(process.env.EXPO_PUBLIC_SUPABASE_URL);
const SUPABASE_ANON_KEY = sanitizeEnvValue(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Zijn er bruikbare Supabase-sleutels ingesteld? Zonder sleutels blijft
 * de app volledig offline werken en wordt er geen client aangemaakt.
 *
 * De URL moet bovendien met "https://" beginnen: een niet-geexpandeerde
 * placeholder (bijvoorbeeld de letterlijke string
 * "$EXPO_PUBLIC_SUPABASE_ANON_KEY" door een kapotte eas.json-configuratie)
 * die toevallig niet met "$" begint, telt zo nog steeds niet als geldig.
 */
export const isSupabaseConfigured = (): boolean =>
  isHttpsUrl(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 0;

/**
 * De client wordt eenmalig (lazy) aangemaakt. Is er geen configuratie,
 * dan blijft dit null en valt alle backend-logica stilletjes terug op
 * de lokale opslag.
 *
 * Mislukt het aanmaken van de client zelf (bijvoorbeeld door een ongeldige
 * URL die de sanitize-check toch doorkomt), dan wordt dat resultaat ook
 * gecachet: we proberen het niet bij elke aanroep opnieuw, en geven
 * voortaan meteen null terug in plaats van steeds opnieuw te crashen.
 */
let client: SupabaseClient | null = null;
let clientCreationFailed = false;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (client) return client;
  if (clientCreationFailed) return null;

  try {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // Geen URL-sessiedetectie nodig in een React Native-app
        detectSessionInUrl: false,
      },
    });
  } catch {
    // Stil falen: backend-logica valt terug op de lokale opslag
    clientCreationFailed = true;
    client = null;
  }

  return client;
}

export type { SupabaseClient };
