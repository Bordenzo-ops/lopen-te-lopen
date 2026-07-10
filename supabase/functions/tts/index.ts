/**
 * Supabase Edge Function: tts
 *
 * Proxy tussen de app en ElevenLabs text-to-speech. De ElevenLabs
 * API-sleutel wordt hier serverside opgeslagen als Supabase Secret
 * (ELEVENLABS_API_KEY) en verlaat nooit de client.
 *
 * Hardening (werkpakket 1):
 *  - JWT-verificatie: verwacht in de Authorization header niet langer de
 *    kale anon key, maar het access token van de ingelogde (of anonieme)
 *    Supabase-gebruiker. Dat token wordt geverifieerd via supabase.auth.getUser.
 *    LET OP: voiceService.ts (client-kant) is in dit werkpakket NIET aangepast
 *    en moet in een volgend werkpakket worden bijgewerkt zodat die voortaan
 *    de access token van de actieve Supabase-sessie meestuurt als Bearer
 *    token, in plaats van de anon key.
 *  - Whitelist op voiceId: alleen de twee coachstemmen zijn toegestaan.
 *  - Tekstlimiet verlaagd naar 500 tekens (coachingzinnen zijn kort).
 *  - Eenvoudige in-memory rate limit per gebruiker: max 30 verzoeken/minuut.
 *
 * Deploy:
 *   supabase functions deploy tts
 *   supabase secrets set ELEVENLABS_API_KEY=sk_...
 *   (SUPABASE_URL en SUPABASE_ANON_KEY zijn standaard al beschikbaar als
 *   omgevingsvariabelen binnen edge functions, hoeven niet apart gezet)
 *
 * Let op: de functie wordt niet langer met --no-verify-jwt gedeployd te
 * laten draaien is niet voldoende op zich, de JWT-check hieronder is de
 * eigenlijke controle op een geldige gebruiker.
 *
 * Aanroep vanuit de app (via voiceService.ts):
 *   POST /functions/v1/tts
 *   Authorization: Bearer <supabase-sessie-access-token>
 *   Content-Type: application/json
 *   Body: { voiceId, text, modelId, voiceSettings }
 *
 * Geeft terug: binary mp3-data (Content-Type: audio/mpeg)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

// Toegestane coachstemmen (Roos en Adam). Elke andere voiceId wordt geweigerd.
const ALLOWED_VOICE_IDS = new Set(['7qdUFMklKPaaAVMsBTBt', 'pNInz6obpgDQGcFmaJgB']);

// Maximale tekstlengte per verzoek (coachingzinnen zijn kort, 500 is ruim genoeg)
const MAX_TEXT_LENGTH = 500;

// Eenvoudige in-memory rate limit per user-id: max 30 verzoeken per minuut.
// Dit is per edge function-instantie en geen verdeelde/persistente limiet,
// maar volstaat als eerste verdedigingslinie tegen misbruik of bugs die
// veel verzoeken afvuren.
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const requestLog = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const timestamps = requestLog.get(userId) ?? [];
  // Oude entries buiten het venster opruimen
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    requestLog.set(userId, recent);
    return true;
  }
  recent.push(now);
  requestLog.set(userId, recent);
  return false;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Preflight voor CORS (React Native stuurt geen OPTIONS, maar voor de zekerheid)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  if (!ELEVENLABS_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'TTS niet geconfigureerd op de server.' }),
      { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // JWT-verificatie: haal de Bearer token uit de Authorization header en
  // verifieer die bij Supabase. Ook anonieme Supabase-gebruikers zijn geldig,
  // de kale anon key als Bearer token is dat echter niet.
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(
      JSON.stringify({ error: 'Niet geautoriseerd.' }),
      { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData?.user) {
    return new Response(
      JSON.stringify({ error: 'Niet geautoriseerd.' }),
      { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const userId = userData.user.id;

  if (isRateLimited(userId)) {
    return new Response(
      JSON.stringify({ error: 'Te veel verzoeken, probeer het over een minuut opnieuw.' }),
      { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  let body: { voiceId?: string; text?: string; modelId?: string; voiceSettings?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Ongeldig JSON-verzoek.' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const { voiceId, text, modelId, voiceSettings } = body;

  if (!voiceId || !text || typeof text !== 'string' || text.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: 'Vereiste velden ontbreken: voiceId en text.' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  if (!ALLOWED_VOICE_IDS.has(voiceId)) {
    return new Response(
      JSON.stringify({ error: 'Ongeldige voiceId.' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // Begrens de tekst (coachingzinnen zijn kort, 500 tekens is ruim voldoende)
  const safeText = text.slice(0, MAX_TEXT_LENGTH);

  try {
    const elevenResp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: safeText,
          model_id: modelId ?? 'eleven_multilingual_v2',
          voice_settings: voiceSettings ?? {
            stability: 0.4,
            similarity_boost: 0.75,
            style: 0.45,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!elevenResp.ok) {
      const errText = await elevenResp.text().catch(() => '');
      return new Response(
        JSON.stringify({ error: `ElevenLabs fout ${elevenResp.status}`, detail: errText }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const audio = await elevenResp.arrayBuffer();
    return new Response(audio, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Onverwachte serverfout.' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
