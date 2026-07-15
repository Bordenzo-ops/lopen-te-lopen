# iOS-testchecklist — Lopen te Lopen (juli 2026)

Gebaseerd op de volledige Android-emulatortest van 13 juli (zie [TESTRAPPORT-2026-07-13.md](TESTRAPPORT-2026-07-13.md)). Alle JS-fixes van die avond zitten automatisch in build 6. Loop deze lijst af op de iPhone; vink af wat goed is en noteer bij afwijkingen kort wat je zag (screenshot helpt).

## Vooraf

- [ ] Build geïnstalleerd: TestFlight build 6 (volledige test) óf development-client via `eas build -p ios --profile development` (voor testen met Metro op zelfde wifi)
- [ ] Wifi + mobiele data aan, locatievoorzieningen aan
- [ ] Bij TestFlight-test van aankopen: ingelogd met een **Sandbox Apple-ID** (Instellingen → App Store → Sandbox-account)

## 1. Koude start & onboarding (⚠️ build 5 crashte hier — extra belangrijk)

- [ ] App start koud zonder crash, AnimatedSplash (schoen) verschijnt en schakelt door
- [ ] Stap 1: Vrij trainen ↔ Wedstrijd-toggle werkt; doel kiezen activeert "Volgende"
- [ ] Stap 1 (Wedstrijd-modus): countdown-labels kloppen — race binnen 7 dagen toont "Deze week", nooit "0 weken"
- [ ] Stap 2: naam invullen, leeftijd-stepper; max. hartslag en zones rekenen live mee (220 − leeftijd)
- [ ] Stap 2: vierde trainingsdag aantikken wisselt de oudste selectie uit (er blijven er precies 3)
- [ ] Stap 3 (stemkeuze, nieuw in build 6): vrouw/man-toggle werkt; **tik op een stem speelt een voorbeeldzin af zonder crash** (dit was de build 5-crash: stemkeuze-fallback)
- [ ] "Start mijn schema" → dashboard toont naam, doel en week 1 van X

## 2. Dashboard & tabs

- [ ] Dashboard: begroeting, voortgangsringen, volgende sessie, premium-banner
- [ ] Schema-tab: weken kloppen met gekozen doel, week 1 uitgeklapt met jouw trainingsdagen
- [ ] Wedstrijd-tab: aankomende races bovenaan, sectie "Afgelopen" gedimd eronder; Dam tot Damloop staat onder **Amsterdam** (niet Rotterdam)
- [ ] Instellingen: profielwaarden kloppen; stemkeuze uit onboarding staat goed; thema licht/donker/systeem schakelt direct

## 3. Sessie starten & locatiepermissies (iOS-specifiek)

- [ ] "Start X km" → eerst de eigen uitleg ("Locatie voor je run"), daarna de iOS-systeemdialoog
- [ ] Kies "Sta één keer toe" of "Bij gebruik van app" → GPS-lock volgt buiten binnen ±30 s
- [ ] Duurt GPS langer dan 30 s → sessie start zonder GPS mét banner; **banner verdwijnt zodra er alsnog signaal is** (fix van 13-07)
- [ ] Routeplanner-sheet: route wordt berekend op echt netwerk (Lus + Heen-en-terug), óf toont binnen ±20 s de foutmelding "Route plannen lukt nu niet..." met "Opnieuw proberen" (fix van 13-07) — hangt nooit meer eindeloos
- [ ] Vliegtuigmodus-test routeplanner: foutmelding + "Start zonder route" werkt

## 4. Tijdens het lopen (loop een blokje om, 5-10 min)

- [ ] Afstand, tempo en voortgangsbalk lopen mee
- [ ] Stemcoaching is hoorbaar (kilometer-update / aanmoediging), ook met scherm vergrendeld
- [ ] Audio mengt netjes met muziek/podcast (duckt en herstelt)
- [ ] Scherm vergrendelen → tracking loopt door met vergrendeld scherm (achtergrond-GPS, iOS-specifiek!)
- [ ] Even stilstaan → auto-pauze activeert; doorlopen → hervat vanzelf
- [ ] Vergrendelknop (slotje) in de sessie werkt
- [ ] Stoppen → bevestigingsdialoog → samenvatting met kloppende cijfers en weekvoortgang

## 5. Na de sessie

- [ ] "Deel je run" → iOS share sheet met afbeelding
- [ ] "Exporteer als GPX" → bestand deelbaar (bijv. AirDrop/Bestanden)
- [ ] Dashboard bijgewerkt (km totaal, voortgang, streak)

## 6. Premium & integraties

- [ ] Paywall: prijzen en abonnementen zichtbaar (RevenueCat `appl_`-key; geen BILLING-fouten zoals op de Android-emulator)
- [ ] Sandbox-aankoop maandelijks → premium ontgrendelt (onbeperkt routes, premium-stemmen)
- [ ] "Aankopen herstellen" werkt na herinstallatie
- [ ] Strava koppelen: OAuth-flow opent en keert netjes terug in de app (strava-callback)
- [ ] Trainingsherinneringen aanzetten → iOS-meldingspermissie verschijnt éénmalig
- [ ] Let op: Apple Health/HealthKit hoort er in deze versie **niet** in te zitten (volgt later; instelling verwijst naar Health Connect = Android-only). Check dat er geen kapotte Health-optie zichtbaar is op iOS.

## 7. Stabiliteit

- [ ] App naar achtergrond en terug tijdens sessie → geen dataverlies
- [ ] App geforceerd afsluiten en heropenen → profiel en historie bewaard
- [ ] Sentry: geen nieuwe crashes in het dashboard na de testronde

---

*Resultaten graag kort per nummer terugkoppelen (bijv. "4: stemcoaching stopte na vergrendelen"), dan documenteer ik ze en zet ik fixes uit zoals bij de Android-ronde.*
