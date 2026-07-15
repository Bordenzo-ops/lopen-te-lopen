# Health check Lopen te Lopen - juli 2026

Datum: 15 juli 2026 (geautomatiseerd)
Uitgevoerd door: geautomatiseerde maandelijkse dependency check

## Status: ORANJE

`npx tsc --noEmit` faalt op dit moment met 21 fouten, allemaal "Cannot find module 'lucide-react-native'". Oorzaak: tijdens deze run brak een dependency-update (lucide-react-native 1.17.0 naar 1.24.0) de TypeScript-resolutie, en de sandbox kon de kapotte bestanden in `node_modules` niet opruimen door een schrijfrechten-beperking op deze projectmap (zie onderaan). `package.json` en `package-lock.json` zijn wel correct teruggezet naar lucide-react-native 1.17.0. **Actie vereist voordat je verder werkt aan de app: draai lokaal `npm install` (zie sandbox-sectie), dat lost dit in één stap op.** Verder is de situatie gezond: npm audit meldt 0 vulnerabilities en er zijn geen nieuwe kritieke store-deadlines.

---

## Verloop van deze run

`npx tsc --noEmit` en `npm outdated`/`npm audit` konden dit keer wel via de npm-registry draaien (in tegenstelling tot voorgaande maanden). `npx expo-doctor` en `npx expo install --check` faalden gedeeltelijk doordat `exp.host` (Expo's eigen API, apart van de npm-registry) in de sandbox geblokkeerd is.

Bevindingen en acties:
- `npx tsc --noEmit`: slaagde in eerste instantie (exit 0)
- `npm audit`: 0 vulnerabilities, zowel voor als na de updates
- `npx expo-doctor`: 18/21 checks geslaagd; de 3 gefaalde checks zijn alle drie het gevolg van de exp.host-blokkade, geen echte projectproblemen
- `npm outdated`: volledig overzicht opgehaald (zie tabellen hieronder)
- Lage-impact updates uitgevoerd, waarna één update (lucide-react-native) tsc brak en teruggedraaid moest worden, wat door een sandbox-schrijfrechtenbug niet volledig lukte

---

## Vergelijking met vorig rapport (16 juni 2026)

| Onderdeel | 16 juni | 15 juli |
|---|---|---|
| Expo SDK | 56.0.11 | 56.0.16 (patch-update) |
| Nieuwste Expo SDK beschikbaar | 56 (actueel) | 57 (uitgebracht, sneller dan verwacht) |
| tsc | schoon | **faalt (lucide-react-native, actie vereist)** |
| npm audit | 0 vulnerabilities | 0 vulnerabilities |
| @supabase/supabase-js | 2.108.2 | 2.110.6 (bijgewerkt) |

Vorig rapport verwachtte SDK 57 rond november 2026 op basis van een cadans van ongeveer één SDK per half jaar. Dat is niet uitgekomen: SDK 57 is al uitgebracht (juli 2026), circa twee maanden na SDK 56. Zie sectie "Expo SDK support" hieronder.

---

## Uitgevoerde updates (lage impact)

Binnen dezelfde major versie, via npm-registry (exp.host was niet nodig voor deze specifieke acties):

| Package | Van | Naar | Status |
|---|---|---|---|
| @supabase/supabase-js | 2.108.2 | 2.110.6 | Bijgewerkt, tsc bleef schoon |
| expo | 56.0.12 | 56.0.16 | Bijgewerkt, tsc bleef schoon |
| expo-asset | 56.0.17 | 56.0.20 | Bijgewerkt, tsc bleef schoon |
| expo-build-properties | 56.0.20 | 56.0.23 | Bijgewerkt in node_modules; package-lock.json nog niet mee bijgewerkt door een afgebroken npm-call (zie sandbox-sectie) |
| expo-constants | 56.0.20 | 56.0.21 | Zelfde als hierboven |
| expo-dev-client | 56.0.20 | 56.0.23 | Zelfde als hierboven |
| expo-linking | 56.0.14 | 56.0.15 | Zelfde als hierboven |
| expo-location | 56.0.18 | 56.0.21 | Zelfde als hierboven |
| expo-media-library | 56.0.7 | 56.0.9 | Zelfde als hierboven |
| expo-notifications | 56.0.20 | 56.0.21 | Zelfde als hierboven |
| expo-router | 56.2.11 | 56.2.15 | Zelfde als hierboven |
| expo-sharing | 56.0.18 | 56.0.22 | Zelfde als hierboven |
| expo-splash-screen | 56.0.10 | 56.0.13 | Zelfde als hierboven |
| expo-task-manager | 56.0.21 | 56.0.22 | Zelfde als hierboven |
| lucide-react-native | 1.17.0 | 1.24.0 | **Teruggedraaid.** Brak tsc met "Cannot find module" op alle 21 gebruiksplekken. Oorzaak: lucide-react-native 1.18+ gebruikt een package.json "exports"-veld dat niet resolvet onder de `moduleResolution: bundler` + `customConditions: ["react-native"]`-instelling in `expo/tsconfig.base` die dit project gebruikt. `package.json` staat nu gepind op exact `1.17.0` (geen `^`) om te voorkomen dat een toekomstige `npm install` opnieuw naar een kapotte versie springt. Overweeg dit los te trekken bij de eerstvolgende Expo SDK-upgrade, wanneer ook `expo install --fix` weer beschikbaar is om een compatibele versie te kiezen. |

Voor negen van de dertien geslaagde expo-*-updates geldt: de bestanden in `node_modules` zijn wel bijgewerkt en tsc bleef schoon, maar `package-lock.json` kreeg de nieuwe versienummers niet correct weggeschreven doordat de npm-opdracht halverwege werd afgebroken (zie sandbox-sectie). Dit is onschadelijk zolang niemand `npm ci` gebruikt met het oude lockbestand als enige bron, maar moet nog even rechtgetrokken worden.

---

## Expo SDK support

**Belangrijkste bevinding deze maand: SDK 57 is al uitgebracht (juli 2026), sneller dan de eerder aangenomen cadans.** SDK 57 brengt React Native 0.86 (React blijft 19.2, geen wijziging) en is bedoeld als een upgrade zonder breaking changes vanaf 0.85. SDK 57 bundelt ook nieuwere versies van react-native-reanimated (4.3 naar 4.5), react-native-worklets (0.8 naar 0.10) en react-native-gesture-handler (2.31 naar 2.32), wat verklaart waarom deze drie pakketten niet los zijn bij te werken: ze horen bij elkaar en bij de SDK-versie.

De app draait nu op SDK 56, wat inmiddels één versie achter de nieuwste stabiele release is. Expo-SDK's krijgen doorgaans circa een jaar kritieke support vanaf release; SDK 56 (mei 2026) is dus nog ruim binnen die periode en er is geen directe deadline. Gezien de versnelde cadans (SDK 56 naar 57 in slechts twee maanden) is het wel verstandig de volgende SDK-upgrade niet te lang uit te stellen. **Dit is een grote wijziging (major SDK-upgrade) en wordt dus alleen voorgesteld, niet automatisch uitgevoerd.**

Voorstel: upgrade naar SDK 57 inplannen voor eind oktober 2026, zodat er ruim de tijd is om de bekende aandachtspunten (view-shot, health-connect, worklets/reanimated-koppeling) te testen voordat een eventuele SDK 58 de druk verder opvoert.

---

## Store-deadlines

**Google Play:** geen nieuwe deadline. De bestaande eis (nieuwe apps/updates moeten per 31 augustus 2026 target API level 36 hebben, bestaande apps minimaal API 35 om zichtbaar te blijven op Android 16/17) is vorige maand al geverifieerd als voldaan; Play Console toont Doel-SDK 36.

**Apple:** geen nieuwe deadline. Sinds 28 april 2026 moet elke upload naar App Store Connect gebouwd zijn met Xcode 26 / iOS 26 SDK. Het standaard EAS Build-image voldoet hieraan.

**Privacy manifests:** geen nieuwe eisen gevonden. De huidige "required reason API"-verplichting dateert van mei 2024 en wordt al gedekt door de privacy manifests die Expo SDK 56 meelevert voor de gebruikte modules.

---

## npm outdated - resterende bevindingen

Pakketten met een beschikbare major update (niet uitgevoerd, mogelijk breaking changes, alleen voorstellen):

| Package | Huidig | Major update |
|---|---|---|
| @babel/core | 7.29.7 | 8.0.1 |
| @react-native-async-storage/async-storage | 2.2.0 | 3.1.1 |
| @sentry/react-native | 7.11.0 | 8.18.0 |
| date-fns | 3.6.0 | 4.4.0 |
| react-native-gesture-handler | 2.31.2 | 3.0.2 (hoort bij SDK 57-upgrade, niet los doen) |
| react-native-purchases | 9.15.2 | 10.4.2 |
| zustand | 4.5.7 | 5.0.14 |

Pakketten die vastzitten aan de SDK-versie (bewust niet los bijgewerkt, komen mee bij de SDK 57-upgrade):

| Package | Huidig | Beschikbaar |
|---|---|---|
| react-native | 0.85.3 | 0.86.0 |
| react | 19.2.3 | 19.2.7 |
| react-native-reanimated | 4.3.1 | 4.5.1 |
| react-native-worklets | 0.8.3 | 0.10.2 |
| react-native-safe-area-context | 5.7.0 | 5.8.0 |
| react-native-screens | 4.25.2 | 4.26.1 |
| react-native-svg | 15.15.4 | 15.15.5 |
| react-native-maps | 1.27.2 | 1.29.0 |
| react-native-view-shot | 5.1.0 | 5.1.1 |

---

## Openstaande acties

1. **Direct, voor je verder werkt aan de app:** draai `npm install` lokaal om de kapotte lucide-react-native-installatie en de negen achterlopende expo-*-vermeldingen in package-lock.json recht te trekken. Zie exacte commando's onderaan.
2. **Plannen voor eind oktober 2026:** Expo SDK 57-upgrade (React Native 0.86). Geen blokkerende dependency verwacht op basis van de wijzigingslog, maar test in elk geval opnieuw de view-shot deelkaart-functie en de Health Connect-integratie, net als bij de SDK 56-upgrade.
3. **Losstaand, geen deadline:** overweeg bij de SDK 57-upgrade ook meteen te kijken of lucide-react-native inmiddels een compatibele "exports"-structuur heeft, zodat de pin naar 1.17.0 los kan.
4. **Losstaand, geen deadline:** de major-updates in de tabel hierboven (async-storage, date-fns, zustand, Sentry, RevenueCat, babel) zijn niet urgent maar lopen wel op; neem ze mee bij de SDK 57-upgrade als natuurlijk breekpunt om compatibiliteit in één keer te testen.

---

## Wat ik niet kon vanwege sandbox-rechten (draai dit in Claude Code)

Deze taak leunt sterk op npm en expo, en liep dit keer tegen twee verschillende sandbox-beperkingen aan:

**1. Netwerk: `exp.host` (Expo's eigen API) is geblokkeerd, de npm-registry niet.** Dit is nieuw ten opzichte van vorige maanden (toen was ook de npm-registry geblokkeerd). Hierdoor faalden specifiek de checks die exp.host nodig hebben:
- `npx expo-doctor` gaf "Check Expo config (app.json/ app.config.js) schema" en "Check that packages match versions required by installed Expo SDK" als fout (`fetch failed`, `getaddrinfo EAI_AGAIN exp.host`). Draai lokaal: `npx expo-doctor` en bekijk of alle 21 checks slagen.
- `npx expo install --check --json` gaf "HTTP Proxy Network Error: Forbidden". Draai lokaal: `npx expo install --fix` om alle Expo-gerelateerde pakketten in één keer op de door SDK 56 verwachte versies te zetten (lost ook punt 2 hieronder op).

**2. Schrijfrechten: deze projectmap laat de sandbox geen bestanden in `node_modules` verwijderen of hernoemen (ENOTEMPTY / "Operation not permitted" bij elke poging).** Hierdoor kon een mislukte update niet volledig worden teruggedraaid:
- lucide-react-native staat in `package.json` en `package-lock.json` correct op `1.17.0`, maar de fysieke bestanden in `node_modules/lucide-react-native` zijn nog steeds versie 1.24.0 (de kapotte versie, mist de `dist/types`-map) omdat de sandbox die map niet mocht overschrijven. Dit is de reden dat `npx tsc --noEmit` in dit rapport faalt.
- Voor negen expo-*-pakketten (expo-build-properties, expo-constants, expo-dev-client, expo-linking, expo-location, expo-media-library, expo-notifications, expo-router, expo-sharing, expo-splash-screen, expo-task-manager) staan de nieuwe patchversies wel in `node_modules` maar nog niet in `package-lock.json`, om dezelfde reden.

**Los dit in één keer op met:**
```
cd "C:\Users\Lars\Documents\Claude\Projects\Hardloop app"
npm install
npx tsc --noEmit
npx expo-doctor
```
Verwacht resultaat: `npm install` herstelt lucide-react-native naar de gepinde 1.17.0 en werkt `package-lock.json` bij voor de negen expo-*-pakketten. `npx tsc --noEmit` moet daarna weer foutloos zijn (exit 0, geen output). Mocht `npm install` zelf vastlopen: verwijder eerst de map `node_modules` volledig en installeer opnieuw (`rmdir /s /q node_modules` in CMD, dan `npm install`).

**3. Git:** geen git-commando's nodig deze keer (alleen leesacties), dus geen lock-bestand-problemen om te melden.

---

## Bronnen

- Expo SDK 57 changelog: https://expo.dev/changelog/sdk-57
- Expo release statuses: https://docs.expo.dev/more/release-statuses/
- Google Play target API level eisen: https://support.google.com/googleplay/android-developer/answer/11926878
- Apple upcoming requirements: https://developer.apple.com/news/upcoming-requirements/
- Apple privacy manifest / required reason API: https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
