# Health check Lopen te Lopen - juni 2026

Datum: 10 juni 2026
Uitgevoerd door: geautomatiseerde maandelijkse dependency check

## Status: ORANJE

Update 10 juni 2026 (na vervolgcontrole met Lars): expo-doctor geeft 18/18 checks passed en tsc slaagt zonder errors. Oranje blijft staan om een reden: Expo SDK 54 is twee versies achter (SDK 56 is uit sinds mei 2026) en SDK 54 is de laatste versie met Legacy Architecture support. Plan de SDK upgrade voor september 2026.

## Verloop van deze run

De geautomatiseerde run kon expo-doctor en npm outdated niet draaien (npm registry geblokkeerd in de sandbox, 403). Lars heeft de checks daarna lokaal gedraaid. Daaruit kwamen drie issues die zijn opgelost (zie uitgevoerde fixes). Eindresultaat: expo-doctor 18/18, tsc schoon.

## Huidige situatie

- Expo SDK: 54.0.35 (package.json: ~54.0.0)
- React Native: 0.81.5, React 19.1.0
- TypeScript check: slaagt zonder errors of warnings (na fix hieronder)
- Geen eerder rapport in reviews/ om mee te vergelijken; dit is de nulmeting

## Uitgevoerde fixes

1. Build-breker opgelost in src/components/ui/ShareRunSheet.tsx: het Instagram-icoon bestaat niet meer in de geinstalleerde lucide-react-native (1.17.0), waardoor tsc faalde met TS2305. Import en gebruik vervangen door het Camera-icoon; knoptekst "Deel op Instagram" en styling ongewijzigd. Wil je liever een echt Instagram-logo, voeg dan een eigen SVG toe via react-native-svg.
2. Zes null-bytes aan het einde van datzelfde bestand verwijderd (veroorzaakten TS1127 errors).
3. "expo-sharing" verwijderd uit de plugins-lijst in app.json. Dat package heeft geen config plugin, waardoor expo config en expo-doctor crashten. Delen blijft gewoon werken.
4. .gitignore aangemaakt (bestond niet) met .expo/, node_modules/, .env en native build-mappen.
5. Door Lars lokaal uitgevoerd: npx expo install expo-constants (ontbrekende peer dependency van expo-router) en npm update voor @react-navigation/bottom-tabs en @react-navigation/native.

Na alle fixes geverifieerd: npx expo-doctor 18/18 checks passed, npx tsc --noEmit slaagt.

## Expo SDK support

- SDK 56 is de actuele versie (uitgebracht mei 2026), SDK 55 verscheen eind 2025. SDK 54 is dus twee versies achter.
- SDK 54 is de laatste SDK met Legacy Architecture support; de Legacy Architecture is sinds juni 2025 bevroren. Vanaf SDK 55 is de New Architecture verplicht.
- Er zijn meldingen dat expo-updates runtime checks SDK 54 al als unsupported aanmerken. Deze app gebruikt expo-updates niet in package.json, dus dat raakt de app nu niet direct.
- Verwachting op basis van Expo's gebruikelijke cadans: EAS Build support voor SDK 54 wordt afgebouwd zodra SDK 57 verschijnt (naar verwachting rond september 2026).

## Store-deadlines

- Apple: sinds 28 april 2026 moeten uploads naar App Store Connect gebouwd zijn met Xcode 26 en de iOS 26 SDK. Expo heeft bevestigd dat SDK 54 en 55 hieraan voldoen; het standaard EAS Build image gebruikt Xcode 26. Geen actie nodig zolang je via EAS bouwt met het standaard image.
- Google: per 31 augustus 2026 moeten nieuwe apps en updates target API level 36 (Android 16) hebben. Expo SDK 54 ondersteunt Android 16 / API 36, dus dit zou goed moeten zitten. Verifieer bij de eerstvolgende productiebuild dat targetSdkVersion 36 is.
- Privacy manifests (Apple): al verplicht sinds 2024; Expo SDK 54 genereert deze voor de meegeleverde modules. Geen nieuwe actie bekend.

## Openstaande acties

1. Voor 31 augustus 2026: bevestig bij een productiebuild dat targetSdkVersion 36 is (Google Play eis). Laag risico, wel controleren.
2. Voor september 2026: upgrade naar SDK 56. Compatibiliteitsonderzoek is gedaan en een concreet stappenplan staat in reviews/2026-06-sdk56-upgradeplan.md. Geen blokkerende dependencies gevonden; enige risico is react-native-view-shot (moet naar v5).
3. npm audit meldt 12 moderate vulnerabilities (vrijwel zeker transitieve dev-dependencies). Niet urgent; NIET npm audit fix --force draaien, dat installeert breaking changes. Bekijk bij de SDK upgrade opnieuw.
4. Aandachtspunt (geen blokker): app.json bevat nog de placeholder "YOUR_GOOGLE_MAPS_API_KEY_HERE" voor de Google Maps API key onder android.config.

## Bronnen

- Expo changelog SDK 54: https://expo.dev/changelog/sdk-54
- Expo changelog SDK 55: https://expo.dev/changelog/sdk-55
- Expo over Xcode 26 eis: https://x.com/expo/status/2048869257480663176
- Apple upcoming requirements: https://developer.apple.com/news/upcoming-requirements/
- Google Play target API eis: https://support.google.com/googleplay/android-developer/answer/11926878
