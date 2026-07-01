# Plan: koppelingen met externe apps (Strava, Health Connect, GPX-export)

Datum: 1 juli 2026. Besloten met Lars: alle drie tegelijk bouwen, Strava met
automatische upload (uit te zetten), Strava API-keys via placeholders (Lars
maakt de API-app later aan).

## Waarom deze drie en niet de rest

- **Strava**: gratis publieke API, volledige OAuth-sync haalbaar.
- **Health Connect**: het Android-platform voor gezondheidsdata. Dekt indirect
  ook Mi Fitness en andere apps die Health Connect lezen. Google Fit API is
  door Google uitgefaseerd; Health Connect is de vervanger.
- **GPX-export**: universeel; Garmin Connect importeert GPX. De echte Garmin
  API vereist goedkeuring voor hun ontwikkelaarsprogramma en valt daarom af.
- **Apple Health**: iOS-only, volgt pas bij een iOS-versie van de app.

## Bestaande bouwstenen

- `CompletedSession.source` kent al 'strava', 'garmin', 'apple_health',
  'google_fit', 'mi_fitness'; GPS-route zit in `CompletedSession.route`
  (lat/lon/timestamp) en blijft bewust lokaal (zie security review: route gaat
  niet naar Supabase).
- Supabase Edge Function-patroon bestaat al (`supabase/functions/tts`), met
  secrets buiten de app-bundel.
- `expo-sharing`, `expo-file-system` en `expo-linking` zijn geïnstalleerd;
  app-scheme is `lopentelopen`.
- npm-registry is geblokkeerd in de sandbox: nieuwe packages gaan in
  package.json maar Lars installeert ze lokaal (zelfde werkwijze als bij de
  Supabase/RevenueCat-ronde).

## Onderdeel 1: GPX-export (geen nieuwe packages)

- `src/services/exportService.ts`: genereert GPX 1.1 uit een
  `CompletedSession` (trackpoints uit route, tijden uit timestamps, naam en
  datum in metadata; hartslag weglaten want alleen gemiddelde beschikbaar).
- Deelknop "Exporteer als GPX" op het samenvattingsscherm
  (`app/session/summary.tsx`), alleen zichtbaar als de run een route heeft.
  Schrijft naar cache-directory en deelt via expo-sharing.

## Onderdeel 2: Strava (OAuth via Supabase Edge Function)

- Edge Function `supabase/functions/strava-oauth`: wisselt de authorization
  code om voor tokens (client secret blijft server-side) en handelt refresh
  af. De OAuth-redirect landt op de function-URL en stuurt door naar de app
  via deep link `lopentelopen://strava-callback`.
- `src/services/stravaService.ts`: verbinden (authorize-URL openen), tokens
  opslaan (AsyncStorage), verversen, uploaden. Runs met route gaan als
  GPX-upload (hergebruik exportService), runs zonder route als handmatige
  activiteit via de activities-API.
- Automatische upload na elke voltooide run, met schakelaar in Instellingen
  en een wachtrij voor mislukte uploads (opnieuw proberen bij volgende start).
- Instellingen: Koppelingen-sectie wordt echt: Strava-rij met
  verbinden/ontkoppelen en de auto-uploadschakelaar.
- Keys via `EXPO_PUBLIC_STRAVA_CLIENT_ID` (app) en Supabase function secrets
  (`STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`). Setupstappen voor Lars in
  `docs/STRAVA_SETUP.md` (API-app aanmaken op strava.com/settings/api;
  callback domain = het Supabase-projectdomein).

## Onderdeel 3: Health Connect (nieuwe native package)

- Package `react-native-health-connect` in package.json plus config in
  app.json (permissies WRITE_EXERCISE, WRITE_DISTANCE); Lars installeert
  lokaal en maakt een nieuwe EAS dev build.
- `src/services/healthConnectService.ts` met dynamic require en graceful
  fallback (module niet geïnstalleerd of geen Health Connect op het toestel =
  functie stil uitgeschakeld), zelfde patroon als purchaseService.
- Schrijft na elke voltooide run een ExerciseSession (hardlopen) met afstand
  en duur. Schakelaar in Instellingen, standaard uit (eerst toestemming
  vragen via de Health Connect-permissiedialoog).

## Volgorde en verificatie

Drie agents in volgorde (GPX-export eerst, Strava hergebruikt die), elk met
eigen commit op feature/premium-backend. Na afloop: review + tsc.

Nog te doen door Lars na deze ronde: Strava API-app aanmaken en keys invullen,
`npx expo install react-native-health-connect`, edge function deployen
(`supabase functions deploy strava-oauth`), nieuwe EAS dev build, testen op
toestel.
