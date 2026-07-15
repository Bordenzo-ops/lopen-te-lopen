# Handover: Lopen te Lopen naar de Apple App Store

Laatste update: 2026-07-10 (fase 5 App Privacy + Age Ratings afgerond terwijl Lars weg was). Doel van dit document: in een nieuwe chat direct verder kunnen met het iOS-lanceringstraject.

## Startprompt voor de nieuwe chat

> Ik wil Lopen te Lopen naar de Apple App Store brengen. Mijn Apple Developer account is betaald en actief (Individual, Apple ID larsvdb1@hotmail.com). Lees HANDOVER-iOS-APPSTORE.md in de projectmap en loods me stap voor stap door fase 2 tot en met 6. Begin bij fase 2.

## Waar we staan

- **Apple Developer Program: BETAALD** op 2026-07-10 (99 euro/jaar, Individual, Apple ID larsvdb1@hotmail.com). Mogelijk nog even wachten op identiteitsverificatie van Apple; check of je in App Store Connect (appstoreconnect.apple.com) kunt inloggen en of "Apps" beschikbaar is.
- **Android draait al**: AAB v11 is geupload naar Play Console en werd verwerkt. iOS is een parallel traject met dezelfde codebase (Expo/EAS), geen Mac nodig, EAS bouwt in de cloud.
- **Code is grotendeels iOS-klaar** (zie sectie "Al voorbereid in code").

## App- en accountgegevens (referentie)

- App: "Lopen te Lopen", Expo SDK 56, expo-router, zustand, TypeScript. Doelgroep: beginners die trainen voor een halve marathon. Alle copy in het Nederlands, nooit "—" gebruiken.
- Bundle identifier (iOS + Android): `com.lopentelopen.app`
- Expo account: bordenzo. EAS projectId: `77bb6e1a-d692-48e8-8206-3cb6cdcea770`
- Repo: github.com/Bordenzo-ops/lopen-te-lopen (branch master)
- Supabase: project `zefiknynxppgbhiiunre` (eu-central-1). Strava client id 262282. Sentry DSN staat in .env + eas.json.
- Prijzen: EUR 5,99/maand en EUR 49/jaar. Entitlement in RevenueCat: `premium`. Offering: `default`. Producten: `premium:maandelijks`, `premium:jaarlijks`.
- Trial-besluit: 14 dagen gratis proefperiode op het JAARplan (soft paywall). Op Android al ingericht (offer trial-14-dagen). Op iOS nog te doen als introductory offer.

## De 6 fases

Fase 1 (Apple Developer account) is klaar. Fase 2 (app aanmaken) is klaar: ascAppId `6789545791`, al gezet in eas.json onder submit.production.ios. Hieronder fase 3 t/m 6.

### Fase 2: App aanmaken in App Store Connect
1. Ga naar appstoreconnect.apple.com > Apps > "+" > Nieuwe app.
2. Platform iOS, naam "Lopen te Lopen", primaire taal Nederlands (nl-NL), bundle-id `com.lopentelopen.app` (als die niet in de lijst staat, eerst registreren via developer.apple.com > Certificates, Identifiers & Profiles > Identifiers > "+"), SKU vrij te kiezen (bijv. lopentelopen001).
3. Noteer de **App Store Connect App ID** (ascAppId) die daarna zichtbaar is. Die is later handig voor `eas submit`.
4. Vul later (kan ook in fase 5) de Team ID op als die gevraagd wordt.

### Fase 3: iOS in-app aankopen + RevenueCat — DEELS KLAAR (stand 2026-07-10)
1. ✅ KLAAR. Abonnementsgroep "Premium" met twee auto-renewable abonnementen: `premium_maandelijks` (EUR 5,99/maand) en `premium_jaarlijks` (EUR 49/jaar). LET OP: Apple staat geen dubbele punt toe in Product ID's, dus de Android-notatie `premium:maandelijks` werkt hier niet gebruikt. Deze hoeven niet letterlijk gelijk te zijn aan de Android product-ids: in RevenueCat koppel je zowel het Android- als het iOS-product aan dezelfde entitlement `premium` en dezelfde offering-packages. Beide staan op status "Ready to Submit" (prijs, beschikbaarheid alle landen, Nederlandse localization, review-screenshot + notes ingevuld). De review-screenshot is een **gegenereerde placeholder-mockup** van het paywallscherm (er bestond nog geen echte app-screenshot); vervang 'm door een echte screenshot zodra de TestFlight-build er is (fase 6), via Abonnementen > desbetreffend abonnement > Review Information > Screenshot.
2. ✅ KLAAR. Introductory offer op `premium_jaarlijks`: gratis, 2 weken, alle landen, startdatum 2026-07-10, geen einddatum.
3. ✅ KLAAR (2026-07-12, door Lars zelf gedaan). Paid Apps Agreement actief (11 jul 2026 - 10 jul 2027), bankrekening Revolut Bank UAB (EUR, IBAN NL96REVO0325076901) toegevoegd en actief, belastingformulieren U.S. Form W-8BEN en U.S. Certificate of Foreign Status of Beneficial Owner ingediend en actief.
4. ✅ KLAAR (2026-07-12). P8 in-app purchase key gegenereerd door Lars in App Store Connect (naam "RevenueCat", Key ID `M22P74SZUR`, Issuer ID `563c96e1-a277-4e37-bbfb-fb0e803bdb83`), geüpload in RevenueCat samen met bundle-id `com.lopentelopen.app` en Custom URL Scheme `rc-91026e5737` (automatisch gegenereerd door RevenueCat na opslaan — nog NIET geregistreerd in app.json, nodig voor RevenueCat paywall-preview deeplinks, mag ook later). App in RevenueCat toont "Valid credentials".
5. ✅ KLAAR (2026-07-12). Apple public SDK key opgehaald: `appl_NhzwPLQPwVrVhkquIVKcQlUYWEt`. Al gezet in lokale `.env` (`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`).
6. ✅ KLAAR (2026-07-12, door Lars lokaal gedraaid). EAS-secret `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` aangemaakt op project `@bordenzo/lopen-te-lopen`.
7. ✅ KLAAR (2026-07-12). Beide iOS-producten aangemaakt in RevenueCat (`premium_maandelijks`, `premium_jaarlijks`), gekoppeld aan entitlement `premium`, en automatisch verschenen in de packages van de `default` offering (Monthly-package en Yearly-package bevatten nu zowel het Android- als het iOS-product). **Fase 3 is hiermee volledig afgerond.**

### Fase 4: iOS-build met EAS — ✅ KLAAR (2026-07-12)
1. **Bekend probleem opgelost**: `eas build --platform ios --profile production` faalde herhaaldelijk op "Verification codes can't be sent to this phone number at this time" tijdens de Apple Developer Portal-login (een ander, minder betrouwbaar 2FA-kanaal dan de normale appleid.apple.com-login, die wel gewoon werkte). Update naar de laatste eas-cli, cache wissen en device-2FA waren geen oplossing (geen Apple-hardware beschikbaar). Opgelost via **handmatige credentials**:
   - Distribution Certificate (Apple Distribution) aangemaakt via developer.apple.com > Certificates (CSR gegenereerd met openssl, hier), gedownload als `distribution.cer`, omgezet naar `.p12` (wachtwoord `LopenTeLopen2026`).
   - Provisioning Profile "Lopen te Lopen App Store" (type App Store Connect) aangemaakt via developer.apple.com > Profiles voor `com.lopentelopen.app`, geldig tot 2027-07-11.
   - Beide bestanden staan lokaal in `ios-cert/` (in .gitignore) en worden aangestuurd via `credentials.json` in de projectroot (ook in .gitignore).
   - `eas.json` > `build.production.ios.credentialsSource` gewijzigd van `"remote"` naar `"local"`.
   - Bij "Would you like to set up Push Notifications?" gekozen voor **"No, don't ask again"** (app gebruikt alleen lokale notificaties, geen remote push) — voorkeur is opgeslagen in eas.json.
   - Resultaat: build draait nu zonder Apple-login nodig te hebben. Build-nummer automatisch verhoogd naar 2 (autoIncrement).
2. **Tussentijdse tegenslag opgelost**: eerste geslaagde "Prepare credentials"-poging faalde alsnog met "Provisioning profile doesn't include the Push Notifications capability" / "doesn't include the aps-environment entitlement" — de Xcode-project-config verwacht dit blijkbaar (waarschijnlijk via `expo-notifications` voor lokale meldingen). Opgelost door: Push Notifications-capability aan te zetten op de App ID (developer.apple.com > Identifiers > com.lopentelopen.app), en het Provisioning Profile helemaal opnieuw te genereren (niet alleen "Edit > Save" op het bestaande profiel — dat leverde vreemd genoeg een profiel op zonder de `aps-environment`-entitlement; een gloednieuw profiel "Lopen te Lopen App Store v2" wél). Geen echte Push Notification Key/certificaat nodig, alleen de capability-vlag.
3. **BUILD GESLAAGD** (2026-07-12). `credentials.json` wijst nu naar `ios-cert/Lopen_te_Lopen_App_Store_v2.mobileprovision` + `ios-cert/ios_distribution.p12`. Lars heeft het .ipa-bestand gedownload.
4. **Let op voor volgende builds**: het Distribution Certificate verloopt pas in 2027, dus dit hoeft niet snel opnieuw. Mocht het certificaat ooit moeten vernieuwen, herhaal dan dezelfde handmatige route (CSR via openssl met `-legacy`-encryptie i.v.m. macOS Keychain-compatibiliteit, upload op developer.apple.com) in plaats van de kapotte interactieve Apple-login te proberen. `eas.json` staat nu permanent op `credentialsSource: "local"` voor iOS production-builds.

### Fase 5: Store-vermelding + privacy — DEELS KLAAR (stand 2026-07-10)
1. ✅ OPGESLAGEN (geverifieerd): Promotional Text, volledige Description, Keywords, Support URL (`https://lopentelopen.nl`), Marketing URL (`https://lopentelopen.nl`), Copyright (`2026 Lars van der Borden`) op de versiepagina (Distribution > App Information/App Store > iOS App Version 1.0).
   ⚠️ **NIET OPGESLAGEN**: in App Review Information is "Sign-in required" al uitgezet (anonieme login) en zijn contactnaam/e-mail + reviewer-notities ingetypt geweest, maar dat hele blok kon niet opslaan omdat Apple een telefoonnummer verplicht stelt bij Contact Information (met "+" landcode) en dat veld leeg is. Herhaal dus: Sign-in required uitzetten, First name "Lars", Last name "van der Borden", Email larsvdb1@hotmail.com, telefoonnummer invullen, en de reviewer-notitie (zie git-historie van dit bestand of vraag opnieuw) — en klik dan Save.
   ⬜ Screenshots ontbreken nog echt (0 van 10): iOS vereist minimaal 6.7 inch (1290x2796) en 6.5 inch (1242x2688). Gebruik het screenshot-plan met 8 captions in STORE_LISTING.md.
2. ✅ INGEVULD, NOG NIET GEPUBLICEERD. App Privacy (Distribution > App Privacy): alle 7 gedeclareerde datatypes zijn ingevuld en opgeslagen — Name, Fitness, Precise Location, Other User Content, User ID, Purchases (alle 6: "Used for App Functionality" + "Linked to the user's identity") en Crash Data ("Used for App Functionality", NIET gelinkt aan identiteit — Sentry crash-rapporten zijn niet aan een accountidentiteit gekoppeld). Geen van alle wordt gebruikt voor tracking. Privacy Policy URL staat correct op `https://lopentelopen.nl/privacy-policy.html`. ⚠️ De pagina heeft een actieve **Publish**-knop rechtsboven: dit publiceert het privacy-label publiekelijk op de App Store-productpagina, dus dat is een moment voor Lars om zelf te controleren en te klikken (niet autonoom gedaan, valt onder "publiceren van publieke content").
3. ✅ KLAAR. Leeftijdsclassificatie ingevuld (Distribution > App Information > Age Ratings, 7-staps-vragenlijst): overal "Geen"/"Nee" behalve "Health or Wellness Topics" = Ja (de app geeft zelf trainings-/leefstijladvies, dat is feitelijk correct). Resultaat: **9+** voor de meeste landen (172), 12+ in Vietnam, A10 in Brazilië, ALL in Korea — dit wijkt af van de eerder aangenomen 4+ in STORE_LISTING.md, maar is Apple's eigen berekening op basis van eerlijke antwoorden en hoeft niet aangepast te worden.
4. Privacybeleid-URL: https://lopentelopen.nl/privacy-policy.html (staat live, geverifieerd op 2026-07-10 — gebruik deze URL, niet de oudere github.io-link uit STORE_LISTING.md).
5. ⬜ NOG TE DOEN. Export compliance: de app gebruikt alleen standaard HTTPS-encryptie, dus meestal "vrijgesteld". Beantwoord de vraag eerlijk (komt meestal langs bij het uploaden van de build in fase 6).
6. ✅ Support-URL en marketing-URL al ingevuld (zie punt 1).

### Fase 6: TestFlight-test + indienen — GESTART (2026-07-12)
1. ✅ KLAAR. Build (ID `8ce16809-2cc9-4e65-ac1b-7ab990493494`, versie 1.0.0, build 4) geüpload naar App Store Connect via `eas submit --platform ios --profile production`. Ook hier gaf de standaard flow (`Generate a new App Store Connect API Key?` → interactieve Apple-login) dezelfde kapotte 2FA-sms-fout. Opgelost met een **handmatige App Store Connect API Key** (Admin-rol): App Store Connect > Users and Access > Integrations > **App Store Connect API** (niet "In-App Purchase" — dat is een aparte, eerder gemaakte sleutel voor RevenueCat). Vereiste eerst een eenmalige toestemmingsstap ("Request Access to the App Store Connect API", direct goedgekeurd). Sleutel "EAS Submit", Key ID `Z3BU2QZNK4`, Issuer ID `563c96e1-a277-4e37-bbfb-fb0e803bdb83`, `.p8`-bestand staat in `ios-cert/AuthKey_Z3BU2QZNK4.p8`. Ingevuld in `eas.json` onder `submit.production.ios` (`ascApiKeyPath`, `ascApiKeyId`, `ascApiKeyIssuerId`) — `appleId` is niet meer nodig en verwijderd. **Voor toekomstige submits**: dit werkt nu altijd zonder Apple-login, gewoon `eas submit --platform ios --profile production` opnieuw draaien.
   Apple verwerkt de build nu (duurt normaal 5-10 minuten), Lars krijgt een e-mail zodra dat klaar is. Build zichtbaar op: https://appstoreconnect.apple.com/apps/6789545791/testflight/ios
2. ⬜ NOG TE DOEN. Test via TestFlight op je iPhone zodra de build verwerkt is. Let vooral op de grootste onzekerheid: **achtergrond-GPS op iOS** (de app draait bewust op "When In Use" + UIBackgroundModes location, GEEN "Always"). Werkt tracking met scherm vergrendeld niet, dan moet `requestBackgroundPermissionsAsync` + een Always-omschrijving terug in de config en opnieuw builden.
3. ⬜ NOG TE DOEN. Test ook: paywall met trial-weergave, testaankoop (sandbox-tester in App Store Connect aanmaken), routeplanner, spraakcoaching, Strava-flow, GPX-export.
3a. ⬜ NOG TE DOEN. Spraakcoaching man/vrouw-stem opnieuw testen op beide platforms na de nieuwe builds (de env-bug uit de vorige sectie beinvloedde dit rechtstreeks). De premium ElevenLabs-stemmen (Roos/Adam) vereisen een werkende Supabase-sessie plus actieve premium-status; zonder een van beide valt de app terug op de ingebouwde telefoonstem. Geverifieerd op 2026-07-13 met `supabase secrets list`: `ELEVENLABS_API_KEY` staat als Supabase function secret en de `tts`-functie is ACTIVE, dus de serverkant van de premium-stemmen is in orde. De fallback-telefoonstem benadert de man/vrouw-keuze nu zelf ook via de beschikbare Nederlandse systeemstemmen en toonhoogte in plaats van altijd dezelfde standaardstem te gebruiken; dit is een benadering (geen gegarandeerd geslacht per stem-identifier) en het resultaat kan per toestel en OS-versie verschillen.
4. ⬜ NOG TE DOEN. Als alles werkt: vul telefoonnummer + App Review Information in (zie fase 5, punt 1), vervang de placeholder-screenshots bij de abonnementen door echte, lever de 10 productscreenshots aan, publiceer de App Privacy-verklaring, en dien dan pas in voor App Review. Review duurt meestal 24 tot 48 uur.

### TestFlight-build 4 crashte direct bij openen, gefixt (2026-07-13)

De TestFlight-build (versie 1.0.0, build 4, productieprofiel) crashte direct bij het openen op de iPhone. Android bleef gewoon werken. Onderzoek en fixes:

- **Bewezen hoofdoorzaak**: `eas.json` (staat in .gitignore, dus niet in git) gebruikte in `build.preview.env` en `build.production.env` waardes als `"$EXPO_PUBLIC_SUPABASE_ANON_KEY"`. De eas-cli doet geen `$`-interpolatie van zulke strings, en env-waardes in eas.json overschrijven de server-side EAS environment variables. De iOS-build kreeg daardoor de letterlijke tekst "$EXPO_PUBLIC_..." als Supabase anon key, RevenueCat-sleutels en Sentry DSN mee, in plaats van de echte waardes. Gefixt: de vier betrokken keys in eas.json (Supabase anon key, beide RevenueCat-keys, Sentry DSN) zijn vervangen door de echte waardes uit het lokale .env-bestand, in zowel het preview- als het production-profiel.
- **Tweede risico, nu gehard**: `src/services/backgroundLocationService.ts` deed een ongeguarde top-level import van `expo-task-manager` en `expo-location`. Beide native modules doen op module-niveau een `requireNativeModule(...)`-aanroep die synchroon crasht als de native module om wat voor reden dan ook niet beschikbaar is. Dit bestand wordt via een side-effect import in `app/_layout.tsx` al bij het opstarten van de app geladen, dus dit was het enige ongeguarde native-module-pad in de opstartketen. Gefixt naar hetzelfde lazy/guarded laadpatroon als `src/services/healthConnectService.ts`: dynamische `require()` binnen try/catch, module-referenties gecachet, `TaskManager.defineTask(...)` in een eigen functie met try/catch die overslaat als de modules niet laadden, en alle exported functies vallen veilig terug op een no-op of `false`/`null` als de modules ontbreken. De publieke API is ongewijzigd gebleven.
- **Derde risico uitgesloten als voorzorg**: `SENTRY_DISABLE_AUTO_UPLOAD: "true"` toegevoegd aan zowel `build.preview.env` als `build.production.env` in eas.json. Dit sluit uit dat het Sentry-sourcemap-uploadscript in de Xcode-bundle-fase een corrupte of lege JS-bundle oplevert. Alleen de sourcemap-upload gaat hiermee uit, crash-reporting zelf (SENTRY_DSN) blijft gewoon werken. `SENTRY_AUTH_TOKEN` staat al als server-side EAS environment variable; deze instelling kan later weer verwijderd worden zodra de app aantoonbaar stabiel draait in TestFlight.
- **Extra hardening bij dezelfde gelegenheid**: `src/services/purchaseService.ts` gaf op iOS bij een lege iOS-sleutel de Android RevenueCat-key (`goog_...`) mee aan `Purchases.configure`, wat fout is en mogelijk een native crash kan veroorzaken. Nu gebruikt iOS uitsluitend `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`; is die leeg, dan is purchases gewoon niet geconfigureerd (bestaand stil-falen-pad), zonder platform-fallback. Ook toegevoegd: een sleutel die met "$" begint (een niet-geëxpandeerde placeholder) wordt ook als "niet geconfigureerd" behandeld. Daarnaast is de dubbele `UIBackgroundModes`-lijst in `app.json` (`["audio","location","audio","location"]`) opgeschoond naar `["audio","location"]`.
- **Vervolgstap**: een nieuwe build en submit zijn nodig, bijvoorbeeld met `eas build --platform ios --profile production --clear-cache --auto-submit`. Gebruik bewust `--clear-cache` omdat de vorige build met de kapotte env-waardes al gecachet kan zijn.
- **Aanbeveling voor later**: de secrets nu netjes lokaal in eas.json staan (dat mag, het bestand staat in .gitignore), maar op termijn is het netter om ze server-side te zetten via `eas env:create` en dan uit eas.json te halen. Dat is een bewuste actie die Lars zelf moet uitvoeren; er zijn in deze ronde bewust geen `eas env`-commando's gedraaid.

**Status na de fixronde (2026-07-13, einde sessie):**

- Alle fixes zijn gecommit en gepusht naar master: `fe14c3b6` (code: opstartcrash, env-sanering, purchase-key-keuze, stemkeuze-fallback) en `2134feb4` (docs). De gerepareerde `eas.json` staat alleen lokaal (gitignored), let daarop bij een verse checkout op een andere machine: dan eerst eas.json herstellen met de waardes uit `.env`.
- **iOS build 5** is door Lars gestart (met `--clear-cache --auto-submit`) VOORDAT de stemkeuze- en hardening-fixes af waren. Build 5 bevat dus wel de crashfixes en de goede env-waardes, maar NIET de stemkeuze-fallback en de supabaseClient/voiceConfig-hardening uit commit `fe14c3b6`. Voor die features is te zijner tijd een build 6 nodig. Premium-stemmen (Roos/Adam) zouden in build 5 al moeten werken zodra premium/trial actief is.
- **Android**: de Play Store-versie v11 is gebouwd met de kapotte env-waardes, dus daar werken Supabase-sync, aankopen en premium-stemmen niet. Lars bouwt en uploadt zelf een nieuwe Android-build (wordt versionCode 12) vanuit de gefixte werkmap; die bevat alle fixes inclusief de stemkeuze-fallback.
- Serverkant stemmen geverifieerd: `tts`-functie ACTIVE op Supabase, `ELEVENLABS_API_KEY` staat als function secret.
- Crashlog-tip als iOS build 5 alsnog crasht: iPhone Instellingen > Privacy en beveiliging > Analyse en verbeteringen > Analysegegevens, zoek een bestand dat begint met "Lopen te Lopen", en deel dat in de volgende chat.

### Delen/opslaan-fix + nieuwe builds (2026-07-15)

Sentry meldde twee nieuwe issues die een vriend tijdens het testen op zijn iPhone tegenkwam: run niet kunnen **delen** en niet kunnen **opslaan**.

- **ANDROID-2** (delen): `instagram-stories://share` stond niet in `LSApplicationQueriesSchemes`, waardoor `Linking.canOpenURL` op iOS een error gooide die de hele deelactie liet crashen. Gefixt in `app.json` (scheme toegevoegd) + `src/hooks/useShareRun.ts` (`canOpenURL`/`openURL` en `share()` in try/catch met nette fallback naar het native deelmenu).
- **ANDROID-3** (opslaan): `MediaLibrary.saveToLibraryAsync` gooit in expo-media-library 56 een runtime-error. Vervangen door `MediaLibrary.Asset.create(...)` in `src/hooks/useShareRun.ts`.
- Beide fixes gecommit op master (`1ee8566e`). Beide Sentry-issues staan op **resolved** (dronevision-studios, project android).
- Permission-rule `mcp__sentry__update_issue` toegevoegd aan `.claude/settings.local.json` zodat het bijwerken van Sentry-issues vanuit de chat mag.

**iOS build 8 (versie 1.0.0): GESLAAGD en GEUPLOAD** (2026-07-15) via `eas build --platform ios --profile production --auto-submit`. Auto-submit werkte meteen (iOS-creds in `ios-cert/` + `ascApiKey`-config in eas.json). Bevat de delen/opslaan-fixes plus al het werk uit build 6. Buildnummer automatisch verhoogd naar 8 (autoIncrement).

**Android (wordt versionCode 13): auto-submit lukt nog niet.** `eas submit`/`--auto-submit` vraagt om `google-service-account.json` (pad in `submit.production.android.serviceAccountKeyPath`), en die sleutel bestaat nog niet — Android v12 is destijds handmatig via de Play Console geupload, nooit via `eas submit`. Twee routes:
- **Nu**: bouw zonder `--auto-submit` (`eas build --platform android --profile production`) en sleep de `.aab` handmatig in de Play Console.
- **Eenmalig instellen**: Google Service Account aanmaken via Play Console > Setup > API access -> service account in Google Cloud -> JSON-key downloaden -> rechten geven in Play Console (Release + View app information) -> bestand opslaan als `google-service-account.json` in de projectroot (staat al in .gitignore). Daarna werkt `--auto-submit` ook voor Android zonder prompt. Gids: https://expo.fyi/creating-google-service-account. (Lars is deze route aan het uitvoeren.)

## Al voorbereid in code (niet opnieuw doen)

- `src/services/purchaseService.ts`: kiest de RevenueCat-key per platform. iOS -> `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, Android -> `EXPO_PUBLIC_REVENUECAT_API_KEY`, zonder platform-fallback (sinds 2026-07-13; zie de subsectie hierboven). `getTrialInfo` leest op iOS `product.introPrice`.
- `.env.example` en `eas.json` (preview + production env): bevatten al `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`.
- `app.json`: iOS bundle-id, `NSLocationWhenInUse`/`AlwaysAndWhenInUse`-omschrijvingen, `UIBackgroundModes` (audio + location), expo-location plugin met iOS-achtergrondlocatie.
- `eas.json`: `production.ios.credentialsSource = remote`, `submit.production.ios.appleId = larsvdb1@hotmail.com`.

## Nog te doen door Lars (kan niet vanuit een chat)

- Toestemming geven voor / zelf genereren van de App Store Connect in-app purchase P8-key (Users and Access > Integrations > In-App Purchase), nodig om de iOS-app in RevenueCat op te slaan.
- Apple-login tijdens `eas build`/`eas submit` (2FA).
- De Apple `appl_`-key uit RevenueCat halen en als EAS-secret + .env zetten.
- Screenshots aanleveren op de juiste iOS-formaten (en de placeholder-screenshot bij de twee abonnementen vervangen door een echte).
- Telefoonnummer invullen bij App Review Information > Contact Information (verplicht veld, met "+" landcode) en daarna nogmaals op Save klikken op de versiepagina.
- App Privacy publiceren: op Distribution > App Privacy staat rechtsboven een actieve **Publish**-knop. Alle 7 datatypes zijn al ingevuld en opgeslagen (zie fase 5, punt 2) — dit is bewust NIET automatisch gepubliceerd omdat het een publiek zichtbare verklaring op de App Store-pagina wordt. Controleer de samenvatting op die pagina en klik zelf op Publish.
- Fysieke TestFlight-test op de iPhone.

## Omgevingswaarschuwingen (bekende valkuilen)

- Mount-cachebug: bash/tsc kunnen afgekapte bestanden zien terwijl Read op het hostpad compleet is. Vertrouw op Read/Edit; draai `npx tsc --noEmit` lokaal.
- Git-lockbug op de mount: `.git/index.lock` moet soms handmatig weg (`del .git\index.lock` in CMD).
- npm in de sandbox is geblokkeerd (403); `npx expo install` en `npm ci` doet Lars lokaal.
- Er stond veel ongecommit werk; dat is op 2026-07-10 gecommit en gepusht (master a1d8b3ef, buildfix 58f963ec). Controleer `git status` voor je begint.
