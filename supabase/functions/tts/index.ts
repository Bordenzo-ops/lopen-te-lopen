/**
 * Supabase Edge Function: tts
 *
 * Proxy tussen de app en ElevenLabs text-to-speech. De ElevenLabs
 * API-sleutel wordt hier serverside opgeslagen als Supabase Secret
 * (ELEVENLABS_API_KEY) en verlaat nooit de client.
 *
 * Deploy:
 *   supabase functions deploy tts --no-verify-jwt
 *   supabase secrets set ELEVENLABS_API_KEY=sk_...
 *
 * Aanroep vanuit de app (via voiceService.ts):
 *   POST /functions/v1/tts
 *   Authorization: Bearer <supabase-anon-key>
 *   Content-Type: application/json
 *   Body: { voiceId, text, modelId, voiceSettings }
 *
 * Geeft terug: binary mp3-data (Content-Type: audio/mpeg)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY') ?? '';

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

  // Begrens de tekst (ElevenLabs-limiet: 5000 tekens per verzoek)
  const safeText = text.slice(0, 5000);

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
