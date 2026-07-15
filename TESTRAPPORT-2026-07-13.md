# Testrapport — volledige emulatortest Android (13 juli 2026, avond)

Uitgevoerd door Claude na de eerste succesvolle lokale build (`npx expo run:android`, debug, emulator Medium_Phone). Alle schermen zijn handmatig doorlopen via adb met screenshots; bevindingen zijn direct gefixt door subagents (zie "Uitgevoerde fixes").

## Wat is getest en werkt goed

| Onderdeel | Resultaat |
|---|---|
| Onboarding stap 1 (doelkeuze) | ✅ Vrij trainen ↔ Wedstrijd-toggle, doelselectie, beschrijving verschijnt, knop activeert correct |
| Onboarding stap 2 (profiel) | ✅ Naam (tekenteller), leeftijd-stepper, max. hartslag live herberekend (220 − leeftijd), zones kloppen |
| Trainingsdagen-limiet | ✅ Slimme FIFO: vierde dag aantikken wisselt de oudste selectie uit, precies 3 blijven actief |
| Onboarding stap 3 (stemkeuze) | ✅ Vrouw/man-toggle werkt, TTS wordt gekoppeld (logcat: "Successfully bound to com.google.android.tts") |
| Dashboard | ✅ Begroeting met naam, week 1/8, voortgangsringen, volgende sessie (wo · 3 km · Z2), premium-banner |
| Schema-tab | ✅ 8 weken, week 1 uitgeklapt met gekozen dagen (Wo/Do/Za), zonelegenda, km-totalen consistent met dashboard |
| Wedstrijd-tab | ✅ Ultiem doel (NN Marathon Rotterdam 2027) met kloppende countdown; provincie/stad-groepering |
| Instellingen | ✅ Profiel exact zoals ingevuld, hartslagzones, thema, gesproken begeleiding, auto-pauze, stemkeuze uit onboarding correct doorgezet, Strava/Health Connect/Cloudsync aanwezig |
| Sessie-start | ✅ Nette pre-permission uitleg → systeemdialoog (Precise voorgeselecteerd) → GPS-zoekscherm met 30s-fallback "Nu starten zonder GPS" |
| Routeplanner (premium, 3 gratis/week) | ✅ Sheet opent, quotatekst klopt, routetypes Lus/Heen-en-terug |
| AnimatedSplash (nieuw, ongecommit) | ✅ Wordt correct getoond bij koude start |

## Gevonden problemen → gefixt

1. **Routeplanner hangt eindeloos op "Route berekenen..."** (4+ min, geen time-out, geen foutmelding). Oorzaak: `fetch` naar OpenRouteService in `src/services/routeService.ts` had geen time-out; de bestaande fout-UI (met "Opnieuw proberen") werd daardoor nooit getriggerd.
   → **Gefixt:** 20s-time-out via AbortController; bij time-out/netwerkfout nu de melding *"Route plannen lukt nu niet. Controleer je verbinding of start zonder route."* "Start met route" was al correct disabled zonder route.
2. **Dam tot Damloop (editie 2025) stond onder Rotterdam** met locatie "Rotterdam Centrum", terwijl de loop Amsterdam → Zaandam is (de 2026-editie stond wél goed onder Amsterdam).
   → **Gefixt:** verplaatst naar Amsterdam (Noord-Holland), locatie "Amsterdam → Zaandam" (`src/data/rotterdamRaces.ts`).
3. **Afgelopen races stonden tussen "aankomende" wedstrijden**: onder "Rotterdam · 3 aankomende wedstrijden" verschenen 5 afgelopen edities (2025/voorjaar 2026) bovenaan de lijst.
   → **Gefixt:** lijst per stad gesplitst — aankomende races eerst, afgelopen races eronder onder een aparte kop "Afgelopen" (`src/components/ui/RacePickerScreen.tsx`). Geen data verwijderd.
4. **"0 Weken Te Gaan"** bij een race binnen 7 dagen (Scheveningen Strandloop, 19 juli) leest raar.
   → **Gefixt:** nieuwe helper `weeksUntilLabel()` toont nu "Deze week" (<1 week), "1 week te gaan" (enkelvoud) of "X weken te gaan"; toegepast in RacePickerScreen, onboarding-goal en schedule.
5. **Onboarding-copy "wedstrijd in Rotterdam"** dekte de lading niet (lijst bevat ook Scheveningen, Amsterdam enz.).
   → **Gefixt:** subtitel is nu "Kies een vrij trainingsschema of train gericht op een wedstrijd."

`npx tsc --noEmit` draait schoon na alle fixes. De fixes zijn **niet gecommit** — beoordeel de diff (`git diff`) en commit zelf.

## Testomgeving-problemen (geen app-bugs)

- **Emulator crashte twee keer** tijdens de test ("DeadSystemException: the system died" — het hele Android-gastsysteem, niet de app). Oorzaak: de AVD had maar **2 GB RAM** (`hw.ramSize=2048`), te krap voor deze app + Google Maps + Play Services.
  → **Gefixt op jouw machine:** `hw.ramSize` verhoogd naar **4096** in `C:\Users\Lars\.android\avd\Medium_Phone.avd\config.ini`.
- Na een crash bleef de emulator hangen op een onzichtbare **crash-consent dialoog** bij de volgende start; crashdata en lockbestanden opgeruimd.
- Let op: na een emulator-herstart is `adb reverse tcp:8081 tcp:8081` nodig zodat de dev-build Metro kan bereiken (of kies de dev-server op het 192.168.x.x-adres in de dev-launcher).

## Sessietest (na emulator-herstel met 4 GB) — geslaagd

- **Start zonder GPS-fallback**: na 30 s zonder signaal start de sessie met duidelijke banner — werkt.
- **GPS-tracking**: met gesimuleerde beweging loopt de afstand correct op (0,50 km geregistreerd), tempo wordt live berekend, voortgangsbalk beweegt.
- **Auto-pauze**: activeert bij stilstand (banner + timer stopt) en distance blijft kloppen. Let op: in de emulator "flappert" auto-pauze omdat gesimuleerde GPS-fixes geen snelheidsveld hebben — op een echt toestel niet aan de orde, maar test het daar ter bevestiging.
- **Zwak-GPS-detectie**: banner "Zwak GPS-signaal. Je afstand kan even achterlopen." verschijnt correct als het signaal wegvalt.
- **Stoppen**: bevestigingsdialoog ("Sessie afsluiten") → samenvatting "Sessie voltooid" met kloppende cijfers (0,50 km, 2m35s, 5:10/km, Z2), eerste-training-mijlpaal, weekvoortgang 1/3, "Deel je run" en "Exporteer als GPX" aanwezig.
- **Paywall**: rendert volledig (jaarlijks €49 met "Bespaar 32%", maandelijks €5,99, aankopen herstellen, voorwaarden). RevenueCat geeft op de emulator `BILLING_UNAVAILABLE` (geen Google-billing) — dat is een testomgevingsbeperking, geen bug; alleen zichtbaar als dev-toast.

### Extra bug gevonden én gefixt tijdens de sessietest

6. **"Geen GPS-signaal. Afstand wordt niet bijgehouden." bleef staan terwijl de afstand wél opliep.** Bij "start zonder GPS" werd `gpsError` gezet maar nooit gewist zodra er alsnog locatie-updates binnenkwamen (`app/session/active.tsx`).
   → **Gefixt:** de melding wordt nu gewist zodra een geldig GPS-punt geaccepteerd wordt; de aparte "Zwak GPS-signaal"-detectie blijft werken. Live geverifieerd in de emulator: banner verdwijnt, indicator wordt groen.

## Nog niet getest / aandachtspunten

- Routeplanner-time-out is code-matig gefixt, maar een geslaagde routeberekening kon in de emulator niet worden bevestigd (de ORS-API antwoordde niet in de testomgeving) — test op je fysieke toestel.
- Niet getest: "Deel je run", GPX-export, Strava-koppeling (OAuth), meldingen-toggle, licht thema, stemcoaching hoorbaar tijdens het lopen (TTS werd wel succesvol gekoppeld), scherm `session/complete.tsx`.
- Wedstrijd-data: alleen Dam tot Damloop is gecorrigeerd; loop de overige races na op locatie/datum.
- RevenueCat op emulator: `BILLING_UNAVAILABLE` is normaal; echte aankooptest vereist een fysiek toestel met Play-account (of RevenueCat sandbox).

## Verificatie van de fixes

Alle fixes zijn na implementatie live geverifieerd in de draaiende app (hot reload): de Wedstrijd-tab toont nu eerst de aankomende races met daaronder een gedimde sectie "Afgelopen", de Dam tot Damloop staat onder Amsterdam (Zuid-Holland telt nu 17 races), en de GPS-banner verdwijnt zodra er signaal is. `npx tsc --noEmit`: exit 0.
