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

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Zijn er bruikbare Supabase-sleutels ingesteld? Zonder sleutels blijft
 * de app volledig offline werken en wordt er geen client aangemaakt.
 */
export const isSupabaseConfigured = (): boolean =>
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/**
 * De client wordt eenmalig (lazy) aangemaakt. Is er geen configuratie,
 * dan blijft dit null en valt alle backend-logica stilletjes terug op
 * de lokale opslag.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (client) return client;

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Geen URL-sessiedetectie nodig in een React Native-app
      detectSessionInUrl: false,
    },
  });

  return client;
}

export type { SupabaseClient };
