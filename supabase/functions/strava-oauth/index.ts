/**
 * Supabase Edge Function: strava-oauth
 *
 * Handelt de volledige Strava OAuth-uitwisseling af. De Strava client
 * secret leeft bewust alleen hier (als Supabase Secret) en verlaat nooit
 * de app-bundel.
 *
 * Twee routes in één function:
 *
 *  1. GET  ?code=...
 *     Dit is de callback-redirect van Strava zelf (Authorization Callback
 *     Domain wijst naar dit Supabase-projectdomein). Wisselt de
 *     authorization code om voor een tokenset via
 *     https://www.strava.com/oauth/token en stuurt de gebruiker met een
 *     302-redirect terug naar de app via het deep link-schema
 *     lopentelopen://strava-callback, met de tokens als querystring.
 *     Gaat er iets mis, dan redirect de function naar
 *     lopentelopen://strava-callback?error=... zodat de app dit netjes
 *     kan tonen in plaats van vast te lopen op een kale foutpagina.
 *
 *  2. POST { refresh_token }
 *     Ververst een verlopen (of bijna verlopen) tokenset bij Strava en
 *     geeft de nieuwe tokenset terug als JSON. Wordt aangeroepen vanuit
 *     stravaService.ts vlak voordat een upload dreigt te falen op een
 *     verlopen access_token.
 *
 * Hardening (werkpakket 1):
 *  - GET-route: de state-parameter die de app meegeeft bij het starten van
 *    de OAuth-flow wordt, indien aanwezig, ongewijzigd teruggegeven in ALLE
 *    redirects naar de app (zowel succes als fout), als parameter state.
 *    De app valideert deze state zelf (client-werk zit in een ander pakket).
 *  - POST-route: eenvoudige in-memory rate limit per refresh_token, max 10
 *    verzoeken per minuut, om misbruik of foutieve retry-loops te beperken.
 *
 * Deploy:
 *   supabase functions deploy strava-oauth --no-verify-jwt
 *   supabase secrets set STRAVA_CLIENT_ID=... STRAVA_CLIENT_SECRET=...
 *
 * --no-verify-jwt is nodig omdat Strava zelf de GET-callback aanroept
 * zonder Supabase-auth-header. Zie docs/STRAVA_SETUP.md voor de volledige
 * setup.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID') ?? '';
const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET') ?? '';

const APP_CALLBACK = 'lopentelopen://strava-callback';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Eenvoudige in-memory rate limit voor de POST-route (token verversen):
// max 10 verzoeken per minuut per refresh_token.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const refreshRequestLog = new Map<string, number[]>();

function isRefreshRateLimited(refreshToken: string): boolean {
  const now = Date.now();
  const timestamps = refreshRequestLog.get(refreshToken) ?? [];
  // Oude entries buiten het venster opruimen
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    refreshRequestLog.set(refreshToken, recent);
    return true;
  }
  recent.push(now);
  refreshRequestLog.set(refreshToken, recent);
  return false;
}

/** Bouwt de deep link terug naar de app met de gegeven querystring-parameters */
function buildAppRedirect(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `${APP_CALLBACK}?${qs}`;
}

/** 302-redirect helper */
function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { ...CORS_HEADERS, Location: url },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const url = new URL(req.url);

  // ── GET: OAuth-callback van Strava zelf ──────────────────────────────────
  if (req.method === 'GET') {
    const code = url.searchParams.get('code');
    const stravaError = url.searchParams.get('error');
    const state = url.searchParams.get('state');

    // Geeft de state-parameter, indien aanwezig, ongewijzigd mee in de
    // redirect. De app valideert deze state zelf om CSRF op de OAuth-flow
    // te voorkomen.
    const withState = (params: Record<string, string>): Record<string, string> =>
      state ? { ...params, state } : params;

    if (stravaError) {
      return redirect(buildAppRedirect(withState({ error: stravaError })));
    }

    if (!code) {
      return redirect(buildAppRedirect(withState({ error: 'geen_code_ontvangen' })));
    }

    if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
      return redirect(buildAppRedirect(withState({ error: 'niet_geconfigureerd' })));
    }

    try {
      const tokenResp = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResp.ok) {
        return redirect(buildAppRedirect(withState({ error: `strava_fout_${tokenResp.status}` })));
      }

      const data = await tokenResp.json();
      const athleteName = [data.athlete?.firstname, data.athlete?.lastname]
        .filter(Boolean)
        .join(' ')
        .trim();

      return redirect(
        buildAppRedirect(
          withState({
            access_token: data.access_token ?? '',
            refresh_token: data.refresh_token ?? '',
            expires_at: String(data.expires_at ?? ''),
            athlete_name: athleteName || 'Strava-atleet',
          }),
        ),
      );
    } catch {
      return redirect(buildAppRedirect(withState({ error: 'onbekende_fout' })));
    }
  }

  // ── POST: token verversen ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Strava-koppeling niet geconfigureerd op de server.' }),
        { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    let body: { refresh_token?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Ongeldig JSON-verzoek.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    if (!body.refresh_token) {
      return new Response(
        JSON.stringify({ error: 'Vereist veld ontbreekt: refresh_token.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    if (isRefreshRateLimited(body.refresh_token)) {
      return new Response(
        JSON.stringify({ error: 'Te veel verzoeken, probeer het over een minuut opnieuw.' }),
        { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    try {
      const tokenResp = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: STRAVA_CLIENT_ID,
          client_secret: STRAVA_CLIENT_SECRET,
          refresh_token: body.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!tokenResp.ok) {
        const errText = await tokenResp.text().catch(() => '');
        return new Response(
          JSON.stringify({ error: `Strava-fout ${tokenResp.status}`, detail: errText }),
          { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }

      const data = await tokenResp.json();
      return new Response(
        JSON.stringify({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: data.expires_at,
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    } catch {
      return new Response(
        JSON.stringify({ error: 'Onverwachte serverfout.' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }
  }

  return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
});
