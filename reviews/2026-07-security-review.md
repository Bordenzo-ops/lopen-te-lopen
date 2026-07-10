# Security review Lopen te Lopen
Datum: 8 juli 2026
Scope: Expo/React Native app (SDK 56, TypeScript), inclusief app.json, eas.json, .env, dependencies, dataopslag, netwerk, permissies, edge functions en privacy-policy.html
Vorig rapport: 2026-06-security-review.md (29 juni 2026)

## Samenvatting

Alle bevindingen uit het vorige rapport (29 juni) zijn afgehandeld of stonden al als open actie geregistreerd. De backend en client zijn sinds die review op meerdere punten verder gehard: Strava-tokens staan nu in SecureStore (Keychain/Keystore) in plaats van AsyncStorage, de nieuwe edge functions strava-oauth en stats hebben CSRF-statebescherming, rate limiting en secret-authenticatie, en de Strava client secret plus STATS_SECRET leven uitsluitend server-side.

De belangrijkste nieuwe bevinding is een gevolg van twee koppelingen die na de vorige review zijn toegevoegd: Strava-upload en Health Connect. Het privacybeleid dekte deze nieuwe datastromen nog niet, waaronder het versturen van de volledige GPS-route naar een derde partij in de VS. Dat is in deze ronde gecorrigeerd.

## Vergelijking met vorig rapport

Nieuw sinds 29 juni:
- Strava-koppeling (OAuth via edge function, upload van runs inclusief GPS-route naar Strava, VS)
- Health Connect (wegschrijven van beweegsessies naar het Android-gezondheidsplatform)
- stats edge function (geaggregeerde marketingcijfers, met STATS_SECRET beveiligd)

Verbeteringen sinds 29 juni die nu bevestigd zijn:
- Strava-tokens in expo-secure-store in plaats van AsyncStorage (was een openstaand type risico voor tokenopslag)
- CSRF-state validatie in de volledige Strava OAuth-flow (client en server)
- Cloudsync blijft standaard uit (cloudSyncEnabled default false) en GPS-routes gaan nog steeds niet naar Supabase (route wordt in syncService op null gezet)

---

## Bevindingen

### Hoog

**1. Privacybeleid dekte de Strava-upload niet (gefixt 8 juli 2026)**

- Locatie: privacy-policy.html vs. src/services/stravaService.ts (uploadRun, uploadManualActivity), supabase/functions/strava-oauth/index.ts
- Risico: bij een actieve Strava-koppeling met automatische upload stuurt de app voltooide trainingen naar Strava Inc. (VS). Bij een run met opgenomen route gaat de volledige GPS-route als GPX-bestand mee (src/services/stravaService.ts regel 354, /api/v3/uploads). Locatiegeschiedenis is onder de AVG een gevoelig persoonsgegeven en gaat hier naar een derde partij buiten de EU. Het privacybeleid noemde Strava nergens.
- Exploiteerbaarheid: dit is een compliance- en storereviewrisico, geen technische exploit. Zowel Apple als Google controleren of het privacybeleid klopt met het feitelijke datagebruik; een niet-gedeclareerde datastroom naar een derde partij is een afwijzingsgrond en een AVG-tekortkoming.
- Status: gefixt. In privacy-policy.html sectie 3 is een Strava-item toegevoegd dat beschrijft welke gegevens (afstand, duur, starttijd en de volledige route als GPS-punten) naar Strava (VS) gaan, dat de koppeling standaard uit staat en handmatig verbonden moet worden, en dat de gebruiker de koppeling kan verbreken. Sectie 4 (Locatietoegang) vermeldt nu dat de route bij een actieve Strava-koppeling ook naar Strava wordt verstuurd. Datum bijgewerkt naar 8 juli 2026.
- Nog te doen door de gebruiker (buiten mandaat): datasafety-formulieren in Play Console en App Store Connect bijwerken zodat Strava als datadeling met een derde partij (locatie en trainingsdata) is gedeclareerd. Commit en push van privacy-policy.html zodat GitHub Pages de nieuwe versie serveert.

---

### Middel

**2. Privacybeleid claimde route-sync naar Supabase die niet plaatsvindt (gefixt 8 juli 2026)**

- Locatie: privacy-policy.html sectie 3 (Supabase-item) en sectie 4 vs. src/services/syncService.ts (runToRow, `route: null`)
- Risico: het beleid stelde dat "voltooide sessies (... en gelopen route als GPS-punten)" naar Supabase worden gesynchroniseerd en dat routes "ook in de cloud" worden opgeslagen. De code zet de route bij het synchroniseren echter bewust op null; routes verlaten het toestel niet via Supabase. Dit is een over-declaratie (het beleid claimt meer verzameling dan er plaatsvindt). Lager risico dan onder-declaratie, maar het is onjuist en zou het datasafety-formulier vervuilen als locatiedeling met Supabase wordt gedeclareerd terwijl dat niet gebeurt.
- Exploiteerbaarheid: geen technische exploit; accuratesse- en compliancekwestie.
- Status: gefixt. Het Supabase-item vermeldt nu expliciet dat de route bewust niet naar Supabase wordt gesynchroniseerd en lokaal blijft. Sectie 4 verwijst nu naar Strava in plaats van naar cloudsync voor routes.

**3. eas.json staat nog steeds onder git-tracking ondanks .gitignore (voorstel)**

- Locatie: eas.json, .gitignore (regel met `eas.json`)
- Risico: eas.json is toegevoegd aan .gitignore, maar het bestand was al getrackt en wordt daardoor nog steeds meegecommit (git ls-files toont eas.json). De .gitignore-regel heeft dus geen effect. De huidige gecommitte versie is schoon: alle sleutels zijn vervangen door EAS secret-referenties ($EXPO_PUBLIC_SUPABASE_ANON_KEY, $EXPO_PUBLIC_REVENUECAT_API_KEY, enzovoort), dus er lekt op dit moment geen live secret. Het risico is dat een toekomstige, per ongeluk ingevulde sleutel alsnog in git belandt omdat de ignore niet werkt.
- Exploiteerbaarheid: nu geen; latent bij toekomstige wijzigingen.
- Status: voorstel (git-operatie, geen code). Draai `git rm --cached eas.json` en commit, zodat het bestand echt uit tracking gaat en de .gitignore-regel effectief wordt. Let op: tijdens deze run stond er een stale .git/index.lock in de repo (git meldde "unable to unlink index.lock, Operation not permitted). Verwijder dat lockbestand voordat je git-commando's draait.

**4. Strava-tokens gaan als querystring door een custom-scheme deep link (voorstel)**

- Locatie: supabase/functions/strava-oauth/index.ts (buildAppRedirect naar lopentelopen://strava-callback?access_token=...&refresh_token=...), app/strava-callback.tsx
- Risico: na de OAuth-uitwisseling stuurt de edge function de access- en refresh-token als URL-parameters terug via het custom deep link-schema lopentelopen://. Op Android kan in principe een andere app hetzelfde custom scheme registreren en zo de redirect (en daarmee de tokens) onderscheppen. De CSRF-state wordt correct gevalideerd (handleStravaCallback vergelijkt de ontvangen state met de bewaarde state), wat request-forgery afdekt, maar niet de onderschepping van het antwoord. Dit is een bekende beperking van custom-scheme OAuth op mobiel.
- Exploiteerbaarheid: middel tot laag. Vereist dat er een kwaadwillende app op het toestel staat die hetzelfde scheme claimt. Een Strava access token geeft toegang tot de gekoppelde Strava-activiteiten van de gebruiker, niet tot de app zelf.
- Status: voorstel, geen low-impact fix (architectuurwijziging). Overweeg Android App Links (geverifieerde https-redirect naar een domein dat je bezit) in plaats van een custom scheme, of een PKCE-achtige uitwisseling waarbij de tokens niet via de redirect-URL maar via een tweede, geauthenticeerde call worden opgehaald.

---

### Laag

**5. GPS-routes staan onversleuteld in AsyncStorage (voorstel, ook in vorig rapport)**

- Locatie: src/store/appStore.ts (partialize persisteert completedSessions inclusief het route-veld, en stravaUploadQueue)
- Risico: op een geroot of gecompromitteerd toestel zijn de lokaal bewaarde GPS-routes uitleesbaar. SecureStore is ongeschikt door de 2 KB-limiet per entry. Omdat routes niet naar Supabase gaan (bevinding 2) is de blootstelling beperkt tot het lokale toestel.
- Status: open voorstel uit vorig rapport, ongewijzigd. Alternatief: alleen afstand/duur/tempo lokaal bewaren, of routes in een versleutelde expo-sqlite-opslag zetten. Impact van de wijziging is te groot voor het automatische mandaat.

**6. Privacybeleid noemde Health Connect niet (gefixt 8 juli 2026)**

- Locatie: privacy-policy.html vs. src/services/healthConnectService.ts, app.json (android.permission.health.WRITE_EXERCISE, WRITE_DISTANCE)
- Risico: de app schrijft voltooide trainingen naar Health Connect. De data blijft op het toestel en de app leest zelf geen gezondheidsgegevens uit, maar het beleid van Google voor Health Connect vereist dat het gebruik in het privacybeleid wordt beschreven. Dit ontbrak.
- Status: gefixt. In privacy-policy.html sectie 3 is een Health Connect-item toegevoegd dat vermeldt dat de app uitsluitend wegschrijft, zelf geen gezondheidsdata leest, dat de gegevens op het toestel blijven en dat de gebruiker de toegang via Health Connect beheert.

**7. npm audit kon niet draaien in de sandbox (informatief)**

- Locatie: package.json, package-lock.json
- Risico: het npm-auditendpoint is geblokkeerd door de netwerk-allowlist van deze sandbox (403 blocked-by-allowlist op /-/npm/v1/security/audits/quick), dus er kon geen actuele kwetsbaarhedenlijst met severity worden opgehaald. De override `xcode > uuid ^11.1.1` uit eerdere rondes staat nog correct in package.json. De vorige lokale run (29 juni) rapporteerde 0 kwetsbaarheden in 662 packages.
- Status: informatief. Draai lokaal `npm audit` (en `npm audit fix` zonder --force bij niet-brekende fixes) om de actuele stand te bevestigen. Dependencies zijn strak gepind op Expo SDK 56 / React Native 0.85; geen losse of verouderde majors gezien.

---

## Wat in orde is

- Secrets in gecommitte bestanden: de huidige eas.json gebruikt uitsluitend EAS secret-referenties, geen live sleutels. De Google Maps-sleutel in app.json is volgens de vorige review applicatie-gebonden gemaakt (com.lopentelopen.app + SHA-1 keystore), rotatie niet nodig. .env is gitignored en niet getrackt (git ls-files toont .env niet).
- Server-side secrets: STRAVA_CLIENT_SECRET, STATS_SECRET, SUPABASE_SERVICE_ROLE_KEY en de ElevenLabs-sleutel leven alleen in de edge functions (Deno.env.get), niet in de app-bundel. Alleen de publieke Strava Client ID (262282) en de publieke RevenueCat/Supabase anon keys staan client-side, zoals bedoeld.
- Edge functions: strava-oauth geeft de OAuth-state ongewijzigd terug voor CSRF-validatie en rate-limit de refresh-route (10 per minuut per token). stats vereist STATS_SECRET (header of query), cachet 10 minuten en geeft uitsluitend geaggregeerde totalen terug, nooit namen of routes. tts proxyt de ElevenLabs-sleutel server-side.
- Tokenopslag: Strava-tokens staan in expo-secure-store (Keychain/Keystore), met een eenmalige migratie vanuit de oude AsyncStorage-opslag.
- Netwerk: alle externe calls gaan over HTTPS (Supabase, Strava, ElevenLabs via tts-function, openrouteservice.org). Geen enkel http://-endpoint in src/, app/ of supabase/.
- URL-parameters: de ORS-sleutel gaat via een Authorization-header, Strava via een Bearer-header. Geen secrets in URL-parameters van de client.
- Logging: drie console-statements (useShareRun.ts, exportService.ts, healthConnectService.ts). Alle drie loggen alleen een foutobject, geen locatie-, token- of gebruikersdata.
- Permissies app.json: ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, FOREGROUND_SERVICE, FOREGROUND_SERVICE_LOCATION (locatietracking tijdens de run), WRITE_EXTERNAL_STORAGE (run-kaart opslaan via media-library) en de nieuwe health.WRITE_EXERCISE / WRITE_DISTANCE (Health Connect wegschrijven) zijn allemaal aantoonbaar in gebruik. Er worden bewust geen READ-gezondheidspermissies gevraagd.
- Cloudsync: gated achter cloudSyncEnabled (default false), gepersisteerd. syncNow en initBackend keren vroeg terug als sync uit staat.
- GPS-routes gaan niet naar Supabase (route: null in runToRow).
- Row Level Security op de Supabase-tabellen profiles en runs.
- TypeScript-compilatie: npx tsc --noEmit slaagt zonder fouten na de wijzigingen in deze review.

---

## Beperkingen van deze run

- npm audit kon niet draaien (registry geblokkeerd door de netwerk-allowlist van deze sandbox). Draai lokaal voor de actuele severity-lijst.
- Git history-analyse is beperkt tot de lokale kloon. De sleutels die in eerdere commits stonden (Google Maps AIza..., RevenueCat goog_..., Supabase anon sb_publishable_...) staan nog in de history; conform vorige review is rotatie voor die specifieke sleutels niet noodzakelijk (app-gebonden respectievelijk publieke, RLS-beschermde sleutels). Gebruik git filter-repo als je de history alsnog wilt opschonen.
- Een stale .git/index.lock verhinderde git-schrijfoperaties in deze run; er zijn geen commits gemaakt. De privacy-policy.html-wijzigingen staan als werkende-boom-wijziging klaar om te committen.

---

## Wat ik niet kon vanwege sandbox-rechten (draai dit in Claude Code)

Deze review draait in een sandbox met een netwerk-allowlist en afgeschermde paden. De volgende punten kon ik daardoor niet zelf afronden. Draai ze in Claude Code, dat lokaal met echte netwerk- en git-toegang werkt:

1. npm audit (registry geblokkeerd door de allowlist, 403):
   - `npm audit` voor de actuele kwetsbaarhedenlijst met severity
   - `npm audit fix` (zonder --force) om niet-brekende patches toe te passen
   - Draai daarna `npx tsc --noEmit` om te bevestigen dat het project nog compileert

2. Bijgewerkte privacy-policy.html publiceren (git-schrijfrechten geblokkeerd; er lag ook een stale .git/index.lock):
   - Verwijder zo nodig eerst het lockbestand: `del .git\index.lock`
   - `git add privacy-policy.html`
   - `git commit -m "Privacy: Strava en Health Connect toegevoegd, Supabase route-claim gecorrigeerd"`
   - `git push` (GitHub Pages serveert daarna de nieuwe policy)

3. Optionele opruiming, eas.json uit git-tracking halen (zie bevinding 3):
   - `git rm --cached eas.json`
   - `git commit -m "Chore: eas.json uit git-tracking (staat al in .gitignore)"`

---

## Afsluiting

Uitgevoerde fixes: 3 (allemaal in privacy-policy.html, geen codewijzigingen, tsc blijft schoon)

1. Strava-datastroom toegevoegd aan het privacybeleid (sectie 3 en 4): welke gegevens naar Strava (VS) gaan, inclusief de volledige GPS-route, dat de koppeling standaard uit staat en handmatig verbonden moet worden.
2. Health Connect toegevoegd aan het privacybeleid (sectie 3): alleen wegschrijven, geen uitlezen, data blijft op het toestel.
3. Onjuiste claim over route-sync naar Supabase gecorrigeerd (sectie 3 en 4): de route wordt bewust niet naar Supabase gesynchroniseerd en blijft lokaal. Datum bijgewerkt naar 8 juli 2026.

Belangrijkste openstaande actie: werk de datasafety-formulieren in Play Console en App Store Connect bij zodat de Strava-koppeling als datadeling met een derde partij (locatie- en trainingsgegevens naar de VS) is gedeclareerd, en commit plus push de bijgewerkte privacy-policy.html zodat de gepubliceerde versie op GitHub Pages klopt. Daarnaast, als opruimactie zonder haast: haal eas.json uit git-tracking (`git rm --cached eas.json`).
