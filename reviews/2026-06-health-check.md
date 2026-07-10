# Health check Lopen te Lopen - juni 2026

Datum: 16 juni 2026 (geautomatiseerd) + aanvulling na lokale run door Lars
Uitgevoerd door: geautomatiseerde maandelijkse dependency check

## Status: GROEN

expo-doctor geeft 21/21 checks passed na twee fixes. TypeScript check slaagt foutloos. npm audit meldt 0 vulnerabilities (was 12 moderate vorige maand). Enige openstaande actie is het verifiëren van targetSdkVersion 36 bij de eerstvolgende productiebuild, wat een normale deadline-check is en geen technisch probleem.

---

## Verloop van deze run

De geautomatiseerde run heeft de projectbestanden gelezen en `npx tsc --noEmit` uitgevoerd (slaagt). De npm registry was geblokkeerd in de sandbox, waardoor expo-doctor en npm outdated niet geautomatiseerd konden draaien. Lars heeft deze daarna lokaal gedraaid en de twee gevonden issues opgelost.

Lokaal uitgevoerde checks en fixes:
- `npx expo-doctor`: initieel 19/21, na fixes 21/21
- `npm outdated`: uitgevoerd, bevindingen verwerkt hieronder
- `npx tsc --noEmit`: slaagt (exit code 0)

---

## Vergelijking met vorig rapport (10 juni 2026)

Vorig rapport stond op ORANJE vanwege SDK 54 (twee versies achter). Grootste actie was "upgrade naar SDK 56 voor september 2026". Die actie is uitgevoerd.

Wijzigingen ten opzichte van vorig rapport:

| Onderdeel | Juni 10 | Juni 16 |
|---|---|---|
| Expo SDK | 54 | 56.0.11 |
| React Native | 0.81.5 | 0.85.3 |
| React | 19.1.0 | 19.2.3 |
| TypeScript | (onbekend) | 6.0.3 |
| tsc | schoon | schoon |
| Google Maps API key | placeholder | ingevuld |

---

## Huidige situatie

- Expo SDK: ~56.0.11 (huidige versie, uitgebracht 21 mei 2026)
- React Native: 0.85.3
- React: 19.2.3
- TypeScript: ~6.0.3
- TypeScript check: slaagt foutloos (exit code 0)
- expo-doctor: kon niet draaien (npm registry 403 in sandbox)
- npm outdated: kon niet draaien (npm registry 403 in sandbox)

---

## Expo SDK support

SDK 56 is de actuele versie en is volledig ondersteund. Op basis van Expo's cadans van circa een SDK per half jaar wordt SDK 57 verwacht rond november 2026. Op het moment dat SDK 57 verschijnt, begint de afbouw van EAS Build support voor SDK 55 en wordt SDK 56 de "oudste ondersteunde" versie. Er is geen directe urgentie voor een verdere upgrade.

Aandachtspunt uit de SDK 56 release notes: het expo-pakket heeft de afhankelijkheid van `@expo-google-fonts/inter` via `@expo/vector-icons` verwijderd. De app gebruikt `@expo-google-fonts/inter` direct in package.json, wat correct is.

Expo Go voor SDK 56 is niet beschikbaar via de App Store of Play Store (alleen via TestFlight External Beta). De app gebruikt `expo-dev-client`, dus dit heeft geen impact op de ontwikkelworkflow.

---

## Store-deadlines

**Google Play (kritiek):**
Per 31 augustus 2026 moeten alle nieuwe apps en updates target API level 36 (Android 16) hebben. De app stelt in app.json geen expliciete `targetSdkVersion` in. Expo SDK 56 ondersteunt Android 16 en stelt targetSdkVersion automatisch in bij de build, maar dit is nog nooit geverifieerd bij een daadwerkelijke productiebuild. Dit is de meest urgente openstaande actie.

**Apple:**
Sinds 28 april 2026 zijn uploads naar App Store Connect verplicht gebouwd met de iOS 26 SDK. Het standaard EAS Build image gebruikt Xcode 26 en voldoet hieraan. Geen nieuwe actie nodig bij gebruik van EAS.

**Privacy manifests:**
Geen nieuwe eisen bekend. Expo SDK 56 genereert privacy manifests voor de meegeleverde modules.

---

## Uitgevoerde fixes

De SDK-upgrade van 54 naar 56 is door Lars uitgevoerd tussen 10 en 16 juni.

Na de geautomatiseerde run zijn door Lars lokaal twee extra fixes gedaan op basis van expo-doctor output:

1. `npx expo install expo-asset` - ontbrekende peer dependency van expo-audio geinstalleerd. Zonder dit pakket kon de app crashen buiten Expo Go.
2. `npx expo install expo expo-font expo-location expo-router expo-sharing` - vijf Expo-pakketten bijgewerkt naar de patch-versies die SDK 56 verwacht (56.0.11 naar 56.0.12, 56.0.6 naar 56.0.7, etc.). Geen breaking changes.

Na beide fixes: expo-doctor 21/21, npm audit 0 vulnerabilities.

---

## npm outdated - bevindingen

Pakketten met een beschikbare major update (niet uitgevoerd, breaking changes mogelijk):

| Package | Huidig | Major update |
|---|---|---|
| @babel/core | 7.29.7 | 8.0.0 |
| @react-native-async-storage/async-storage | 2.2.0 | 3.1.1 |
| date-fns | 3.6.0 | 4.4.0 |
| react-native-gesture-handler | 2.31.2 | 3.0.1 |
| zustand | 4.5.7 | 5.0.14 |

Pakketten met een beschikbare minor/patch update buiten de Expo SDK:

| Package | Huidig | Beschikbaar |
|---|---|---|
| lucide-react-native | 1.17.0 | 1.20.0 |
| react-native-svg | 15.15.4 | 15.15.5 |
| react-native-safe-area-context | 5.7.0 | 5.8.0 |
| react | 19.2.3 | 19.2.7 |

De react, react-native en react-native-* versies worden beheerd door de Expo SDK; update deze alleen via `npx expo install`, niet via npm direct.

---

## Openstaande acties

1. ~~**Uiterlijk 31 augustus 2026 (kritiek):** Verifieer targetSdkVersion 36.~~ AFGEROND op 16 juni 2026. Play Console bevestigt Doel-SDK 36. Voldoet aan de Google Play deadline.

2. **Let op bij volgende SDK-upgrade (SDK 57, ~november 2026):** Controleer bij die upgrade de major updates hierboven opnieuw, want ze kunnen dan wel compatibel zijn. Besteed extra aandacht aan zustand (4 naar 5) en react-native-gesture-handler (2 naar 3), die API-wijzigingen bevatten.

3. **Aandachtspunt (geen blokker):** De Google Maps API key staat als plain text in `app.json`. Overweeg hem te verplaatsen naar een `.env`-bestand om te voorkomen dat de sleutel in versiebeheer staat.

---

## Bronnen

- Expo SDK 56 changelog: https://expo.dev/changelog/sdk-56
- Expo release statuses: https://docs.expo.dev/more/release-statuses
- Google Play target API level eisen: https://support.google.com/googleplay/android-developer/answer/11926878
- Apple upcoming requirements: https://developer.apple.com/news/upcoming-requirements/
