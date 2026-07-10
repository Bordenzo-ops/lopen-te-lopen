# Store Submission Plan: Lopen te Lopen

Stap-voor-stap plan om de app klaar te maken voor de Google Play Store en Apple App Store.
Geschatte doorlooptijd: 2 tot 4 weken, afhankelijk van Apple-goedkeuring.

---

## Fase 1: Bugfixes en technische opschoning
*Moet af zijn voordat je ook maar iets anders doet.*

- [x] **Fix ontbrekende marathon-entry in dashboard**
  In `app/(tabs)/dashboard.tsx` staat `goalLabel` zonder `'marathon'`. Dit geeft een lege string als iemand het marathon-schema kiest.
  Oplossing: voeg `'marathon': 'Marathon'` toe aan het object.

- [x] **Test de volledige app-flow op een echt Android-apparaat** (niet via Expo Go)
  Doorloop: onboarding, sessie starten, GPS, sessie afsluiten, samenvatting, instellingen.

- [ ] **Test op iOS** (als je een Mac en Apple Developer account hebt)

- [x] **Controleer of alle "binnenkort"-features eerlijk gelabeld zijn**
  GPS-tracking staat nu correct op `soon: false` (is geïmplementeerd). Strava/Garmin/Apple Health blijft `soon: true`.

---

## Fase 2: Privacy en juridisch
*Verplicht voor beide stores. Zonder dit wordt je app geweigerd.*

- [x] **Schrijf een privacybeleid**
  Bestand aangemaakt: `privacy-policy.html`.

- [x] **Privacybeleid hosten op publieke URL**
  Live op: https://bordenzo-ops.github.io/lopen-te-lopen/privacy-policy.html

- [x] **Voeg een link naar het privacybeleid toe in de app**
  Link toegevoegd in de Instellingen-tab onder "Overige", URL bijgewerkt naar de live URL.

- [x] **GDPR-check**
  Afgerond op 12 juni 2026. expo-location stuurt zelf niets naar externe servers. Enige externe datastroom: de routeplanner stuurt de GPS-positie naar openrouteservice.org (staat sinds 11 juni in het privacybeleid). Geen secrets in git, .env en google-service-account.json staan in .gitignore. De ElevenLabs-sleutel in .env wordt niet meegebouwd door EAS (gitignored); zonder sleutel valt de app terug op de telefoonsstem.

**Antwoorden voor het Data safety-formulier in Play Console (12 juni 2026):**
  - Verzamelt de app gebruikersdata? Ja
  - Locatie (precies): verzameld voor app-functionaliteit, niet gedeeld (verwerking door openrouteservice is kortstondig/ephemeral), optioneel (gebruiker start zelf een sessie), versleuteld onderweg (HTTPS), verwijderbaar via "Voortgang resetten"
  - Persoonlijke info (naam) en Gezondheid en fitness (trainingsdata): alleen lokaal op het toestel opgeslagen, verlaat het apparaat niet en hoeft daarom niet als "verzameld" opgegeven te worden
  - Data voor tracking of advertenties: nee
  - Accountgegevens: geen, de app heeft geen account

---

## Fase 3: Release build opzetten
*Technisch fundament voor de stores.*

- [x] **Bundle identifiers en slug bijgewerkt in app.json**
  iOS/Android package: `com.lopentelopen.app`, slug: `lopen-te-lopen`, scheme: `lopentelopen`

- [x] **`eas.json` aangemaakt** met preview en production profielen voor Android en iOS.

- [x] **EAS CLI installeren en inloggen**
- [x] **EAS koppelen aan het project** via `eas build:configure`
- [x] **Preview-build Android geslaagd** — APK beschikbaar via expo.dev

- [ ] **iOS: Apple Developer account aanmaken** ($99/jaar via developer.apple.com)
  EAS regelt daarna automatisch certificates en provisioning profiles.

- [ ] **Productie-builds maken** (jij, in terminal)
  ```
  eas build --platform android --profile production
  eas build --platform ios --profile production
  ```

- [ ] **Na iOS-build: `ascAppId` en `appleTeamId` invullen in `eas.json`**
  Deze krijg je via App Store Connect na het aanmaken van het app-record.

---

## Fase 4: Store-accounts aanmaken
*Eenmalige setup, doe dit vroeg want Apple-goedkeuring kan dagen duren.*

- [x] **Google Play Console**: $25 eenmalig via play.google.com/console
  Account "PlatosLabs" actief en volledig geverifieerd (identiteit en telefoon) per 12 juni 2026.
- [ ] **Apple App Store Connect**: inbegrepen bij Apple Developer account ($99/jaar) via appstoreconnect.apple.com

---

## Fase 5: Store-assets maken
*Tijdrovend maar onmisbaar. Plan hier een halve dag voor.*

**App-icoon**
- [x] Controleer of `assets/icon.png` minimaal 1024x1024 px is en geen transparantie heeft
  Gecontroleerd op 12 juni 2026: 1024x1024, RGB zonder alpha. In orde.
- [x] Android adaptive icon: `assets/adaptive-icon.png` met veilige zone van 66%
  Op 12 juni 2026 vervangen door een full-bleed versie (schoen op oranje gradient, 56% van de breedte, ruim binnen de veilige zone). Oude versie bewaard als `adaptive-icon-oud.png`.

**Screenshots**
- [ ] Minimaal 4 screenshots per platform
- [ ] Android: minimaal 1080x1920 px (telefoon), optioneel ook tablet
- [ ] iOS: vereist voor iPhone 6.7" (bijv. iPhone 15 Pro Max) en 6.5" (iPhone 14 Plus). Optioneel iPad.
- [ ] Voeg een korte tekst toe aan elke screenshot die de functie uitlegt

**Aanbevolen schermen om te screenshotten:**
1. Welkomstscherm
2. Doelkeuze (onboarding)
3. Dashboard met trainingsschema
4. Actieve sessie
5. Samenvatting na sessie

**Feature graphic (alleen Android)**
- [x] 1024x500 px afbeelding die bovenaan je Play Store-pagina verschijnt
  Gemaakt op 12 juni 2026: `store-assets/feature-graphic.png`

---

## Fase 6: App Store-listings schrijven

**Korte beschrijving (max. 80 tekens, Google Play)**
Voorstel: *Train slim naar jouw doel: 5 km, 10 km of een halve marathon.*

**Volledige beschrijving**
Voorstel:

> Lopen te Lopen is jouw persoonlijke hardloopcoach. Of je nu voor het eerst 5 km wilt lopen of toewerkt naar een halve marathon: de app geeft je een helder weekschema, begeleiding op hartslagzone en een coach die je aanmoedigt tijdens elke stap.
>
> Wat de app doet:
> - Persoonlijk trainingsschema voor 5 km, 10 km, halve marathon of marathon
> - Training op hartslagzone, afgestemd op jouw leeftijd
> - Gesproken begeleiding tijdens het lopen
> - Voortgang per week en over het hele schema
> - Train gericht op een wedstrijd, het schema past zich automatisch aan
>
> Gratis en zonder account. Jouw gegevens blijven op jouw telefoon.

- [x] Schrijf de definitieve beschrijving in het Nederlands
  Bestand aangemaakt: `STORE_LISTING.md` met korte beschrijving, volledige tekst, trefwoorden en antwoorden op App Store privacy-vragen.
- [ ] Optioneel: voeg ook een Engelse versie toe voor een groter bereik

**Categorie:** Gezondheid en fitness
**Leeftijdsclassificatie:** Geschikt voor iedereen

---

## Fase 7: Indienen en wachten

**Google Play** (status 12 juni 2026)
- [x] App "Lopen te Lopen" aangemaakt in Play Console (com.lopentelopen.app, Nederlands, gratis app)
- [x] Privacybeleid-URL ingevuld
- [x] App-toegang: geen inloggegevens nodig
- [x] Advertenties: nee
- [x] Contentclassificatie (IARC): voltooid, alle leeftijden / PEGI 3
- [x] Doelgroep: 18 jaar en ouder
- [x] Veiligheid van gegevens: locatie verzameld (kortstondig, app-functionaliteit), versleuteld, niet gedeeld
- [x] Advertentie-ID: nee; Overheidsapp: nee; Financiële functies: geen; Gezondheidsapps: activiteit en conditie
- [x] Store-vermelding: korte en volledige beschrijving ingevuld (opgeslagen als concept)
- [x] Interne testtrack: mailinglijst "Interne testers" met lars.dronevision@gmail.com en larsvdb1@hotmail.com
- [x] App-icoon (512x512) en feature graphic uploaden in de store-vermelding
- [x] Screenshots (4 stuks) geüpload, store-vermelding "Klaar om voor beoordeling te sturen"
- [x] Productie-AAB gebouwd en geüpload: release LtLO.1 live in Interne tests (vrijgegeven 13 juni 12:44)
- [x] READ_MEDIA_IMAGES/READ_MEDIA_VIDEO rechtenverklaring ingevuld
- [x] FOREGROUND_SERVICE_LOCATION rechtenverklaring ingevuld (demo-video YouTube Short, 16 juni 2026)
- [x] Nieuwe EAS-build met routeplanner-bugfix (ORS foot-walking) afgerond (16 juni 2026)
- [ ] **Gesloten testrelease opnieuw bevestigen en ter beoordeling versturen** (jij, in Play Console)
- [ ] 12 testers vinden voor minimaal 14 dagen (vereiste voor persoonlijke accounts), daarna productietoegang aanvragen
- [ ] Daarna pas: indienen voor review productie. Doorlooptijd: meestal 1 tot 3 dagen.

**Apple App Store**
- [ ] Maak een nieuw app-record aan in App Store Connect
- [ ] Upload de build via EAS of Xcode
- [ ] Vul alle velden in, inclusief privacyvragen (welke data verzamel je?)
- [ ] Dien in voor review. Doorlooptijd: 1 tot 7 dagen, soms langer bij eerste indiening.

---

## Checklist samenvatting

| Fase | Onderdeel | Status |
|---|---|---|
| 1 | Marathon-bug in dashboard fixen | [x] |
| 1 | Volledige flow testen op echt apparaat | [x] |
| 1 | "Binnenkort"-features beslissing | [x] |
| 2 | Privacybeleid schrijven (privacy-policy.html) | [x] |
| 2 | Privacybeleid hosten op publieke URL | [x] |
| 2 | Link naar privacybeleid in de app | [x] |
| 3 | Bundle identifiers bijgewerkt in app.json | [x] |
| 3 | eas.json aangemaakt | [x] |
| 3 | EAS CLI installeren en inloggen | [x] |
| 3 | eas build:configure uitvoeren | [x] |
| 3 | Apple Developer account aanmaken | [ ] |
| 3 | Preview-build Android testen | [x] |
| 3 | Productie-AAB gebouwd en geüpload (LtLO.1) | [x] |
| 3 | EAS-build routeplanner-bugfix | [x] |
| 4 | Google Play Console account (PlatosLabs) | [x] |
| 4 | Apple App Store Connect account | [ ] |
| 5 | App-icoon controleren (1024x1024) | [x] |
| 5 | Screenshots Android (4 stuks) | [x] |
| 5 | Feature graphic Android (1024x500) | [x] |
| 6 | Store-beschrijvingen schrijven (STORE_LISTING.md) | [x] |
| 6 | Engelse store listing | [x] |
| 7 | Rechtenverklaringen Play Console | [x] |
| 7 | Gesloten testrelease bevestigen en insturen | [ ] |
| 7 | 12 testers 14 dagen (vereiste persoonlijk account) | [ ] |
| 7 | Indienen bij Google Play productie | [ ] |
| 7 | Indienen bij Apple App Store | [ ] |
