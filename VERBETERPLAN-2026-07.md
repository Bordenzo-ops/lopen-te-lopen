# Verbeterronde Lopen te Lopen (juli 2026)

Resultaat van security audit en design/functie-review (benchmark: Strava, Komoot, Runna), uitgevoerd op 5 juli 2026. De codewijzigingen hieronder zijn AFGEROND en gecontroleerd; na het installeren van de nieuwe packages (zie hieronder) compileert tsc schoon. Vrijwel alle vervolgacties zijn op 5 juli 2026 samen met Lars afgewerkt; alleen de fysieke toesteltest staat nog open.

## Uitgevoerd: backend hardening (supabase/functions)

1. `tts/index.ts`: vereist nu een geldige Supabase-sessietoken (ook anoniem) als Bearer, voiceId beperkt tot whitelist (Roos en Adam), tekstlimiet 500 tekens, rate limit 30 verzoeken per minuut per gebruiker.
2. `stats/index.ts`: alleen toegankelijk met header `x-stats-secret` gelijk aan Supabase secret STATS_SECRET, resultaat wordt 10 minuten in-memory gecachet.
3. `strava-oauth/index.ts`: geeft de `state` parameter door van Strava-callback naar de app-deeplink (CSRF-detectie), rate limit op de POST-verversroute.

## Uitgevoerd: client security

1. Strava-tokens verplaatst van AsyncStorage naar expo-secure-store, met eenmalige stille migratie van bestaande tokens (`src/services/stravaService.ts`).
2. CSRF-state: `connectStrava()` genereert een random state via expo-crypto en `handleStravaCallback()` valideert die; `app/strava-callback.tsx` geeft de parameter door.
3. `voiceService.ts` stuurt nu de Supabase-sessietoken mee naar de TTS-function (in plaats van de anon key); zonder sessie valt de app terug op de telefoonstem.
4. `EXPO_PUBLIC_ELEVENLABS_API_KEY` verwijderd uit .env en .env.example.
5. `package.json`: expo-secure-store, expo-crypto en expo-keep-awake toegevoegd (nog niet geinstalleerd, zie openstaande acties).

## Uitgevoerd: run-ervaring (Strava/Runna-stijl)

1. Keep-awake tijdens een actieve sessie (scherm blijft aan).
2. Countdown 3-2-1 met haptische tikken bij de start.
3. Auto-pauze bij circa 5 seconden stilstand, automatisch hervatten bij beweging, toggle "Auto-pauze" in Instellingen (default aan, gepersisteerd in appStore).
4. Km-splits per gelopen kilometer, getoond in de samenvatting met balkjes en snelste km uitgelicht; opgeslagen als optioneel veld `splits` op CompletedSession (backwards compatible).
5. GPS-punten met nauwkeurigheid slechter dan 25 meter worden genegeerd voor afstand en routelijn.
6. Haptische feedback bij elke kilometer-cue.

## AFGEROND op 5 juli 2026 (samen met Lars afgewerkt)

1. `npx expo install expo-secure-store expo-crypto expo-keep-awake` gedraaid; de drie packages (56.0.x) staan geinstalleerd, de twee resterende tsc-fouten zijn daarmee weg.
2. Supabase secret gezet: `supabase secrets set STATS_SECRET=<sterk willekeurig geheim>`, met exact dezelfde waarde ook in de lokale `.env` (nodig omdat de statsbriefing die daaruit leest).
3. Drie functions opnieuw gedeployed: `supabase functions deploy tts`, `supabase functions deploy stats --no-verify-jwt`, `supabase functions deploy strava-oauth --no-verify-jwt`. Geverifieerd: de stats-functie geeft 401 zonder geldig geheim en verse data met het juiste geheim.
4. De stats-authenticatie voor het marketingdashboard en de wekelijkse statsbriefing geregeld. Omdat `web_fetch` geen custom headers kan sturen en de bash-sandbox Supabase niet bereikt, accepteert de stats-functie het geheim nu ook via query-parameter `?s=` naast de header `x-stats-secret`. De scheduled task `marketing-statsbriefing` leest STATS_SECRET uit `.env` en roept `.../stats?s=<geheim>` aan; `.env.example` heeft een lege placeholder.
5. ElevenLabs API-key geroteerd in het ElevenLabs-dashboard; de nieuwe key staat uitsluitend als Supabase-secret `ELEVENLABS_API_KEY` en niet meer in de client. De oude key blijft als gecompromitteerd beschouwd.
6. Google Maps-key uit app.json in Google Cloud Console beperkt tot package `com.lopentelopen.app` plus SHA-1 fingerprint.
7. `versionCode` opgehoogd van 7 naar 8 in app.json; in eas.json `autoIncrement: true` (production) plus `appVersionSource: local` gezet zodat de versiecode voortaan vanzelf ophoogt. Nieuwe AAB gebouwd en als upgrade geupload naar de Play Console, uitgerold naar de gesloten en interne testtrack.

## NOG OPEN

1. Fysieke toesteltest via de interne testtrack: countdown, auto-pauze, km-splits, keep-awake, Strava-koppeling (nieuwe state-flow) en premium TTS-stem (nieuwe token-flow). Bevindingen hieronder aanvullen.

## Bewust buiten scope

Background tracking via foreground service (run doorlopen met vergrendeld scherm) is de grootste resterende feature-gap met Strava, maar vergt een native rebuild en toesteltesten. Aanbevolen als apart vervolgproject.
