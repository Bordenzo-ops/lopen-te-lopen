/**
 * Supabase Edge Function: delete-account
 *
 * Verwijdert het account van de aanroeper definitief (store-eis: Apple
 * 5.1.1(v) en Google Play). De gebruiker wordt uit auth.users verwijderd
 * met de service role; profiles, runs en events hangen met
 * `on delete cascade` aan auth.users (zie migraties 0001, 0002 en 0003) en
 * verdwijnen dus automatisch mee.
 *
 * Optioneel, voor Apple-gebruikers: Apple vereist dat bij het verwijderen van
 * een account het "Sign in with Apple"-token ingetrokken wordt. Stuurt de app
 * een `appleAuthorizationCode` mee en zijn de Apple-secrets gezet, dan wisselen
 * we die code in bij Apple en trekken we het token in. Ontbreekt iets of faalt
 * het, dan loggen we dat (zonder tokens) en verwijderen we het account toch.
 *
 * Beveiliging:
 *  - JWT-verificatie: de Authorization header moet het access token van de
 *    ingelogde (of anonieme) Supabase-gebruiker bevatten. Dat token wordt
 *    geverifieerd via supabase.auth.getUser. Je kunt alleen jezelf verwijderen.
 *  - De service role key verlaat de server nooit.
 *
 * Deploy:
 *   supabase functions deploy delete-account
 *   (SUPABASE_URL, SUPABASE_ANON_KEY en SUPABASE_SERVICE_ROLE_KEY zijn binnen
 *   edge functions standaard beschikbaar.)
 *   Optioneel voor Apple-tokenintrekking:
 *   supabase secrets set APPLE_TEAM_ID=...        (10 tekens, Apple Developer-account)
 *   supabase secrets set APPLE_KEY_ID=...         (Key ID van de "Sign in with Apple"-sleutel)
 *   supabase secrets set APPLE_PRIVATE_KEY="$(cat AuthKey_XXXX.p8)"   (inhoud van de .p8)
 *   supabase secrets set APPLE_CLIENT_ID=com.lopentelopen.app          (bundle id)
 *
 * Aanroep vanuit de app (via authService.deleteAccount):
 *   POST /functions/v1/delete-account
 *   Authorization: Bearer <supabase-sessie-access-token>
 *   Content-Type: application/json
 *   Body: { appleAuthorizationCode?: string }   (mag leeg of weggelaten zijn)
 *
 * Antwoord:
 *   200 { ok: true, appleRevoked: boolean }
 *   401 { error }  geen of ongeldig token
 *   405 verkeerde methode
 *   500 { error }  verwijderen mislukt (account bestaat dan nog)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const APPLE_TEAM_ID = Deno.env.get('APPLE_TEAM_ID') ?? '';
const APPLE_KEY_ID = Deno.env.get('APPLE_KEY_ID') ?? '';
const APPLE_PRIVATE_KEY = Deno.env.get('APPLE_PRIVATE_KEY') ?? '';
const APPLE_CLIENT_ID = Deno.env.get('APPLE_CLIENT_ID') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Importeert de Apple .p8-sleutel (PKCS#8, PEM) als ES256-signeersleutel. */
async function importApplePrivateKey(pem: string): Promise<CryptoKey> {
  // Secrets bevatten soms letterlijke "\n"-reeksen in plaats van echte regeleinden.
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

/** Maakt het client_secret-JWT (ES256, max 6 maanden geldig; wij gebruiken 5 minuten). */
async function createAppleClientSecret(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: APPLE_KEY_ID, typ: 'JWT' };
  const claims = {
    iss: APPLE_TEAM_ID,
    iat: now,
    exp: now + 300,
    aud: 'https://appleid.apple.com',
    sub: APPLE_CLIENT_ID,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const key = await importApplePrivateKey(APPLE_PRIVATE_KEY);
  // Web Crypto geeft ECDSA-handtekeningen al als ruwe r||s terug, het formaat dat JWT vraagt.
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64url(signature)}`;
}

/**
 * Best-effort: wisselt de authorizationCode in en trekt het Apple-token in.
 * Geeft true terug als Apple de intrekking bevestigde. Logt nooit tokens.
 */
async function revokeAppleToken(authorizationCode: string): Promise<boolean> {
  if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY || !APPLE_CLIENT_ID) {
    console.log('delete-account: Apple-secrets niet gezet, tokenintrekking overgeslagen.');
    return false;
  }
  try {
    const clientSecret = await createAppleClientSecret();

    const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: APPLE_CLIENT_ID,
        client_secret: clientSecret,
        code: authorizationCode,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      console.log(`delete-account: Apple-code inwisselen mislukt (status ${tokenRes.status}).`);
      return false;
    }
    const tokens = await tokenRes.json();
    const tokenToRevoke: string | undefined = tokens.refresh_token ?? tokens.access_token;
    const hint = tokens.refresh_token ? 'refresh_token' : 'access_token';
    if (!tokenToRevoke) {
      console.log('delete-account: Apple gaf geen token terug om in te trekken.');
      return false;
    }

    const revokeRes = await fetch('https://appleid.apple.com/auth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: APPLE_CLIENT_ID,
        client_secret: clientSecret,
        token: tokenToRevoke,
        token_type_hint: hint,
      }),
    });
    if (!revokeRes.ok) {
      console.log(`delete-account: Apple-token intrekken mislukt (status ${revokeRes.status}).`);
      return false;
    }
    return true;
  } catch (e) {
    console.log('delete-account: fout bij Apple-tokenintrekking:', e instanceof Error ? e.message : 'onbekend');
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Niet geautoriseerd.' }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return json({ error: 'Niet geautoriseerd.' }, 401);
  }
  const userId = userData.user.id;

  let appleAuthorizationCode: string | null = null;
  try {
    const payload = await req.json();
    if (typeof payload?.appleAuthorizationCode === 'string' && payload.appleAuthorizationCode) {
      appleAuthorizationCode = payload.appleAuthorizationCode;
    }
  } catch {
    // Lege of ongeldige body: gewoon doorgaan zonder Apple-intrekking
  }

  // Eerst Apple (best-effort), daarna pas het echte verwijderen.
  const appleRevoked = appleAuthorizationCode
    ? await revokeAppleToken(appleAuthorizationCode)
    : false;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.log('delete-account: verwijderen mislukt:', deleteError.message);
    return json({ error: 'Account verwijderen mislukt.' }, 500);
  }

  return json({ ok: true, appleRevoked });
});
