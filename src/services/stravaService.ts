/**
 * stravaService
 *
 * Koppeling met Strava: OAuth-verbinding, tokenbeheer en het uploaden van
 * voltooide runs.
 *
 * Werking:
 *  1. connectStrava() opent de Strava-authorize-pagina in de browser. Strava
 *     stuurt na goedkeuring door naar de Supabase Edge Function
 *     (supabase/functions/strava-oauth), die de authorization code omwisselt
 *     voor tokens (client secret blijft serverside) en de gebruiker
 *     terugstuurt naar de app via het deep link-schema
 *     lopentelopen://strava-callback. De route app/strava-callback.tsx vangt
 *     dat op en roept saveTokens() aan.
 *  2. Tokens staan lokaal in AsyncStorage (zelfde opslag als de zustand-
 *     store). Vlak voor een upload wordt gecontroleerd of het access_token
 *     binnen 5 minuten verloopt; zo ja, dan wordt het eerst ververst via de
 *     POST-route van dezelfde Edge Function.
 *  3. uploadRun() stuurt de run door: met een route (>= 2 punten) als
 *     GPX-bestand (hergebruikt generateGpx uit exportService) naar
 *     /api/v3/uploads, zonder route als handmatige activiteit naar
 *     /api/v3/activities.
 *
 * Alle functies falen stil (result-object, geen throws) zodat een voltooide
 * training nooit vastloopt op een Strava-probleem.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { generateGpx } from './exportService';
import type { CompletedSession } from '../store/appStore';
import { useAppStore } from '../store/appStore';

const TOKEN_STORAGE_KEY = 'strava-tokens';

/** Leeg = koppeling uitgeschakeld: de UI toont dan dat setup nog nodig is. */
export const STRAVA_CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID ?? '';

export const isStravaConfigured = (): boolean => STRAVA_CLIENT_ID.length > 0;

/** Function-URL afgeleid van de bestaande Supabase-URL-configuratie */
function getFunctionUrl(): string {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  if (!supabaseUrl) return '';
  return `${supabaseUrl}/functions/v1/strava-oauth`;
}

interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix seconds
  athleteName: string;
}

// ── Tokenopslag ───────────────────────────────────────────────────────────────

async function saveTokens(tokens: StravaTokens): Promise<void> {
  await AsyncStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

async function readTokens(): Promise<StravaTokens | null> {
  try {
    const raw = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StravaTokens;
  } catch {
    return null;
  }
}

async function clearTokens(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Negeer storage-fouten bij wissen
  }
}

// ── Verbinden ─────────────────────────────────────────────────────────────────

/**
 * Opent de Strava-authorize-pagina. De redirect_uri wijst naar de Edge
 * Function, die op zijn beurt terugstuurt naar de app via het deep link-
 * schema. Doet niets als de koppeling niet geconfigureerd is.
 */
export async function connectStrava(): Promise<{ ok: boolean; message?: string }> {
  if (!isStravaConfigured()) {
    return { ok: false, message: 'Strava-koppeling is nog niet ingesteld voor deze app.' };
  }
  const functionUrl = getFunctionUrl();
  if (!functionUrl) {
    return { ok: false, message: 'Strava-koppeling is nog niet ingesteld voor deze app.' };
  }

  const authorizeUrl =
    'https://www.strava.com/oauth/authorize' +
    `?client_id=${encodeURIComponent(STRAVA_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(functionUrl)}` +
    '&response_type=code' +
    '&scope=activity:write,read' +
    '&approval_prompt=auto';

  try {
    await Linking.openURL(authorizeUrl);
    return { ok: true };
  } catch {
    return { ok: false, message: 'Kon de Strava-verbindingspagina niet openen.' };
  }
}

/**
 * Verwerkt de callback-parameters van app/strava-callback.tsx en slaat de
 * tokens op bij succes.
 */
export async function handleStravaCallback(params: {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  athlete_name?: string;
  error?: string;
}): Promise<{ ok: boolean; athleteName?: string; message?: string }> {
  if (params.error) {
    return { ok: false, message: vertaalStravaFout(params.error) };
  }
  if (!params.access_token || !params.refresh_token || !params.expires_at) {
    return { ok: false, message: 'Onvolledig antwoord van Strava ontvangen.' };
  }

  const athleteName = params.athlete_name || 'Strava-atleet';
  await saveTokens({
    accessToken: params.access_token,
    refreshToken: params.refresh_token,
    expiresAt: parseInt(params.expires_at, 10),
    athleteName,
  });

  useAppStore.getState().setStravaConnected(true, athleteName);
  return { ok: true, athleteName };
}

function vertaalStravaFout(error: string): string {
  if (error === 'niet_geconfigureerd') return 'Strava-koppeling is nog niet ingesteld op de server.';
  if (error === 'geen_code_ontvangen') return 'Strava heeft geen toestemmingscode teruggestuurd.';
  return 'Verbinden met Strava is niet gelukt. Probeer het opnieuw.';
}

/** Ontkoppelt Strava: wist lokale tokens en trekt de toegang bij Strava in. */
export async function disconnectStrava(): Promise<void> {
  const tokens = await readTokens();
  await clearTokens();
  useAppStore.getState().setStravaConnected(false);

  if (!tokens) return;
  try {
    await fetch(
      `https://www.strava.com/oauth/deauthorize?access_token=${encodeURIComponent(tokens.accessToken)}`,
      { method: 'POST' },
    );
  } catch {
    // Best-effort: lokale ontkoppeling is al gebeurd, de rest is opruimen
  }
}

// ── Tokenverversing ───────────────────────────────────────────────────────────

/** Ververst het token binnen 5 minuten voor verlopen, anders geeft het bestaande token terug. */
async function ensureFreshToken(): Promise<StravaTokens | null> {
  const tokens = await readTokens();
  if (!tokens) return null;

  const fiveMinutes = 5 * 60;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (tokens.expiresAt - nowSeconds > fiveMinutes) {
    return tokens;
  }

  const functionUrl = getFunctionUrl();
  if (!functionUrl) return tokens;

  try {
    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: tokens.refreshToken }),
    });
    if (!res.ok) return tokens;

    const data = await res.json();
    if (!data.access_token) return tokens;

    const refreshed: StravaTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? tokens.refreshToken,
      expiresAt: data.expires_at ?? tokens.expiresAt,
      athleteName: tokens.athleteName,
    };
    await saveTokens(refreshed);
    return refreshed;
  } catch {
    // Netwerk weg: probeer het toch met het (mogelijk nog geldige) token
    return tokens;
  }
}

// ── Uploaden ──────────────────────────────────────────────────────────────────

export interface StravaUploadResult {
  ok: boolean;
  message?: string;
}

/**
 * Uploadt een voltooide sessie naar Strava. Met een route (>= 2 punten) als
 * GPX-bestand, zonder route als handmatige activiteit. Geeft altijd een
 * resultaatobject terug, gooit nooit.
 */
export async function uploadRun(session: CompletedSession): Promise<StravaUploadResult> {
  try {
    const tokens = await ensureFreshToken();
    if (!tokens) {
      return { ok: false, message: 'Geen actieve Strava-koppeling.' };
    }

    const hasRoute = (session.route?.length ?? 0) >= 2;

    if (hasRoute) {
      return await uploadGpx(session, tokens.accessToken);
    }
    return await uploadManualActivity(session, tokens.accessToken);
  } catch {
    return { ok: false, message: 'Uploaden naar Strava is niet gelukt.' };
  }
}

async function uploadGpx(session: CompletedSession, accessToken: string): Promise<StravaUploadResult> {
  const gpx = generateGpx(session);
  if (!gpx) {
    return await uploadManualActivity(session, accessToken);
  }

  const activityName = `Training ${new Date(session.completedAt).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
  })}`;

  const form = new FormData();
  form.append('data_type', 'gpx');
  form.append('name', activityName);
  // React Native's fetch/FormData ondersteunt een bestandsobject met een
  // data-URI. GPX is platte tekst, dus base64 is niet nodig: we sturen het
  // als een "blob" met expliciet type via een Blob-achtig object.
  form.append('file', {
    // @ts-ignore: React Native FormData-bestandsvorm (uri/name/type)
    uri: `data:application/gpx+xml;base64,${base64FromUtf8(gpx)}`,
    name: `lopen-te-lopen-${session.sessionId}.gpx`,
    type: 'application/gpx+xml',
  } as unknown as Blob);

  try {
    const res = await fetch('https://www.strava.com/api/v3/uploads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    if (!res.ok) {
      return { ok: false, message: `Strava-upload mislukt (status ${res.status}).` };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: 'Netwerkfout bij uploaden naar Strava.' };
  }
}

async function uploadManualActivity(session: CompletedSession, accessToken: string): Promise<StravaUploadResult> {
  const activityName = `Training ${new Date(session.completedAt).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
  })}`;

  try {
    const res = await fetch('https://www.strava.com/api/v3/activities', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: activityName,
        type: 'Run',
        start_date_local: session.completedAt,
        elapsed_time: session.durationSeconds,
        distance: Math.round(session.actualDistanceKm * 1000),
      }),
    });
    if (!res.ok) {
      return { ok: false, message: `Strava-upload mislukt (status ${res.status}).` };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: 'Netwerkfout bij uploaden naar Strava.' };
  }
}

/** Eenvoudige UTF-8-naar-base64 encoder, zonder afhankelijkheid van Buffer (niet beschikbaar in React Native) */
function base64FromUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  // btoa is beschikbaar in Hermes/React Native
  return btoa(binary);
}

// ── Wachtrij: opnieuw proberen ────────────────────────────────────────────────

/**
 * Probeert alle sessies in de uploadwachtrij opnieuw. Best-effort en stil,
 * net als syncService: geen foutmeldingen, geen blokkerende UI. Wordt
 * aangeroepen bij app-start en bij het openen van het dashboard.
 */
export async function retryStravaQueue(): Promise<void> {
  const state = useAppStore.getState();
  if (!state.stravaConnected || !state.stravaAutoUpload) return;
  if (state.stravaUploadQueue.length === 0) return;

  for (const sessionId of [...state.stravaUploadQueue]) {
    const session = useAppStore.getState().completedSessions.find(s => s.sessionId === sessionId);
    if (!session) {
      // Sessie bestaat niet meer (bijv. na reset): verwijder uit de wachtrij
      useAppStore.getState().dequeueStravaUpload(sessionId);
      continue;
    }
    try {
      const result = await uploadRun(session);
      if (result.ok) {
        useAppStore.getState().dequeueStravaUpload(sessionId);
      }
    } catch {
      // Stil falen: blijft in de wachtrij voor de volgende poging
    }
  }
}
