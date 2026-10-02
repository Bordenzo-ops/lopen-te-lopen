# Lopen te Lopen

Nederlandstalige hardloopcoach voor iOS en Android (React Native met Expo SDK 56). De app maakt een trainingsschema richting een wedstrijd, met de marathon als einddoel, coacht tijdens het lopen met gesproken aanwijzingen en volgt routes, hartslag en voortgang. De app werkt offline; account, synchronisatie en premium zijn aanvullingen. Live in de App Store en Google Play.

## Starten

Vereisten: een recente Node LTS (er is geen `engines`-veld; de Expo SDK 56-tooling bepaalt de ondergrens) en npm.

```
npm install
npx expo start
```

De app gebruikt native modules (HealthKit, Health Connect, BLE, Google Sign-In, RevenueCat, Sentry, kaarten). Expo Go werkt daarom niet: gebruik een development build (`expo-dev-client` zit erin).

```
npx expo run:android   # lokale dev-build, vereist Android-toolchain
npx expo run:ios       # vereist macOS en Xcode
```

Of een cloud-devbuild via het EAS-profiel `development`. Typecheck: `npx tsc --noEmit`.

## Omgevingsvariabelen

Lokaal staan ze in `.env` (kopieer `.env.example`, staat in `.gitignore`). Voor EAS-builds staan ze per profiel in `eas.json`. Allemaal optioneel: zonder werkt de app offline.

| Variabele | Waarvoor |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase-project |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Publieke Supabase-sleutel |
| `EXPO_PUBLIC_REVENUECAT_API_KEY` | RevenueCat, Android |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | RevenueCat, iOS |
| `EXPO_PUBLIC_STRAVA_CLIENT_ID` | Strava-koppeling (alleen in `eas.json`) |
| `EXPO_PUBLIC_SENTRY_DSN` | Crashrapportage |
| `STATS_SECRET` | Alleen voor de wekelijkse statsbriefing, niet in de app |

## Mappenstructuur

- `app/` Expo Router-schermen. `(tabs)/` is de hoofdnavigatie, `(onboarding)/` de eerste-start-flow; daarnaast `routine/`, `session/`, `account`, `paywall`, `premium-intro` en `strava-callback`.
- `src/components/` herbruikbare UI; `components/ui/` primitieven, `components/motion/` animaties.
- `src/services/` koppelingen: Supabase, auth, RevenueCat, Strava, Sentry, spraak, BLE-hartslag, HealthKit/Health Connect, routes, sync.
- `src/hooks/`, `src/store/` (app-state), `src/config/`, `src/theme/`, `src/utils/`.
- `src/data/` trainingsschema's, tempomodel, wedstrijden en andere statische data.
- `src/web-stubs/` stubs voor modules die niet op web draaien.
- `supabase/` edge functions (`tts`, `strava-oauth`, `stats`, `route`, `delete-account`) en migraties `0001` t/m `0006`.
- `scripts/` hulpscripts (zie hieronder).
- `docs/` setupgidsen per integratie.
- `assets/` app-beelden en fonts; `store-assets/` screenshots en beelden voor de stores.
- `privacy-policy.html`, `voorwaarden.html`, `account-verwijderen.html` in de root: bron voor GitHub Pages (branch `main`; `master` is de werkbranch).
- `_workspace/` staat buiten git: notities, campagnemateriaal en uitvoer van de scripts.

### Scripts

- `scripts/generate-voice-packs.ts` bouwt de stempakketten (mp3's en manifest) uit `src/config/voicePhrases.ts` met ElevenLabs. `--dry-run` werkt zonder sleutel.
- `scripts/publish-races.ts` publiceert de wedstrijdlijst uit `src/data/rotterdamRaces.ts` naar bucket `app-data`, zonder nieuwe build.
- `scripts/render-campaign-voiceovers.ts` rendert campagne-voice-overs naar mp3 met de vier app-stemmen.
- `scripts/brand-assets/render.mjs` bakt merk-assets uit HTML naar PNG (`node scripts/brand-assets/render.mjs`).

Draai TypeScript-scripts met `npx tsx scripts/<naam>.ts`.

## Integraties

| Dienst | Gebruik | Documentatie |
| --- | --- | --- |
| Supabase | Auth (Apple, Google, e-mail, anoniem), database, edge functions, storage | `docs/SUPABASE_SETUP.md`, `supabase/README.md` |
| RevenueCat | Premium-abonnementen op beide stores | `docs/REVENUECAT_SETUP.md` |
| Strava | Runs delen, OAuth via edge function `strava-oauth` | `docs/STRAVA_SETUP.md`, `docs/STRAVA_COMPLIANCE.md` |
| Sentry | Crashrapportage | `docs/SENTRY_SETUP.md` |
| ElevenLabs | Alleen via scripts; de stempakketten staan in de publieke bucket `voice-packs`, de app downloadt ze. Edge function `tts` is een oude ElevenLabs-proxy die de app sinds juli 2026 niet meer gebruikt; hij weigert anonieme gebruikers en heeft een daglimiet | n.v.t. |
| HealthKit / Health Connect | Gezondheidsdata op iOS / Android | n.v.t. |
| Google Maps / OpenRouteService | Kaarten (`react-native-maps`); routeplanning loopt via edge function `route`, de ORS-sleutel zit niet in de app | n.v.t. |

Overige documenten: `docs/ANALYTICS_TRAININGSDAGEN.md` (meting rond trainingsdagen) en `docs/WP3_HARDENING.md` (sleutelhygiëne, afgerond).

## Builden en uitbrengen

1. Verhoog de versie in `app.json` handmatig (minor). Buildnummers gaat EAS zelf ophogen (`autoIncrement`).
2. Bouw en verstuur beide platforms:

```
npx eas-cli build --platform all --profile production --auto-submit
```

Android-submit gaat naar de interne track van Google Play; promoten naar productie gebeurt in de Play Console.

## Edge functions en database

Edge functions controleren de JWT zelf, daarom `--no-verify-jwt`:

```
npx supabase functions deploy <naam> --project-ref zefiknynxppgbhiiunre --no-verify-jwt
```

Migraties draai je via de SQL Editor in het Supabase-dashboard, niet met `db push`: de repo nummert `0001_...`, de remote historie gebruikt timestamps.
