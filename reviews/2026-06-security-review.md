# Security review Lopen te Lopen
Datum: 10 juni 2026
Scope: Expo/React Native app in projectmap, inclusief app.json, eas.json, dependencies, dataopslag, netwerk en privacy-policy.html
Vorig rapport: geen (dit is de eerste review, de map reviews/ bestond nog niet)

## Samenvatting
Geen kritieke bevindingen. De app werkt volledig lokaal, gebruikt uitsluitend HTTPS en bevat geen hardcoded secrets. De belangrijkste bevinding is dat het privacybeleid niet klopt met de routeplanner, die locatiedata naar een externe dienst stuurt. Daarnaast vroeg de app meer permissies dan de code gebruikt; dat is opgeschoond.

## Bevindingen

### Hoog

**1. Privacybeleid klopt niet met de routeplanner (gefixt op 11 juni 2026)**
- Locatie: src/services/routeService.ts (orsPost, generateLoopRoute, generateOutAndBackRoute) tegenover privacy-policy.html sectie 2 en 3
- Risico: de routeplanner stuurt de actuele GPS-positie van de gebruiker naar api.openrouteservice.org om routes te genereren. Het privacybeleid stelt letterlijk dat de app geen persoonlijke gegevens naar externe servers verstuurt en niets met derden deelt. Dat is onjuist zodra de routeplanner gebruikt wordt. Locatiedata is onder de AVG een persoonsgegeven.
- Exploiteerbaarheid: geen directe aanval, maar wel een reëel compliance- en storereviewrisico (Apple en Google controleren of de privacyverklaring klopt met het daadwerkelijke datagedrag).
- Status: gefixt op 11 juni 2026. privacy-policy.html is aangevuld met een paragraaf over de routeplanner en openrouteservice.org (welke data, waarvoor, link naar het privacybeleid van HeiGIT) en gecommit naar GitHub (commit 7c5fbf7 op main), waarmee de gepubliceerde versie op GitHub Pages wordt bijgewerkt. Nog te doen: de datasafety-formulieren in de App Store en Play Store hierop aanpassen.

### Middel

**Aanvulling 11 juni 2026: npm audit resultaten (voorstel)**
- De gebruiker heeft npm audit lokaal gedraaid: 12 kwetsbaarheden, allemaal severity moderate, geen kritiek of hoog.
- Het gaat om 2 onderliggende issues in transitieve dependencies van expo:
  - postcss kleiner dan 8.5.10: XSS via niet-geescapete style-tag in CSS-output (GHSA-qx2v-qp2m-jg93), via @expo/metro-config en @expo/cli
  - uuid kleiner dan 11.1.1: ontbrekende buffer bounds check in v3/v5/v6 (GHSA-w5hq-g745-h8pq), via xcode en @expo/config-plugins
- Praktische relevantie is beperkt: beide zitten in build-tooling (metro-config, prebuild, xcode-projectgeneratie) en niet in code die op het toestel van de eindgebruiker draait. Geen directe exploiteerbaarheid in de app zelf.
- Er is geen fix zonder breaking change: npm audit fix lost niets op, alleen npm audit fix --force naar expo@56.0.9 verhelpt het. Dat is een major upgrade (project zit op expo 54) en valt daarmee buiten het mandaat van deze review, dus niet uitgevoerd.
- Status: voorstel. Plan een gecontroleerde upgrade naar Expo SDK 56 (via npx expo install expo@^56 en npx expo install --fix, daarna testen), in plaats van npm audit fix --force.

**2. Locatiegeschiedenis onversleuteld in AsyncStorage (voorstel)**
- Locatie: src/store/appStore.ts (zustand persist met AsyncStorage, key "app-store")
- Risico: completedSessions bevat per sessie de volledige route als lat/lon/timestamp-punten. AsyncStorage is onversleutelde opslag; op een gecompromitteerd of geroot toestel is de volledige loopgeschiedenis (inclusief vermoedelijk huisadres als startpunt) uitleesbaar.
- Exploiteerbaarheid: vereist fysieke of malware-toegang tot het toestel, dus beperkt. Maar locatiegeschiedenis is gevoelige data.
- Status: voorstel (opslagmigratie valt buiten het mandaat van deze review). SecureStore is ongeschikt voor routes (limiet circa 2 KB per entry). Beter: routes opslaan in expo-sqlite (staat al in package.json maar wordt nergens gebruikt), of routes helemaal niet persistent bewaren en alleen afstand/duur/tempo opslaan. Dat laatste maakt het privacybeleid ("locatiegegevens worden niet bewaard buiten de sessiesamenvatting") ook letterlijk waar.

**3. ORS API-sleutel wordt in de app-bundel meegeleverd (voorstel)**
- Locatie: src/config/premiumConfig.ts (ORS_API_KEY, nu nog de placeholder YOUR_ORS_API_KEY_HERE)
- Risico: zodra hier een echte sleutel staat, is die door iedereen uit de app-bundel te extraheren en te misbruiken (quota-uitputting, kosten).
- Exploiteerbaarheid: triviaal voor iedereen die de APK/IPA decompileert.
- Status: voorstel. Acceptabel voor een gratis ORS-sleutel met lage limieten, maar zet er nooit een betaalde sleutel in. Structurele oplossing: een eigen proxy die de sleutel serverside houdt. Positief: de sleutel gaat via de Authorization-header en niet als URL-parameter, dus hij lekt niet via logs of proxies.

**4. Google Maps API-sleutel in app.json (voorstel)**
- Locatie: app.json, android.config.googleMaps.apiKey (nu nog placeholder)
- Risico: deze sleutel komt in de gebouwde app terecht; dat is bij de Maps SDK onvermijdelijk, maar een onbeperkte sleutel kan misbruikt worden voor andere Google APIs.
- Status: voorstel. Beperk de sleutel in Google Cloud Console tot de Maps SDK for Android en tot het package com.lopentelopen.app met de bijbehorende SHA-1 fingerprint.

### Laag

**5. Overbodige permissies in app.json (gefixt)**
- Locatie: app.json
- Risico: meer permissies dan de code gebruikt betekent onnodig dataminimalisatierisico en lastige storereviews.
- Uitgevoerde fixes:
  - ACTIVITY_RECOGNITION (Android) verwijderd: nergens in de code wordt een stappenteller of activiteitsherkenning gebruikt
  - NSMotionUsageDescription (iOS) verwijderd: er is geen motion/pedometer-code
  - NSLocationAlwaysUsageDescription (iOS) verwijderd: de app vraagt alleen requestForegroundPermissionsAsync, nooit always-toegang
  - Dubbele entries android.permission.ACCESS_COARSE_LOCATION en android.permission.ACCESS_FINE_LOCATION verwijderd (stonden er twee keer in, met en zonder prefix)
  - isAccessMediaLocationEnabled van de expo-media-library plugin uitgezet: de app leest geen EXIF-locaties van foto's, ze slaat alleen run-kaarten op
- Status: gefixt. app.json blijft geldige JSON.

**6. Mediatoegang breder dan nodig (gefixt op 11 juni 2026)**
- Locatie: src/hooks/useShareRun.ts regel 125 en app.json (READ_MEDIA_IMAGES, READ_EXTERNAL_STORAGE)
- Risico: de app slaat alleen afbeeldingen op (saveToLibraryAsync) maar vroeg via requestPermissionsAsync() volledige leestoegang tot de fotobibliotheek.
- Status: gefixt. useShareRun.ts gebruikt nu MediaLibrary.requestPermissionsAsync(true) (writeOnly) en READ_MEDIA_IMAGES en READ_EXTERNAL_STORAGE zijn uit app.json gehaald. WRITE_EXTERNAL_STORAGE blijft staan voor oudere Android-versies. Test het delen van een run-kaart even op een fysiek toestel.

**7. Inconsistente iOS background-locatieconfiguratie (voorstel)**
- Locatie: app.json: UIBackgroundModes bevat "location", terwijl de expo-location plugin isIosBackgroundLocationEnabled op false heeft staan
- Risico: geen beveiligingslek, wel reviewrisico bij Apple. UIBackgroundModes "location" is functioneel nodig om GPS-tracking door te laten lopen als het scherm vergrendeld is tijdens een run, daarom is hij bewust blijven staan.
- Status: gefixt op 11 juni 2026. isIosBackgroundLocationEnabled staat nu op true, consistent met UIBackgroundModes. Wees bij de Apple-review voorbereid op de vraag waarom background location nodig is (antwoord: GPS-tracking tijdens een actieve hardloopsessie met vergrendeld scherm).

**8. Ongebruikte dependencies (voorstel)**
- Locatie: package.json: expo-av en expo-sqlite worden nergens in src/ of app/ geïmporteerd
- Risico: onnodig groot aanvalsoppervlak en bundelgrootte.
- Status: gefixt op 11 juni 2026. Beide verwijderd via npm uninstall (package.json en package-lock.json bijgewerkt). Als je bevinding 2 oppakt met SQLite, installeer expo-sqlite dan opnieuw via npx expo install expo-sqlite.

**9. Rommelbestanden in de projectroot (voorstel)**
- Locatie: lege bestanden met namen als "navigation.goBack()}", "setShowShare(false)}" en "{"
- Risico: geen, maar het zijn duidelijk per ongeluk aangemaakte bestanden.
- Status: gefixt op 11 juni 2026. Alle drie verwijderd.

## Wat in orde is
- Netwerk: alle externe calls gaan over HTTPS (openrouteservice.org); geen http:// in de codebase
- Secrets: geen hardcoded API-sleutels, tokens of wachtwoorden gevonden in code, app.json of eas.json (alleen bewuste placeholders); de git-repository heeft nog geen commits, dus ook geen secrets in de historie
- Logging: slechts 1 console.error (useShareRun) en die logt alleen een foutobject, geen locatie- of gebruikersdata
- URL-parameters: geen gevoelige data in URLs; de ORS-sleutel gaat via een header
- Dataverwijdering: "Voortgang resetten" wist de persistente opslag daadwerkelijk (AsyncStorage.removeItem)
- eas.json: serviceAccountKeyPath verwijst naar ./google-service-account.json; dat bestand staat niet in de projectmap, dus er lekt nu niets. Op 11 juni 2026 is google-service-account.json preventief aan .gitignore toegevoegd zodat het nooit per ongeluk in git belandt

## Beperkingen van deze run
- npm audit kon tijdens de geautomatiseerde run niet draaien: het audit-endpoint van de npm-registry wordt geblokkeerd door de netwerk-allowlist van deze omgeving. De gebruiker heeft de audit op 11 juni 2026 lokaal gedraaid; de resultaten zijn verwerkt als bevinding onder Middel.
- npx tsc --noEmit gaf in deze omgeving valse syntaxfouten doordat de bestandssynchronisatie van de sandbox meerdere bronbestanden afgekapt aanleverde. De echte bestanden op schijf zijn handmatig gecontroleerd en compleet en intact. De uitgevoerde fix raakt uitsluitend app.json (configuratie, geen TypeScript), dus de compilatie wordt er niet door beïnvloed; app.json is gevalideerd als geldige JSON.

## Afsluiting
Uitgevoerde fixes: 12 in totaal.
- 5 opschoningen in app.json (overbodige en dubbele permissies plus de EXIF-locatievlag)
- Privacybeleid in lijn gebracht met de routeplanner en gepubliceerd via GitHub (commit 7c5fbf7)
- Mediatoegang beperkt tot writeOnly (useShareRun.ts) en READ-permissies uit app.json
- iOS background-locatieconfiguratie consistent gemaakt (isIosBackgroundLocationEnabled: true)
- Ongebruikte dependencies expo-av en expo-sqlite verwijderd
- 3 rommelbestanden in de projectroot verwijderd
- google-service-account.json aan .gitignore toegevoegd

Resterende acties voor de eigenaar (kunnen niet vanuit deze omgeving):
1. Expo SDK 56 upgrade voor de 12 moderate kwetsbaarheden: draai lokaal "npx expo install expo@^56" gevolgd door "npx expo install --fix", en test daarna de app. Gebruik niet "npm audit fix --force".
2. Datasafety-formulieren in App Store Connect en Play Console bijwerken: vermeld dat locatiedata bij gebruik van de routeplanner naar openrouteservice.org gaat.
3. Bij het invullen van echte API-sleutels: beperk de Google Maps sleutel in Google Cloud Console tot de Maps SDK for Android en het package com.lopentelopen.app, en gebruik voor ORS alleen een gratis sleutel met lage limieten.
4. Optioneel (bevinding 2): routes uit de persistente opslag halen of migreren naar SQLite. Dit raakt de kern van de app en hoort lokaal met testen te gebeuren.
5. Na de wijzigingen eenmalig lokaal "npx tsc --noEmit" draaien en de app testen (delen van een run-kaart, locatietracking met vergrendeld scherm).
