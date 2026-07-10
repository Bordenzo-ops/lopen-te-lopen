# Kwartaal design-review: 2026 Q3

Beoordeelde app: "Lopen te Lopen" (Expo/React Native, TypeScript, expo-router, zustand). Doelgroep: beginners die voor hun eerste halve marathon trainen. Beoordeeld zijn alle schermen in `app/`, de componenten in `src/components/ui/` en de designtokens in `src/theme/tokens.ts`. Ter vergelijking is het vorige rapport `reviews/2026-Q2-design-review.md` meegenomen. Dit is een review met aanbevelingen, er zijn geen codewijzigingen doorgevoerd.

## Samenvatting en algemene indruk

Dit kwartaal is een sterk kwartaal geweest. De drie grootste, gedragsgerichte knelpunten uit het Q2-rapport zijn alle drie opgepakt: er is nu een licht thema voor leesbaarheid in daglicht (`src/theme/tokens.ts`, `lightColors`, met een keuzeschakelaar in `app/(tabs)/settings.tsx`), er is een geruststellende "niet fit vandaag, sla over"-flow op het dashboard, en de hoofdvoortgangsring op het dashboard is herrekend op basis van werkelijk voltooide sessies in plaats van kalenderweken. Ook is er een schermvergrendeling toegevoegd tijdens het lopen, is het zonejargon op het actieve scherm verzacht ("Rustig" in plaats van "Z2 Aeroob" als hoofdlabel), zijn persoonlijke mijlpalen en records op het dashboard verschenen, en zijn de "binnenkort"-integraties in instellingen gebundeld tot een rustige, enkele regel. Dat is een ongebruikelijk hoog tempo van opvolging en het is terug te zien in de kwaliteit van de app.

De resterende punten zijn nu vooral consistentiekwesties: de iconografie mengt nog steeds emoji met lijn-iconen, en, nieuw ontdekt dit kwartaal, het lichte thema is niet overal doorgevoerd. De tabbalk (`app/(tabs)/_layout.tsx`) en twee kleine maar zichtbare componenten (`ZoneBadge`, `PremiumBadge`) gebruiken nog de statische, altijd-donkere `colors`-export in plaats van `useThemeColors()`. Voor een gebruiker die bewust naar het lichte thema overschakelt, is dat een merkbare inconsistentie: precies op de plekken waar kleur betekenis draagt (hartslagzone, premium-status) en op de permanent zichtbare tabbalk blijft de donkere styling hangen. Dit is de nieuwe hoogste prioriteit, juist omdat de vorige hoofdprioriteit (het licht thema zelf) nu wel bestaat maar niet compleet is.

## Top geprioriteerde verbeteropties

### 1. Maak het lichte thema compleet: tabbalk, ZoneBadge en PremiumBadge volgen nog het donkere thema (prioriteit: hoog)

Probleem: `app/(tabs)/_layout.tsx` importeert de statische `colors`-export (altijd donker) voor `tabBarStyle`, `tabBarActiveTintColor` en `tabBarInactiveTintColor`, in plaats van `useThemeColors()`. `src/components/ui/ZoneBadge.tsx` bouwt zijn `StyleSheet` buiten de component met een module-level import van `typography`/`spacing`/`radius` en gebruikt geen thema-hook. `src/components/ui/PremiumBadge.tsx` gebruikt een eigen hardgecodeerde `const GOLD = '#F59E0B'` los van `colors.premium`. Het gevolg: een gebruiker die in Instellingen bewust "Licht" kiest, ziet toch een donkere tabbalk onderaan elk scherm, en de hartslagzone- en premium-badges (die overal in de app terugkomen: schema, dashboard, sessiekaarten, actieve sessie) blijven met donkere-thema-kleuren renderen. Dat is nu net de plek waar het net opgeleverde licht-thema-werk zijn geloofwaardigheid verliest.

Voorstel: geef `TabsLayout` een component-body met `useThemeColors()` (nu kan dat niet binnen `screenOptions` als top-level object; verplaats naar een functie die de hook aanroept, wat al gangbaar patroon is in de andere schermen). Voeg `useThemeColors()` toe aan `ZoneBadge` en `PremiumBadge` en vervang de losse `GOLD`-constante door `colors.premium`.

Verwachte impact: hoog. Dit is zichtbaar op vrijwel elk scherm zodra iemand het lichte thema gebruikt, en ondermijnt anders het werk dat net gedaan is om buiten leesbaar te zijn.

### 2. Iconografie: vervang de resterende emoji door lijn-iconen (prioriteit: midden)

Probleem: dit punt uit Q2 staat nog open. Emoji komen nog voor in de hero van `welcome.tsx` (🏃), de stemkeuze in `voice.tsx` (👩👨), de weekafronding op het dashboard (🎉, hier bewust en prima als feestmoment), het schema-voltooid-scherm `complete.tsx` (💪🏅🏆 als "volgende uitdaging"-iconen) en in `SessionTypeSheet.tsx` (🐢⚡🏃😴🚴 als sessietype-iconen). Sommige zijn functioneel (stemkeuze, volgende doel), andere zijn puur decoratief (hero, sessietype-uitleg). Emoji renderen inconsistent op Android per fabrikant en OS-versie, en ogen minder verzorgd naast de nette `lucide-react-native`-iconen die de rest van de app gebruikt.

Voorstel: vervang in ieder geval de functionele emoji (stemkeuze-iconen, volgende-doel-iconen in `complete.tsx`) door lijn-iconen met een kleuraccent, consistent met hoe `goalMeta` in `goal.tsx` dat al doet. De sessietype-emoji in `SessionTypeSheet` mogen om hun warmte blijven, maar overweeg ze te combineren met een subtiele lijn-icoonvariant zodat het geheel oogt als één systeem. Houd de 🎉 bij de weekafronding: die is functioneel gepast als vieringsmoment.

Verwachte impact: midden. Een merkbare sprong in verzorgdheid en consistentie tegen beperkte inspanning, en het enige punt uit Q2 dat nog volledig openstaat.

### 3. Vier de eerste 5 km en 10 km expliciet als losse mijlpalen (prioriteit: midden)

Probleem: de mijlpalenkaart op het dashboard (`app/(tabs)/dashboard.tsx`, `computeMilestones`) toont al reeksen, langste afstand en beste tempo. Dat is een sterke stap sinds Q2. Wat nog ontbreekt is een vroeg, laagdrempelig gevoel van "iets bereikt hebben" voor de allereerste weken: een startende hardloper die net zijn eerste training heeft afgerond heeft nog geen reeks en geen record om trots op te zijn, en de kaart verschijnt nu pas vanaf de eerste run zonder een specifiek "welkom"-moment.

Voorstel: voeg een kleine, eenmalige viering toe direct na de allereerste voltooide sessie (op `summary.tsx`, naast de bestaande PR-detectie), en herhaal dat bij het bereiken van 5 km en 10 km cumulatieve afstand als losse badge naast de bestaande "langste run"-metriek. Dit sluit aan bij wat Runna en Strava beide doen: grote afstanden opdelen in kleine, snel haalbare brokjes zodat een beginner al in de eerste weken een gevoel van vooruitgang heeft, niet pas na een paar weken reeks.

Verwachte impact: midden op vroege motivatie, met name in de eerste twee trainingsweken die statistisch het grootste afhaakrisico kennen.

### 4. Workout-briefing: geef de coachtip een moment vóór de start, niet alleen tijdens (prioriteit: midden)

Probleem: `session.coachTip` verschijnt nu als klein tekstblok tijdens de actieve sessie (`app/session/active.tsx`, `tipBanner`, alleen zichtbaar als er geen kaart getoond wordt) en op de samenvatting achteraf. Voor een beginner die net op "start" heeft gedrukt en nog aan het wachten is op GPS, is er geen moment waarop de app kort uitlegt wat deze specifieke training vraagt en waarom, voordat de cijfers beginnen te lopen.

Voorstel: toon een korte, gepersonaliseerde briefing op het GPS-wachtscherm (waar nu alleen de laadindicator en eventueel de routevraag staan): naam van de gebruiker, het sessietype in gewone taal, en één zin uit `coachTip`. Dat vult een moment dat nu leeg aanvoelt (wachten op GPS) met iets nuttigs, en bereidt de beginner mentaal voor.

Verwachte impact: midden. Vult een dood moment in de flow en verhoogt het vertrouwen vlak voor de inspanning zelf.

### 5. Route- en kaartleesbaarheid tijdens het lopen (prioriteit: midden tot laag)

Probleem: `LiveRouteMap` toont de geplande route en de huidige positie tijdens de sessie, maar is nog niet beoordeeld op leesbaarheid in fel daglicht nu er wel een licht thema is voor de rest van de app. Een kaart die in donkere stijl blijft renderen terwijl de gebruiker net naar het lichte thema is overgeschakeld, oogt inconsistent en kan in de zon lastig af te lezen zijn.

Voorstel: controleer of `LiveRouteMap` de actieve kleurenset (`useThemeColors()`) doorkrijgt voor kaartaccenten, routelijn en achtergrondstijl, net als de rest van het actieve scherm. Neem het principe van Komoot over (geen merkspecifieke elementen, wel het idee): een rustige, hoog-contrast kaartstijl met duidelijke afstandsmarkeringen die ook in fel licht goed leesbaar blijft.

Verwachte impact: midden tot laag, afhankelijk van hoeveel gebruikers de routeplanner daadwerkelijk gebruiken, maar relevant zodra dat gebeurt.

### 6. Beheers de resterende "binnenkort"-belofte in de welkomstflow (prioriteit: laag)

Probleem: in `settings.tsx` is dit uit Q2 al opgelost (één rustige regel in plaats van vijf pillen). In `welcome.tsx` staat echter nog steeds een individuele "binnenkort"-badge naast de Strava/Garmin/Apple Health-featurerij, tussen drie features die al wel werken. Dat is nu de enige overgebleven losse "binnenkort"-vermelding in de app.

Voorstel: overweeg deze vierde rij uit de hero-featurelijst te halen (die lijst mag drie sterke, werkende features tonen) en de koppelingen pas in instellingen te noemen, waar de nette, gebundelde versie al staat.

Verwachte impact: laag, maar zorgt voor een volledig opgeloste eerste indruk.

## Per-scherm bevindingen

### Welkom (`welcome.tsx`)
Nog steeds een sterke, rustige opening. Enige aandachtspunt: de laatste featurerij met "binnenkort"-badge (punt 6) en de hero-emoji 🏃 (punt 2, laag risico, puur decoratief).

### Doel kiezen (`goal.tsx`)
Sterk scherm, ongewijzigd sinds Q2 en nog steeds goed: heldere tweedeling, een eerlijke premium-hint bij wedstrijdafstanden ("Je kunt nu elke wedstrijd kiezen... vraagt de app later om premium"), en een nette lege staat bij geen wedstrijden. De doel-iconen zijn hier al `lucide-react-native`-iconen (`Target`, `Dumbbell`, `Medal`, `Trophy`), dus dit scherm is al vrij van emoji-inconsistentie: een goed voorbeeld voor punt 2.

### Profiel (`profile.tsx`)
Ongewijzigd en nog steeds helder. De zonekleuren gebruiken hier terecht `colors.zone1` t/m `colors.zone5` (Q2-punt 9 was hier al opgelost).

### Begeleiding/stem (`voice.tsx`)
De stemvoorbeelden en premium-uitleg werken goed. De stemkeuze-emoji (👩👨) zijn hier het duidelijkste functionele geval voor punt 2: vervang door lijn-iconen (bijvoorbeeld `User`/`UserRound`-varianten) met een kleuraccent per stem.

### Dashboard (`dashboard.tsx`)
Grote sprong sinds Q2. De hoofdring is nu op voltooide sessies gebaseerd (niet meer kalenderweek), de ringgrootte is responsief gemaakt (`ringSize = Math.min(110, ...)`, schaalt met schermbreedte), er is een "niet fit vandaag"-uitweg met een geruststellende bevestigingsdialoog, en de mijlpalenkaart toont reeksen, langste afstand, beste tempo en badges. Dit scherm demonstreert het best hoeveel er dit kwartaal is opgelost. Blijft: de eerste-weken-mijlpaalviering (punt 3).

### Schema (`schedule.tsx`)
Ongewijzigd sterk. De overgeslagen-status wordt nu netjes getoond ("overgeslagen"-label, opacity-styling) naast voltooid, en telt mee bij het bepalen of een week "afgehandeld" is. Dat is een goede, niet voor de hand liggende afhandeling van de nieuwe skip-flow.

### Wedstrijd (`races.tsx` / `RacePickerScreen`)
Geen wijzigingen geconstateerd ten opzichte van Q2, delegeert nog naar `RacePickerScreen`.

### Instellingen (`settings.tsx`)
De thema-keuze (Systeem/Licht/Donker) is hier keurig toegevoegd met een duidelijke toelichting ("Kies Licht voor betere leesbaarheid buiten in fel daglicht"). De integraties zijn nu gebundeld tot één rustige regel (Q2-punt 7 opgelost voor dit scherm). Cloudsync is nieuw en helder toegelicht met statusfeedback (gesynchroniseerd/bezig/mislukt).

### Actieve sessie (`active.tsx`)
Dit scherm heeft de grootste sprong gemaakt. Alle drie de Q2-hoofdpunten zitten erin: het licht thema werkt hier volledig via `useThemeColors()`, het zonejargon is verzacht (`sessionTypeShort`, "Rustig" leidt, "Z2 Aeroob" ondersteunt), en er is een schermvergrendeling met een bewust log-drukgebaar om te ontgrendelen. De routevraag, GPS-terugval en annuleer-/stopdialogen blijven allemaal goed. Enige aandachtspunt: het moment vlak voor start (GPS wachten) kan de coachtip/briefing beter benutten (punt 4), en de live kaart is nog niet expliciet gecontroleerd op thema-consistentie (punt 5).

### Samenvatting na sessie (`summary.tsx`)
Nieuw en sterk: persoonlijke-record-detectie ("Nieuw record: je langste run tot nu toe!") direct na de sessie, naast de bestaande weekvoortgang-stippen en coachbericht. Dit is precies het soort kleine, frequente erkenning die in de inspiratie-sectie hieronder wordt aanbevolen, en het is mooi dat dit al leeft.

### Schema voltooid (`complete.tsx`)
Ongewijzigd sinds Q2: trofee, kerncijfers, motiverend citaat en een "volgende uitdaging"-suggestie. De volgende-doel-iconen zijn hier nog emoji (💪🏅🏆, punt 2).

### Paywall (`paywall.tsx`)
Q2-punt 9 (losse goudkleur) is opgelost: `const GOLD = colors.premium` haalt nu netjes uit het tokensysteem in plaats van een eigen hex-waarde. Verder ongewijzigd en nog steeds eerlijk en duidelijk.

## Visueel systeem

Kleur: het licht-thema-werk (`lightColors` in `tokens.ts`) is goed doordacht: dezelfde sleutels als het donkere thema, een donkerdere `brandLight` voor leesbaarheid op licht, en zone- en semantische kleuren die bewust ongewijzigd blijven omdat ze op beide achtergronden werken. De implementatie in de meeste schermen via `useThemeColors()` is consistent. De resterende hiaten (tabbalk, `ZoneBadge`, `PremiumBadge`, zie punt 1) zijn geen ontwerpprobleem maar een doorvoerprobleem: het patroon bestaat al, het is alleen niet overal toegepast.

Typografie: ongewijzigd sinds Q2 en nog steeds sterk. Geen nieuwe knelpunten geconstateerd.

Ruimte: het 8pt-grid blijft consistent aangehouden, ook in de nieuwe elementen (mijlpalenkaart, thema-keuzerij, cloudsync-rij).

Iconografie: nog steeds de grootste resterende inconsistentie (punt 2), al is de scope kleiner dan in Q2: de ergste plek (integratie-emoji-bollen in instellingen) is al vervangen door een neutrale tekstregel. Wat overblijft is vooral in de onboarding en het schema-voltooid-scherm.

Consistentie: het patroon `useThemeColors()` + `useMemo(() => makeStyles(colors), [colors])` is inmiddels de facto standaard in bijna elk scherm en de meeste componenten, wat knap consistent is doorgevoerd. Juist daardoor vallen de paar uitzonderingen (punt 1) extra op.

## UX en flows

Navigatie: ongewijzigd en nog steeds sterk: vier tabs, korte onboarding, weinig taps voor kerntaken.

Lege en foutstaten: blijft een sterk punt, met als nieuwe toevoeging de "geen wedstrijd gekozen"-melding en overgeslagen-sessieweergave die netjes zijn geintegreerd in bestaande patronen.

Gebruiksgemak voor beginners: de twee grootste gedragsdrempels uit Q2 (wat gebeurt er als ik een training mis, zie ik mijn inspanning terug in de voortgang) zijn beide opgelost. Het jargon-punt is ook opgelost op het scherm waar het telde. De resterende drempel is subtieler: het moment vlak voor de start (wachten op GPS) is nog een beetje leeg voor een beginner die gerustgesteld wil worden over wat er komt (punt 4).

Motivatie en beloning: duidelijk verbeterd. Persoonlijke records verschijnen nu zowel op het dashboard als direct na de sessie. De volgende stap is het eerste-weken-moment specifiek vieren (punt 3), zodat ook wie nog geen reeks of record heeft toch een gevoel van vooruitgang ervaart.

## Inspiratie: Komoot, Runna en Strava, vertaald naar Lopen te Lopen

Uit Runna (2026): de nieuwste beginnersplannen van Runna leunen sterk op flexibiliteit rond gemiste trainingen en op korte, persoonlijke "workout briefings" vlak voor een training. Lopen te Lopen heeft de flexibiliteit inmiddels deels zelf (de "niet fit vandaag"-skip), maar mist nog het briefing-moment: een korte, warme uitleg per sessie vlak voordat de gebruiker begint, niet pas tijdens het lopen. Dat is direct vertaalbaar naar het GPS-wachtscherm (punt 4). Runna's aanpak om nieuwe lopers te laten beginnen met tijd in plaats van afstand ("walk-run" in plaats van kilometers) is ook een idee waard om te overwegen voor de allereerste weken van het 5 km-schema, mocht daar veel uitval zitten.

Uit Strava (2026): Strava's kracht blijft frequente, kleine erkenning, nu uitgebreid met een functie die na elke activiteit uitlegt waarom een workout wordt aanbevolen en wat het voordeel ervan is. Omdat Lopen te Lopen bewust geen sociale laag heeft, vertaalt dit zich het best naar het uitbreiden van de bestaande mijlpalenkaart met net dat beetje extra uitleg: niet alleen "3 weken op rij getraind" tonen, maar er een halve zin bij dat uitlegt waarom dat telt (opbouw van uithoudingsvermogen, minder blessurerisico). Dat voegt betekenis toe aan een cijfer, wat past bij de coachende toon die de app al heeft.

Uit Komoot (2026): Komoot's kaartervaring blijft draaien om duidelijkheid: ondergrondtype, hoogteverschil en een rustige, goed leesbare kaartstijl, nu verder versterkt met natuurlijke-taal-routeplanning die rekening houdt met het ervaringsniveau van de gebruiker. Voor Lopen te Lopen is de kaartleesbaarheid in daglicht (punt 5) de meest directe toepassing: nu er een licht thema bestaat voor de rest van de app, moet de route- en live kaart in `LiveRouteMap` daar even goed in meebewegen als de cijfers eromheen.

## Vergelijking met het vorige rapport (`reviews/2026-Q2-design-review.md`)

Opgelost sinds vorig kwartaal:
- Licht/hoog-contrast thema toegevoegd (`lightColors` in `tokens.ts`), met een keuzeschakelaar in instellingen en toepassing op vrijwel elk scherm, inclusief het actieve sessiescherm. Dit was de hoogste Q2-prioriteit.
- Flexibiliteit bij een gemiste training: de "niet fit vandaag? sla over"-knop op het dashboard, met een geruststellende bevestigingsdialoog en correcte verwerking in schema en week-voltooid-logica.
- De hoofdvoortgangsring is herrekend op basis van werkelijk voltooide sessies in plaats van kalenderweek, en de ringgrootte is responsief gemaakt voor smalle schermen.
- Het hartslagzone-jargon op het actieve scherm is verzacht: "Rustig"/"Tempo"/"Lang" leidt, de zonecode ondersteunt.
- Schermvergrendeling tijdens het lopen is toegevoegd, met een bewust houd-ingedrukt-gebaar om te ontgrendelen en een aangepaste hardware-terugknop-afhandeling tijdens vergrendeling.
- Persoonlijke mijlpalen en records (reeksen, langste run, beste tempo, PR-detectie na elke sessie) zijn toegevoegd op dashboard en samenvatting.
- De "binnenkort"-integraties in instellingen zijn gebundeld tot een enkele rustige regel in plaats van vijf pillen met emoji-bollen.
- De losse goudkleur in de paywall is naar het tokensysteem getrokken (`colors.premium`).

Nieuw geconstateerd dit kwartaal:
- Het lichte thema is niet compleet: de tabbalk, `ZoneBadge` en `PremiumBadge` gebruiken nog de statische, altijd-donkere kleurenset (punt 1, nieuwe hoogste prioriteit).

Blijft liggen sinds Q2:
- Iconografie is nog een mix van emoji en lijn-iconen, met name in de onboarding-stemkeuze en het schema-voltooid-scherm (punt 2). De ergste plek uit Q2 (integratiebollen) is wel al opgelost.
- De laatste losse "binnenkort"-badge staat nog in de welkomstflow (punt 6, sterk verkleind ten opzichte van Q2).

Eindbeeld: dit is het sterkste kwartaal van de twee tot nu toe gemeten. Alle drie de gedragsgerichte hoofdpunten uit Q2 (leesbaarheid, flexibiliteit, voortgang die klopt met inspanning) zijn opgepakt en goed uitgevoerd, niet oppervlakkig. De focus kan nu verschuiven van grote gedragsverbeteringen naar het afwerken van wat er al is: het lichte thema echt overal doorvoeren, de laatste emoji vervangen, en de kleine motivatiemomenten (eerste kilometers, briefing vooraf) verder uitbouwen op de fundering die er al staat.

## Doorgevoerd naar aanleiding van dit rapport

Lars heeft direct na oplevering van dit rapport gevraagd om alle zes verbeteropties door te voeren. Status per punt:

1. Licht thema compleet (hoog): opgelost. `app/(tabs)/_layout.tsx` gebruikt nu `useThemeColors()` voor de tabbalkkleuren, `ZoneBadge.tsx` en `PremiumBadge.tsx` zijn omgezet naar het `useThemeColors()` + `makeStyles(colors)`-patroon. `PremiumBadge` gebruikt nu `colors.premium` in plaats van een losse `GOLD`-constante.
2. Iconografie (midden): de functionele emoji zijn vervangen door lijn-iconen. De stemkeuze in `voice.tsx` gebruikt nu `UserRound`/`User` met een kleuraccent per stem, en de volgende-uitdaging-iconen in `complete.tsx` gebruiken nu `Dumbbell`/`Medal`/`Trophy`, consistent met `goalMeta` in `goal.tsx`. De sessietype-emoji in `SessionTypeSheet` en de hero-emoji in `welcome.tsx` zijn bewust ongewijzigd gelaten, zoals het rapport voorstelde.
3. Eerste 5/10 km-mijlpalen (midden): opgelost. `src/data/achievements.ts` heeft twee nieuwe cumulatieve mijlpalen (`km-5`, `km-10`) vroeg in `computeMilestones`, en een nieuwe `detectCumulativeMilestone`-functie herkent de allereerste training en het moment waarop de cumulatieve afstand 5 km resp. 10 km passeert. `summary.tsx` toont daarvoor een aparte vieringsbanner naast de bestaande PR-banner.
4. Workout-briefing (midden): opgelost. Het GPS-wachtscherm in `app/session/active.tsx` toont nu een briefingkaart met de naam van de gebruiker, het sessietype in gewone taal en de coachtip, vóór het GPS-icoon en de laadindicator.
5. Kaart-thema-consistentie (midden/laag): bij nader onderzoek bleek `LiveRouteMap.tsx` al volledig themabewust: het gebruikt al `useThemeColors()` en `useIsLightTheme()`, en geeft `userInterfaceStyle` door aan de kaart. Er was dus geen codewijziging nodig; dit punt was kennelijk al opgelost voordat dit rapport werd geschreven.
6. Laatste "binnenkort"-badge (laag): opgelost. De vierde featurerij (Strava/Garmin/Apple Health) is uit de hero-featurelijst in `welcome.tsx` gehaald; de koppelingen staan al gebundeld in `settings.tsx`.

Alle wijzigingen zijn puur presentatie- en datalogica in bestaande patronen; er zijn geen nieuwe afhankelijkheden toegevoegd.
