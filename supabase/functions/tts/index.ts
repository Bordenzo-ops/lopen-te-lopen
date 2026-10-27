// Uitgeschakeld op 27-10-2026: geen enkele appversie gebruikt deze functie.
// Stemmen komen uit de voice-packs (scripts/generate-voice-packs.ts roept
// ElevenLabs rechtstreeks aan). Mag in het dashboard verwijderd worden.
Deno.serve(() =>
  new Response(JSON.stringify({ error: 'gone' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json' },
  }),
);
