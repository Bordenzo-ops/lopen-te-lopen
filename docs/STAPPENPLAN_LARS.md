# Stappenplan: resterende stappen voor Lars

Datum: 1 juli 2026. Alles hieronder doe jij zelf (lokaal of in een dashboard);
de code staat al klaar op branch feature/premium-backend.

## Stap 1: Health Connect-package lokaal installeren

Open een terminal in de projectmap en draai:

```
npx expo install react-native-health-connect
```

De package staat al in package.json en app.json (plugin + permissies); dit
haalt hem alleen echt binnen. Zonder deze stap blijft de Health Connect-rij in
Instellingen uitgegrijsd.

## Stap 2: Strava API-app aanmaken (5 minuten)

1. Ga naar https://www.strava.com/settings/api en maak een API-applicatie aan.
2. Vul bij "Authorization Callback Domain" in: `zefiknynxppgbhiiunre.supabase.co`
   (zonder https://).
3. Noteer de Client ID en Client Secret.

## Stap 3: Strava-keys instellen

In de terminal, vanuit de projectmap:

```
supabase secrets set STRAVA_CLIENT_ID=jouw_client_id
supabase secrets set STRAVA_CLIENT_SECRET=jouw_client_secret
```

Daarna de Client ID (die is publiek, geen geheim) in de app-omgeving:

1. Voeg toe aan `.env`: `EXPO_PUBLIC_STRAVA_CLIENT_ID=jouw_client_id`
2. Ook als EAS-variabele, anders zit hij niet in cloudbuilds:

```
eas env:create --name EXPO_PUBLIC_STRAVA_CLIENT_ID --value jouw_client_id --visibility plaintext
```

(Doe dit voor de preview- en production-omgeving, zoals eerder bij Supabase.)

## Stap 4: Edge function deployen

```
supabase functions deploy strava-oauth --no-verify-jwt
```

De vlag --no-verify-jwt is nodig omdat Strava de functie aanroept zonder
Supabase-auth-header. Zie docs/STRAVA_SETUP.md voor detail en probleemoplossing.

## Stap 4b: Stats-functie deployen (voor het marketingdashboard)

```
supabase functions deploy stats --no-verify-jwt
```

Deze functie geeft alleen geaggregeerde totalen terug (aantal gebruikers,
runs, kilometers), nooit persoonlijke data. Het dashboard en de maandagse
statsbriefing-agent gebruiken dit endpoint.

## Stap 5: Nieuwe build maken en uitrollen

1. Hoog `versionCode` in app.json op (staat nu op 6, wordt 7).
2. Bouw: `eas build --platform android --profile production`
3. Upload de AAB in Play Console en zet hem op de track "Gesloten test - Alpha"
   (daar zit jouw testtoestel op, niet op Interne tests).
4. Belangrijk: dien de release in via Publicatieoverzicht ("Verzenden voor
   beoordeling"), anders blijft hij op "Nog niet verstuurd" staan en krijgt je
   toestel niets.

## Stap 6: Testen op je toestel

- Lichte modus: visuele controle (stond nog open uit de Q2-ronde). Let op
  contrast van zone-badges, overlay-teksten en knoplabels op oranje.
- Q3-features: workout-briefing op het GPS-scherm, mijlpaalbanner na een run.
- GPX-export: run met GPS afronden, "Exporteer als GPX" op het
  samenvattingsscherm, bestand delen en bijvoorbeeld in Garmin Connect of
  Strava importeren.
- Strava: verbinden via Instellingen > Koppelingen, run afronden, controleren
  dat hij op strava.com verschijnt. Test ook de wachtrij: run afronden in
  vliegtuigmodus, daarna app opnieuw openen met internet en controleren dat de
  upload alsnog komt.
- Health Connect: schakelaar aanzetten (permissiedialoog verschijnt), run
  afronden, controleren dat hij zichtbaar is in de Health Connect-app of
  Mi Fitness.
- Ontkoppelen van Strava testen (bevestigings-Alert, status terug naar
  "Verbind met Strava").

## Stap 7: Play Console afronden (los van de koppelingen)

- Nog open: 12 testers gedurende minstens 14 dagen op de gesloten test voordat
  je productietoegang kunt aanvragen (persoonlijk account-vereiste).
- Store-vermelding: er stonden 4 van de 8 telefoonscreenshots in; maak
  eventueel nieuwe screenshots met het nieuwe lichte thema en de koppelingen.

## Stap 8 (optioneel, na succesvolle test): opruimen

- Merge feature/premium-backend naar master zodra alles op het toestel werkt.
- ElevenLabs premium-stemmen: de sk_-sleutel staat bewust niet in de build;
  de tts-edge-function is er al. Controleer of die gedeployed is
  (`supabase functions list`) en of ELEVENLABS_API_KEY als secret staat, als
  je de premium-stemmen in de release wilt activeren.

## Volgorde-tip

Stap 1 t/m 4 kunnen in één sessie achter elkaar; daarna één build (stap 5) die
alles tegelijk bevat, dan testen (stap 6). Stap 7 loopt parallel op de
achtergrond (testers werven kost doorlooptijd, begin daar vandaag mee).
