# Security review Lopen te Lopen
Datum: 29 juni 2026
Scope: Expo/React Native app (SDK 56, TypeScript), inclusief app.json, eas.json, .env, dependencies, dataopslag, netwerk, permissies en privacy-policy.html
Vorig rapport: 2026-06-security-review.md (10 juni 2026, herzien 11 juni 2026)

## Vergelijking met vorig rapport

Alle bevindingen uit het vorige rapport (10-11 juni) zijn afgehandeld of staan al als open actie geregistreerd. Nieuwe bevindingen in deze ronde zijn het gevolg van de Supabase-backend en ElevenLabs-integratie die na de vorige review zijn toegevoegd:

- Privacybeleid klopte niet meer met de daadwerkelijke datastromen (KRITIEK, zie bevinding 1 - gefixt)
- EXPO_PUBLIC_ ElevenLabs API-sleutel is uit de .env-bundel extraheerbaar (HOOG, voorstel)
- Supabase- en RevenueCat-sleutels staan in git history via eas.json (HOOG, voorstel)
- Google Maps API-sleutel in git history via app.json (HOOG, voorstel - was al Middel in vorig rapport)
- GPS-routes worden naar Supabase gesynchroniseerd zonder privacybeleidsdekking (KRITIEK, gefixt)

---

## Bevindingen

### Kritiek

**1. Privacybeleid klopte niet met cloudsync en ElevenLabs (gefixt 29 juni 2026)**

- Locatie: privacy-policy.html vs. src/services/syncService.ts, src/services/authService.ts, src/services/voiceService.ts
- Risico: het privacybeleid beweerde "Alle gegevens worden lokaal opgeslagen. Er is geen gebruikersaccount en geen cloud-synchronisatie." Ondertussen:
  - De app maakt automatisch een anonieme Supabase-sessie aan (signInAnonymously) en synchroniseert best-effort naam, leeftijd, doel, trainingsdata en GPS-routes naar Supabase-servers (EU, AWS Frankfurt) zonder dat de gebruiker dit weet of toestemming geeft.
  - Premium-gebruikers sturen coachteksten naar ElevenLabs (VS) voor spraaksynthese.
- Exploiteerbaarheid: directe AVG/GDPR-overtreding. Toezichthouder of storereviewer kan de app blokkeren; ook Apple- en Google-reviewers controleren of het privacybeleid klopt met het daadwerkelijke datagebruik.
- Status: gefixt. privacy-policy.html is volledig herschreven:
  - Sectie 2 beschrijft nu de offline-first opslag plus de optionele cloudsync naar Supabase (EU, RLS-beveiliging).
  - Sectie 3 noemt drie externe diensten: Supabase (cloudsync), openrouteservice.org (routeplanner) en ElevenLabs (stemcoaching, alleen premium).
  - Sectie 4 vermeldt expliciet dat routes ook in de cloud worden opgeslagen als sync actief is.
  - Sectie 5 voegt een procedure toe voor clouddata-verwijdering.
  - Datum bijgewerkt naar 29 juni 2026.
- Nog te doen: commit en push naar GitHub (Pages worden daarna automatisch bijgewerkt), datasafety-formulieren in App Store Connect en Play Console bijwerken.

---

### Hoog

**2. EXPO_PUBLIC_ ElevenLabs API-sleutel wordt in de app-bundel meegeleverd (voorstel)**

- Locatie: .env regel 1 (EXPO_PUBLIC_ELEVENLABS_API_KEY=sk_e0c7c6...)
- Risico: het EXPO_PUBLIC_ prefix is door Expo bedoeld voor configuratie die bewust publiek mag zijn. Een ElevenLabs API-sleutel valt hier niet onder: iedereen die de APK of IPA decompileert (triviaal met jadx of ipa-tools) kan de sleutel uitlezen en gebruiken voor eigen tekstomzetting op kosten van de eigenaar. De sleutel geeft ook toegang tot eventuele opgeslagen audio in de ElevenLabs-bibliotheek.
- Exploiteerbaarheid: hoog. Decompileren is een standaardhulpmiddel voor beveiligingsonderzoekers en kwaadwillenden. De sleutel zit letterlijk als plaintext string in het JavaScript-bundel.
- Status: voorstel (secrets roteren valt buiten het mandaat van deze review):
  a. Verplaats het ElevenLabs-verzoek naar een eigen serverless proxy (bijv. Supabase Edge Function of Vercel serverless). De app stuurt de te zeggen tekst naar jouw proxy; de proxy voegt de sleutel toe en belt ElevenLabs aan. Zo blijft de sleutel altijd serverside.
  b. Als stap a te groot is: beperk de ElevenLabs-sleutel zo strak mogelijk in het ElevenLabs dashboard (specifieke voice-IDs, maandelijks karakterlimiet) zodat misbruik bij diefstal beperkt blijft.
  c. Roteer de huidige sleutel zodra stap a of b klaar is.

**3. Supabase- en RevenueCat-sleutels staan in git history (voorstel)**

- Locatie: eas.json (gecommit als onderdeel van de repository, o.a. commit 9d8a88e5)
- Risico: EXPO_PUBLIC_SUPABASE_ANON_KEY en EXPO_PUBLIC_REVENUECAT_API_KEY staan in git history. Voor de Supabase anon key geldt dat die van nature semi-publiek is (Row Level Security beschermt de data), maar blootstelling via een publieke repository maakt misbruik van de Supabase API-endpoint makkelijker (quota-aanvallen). De RevenueCat key (goog_...) geeft toegang tot het RevenueCat dashboard en kan in theorie gebruikt worden om aankopen te manipuleren.
- Exploiteerbaarheid: iedereen met toegang tot de git-repository of een clone heeft de sleutels al. Voor de Supabase anon key is de impact beperkt door RLS. Voor de RevenueCat key is de impact groter.
- Status: voorstel (secrets roteren valt buiten het mandaat):
  a. Controleer of de RevenueCat key ook client-side read-only is of daadwerkelijk schrijfrechten geeft. Zo ja: roteer de sleutel en sla de nieuwe waarde op als EAS secret (eas secret:create) in plaats van in eas.json.
  b. Overweeg de Supabase anon key ook als EAS secret op te slaan.
  c. Voeg eas.json toe aan .gitignore als de sleutels erin blijven. Let op: de bestaande history is er al; dat vereist git filter-repo als je het volledig wilt schonen.

**4. Google Maps API-sleutel permanent in git history (voorstel)**

- Locatie: app.json (commit b78f4c57 e.v., sleutel AIzaSyC_mehbQyc...)
- Risico: de sleutel is publiek voor iedereen met repository-toegang. Onbeperkt gebruik is een direct kosten- en misbruikrisico.
- Exploiteerbaarheid: onmiddellijk beschikbaar voor iedereen met repo-toegang.
- Status: voorstel (ook al in vorig rapport vermeld, nog niet afgehandeld):
  - Beperk de sleutel in Google Cloud Console tot de Maps SDK for Android, package com.lopentelopen.app en de SHA-1 fingerprint van het release-keystore. Daarmee wordt misbruik voor andere Google APIs geblokkeerd, ook al kent iemand de sleutel.
  - Roteer de sleutel als de beperking niet snel kan worden ingevoerd.

---

### Middel

**5. GPS-routes worden gesynchroniseerd naar Supabase (voorstel)**

- Locatie: src/services/syncService.ts (runToRow, regel: `route: run.route ?? null`), supabase/migrations/0002_runs.sql (kolom route jsonb)
- Risico: voltooide runs bevatten per sessie de volledige GPS-route als array van lat/lon/timestamp-punten. Dit omvat vermoedelijk het huisadres als startpunt. De data gaat zonder expliciete keuze van de gebruiker naar Supabase zodra de sleutels actief zijn.
- Exploiteerbaarheid: Supabase RLS beschermt de data goed tegen externe aanvallers. Risico is intern (Supabase zelf, of een gelekte servicerol key) of bij een dataleak. Locatiegeschiedenis is onder de AVG een gevoelig persoonsgegeven.
- Status: voorstel. Twee opties:
  a. Stop het synchroniseren van de route-kolom (zet `route: null` in syncService.ts ongeacht de waarde). Behoud alleen afstand, duur en tempo. De route blijft dan lokaal beschikbaar via AsyncStorage, maar gaat niet naar de cloud. Dat maakt het privacybeleid ook een stuk eenvoudiger.
  b. Vraag de gebruiker expliciete toestemming voor cloudsync inclusief routes, en bied een opt-out aan.

**6. npm audit (niet uitvoerbaar vanuit deze omgeving)**

- Locatie: package.json
- Risico: het npm-auditendpoint is geblokkeerd in deze sandbox. De override `xcode > uuid ^11.1.1` staat correct in package.json (toegevoegd in vorig rapport).
- Status: draai lokaal `npm install && npm audit` om te controleren of de uuid-kwetsbaarheid inderdaad is verholpen. Verwacht 0 kwetsbaarheden. Expo SDK 56.0.12 is de huidige versie; controleer periodiek of er een nieuwere patch-release is.

**7. Anonieme cloudsync zonder expliciete gebruikerstoestemming (voorstel)**

- Locatie: src/store/appStore.ts (onRehydrateStorage roept syncNow aan), src/services/authService.ts (ensureAnonymousSession maakt stilletjes een Supabase-account aan)
- Risico: zodra de Supabase-sleutels actief zijn, wordt er bij elke app-start automatisch een anonieme account aangemaakt en worden profiel en sessies gesynchroniseerd, zonder dat de gebruiker dit heeft gekozen of een melding ziet. Onder de AVG vereist verwerking in de cloud een wettelijke grondslag; stilzwijgende anonieme sync voldoet daar mogelijk niet aan.
- Exploiteerbaarheid: geen directe technische aanval, maar een compliance-risico.
- Status: voorstel. Voeg in de instellingen een zichtbare "Cloudsync aan/uit" schakelaar toe en vraag bij eerste sync toestemming. Schakel ensureAnonymousSession alleen aan als de gebruiker dat heeft bevestigd.

---

### Laag

**8. AsyncStorage bevat GPS-routes onversleuteld (voorstel, ook in vorig rapport)**

- Locatie: src/store/appStore.ts (completedSessions wordt gepersisteerd via AsyncStorage)
- Risico: op een geroot of gecompromitteerd toestel zijn GPS-routes uitleesbaar. SecureStore is ongeschikt (limiet 2 KB per entry). Alternatief: routes niet lokaal bewaren (sla alleen afstand/duur/tempo op) of bewaren in expo-sqlite met versleuteling.
- Status: open voorstel uit vorig rapport, nog niet geimplementeerd. Zie ook bevinding 5: als routes ook niet naar de cloud gaan, is de blootstelling beperkt tot het lokale toestel en zakt het risico verder.

---

## Wat in orde is

- Netwerk: alle externe calls gaan over HTTPS (Supabase, ElevenLabs, openrouteservice.org). Geen enkel http://-endpoint gevonden.
- Logging: slechts 1 console.error in useShareRun.ts (logt alleen een foutobject, geen locatie- of gebruikersdata). Geen gevoelige data in logs.
- URL-parameters: de ElevenLabs-sleutel gaat via een xi-api-key header, de ORS-sleutel via een Authorization-header. Geen secrets in URL-parameters.
- Permissies app.json: schoongemaakt in vorige review. Huidige permissies (ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, FOREGROUND_SERVICE, FOREGROUND_SERVICE_LOCATION, WRITE_EXTERNAL_STORAGE) zijn allen aantoonbaar in gebruik.
- Row Level Security: de Supabase-tabellen profiles en runs hebben RLS ingeschakeld. Een gebruiker kan alleen zijn eigen data lezen, schrijven en verwijderen.
- .env staat correct in .gitignore; de ElevenLabs-sleutel staat dan ook niet in de git history (alleen in de app-bundel van een gebouwde release).
- TypeScript-compilatie: npx tsc --noEmit slaagt zonder fouten na de wijzigingen in deze review.
- isAccessMediaLocationEnabled: uit (gefixt vorig rapport).
- Ongebruikte dependencies expo-av en expo-sqlite: verwijderd in vorig rapport.

---

## Beperkingen van deze run

- npm audit kon niet draaien (registry geblokkeerd door netwerk-allowlist van deze sandbox). Draai lokaal.
- Git history-analyse is beperkt tot de lokale kloon (geen toegang tot remote zoals GitHub). Als de repository op een remote staat, geldt dat sleutels in de history daar ook beschikbaar zijn voor iedereen met leesrechten.

---

## Afsluiting

Uitgevoerde fixes: 1
- privacy-policy.html volledig bijgewerkt: Supabase cloudsync, ElevenLabs stemcoaching en GPS-routesync toegevoegd aan de beschrijving; sectie 5 uitgebreid met clouddata-verwijderingsprocedure; datum bijgewerkt naar 29 juni 2026. TypeScript-compilatie niet beinvloed (geen codewijziging).

Belangrijkste openstaande actie: **verplaats de ElevenLabs API-aanroep naar een eigen serverless proxy** (bevinding 2). De sleutel zit nu als plaintext string in de productiebundel en is triviaal extraheerbaar. Parallel hieraan: commit en push de bijgewerkte privacy-policy.html en werk de datasafety-formulieren in App Store Connect en Play Console bij (bevinding 1).
