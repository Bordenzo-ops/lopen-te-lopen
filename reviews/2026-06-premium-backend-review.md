# Review: premium en backend, plus eindpolish (juni 2026)

Datum: 16 juni 2026
Branch: feature/premium-backend
Rol: QA en polish, afronding van de v1-ervaring nu premium en backend erbij zijn gekomen.

## Status: GROEN

De premium- en backend-ronde is functioneel compleet en consistent met de rest van de app. TypeScript compileert met alleen de vier verwachte "Cannot find module"-fouten voor de drie nog niet geinstalleerde pakketten. Alle gebruikerszichtbare copy is Nederlands en bevat geen gedachtestreepje. De enige openstaande zaken zijn handmatige stappen voor Lars (backend en monetisatie aanzetten) en een fysieke toesttest, die niet vanuit deze omgeving te doen zijn.

---

## Wat er in deze ronde is gebouwd

Drie eerdere fases op deze branch, daarna deze polish-ronde.

### Backend (Supabase)
- Centrale client (src/services/supabaseClient.ts), offline-first: zonder sleutels of netwerk wordt er geen client aangemaakt en blijft alles lokaal werken.
- Auth (src/services/authService.ts): stille anonieme sessie, optioneel een e-mailaccount koppelen zodat data herstelbaar is op een nieuw toestel. Alle functies vangen hun eigen fouten af en gooien nooit.
- Sync (src/services/syncService.ts): best-effort push van profiel en voltooide sessies naar de cloud, idempotent via een stabiele client-run-id. Lokaal blijft de bron van waarheid.
- Datamodel in supabase/migrations/ (profiles, runs).

### Monetisatie (RevenueCat)
- Aankoopservice (src/services/purchaseService.ts) rond react-native-purchases, offline-first: zonder sleutel of bij een fout valt alles stil terug op "geen premium".
- Entitlement "premium", offering "default", aankopen en herstel, koppeling van de RevenueCat-appUserID aan de Supabase-user-id.
- Paywall-scherm (app/paywall.tsx): twee abonnementsopties met echte prijzen uit de offering en vaste fallbackteksten (EUR 5,99 per maand, EUR 49 per jaar), knoppen om te kopen, te herstellen en te sluiten. Nette toegankelijkheidslabels en touch targets.

### Premium-gating
- Centrale config (src/config/premiumConfig.ts) met alle limieten op een plek en een schakelaar PAYWALL_ACTIVE (nu false: testfase, iedereen heeft toegang).
- Hook usePremium (src/hooks/usePremium.ts): status, navigatie naar de paywall en een nette upgrade-prompt.
- Gating toegepast op: routeplanner (gratis 3 routes per week, zie active.tsx), wedstrijdkeuze (gratis de halve marathon, premium alle afstanden, zie RacePickerScreen.tsx) en premium-stemmen (voiceService.ts, met hint in voice.tsx en settings.tsx).
- Offline-first ontwerp: een onbekende premium-status telt altijd als gratis, nooit per ongeluk premium weggeven, nooit crashen.

### Polish in deze ronde (zie onder)
Consistentiecontrole van alle nieuwe bestanden, fix van het onboarding-randgeval, en documentatie van de store-gevolgen van de native modules.

---

## Polish-bevindingen en fixes

### 1. Gedachtestreepje in commentaar van nieuwe bestanden: GEFIXT
In de nieuwe en gewijzigde premium-bestanden stond het teken "—" nog in code-commentaar (geen gebruikerszichtbare copy). Vervangen door dubbele punt of komma in: src/config/premiumConfig.ts (twee plekken, plus een pijl-teken in de setup-uitleg), src/store/appStore.ts (drie plekken), src/components/ui/RacePickerScreen.tsx (twee plekken) en app/session/active.tsx (drie plekken). Geen enkele gebruikerszichtbare string bevatte het teken, dat was in eerdere rondes al opgeschoond.

Restpunt (niet aangeraakt, buiten scope): in oudere bestanden staat "—" nog in commentaar (tokens.ts, rotterdamRaces.ts, trainingPlans.ts, useShareRun.ts, LiveRouteMap.tsx, ShareRunSheet.tsx). Dit is uitsluitend commentaar, nooit copy. Bewust niet gewijzigd om geen ongerelateerde bestanden te raken.

### 2. Onboarding-wedstrijdkeuze niet gegate: GEFIXT met bewuste keuze
Bevinding van de gating-agent bevestigd: de onboarding (app/(onboarding)/voice.tsx) bouwt een raceplan uit een raceId die in app/(onboarding)/goal.tsx wordt gekozen, en goal.tsx toonde alle aankomende wedstrijden van elke afstand zonder gating. Een gratis gebruiker kon zo in de onboarding een premium-wedstrijd (bijvoorbeeld een marathon) kiezen die in het hoofdscherm wel vergrendeld zou zijn.

Gekozen oplossing (de minst verwarrende): de keuze in de onboarding wordt bewust toegestaan, maar eerlijk gelabeld. Een nieuwe gebruiker mag bij de allereerste stap nooit geblokkeerd worden en moet altijd direct een werkend schema krijgen, in lijn met het uitgangspunt dat de gratis laag volledig bruikbaar blijft. Tegelijk is het nu consistent en geen verrassing:
- In goal.tsx krijgen wedstrijden van een premium-afstand dezelfde PremiumBadge als in het hoofdscherm.
- Er staat een korte, eerlijke noot boven de lijst: de halve marathon blijft altijd gratis, voor andere afstanden vraagt de app later om premium.
- Dit gebruikt dezelfde hasAccess- en isRaceDistanceFree-logica als de rest van de app. Zolang PAYWALL_ACTIVE op false staat verschijnt er niets (hasAccess is dan true), precies zoals overal elders.

Zo blokkeert de onboarding nooit, terwijl de premium-grens wel zichtbaar en consistent is zodra de betaalmuur live gaat.

### 3. Consistentie nieuwe code: gecontroleerd, in orde
- Nederlandse copy: alle gebruikerszichtbare strings in de nieuwe bestanden zijn Nederlands. Geen Engelse placeholder-copy aangetroffen (alleen code-identifiers zoals style: 'cancel' en de loading-prop, dat is geen copy).
- Toegankelijkheid: de nieuwe interactieve elementen hebben accessibilityRole en accessibilityLabel net als de rest van de app. Gecontroleerd: paywall-sluitknop, de twee abonnementskaarten (PlanCard, met accessibilityState voor disabled en busy), de upgrade-tik bij de premium-stemmen (voice.tsx en settings.tsx) en de vergrendelde wedstrijden (RacePickerScreen.tsx, met Lock-icoon en PremiumBadge).
- Touch targets: de sluitknop is 40pt met hitSlop 12 (effectief ruim 44pt), de abonnementskaarten en de stemknoppen zitten ruim boven 44pt. Geen knoppen onder de norm aangetroffen in de nieuwe schermen.
- Tokens: de nieuwe code gebruikt de bestaande tokens uit src/theme/tokens.ts. De enige bewuste uitzondering is de gouden accentkleur (#F59E0B) voor de premium-kroon en -badge, consistent toegepast in PremiumBadge.tsx en paywall.tsx. Dit is een opzettelijke merk-accent voor premium en bestaat niet als token; aanvaardbaar voor v1.

### 4. Openstaande UX-review-punten: beoordeeld
De openstaande punten uit 2026-06-ux-review.md waren allemaal handmatige toesttaken (lopen op een telefoon, schermlezer-test, visuele contrastbeoordeling). Die vergen een fysiek toestel en zijn niet vanuit deze omgeving op te lossen. Geen echte codefout aangetroffen die hier nog open stond, dus deze schermen zijn niet aangeraakt. De punten blijven open voor Lars.

### 5. Store-gevolgen van de native modules: gedocumenteerd
In docs/REVENUECAT_SETUP.md is een sectie toegevoegd over de Android-build en Play Console:
- react-native-purchases voegt de permissie com.android.vending.BILLING automatisch toe aan de samengevoegde manifest; die hoeft dus niet handmatig in app.json.
- In-app betalingen vragen geen losse runtime-permissie, dus er hoeft hiervoor niets extra in de Data safety-vragenlijst.
- Wel nodig in de Play Console: betaalprofiel, de twee abonnementsproducten en een gepubliceerde build in een testtrack.
- Zowel RevenueCat als de Supabase-auth-opslag zijn native modules en vereisen een nieuwe EAS dev build.

Geen nieuwe Play Console-acties verzonnen die al gedaan zijn: targetSdkVersion 36 is al afgerond (zie health check), de datasafety-aanpassing voor de routeplanner stond al open in de security review.

---

## Eindverificatie

### TypeScript (npx tsc --noEmit, met cache-bust)
Alleen de vier verwachte fouten, exact:

```
src/services/authService.ts(21,36): error TS2307: Cannot find module '@supabase/supabase-js' or its corresponding type declarations.
src/services/purchaseService.ts(26,8): error TS2307: Cannot find module 'react-native-purchases' or its corresponding type declarations.
src/services/supabaseClient.ts(19,8): error TS2882: Cannot find module or type declarations for side-effect import of 'react-native-url-polyfill/auto'.
src/services/supabaseClient.ts(21,51): error TS2307: Cannot find module '@supabase/supabase-js' or its corresponding type declarations.
```

Deze verdwijnen zodra de drie pakketten zijn geinstalleerd (@supabase/supabase-js, react-native-url-polyfill, react-native-purchases). Geen enkele andere fout.

### Gedachtestreepje en Engelse copy
- Geen "—" in enige gebruikerszichtbare string in src/ of app/ (gecontroleerd op quoted strings: nul treffers). De resterende voorkomens staan uitsluitend in code-commentaar van oudere, niet-aangeraakte bestanden.
- Geen Engelse placeholder-copy in de nieuwe bestanden.

---

## Wat Lars zelf nog moet doen (volledige checklist)

### Backend aanzetten (Supabase)
1. Supabase-project aanmaken.
2. EXPO_PUBLIC_SUPABASE_URL en EXPO_PUBLIC_SUPABASE_ANON_KEY invullen in .env (zie .env.example).
3. In Supabase onder Authentication, Providers: Anonymous sign-ins aanzetten.
4. De twee migraties draaien: supabase/migrations/0001_profiles.sql en 0002_runs.sql.
   Details staan in docs/SUPABASE_SETUP.md.

### Monetisatie aanzetten (RevenueCat)
5. RevenueCat-account en een project van het type Google Play Store aanmaken.
6. In de Play Console twee abonnementsproducten aanmaken (maandelijks EUR 5,99, jaarlijks EUR 49) en activeren.
7. In RevenueCat de producten koppelen, een entitlement met exact de naam "premium" maken en een offering met een Monthly- en Annual-package als current zetten.
8. De Google Play public SDK key (goog_...) invullen in EXPO_PUBLIC_REVENUECAT_API_KEY in .env. Nooit de secret key.
   Details staan in docs/REVENUECAT_SETUP.md.

### Build en activatie
9. De drie pakketten installeren: npx expo install @supabase/supabase-js react-native-url-polyfill react-native-purchases.
10. Een nieuwe EAS dev build maken (de native modules werken niet in Expo Go): eas build --profile development --platform android.
11. Metro herstarten met npx expo start zodat de nieuwe .env-waarden geladen worden.
12. Pas na het testen van echte aankopen: PAYWALL_ACTIVE in src/config/premiumConfig.ts op true zetten om de betaalmuur te activeren.

### Nog open uit eerdere reviews (niet vanuit code op te lossen)
13. Datasafety-formulieren in de Play Console aanpassen op de routeplanner (locatiedata naar openrouteservice.org), zie security review.
14. De handmatige UX-toetsen op een toestel: onboarding-flows, run met en zonder GPS, zone-uitleg tijdens een run, en een schermlezer-test (TalkBack of VoiceOver).

---

## Aanbevolen testscenario's (op de nieuwe dev build)

1. Zonder sleutels: app start, geen login, geen premium, alles werkt lokaal. Geen crash, geen blokkade.
2. Met Supabase-sleutels: app start een anonieme sessie, voltooi een sessie en controleer in Supabase dat profiel en run verschijnen (tabellen profiles en runs).
3. E-mailaccount koppelen, daarna opnieuw installeren en inloggen: data komt terug.
4. Met RevenueCat-sleutel en PAYWALL_ACTIVE nog op false: alle premium features zijn vrij te gebruiken, de PremiumBadge toont "Nu gratis".
5. PAYWALL_ACTIVE op true: gratis gebruiker ziet de halve marathon vrij, andere wedstrijdafstanden vergrendeld met PremiumBadge en een prompt naar de paywall. Routeplanner stopt na 3 routes per week met een nette prompt. Premium-stemmen vragen om upgrade.
6. Testaankoop met een licentietester: premium wordt actief, vergrendelingen verdwijnen, de PremiumBadge toont "Premium".
7. Aankopen herstellen op een schoon toestel of na opnieuw installeren.
8. Onboarding als gratis gebruiker met PAYWALL_ACTIVE op true: controleer dat een premium-wedstrijd te kiezen is, dat de noot en de badge verschijnen, en dat het schema gewoon gebouwd wordt zonder blokkade.

---

## Eerlijk over wat niet geverifieerd kon worden

- Geen runtime: de app is niet op een toestel of in een simulator gedraaid. De verificatie beperkt zich tot statische analyse en TypeScript.
- De native modules zijn niet geinstalleerd (npm-registry geblokkeerd), dus de echte Supabase- en RevenueCat-koppeling, anonieme sessies, aankopen en herstel zijn niet live getest. De code is offline-first en defensief opgezet, maar het daadwerkelijke gedrag met echte sleutels moet Lars op de dev build bevestigen.
- Toegankelijkheid is op code-niveau gecontroleerd (labels, rollen, states, touch targets), niet met een echte schermlezer.
- De prijsweergave uit de RevenueCat-offering en de Play Billing-flow zijn niet te testen zonder een gepubliceerde build en een betaalprofiel.
