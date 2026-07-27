# Sentry instellen voor Lopen te Lopen

Sentry vangt crashes op in productie en stuurt een crashrapport, zodat je
fouten kunt opsporen zonder dat gebruikers dit zelf hoeven te melden. Zonder
DSN blijft crashrapportage stilletjes uit en valt de app terug op alleen de
eigen Nederlandse foutmelding (CrashReportingBoundary).

## 1. Wat er al staat (gedaan)

1. `@sentry/react-native` staat in package.json en in de plugins-lijst van
   app.json, met organization `dronevision-studios` en project
   `lopen-te-lopen`. Dat project heette tot 27-07-2026 `android`, maar vangt
   crashes van **beide** platforms op: er is één DSN voor iOS en Android. Wil
   je per platform kijken, filter dan in Sentry op `os.name:iOS` of
   `os.name:Android`. De DSN zelf bevat het project-ID (`4511701714862160`),
   niet de projectnaam — hernoemen raakt reeds uitgeleverde apps dus niet.
2. `EXPO_PUBLIC_SENTRY_DSN` staat in `.env` en is toegevoegd aan de
   `preview`- en `production`-env in `eas.json`, zodat gebuilde apps 'm ook
   meekrijgen.
3. `src/services/crashReporting.ts` initialiseert Sentry met die DSN en biedt
   een `CrashReportingBoundary` met Nederlandse fallback-UI, aangesloten in
   `app/_layout.tsx`.
4. `metro.config.js` is gewrapt met `withSentryConfig` uit
   `@sentry/react-native/metro`. Dit voegt debug-ID's toe aan de bundel en
   source maps, zodat crashstacktraces in Sentry straks leesbare
   bestandsnamen en regelnummers tonen in plaats van geminificeerde code.

Met alleen deze stappen werkt crashrapportage al: nieuwe crashes komen
binnen in het Sentry-project, alleen de stacktrace is dan nog geminificeerd.

## 2. Auth-token voor source maps (nog te doen)

Om de source maps automatisch te laten uploaden tijdens een EAS-build heeft
Sentry een auth-token nodig met schrijfrechten. Dit token hoort nooit in
`.env` of in versiebeheer, want het heeft meer rechten dan een DSN.

1. Ga naar sentry.io, kies de organisatie `dronevision-studios`.
2. Ga naar Organization Settings > Auth Tokens en maak daar een
   **Organization Auth Token** aan (niet een persoonlijk token onder je
   accountinstellingen). Sentry raadt persoonlijke tokens voor CI/builds af:
   die stoppen met werken zodra die gebruiker ooit uit de organisatie zou
   verdwijnen. Een organisatietoken is losgekoppeld van je account en heeft
   precies de rechten die nodig zijn voor source map-uploads.
3. Zet het token als EAS-secret, niet in `.env`:

   eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <token> --type string

4. **Zet daarna `SENTRY_DISABLE_AUTO_UPLOAD` op `"false"`** in de `preview`- en
   `production`-env van `eas.json`. Die staat nu bewust op `"true"`: zonder
   auth-token faalt de upload-stap en klapt de hele build. Zolang die
   schakelaar aanstaat wordt de `project`-waarde uit `app.json` niet gebruikt
   en blijven stacktraces geminificeerd — een token zetten alléén is dus niet
   genoeg. Controleer bij het omzetten meteen of `project` in `app.json` op
   `lopen-te-lopen` staat, anders uploadt de build naar een niet-bestaand
   project.

5. Dit vereist dat je bent ingelogd bij EAS (`eas login`) met het account dat
   dit project beheert.

## 3. Nieuwe build maken en controleren

1. Maak een nieuwe EAS-build (bijvoorbeeld `eas build --platform android
   --profile production`, of eerst een preview/dev-build om te testen).
2. Forceer na installatie een test-crash (of wacht op een echte) en
   controleer in het Sentry-project `lopen-te-lopen` onder Issues of het
   rapport binnenkomt.
3. Open het issue en controleer of de stacktrace leesbare bestandsnamen en
   regelnummers toont (bijvoorbeeld `src/services/...ts:42`) in plaats van
   `index.android.bundle:1:123456`. Zo niet, controleer of `SENTRY_AUTH_TOKEN`
   echt als EAS-secret stond tijdens de build (secrets die je pas na het
   starten van de build toevoegt, gelden niet met terugwerkende kracht).

## Wat de app zelf al doet

- Sentry-init met DSN uit `EXPO_PUBLIC_SENTRY_DSN`; leeg = uitgeschakeld,
  de app crasht dan nooit op een ontbrekende sleutel.
- `CrashReportingBoundary` vangt renderfouten op met een Nederlandse
  fallback-melding in plaats van een witte crashscherm.
