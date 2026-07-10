# Grote verbeterronde Lopen te Lopen (8 juli 2026)

Pre-launch ronde met 4 review-agents (premium/conversie, UX, techniek, store/groei) en 5 bouw-agents. Besluiten van Lars: 14 dagen gratis proefperiode op het jaarplan (soft paywall), background tracking nu meebouwen (lancering mag schuiven), Sentry toevoegen. Prijzen blijven EUR 5,99 per maand en EUR 49 per jaar.

Alle code hieronder is AFGEROND en geverifieerd op het echte bestandssysteem. De sandbox-tsc was deze sessie onbetrouwbaar (mount-cachebug); de finale tsc-check draait Lars lokaal (zie actielijst).

## Gebouwd: premium en conversie

1. `src/services/purchaseService.ts`: nieuwe `getTrialInfo(pkg)` leest de gratis proefperiode platform-onafhankelijk uit (iOS `introPrice`, Android `subscriptionOptions`/pricingPhases). Plus: `addPremiumListener`/`removePremiumListener` rond RevenueCat's CustomerInfo-listener, `logOut()`-helper, en een automatische retry in `getOfferings`.
2. `app/paywall.tsx`: toont bij een actieve trial "Eerst 14 dagen gratis", knoptekst "Start gratis proefperiode" en "Daarna {prijs} per jaar, stop wanneer je wilt". Besparingsbadge dynamisch berekend ("Bespaar 32%") plus maandanker op het jaarplan. Fineprint platform-conditioneel (App Store vs Google Play) met trial-opzegtekst. Links naar Gebruiksvoorwaarden en Privacybeleid (verplicht voor Apple 3.1.2).
3. `src/store/appStore.ts`: `isPremium` wordt nu gepersisteerd (offline cache: betalende gebruiker die zonder netwerk start ziet niet de gratis laag); `refreshPremium` overschrijft alleen bij een bevestigd antwoord. Nieuwe vlaggen `premiumExpiredNoticePending` en `dashboardUpsellDismissed`.
4. `app/_layout.tsx`: registreert de premium-listener zodat een verlopen of elders gekocht abonnement direct doorwerkt zonder herstart.
5. `app/(tabs)/dashboard.tsx`: eenmalige nette melding bij verlopen premium, plus een wegklikbare premium-ontdekkaart voor gratis gebruikers.
6. `app/session/summary.tsx`: contextuele upsellkaart na een run ("Haal meer uit je volgende run", 14 dagen gratis), maximaal 1x per 3 voltooide runs via `selectShowRunUpsell`.
7. `src/config/premiumConfig.ts`: 15 km toegevoegd aan `FREE_RACE_DISTANCES` (inconsistentie opgeheven: alle standaardafstanden gratis).

## Gebouwd: background GPS en run-robuustheid

1. `src/services/backgroundLocationService.ts` (nieuw): expo-task-manager taak `lopen-te-lopen-run-tracking` met Android foreground service (notificatie "Lopen te Lopen volgt je run") en iOS Fitness-activityType. `active.tsx` gebruikt de service met stille fallback naar `watchPositionAsync`. Bestaande verwerkingslogica (25m-filter, auto-pauze, splits, haptics) ongewijzigd. Side-effect import in `_layout.tsx` zodat de taak altijd geregistreerd is.
2. `src/services/runRecoveryService.ts` (nieuw): snapshot van de actieve run elke 15 seconden naar AsyncStorage. Bij opstarten (`app/index.tsx`) een herstel-dialoog "Onafgemaakte run gevonden" met Opslaan/Verwijderen.
3. GPS-verlies-detectie: na 20 seconden zonder geaccepteerd punt verschijnt "Zwak GPS-signaal. Je afstand kan even achterlopen.", verdwijnt vanzelf.
4. Plausibiliteitsfilter: punten met impliciete snelheid boven 8 m/s worden genegeerd.
5. "Open instellingen"-knop bij geweigerde locatietoegang.
6. `src/services/crashReporting.ts` (nieuw): Sentry-init (DSN uit `EXPO_PUBLIC_SENTRY_DSN`, leeg = uit) plus `CrashReportingBoundary` met Nederlandse fallback, aangesloten in `_layout.tsx`.
7. `app.json`: iOS "Always"-locatiepermissie verwijderd (app gebruikt bewust When In Use plus background mode). LET OP: dit is de grootste onzekerheid van de ronde, zie actielijst punt 5.

## Gebouwd: retentie

1. `src/services/notificationService.ts` (nieuw, dynamic require dus crasht nooit zonder package): lokale trainingsherinneringen op de trainingsdagen uit het profiel, streak-bescherming (zondag 18:00 als er die week nog geen run is), weekoverzicht (zondag 19:00 met actuele cijfers), herplanning na elke voltooide run.
2. `app/(tabs)/settings.tsx`: nieuwe sectie "Herinneringen" met toggle (default uit, vraagt netjes permissie) en tijdkeuze 07:00/08:00/12:00/18:00.
3. `app/(tabs)/dashboard.tsx`: streak-vlam zichtbaar vanaf de allereerste run ("Eerste week bezig!" / "X weken op rij").
4. `src/services/reviewService.ts` (nieuw): in-app review na de 3e volledig afgeronde run, met voorvraag "Geniet je van Lopen te Lopen?". Ja leidt naar de systeemreviewprompt, "Kan beter" naar een feedbackmail. Maximaal 1x per 90 dagen, en nooit tegelijk met de upsellkaart.

## Gebouwd: UX en branding

1. `src/components/ui/ShareRunCard.tsx`: oude appnaam "Loop de halve" op de Instagram-deelkaart vervangen door "Lopen te Lopen".
2. Locatie-priming: eenmalige uitleg ("Locatie voor je run") vlak voor de allereerste systeempermissievraag.
3. Copy-fixes: marathon-tagline "De ultieme uitdaging", race-subtitel over automatische aanpassing, voice-beschrijving gelijkgetrokken met instellingen.
4. `StatRing.tsx`: progressbar-rol en -waarde voor screenreaders.

## Gebouwd: store en website

1. `STORE_LISTING.md` volledig herschreven: misleidende "geen abonnement"-claims verwijderd, premium en trial eerlijk vermeld, keyword-bewuste beschrijving, App Store subtitel/keywords/promotietekst, App Privacy-antwoorden dekken nu ook Strava en Supabase-cloudsync, plus een screenshot-plan met 8 screenshots en captions.
2. `website/index.html`: premium-sectie eerlijk (prijs, 14 dagen gratis, opzeggen wanneer je wilt), FAQ en feature-claims gecorrigeerd.
3. `website/voorwaarden.html` (nieuw): concept-gebruiksvoorwaarden in de huisstijl, juridisch laten toetsen.

## Actielijst Lars

**Status per 8 juli 2026 (avond):** `tsconfig.verify.json` verwijderd en `website/privacy-policy.html` gesynchroniseerd met de roottekst (Strava + Health Connect + "route niet naar Supabase" toegevoegd) zijn gedaan. Stap 1 hieronder is nu ook volledig afgerond: Lars heeft de vier packages lokaal geinstalleerd en `npx tsc --noEmit` gaf 3 fouten, die zijn gefixt (`profile?.trainingDays` i.p.v. `profile.trainingDays` op twee plekken in settings.tsx, en `async` toegevoegd aan de TaskManager-executor in backgroundLocationService.ts). Tweede `tsc --noEmit`-run: 0 fouten.

1. ~~Lokaal (Claude Code of terminal): `npx expo install expo-task-manager @sentry/react-native expo-notifications expo-store-review` en daarna `npx tsc --noEmit`~~ (gedaan, 0 fouten na fixes).
2. Play Console: 14-dagen gratis proef-offer toevoegen aan het jaarlijkse base plan (alleen nieuwe abonnees). App Store Connect (zodra zover): introductory offer "gratis, 2 weken" op het jaarplan, maand en jaar in dezelfde abonnementsgroep.
3. RevenueCat: producten/offerings herimporteren zodat de trial-fase zichtbaar wordt in de app.
4. ~~Sentry~~ (volledig gedaan, 8 juli): DSN in `.env` + `eas.json`, `metro.config.js` gewrapt met `withSentryConfig`, `organization`/`project` in de app.json-plugin, en `SENTRY_AUTH_TOKEN` als EAS-secret gezet (Organization Auth Token, via CMD). Bij de volgende build (stap 5) meteen controleren of een test-crash met leesbare stacktrace binnenkomt in Sentry.
5. Nieuwe EAS-build (native modules toegevoegd) en fysieke toesteltest. Belangrijkste punt: background tracking op iPhone met vergrendeld scherm. We gebruiken bewust geen "Altijd"-permissie; stopt de tracking op iOS in de achtergrond, dan moet `requestBackgroundPermissionsAsync` plus de Always-permissiestring terug (kleine ingreep, staat gedocumenteerd in `backgroundLocationService.ts`). Test ook: crash-herstel (app force-killen tijdens een run), notificaties, trial-weergave in de paywall, en de eerdere punten uit VERBETERPLAN-2026-07.md.
6. ~~Website opnieuw deployen~~ (gedaan, 8 juli: zip met correcte rechten geleverd, Lars heeft geupload en uitgepakt op Strato, live geverifieerd op lopentelopen.nl/privacy-policy.html en /voorwaarden.html, datum klopt en assets laden zonder 403). Opruimkandidaten die nog op de webspace staan (niet urgent): map "oud", .htaccess.uit, .htaccess.uit2, en de zip zelf mag na verificatie weg.
7. Screenshots herwerken met tekst-overlay volgens het screenshot-plan in STORE_LISTING.md.
8. Optioneel juridisch: voorwaarden.html laten toetsen voor publicatie.

## Bewust open gelaten (P2, na lancering)

Social proof op de paywall zodra er echte reviews zijn, gratis-vs-premium vergelijkingstabel, badge-overzichtsscherm met onbehaalde mijlpalen, "plan wordt samengesteld"-animatie na onboarding, ORS-API-key via edge function, prijsverhoging naar EUR 6,99 per maand pas overwegen met retentiedata, referral-programma en community-features pas bij een actieve gebruikersbasis.
