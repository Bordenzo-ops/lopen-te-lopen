# Concurrentie- en featureanalyse — Lopen te Lopen (juli 2026)

## 1. Samenvatting

Lopen te Lopen heeft al een solide, privacy-vriendelijke basis: GPS-tracking met auto-pauze en crash-herstel, stemcoaching, wedstrijdschema's met doeltijd-tempo's, een routeplanner, Strava/Health Connect-koppeling, lokale mijlpalen/PR's, een weekstreak, en periode-overzichten (week/maand/kwartaal/jaar) met deelbare kaarten. Dat is méér dan veel concurrenten in de kern-trackingervaring bieden. De grootste gaten liggen elders: (1) geen intervaltrainingen met segmenten/rustperiodes — alleen één vast tempo per sessie; (2) een schema dat na een gemiste training niet echt herplant, alleen "overslaat"; (3) geen enkele vorm van trainingsbelasting/herstel-inzicht (Strava's Fitness & Freshness, Garmin's Training Status); (4) geen wekelijkse coach-samenvatting die motiveert tussen sessies door; (5) opvallend: `react-native-reanimated` staat al in `package.json` maar wordt nergens gebruikt — de app heeft dus nul micro-animaties, terwijl de tooling er al ligt. Dat laatste is de goedkoopste winst van dit hele rapport.

## 2. Per concurrent: wat doen ze goed dat wij missen

### Runna
- **Adaptieve schema's die echt herplannen** na een gemiste training of gevoel-feedback, in plaats van alleen "overslaan en doorgaan". Wij markeren een sessie als overgeslagen (`skipSession` in `dashboard.tsx`) maar het schema zelf blijft statisch.
- **Post-workout feedback-lus**: na elke training vraagt Runna hoe de sessie voelde, en dat stuurt de volgende sessies bij.
- **Gestructureerde intervaltrainingen** met per-rep pace-doelen en audio-cues bij elke herhaling/rust. Wij hebben alleen easy/tempo/long met één doeltempo voor de hele sessie (`src/data/paceModel.ts` — `PACE_FACTORS`), geen segmentstructuur.
- **Weersafhankelijke aanpassing** van sessies — te geavanceerd/laag prioriteit voor onze doelgroep, niet aan te raden als eerste stap.

### Strava
- **Fitness & Freshness** (trainingsbelasting/herstel, vergelijkbaar met CTL/ATL/TSB): geeft gevorderde lopers inzicht in opbouw vs. herstel. Wij hebben geen enkel trainingsbelasting-concept.
- **Year in Sport**: een verhalende, swipeable jaaroverzicht-ervaring. Wij hebben al een jaar-periode in `logbook.tsx`/`periodStats.ts` met deel-kaart, maar geen "wrapped"-achtige, verhalende beleving — dat is een uitbreiding, geen nieuwe feature.
- **Pace zones die automatisch meebewegen** met een performance-predictie (5K-voorspelling). Wij hebben vaste hartslagzones (`zoneInfo` in `trainingPlans.ts`) die nooit meebewegen met vooruitgang.

### Nike Run Club
- **Weekstreak-kalibratie** (niet dagelijks): dit hebben wij al goed (`computeWeekStreak` in `achievements.ts`) — geen actie nodig, wel vermeldenswaardig dat we hier al best practice volgen.
- **Grote bibliotheek audio-guided runs** met coaches/bekende stemmen: te productie-zwaar voor ons, niet aan te raden.
- **Bredere badge-variatie** (nieuwjaarsrun, vroege-vogel-run, streak-lengtes): onze mijlpalenlijst (`computeMilestones`) is functioneel maar smal (10 vaste mijlpalen, allemaal afstand/aantal-gebaseerd). Geen "soort" variatie.

### Adidas Running
- **Schoenentracker** (kilometers per paar schoenen, vervangingsalarm rond 600-800 km): ontbreekt volledig bij ons en is functioneel, geen social-feature — past bij onze coachende, niet-sociale positionering.
- **Community/Live Cheers**: sociale features, passen niet bij onze privacy-first, solo-coachende toon. Bewust overslaan.

### Garmin Coach
- **Dag-tot-dag aanpassing op basis van herstel/trainingsstatus**: vereist wearable-sensordata (HRV, slaap) die wij niet hebben; te groot en buiten scope zonder wearable-integratie.
- **Periodisering (opbouw/piek/taper)**: onze wedstrijdschema's (`rotterdamRaces.ts`/`buildRacePlan.ts`) bouwen al impliciet op naar de wedstrijd — geen directe actie, wel een kans om dit explicieter te tonen in het schema-scherm.

### Coopah
- **Race Day Confidence Score**: een score die aangeeft hoe waarschijnlijk het is dat de gebruiker zijn doeltijd haalt, gebaseerd op afgeronde vs. geplande trainingen. Sterke motivator, en met onze bestaande data (completedSessions vs. racePlan) grotendeels te bouwen zonder externe diensten.
- **Wekelijk coach-rapport**: vat de week samen (km, sessies, type) met een korte coach-duiding. Wij hebben periode-stats (`periodStats.ts`) maar geen proactieve, tekstuele duiding of pushmelding hierover.

## 3. Prioriteitenlijst

### Quick wins (< 1 dag)

1. **Progress-ring en stat-cijfers animeren.** `react-native-reanimated` staat al in `package.json` (v4.3.1) maar wordt nergens gebruikt — `src/components/ui/StatRing.tsx` rendert de voortgangscirkel nu instant, zonder fill-animatie of count-up. Waarom: Strava/Runna laten stat-cards en ringen altijd invullen/optellen bij het laden; dit is de goedkoopste, meest zichtbare polish-stap. Waar: `src/components/ui/StatRing.tsx` (animate `strokeDashoffset` met `withTiming`), gebruikt in `app/(tabs)/dashboard.tsx`.
2. **Schoenentracker (basis).** Een optioneel schoen-veld per run (naam) plus cumulatieve km per schoen, met een zachte melding rond 600-800 km. Waarom: bewezen bij Adidas Running/Strava, functioneel en injuriepreventief, past bij onze coachende toon, geen social nodig. Waar: nieuw veld in `CompletedSession` (store/appStore.ts), UI-onderdeel in `app/(tabs)/settings.tsx` of `logbook.tsx`.
3. **Bredere mijlpaal-variatie.** Voeg 3-4 nieuwe mijlpaal-types toe naast de bestaande afstand/aantal-mijlpalen: bijv. "vroege vogel" (training voor 7u), "weekend-warrior", "alle 3 trainingsdagen deze week gehaald". Waarom: Nike Run Club bewijst dat variatie in badge-*soort* (niet alleen afstand) motivatie verlengt. Waar: `src/data/achievements.ts` (`computeMilestones`), tonen op `app/(tabs)/dashboard.tsx`.
4. **Checkmark/voltooiing micro-animatie op het samenvattingsscherm.** Het statische `CheckCircle2`-icoon in `app/session/summary.tsx` (hero-sectie) kan een zachte scale-in + fade doen bij het laden, en de PR/mijlpaal-banners kunnen inschuiven in plaats van direct te verschijnen. Waarom: elke concurrent laat het "trotsmoment" net iets langer landen via animatie; wij tonen het nu instant en plat. Waar: `app/session/summary.tsx`.
5. **Explicietere periodisering in het schema-scherm.** Toon bij wedstrijdschema's een korte label per weekfase (opbouw/piek/taper) naast het al bestaande "week X van Y". Waarom: Garmin Coach bewijst de waarde van zichtbare periodisering; onze data bevat dit al impliciet in `buildRacePlan.ts`, dus dit is puur presentatie. Waar: `app/(tabs)/schedule.tsx`, `src/data/buildRacePlan.ts`.

### Middelgroot (1-3 dagen)

6. **Wekelijk coach-rapport.** Een korte, gegenereerde (niet-AI, regelgebaseerde) tekst na elke afgeronde week: km vs. schema, aantal sessies, en één duidingszin ("Je liep deze week 2 km meer dan gepland, mooi opgebouwd richting je lange duurloop"). Waarom: bewezen retentie-hefboom bij Coopah; onze data (`completedSessions`, `activePlan`) is er al, dit is vooral nieuwe presentatie- en tekstlogica. Waar: nieuw component, getriggerd vanuit `app/(tabs)/dashboard.tsx` of als pushmelding via `src/services/notificationService.ts` (bestaande streak-notificatie-infrastructuur hergebruiken).
7. **Post-workout feel-check.** Eén simpele vraag na elke sessie op `app/session/summary.tsx` ("Hoe voelde deze training? 😓 😐 💪"), lokaal opgeslagen bij de `CompletedSession`. Nog geen volledige adaptieve schema-motor nodig — begin met alleen dataverzameling en een simpele regel ("3x zwaar gevoeld op rij? Stel een rustweek voor"). Waarom: bewijst de waarde van Runna's feedback-lus zonder de volledige complexiteit. Waar: `app/session/summary.tsx`, `src/store/appStore.ts` (uitbreiden `CompletedSession`).
8. **Race Day Confidence-indicatie.** Een eenvoudige, lokaal berekende indicator op het schema- of dashboardscherm die trainingsvoortgang (voltooid vs. gepland, gemiddeld tempo vs. doeltempo) samenvat in een kwalitatief label ("op schema", "iets achter", "vooruit") — geen kansberekening pretenderen, wel de motiverende functie van Coopah's score namaken zonder overclaimen. Waar: nieuwe berekening in `src/data/achievements.ts` of nieuw bestand, tonen in `app/(tabs)/dashboard.tsx` naast de bestaande voortgangsringen.
9. **Zachte "schema herplannen" bij een gemiste training.** In plaats van alleen `skipSession`, bied een keuze: "Wil ik deze training later deze week inhalen, of ga ik door?" Bij "inhalen" verschuift alleen de eerstvolgende rustdag. Waarom: dit is de meest gevraagde Runna-feature (adaptief schema) in een light-versie die past bij onze vaste 3-dagen-structuur. Waar: `app/(tabs)/dashboard.tsx` (`handleSkip`), `src/store/appStore.ts` (`skipSession`), evt. `src/data/trainingPlans.ts` (`remapWeekDays`).
10. **Jaaroverzicht als verhalende "wrapped"-ervaring.** Bouw voort op de bestaande `SharePeriodSheet`/`periodStats.ts` (jaar-periode bestaat al) met een swipeable multi-kaart weergave (totaal km, langste run, beste maand, aantal trainingen) in plaats van één statische deelkaart. Waarom: Strava's Year in Sport is dé jaarlijkse re-engagement-hefboom; wij hebben de databasis al, dit is presentatie-werk. Waar: `src/components/ui/SharePeriodSheet.tsx`, `src/utils/periodStats.ts`.

### Groot (> 3 dagen)

11. **Structurele intervaltrainingen.** Nieuw sessietype met segmenten (warming-up, N× herhaling met pace-doel, rust, cooling-down), live segment-timer en aparte audio-cues per segmentovergang op `app/session/active.tsx`. Waarom: dit is de belangrijkste inhoudelijke feature-kloof met Runna/Garmin/Coopah — alles wat wij nu bieden is "duurloop met tempo-hint", geen structuur voor snelheidswerk. Waar: `src/data/trainingPlans.ts` (nieuw `Session`-subtype), `app/session/active.tsx` (segmentlogica naast de bestaande km-tracking), `src/hooks/useVoiceGuidance.ts` (segment-cues).
12. **Eenvoudige trainingsbelasting-indicator.** Een lokale, rolling-window-berekening (bijv. 4-weeks-gemiddelde km vs. laatste week, "acute:chronic"-achtige ratio) zonder VO2max-schatting erbij te halen — dat laatste vereist betrouwbare hartslagdata die de meeste van onze gebruikers niet consistent leveren (telefoon-GPS, geen band/horloge gegarandeerd). Waarom: bewijst de kernwaarde van Strava's Fitness & Freshness op een manier die met alleen afstand/tijd werkt, dus haalbaar zonder wearable-afhankelijkheid. Waar: nieuw bestand `src/data/trainingLoad.ts`, tonen op `app/(tabs)/dashboard.tsx` of `app/(tabs)/logbook.tsx`.
13. **Volledig adaptieve schema-motor.** De uitbreiding van punt 9: een schema dat structureel herberekent (niet alleen de eerstvolgende sessie verschuift, maar het hele resterende schema herverdeelt) op basis van voltooide/overgeslagen sessies en de feel-check-data uit punt 7. Waarom: dit is Runna's kernbelofte; groot omdat het de trainingsplan-generatielogica (`trainingPlans.ts`, `buildRacePlan.ts`) fundamenteel raakt en zorgvuldig getest moet worden om nooit een onveilig schema te genereren voor een beginner. Waar: `src/data/trainingPlans.ts`, `src/data/buildRacePlan.ts`, `src/store/appStore.ts`.

## 4. Motion & animatie-benchmarks

Concreet, passend bij onze rustige/coachende toon (geen confetti, geen schreeuwerige overlays):

| Patroon | Bron | Waar het bij ons zou passen |
|---|---|---|
| **Ring-fill animatie**: voortgangscirkel vult geleidelijk (300-600ms, ease-out) in plaats van instant te renderen | Strava (stat-cards "pulsen" bij laden) | `StatRing.tsx` — de 3 dashboardringen (schema/week/totaal) en de zone-indicator op `session/active.tsx` |
| **Count-up cijfers**: een stat-waarde telt op van 0 naar het eindgetal in ~500ms | Algemeen patroon bij Strava/Runna stat-schermen | `session/summary.tsx` grote km-cijfer, `logbook.tsx` periode-stats |
| **Zachte glow/pulse op net-behaalde achievement** (géén confetti — één subtiele highlight-puls in merkkleur, 1-2 herhalingen) | Strava ("achievements glow met dezelfde oranje als het logo") | `dashboard.tsx` mijlpalenkaart bij een nieuw behaalde mijlpaal, PR-banner op `session/summary.tsx` |
| **Route-lijn "morph"/teken-animatie**: de kaartroute tekent zich lijn-voor-lijn in plaats van in één keer te verschijnen | Strava ("save activity morph path animation") | `LiveRouteMap.tsx` bij het tonen van de geplande route, en de gelopen route op het samenvattingsscherm (indien die ooit een kaart krijgt) |
| **Kalme, ongehaaste onboarding-overgangen** (geen bounce/spring-overkill, gewoon nette fade/slide, 250-350ms) | Runna (bewust "unhurried pacing", geen flashiness) | `app/(onboarding)/*` — met name `goal.tsx`, dat al recent is aangepast |
| **Story-achtige swipeable kaarten** voor een periode-overzicht, met een korte reveal-animatie per kaart bij swipen | Strava Year in Sport | Uitbreiding van `SharePeriodSheet.tsx` voor de jaar-periode (zie voorstel 10) |
| **Segment-overgang-tik**: bij het wisselen van interval-segment een korte, duidelijke visuele + haptische overgang (kleur van de voortgangsbalk verspringt, geen abrupte cut) | Garmin (vibratie/beep bij elke intervalgrens) | Nieuw interval-sessiescherm (voorstel 11) — wij hebben al haptics bij km-splits in `session/active.tsx`, dit is dezelfde taal doortrekken naar segmenten |
| **Weekcompleet-viering, subtieler dan het huidige 🎉-emoji**: een korte scale-in van het trofee-icoon met een zachte "settle"-easing, in plaats van een statisch emoji | Algemeen "geen confetti, wel gevoel"-principe uit Nike/Runna-analyses | `dashboard.tsx` `weekCompleteCard`, `session/complete.tsx` `trophyBox` |

## 5. Top-5 aanbeveling

1. **Animeer `StatRing` en samenvattingscijfers met de al-geïnstalleerde `react-native-reanimated`** — grootste polish-winst voor de laagste kosten, letterlijk nul nieuwe dependencies.
2. **Bouw structurele intervaltrainingen** — de enige inhoudelijke feature waar we écht achterlopen op elke serieuze concurrent; zonder dit missen we een volledige trainingscategorie.
3. **Voeg een wekelijk coach-rapport toe** — goedkope retentie-hefboom die onze bestaande periode-data en notificatie-infrastructuur hergebruikt.
4. **Introduceer de "zachte herplan"-vraag bij een gemiste training** — de light-versie van Runna's adaptieve schema, haalbaar in dagen in plaats van weken.
5. **Bouw een schoenentracker** — kleine moeite, functioneel (injuriepreventie), en het enige "Adidas-idee" dat bij onze niet-sociale, coachende positionering past.
