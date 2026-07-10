# Kwartaal design-review: 2026 Q2

Beoordeelde app: "Lopen te Lopen" (Expo/React Native, TypeScript, expo-router, zustand). Doelgroep: beginners die voor hun eerste halve marathon trainen. Beoordeeld zijn alle schermen in `app/`, de componenten in `src/components/ui/` en de designtokens in `src/theme/tokens.ts`. Ter vergelijking is het vorige rapport `reviews/2026-06-ux-review.md` meegenomen. Dit is een review met aanbevelingen, er zijn geen codewijzigingen doorgevoerd.

## Samenvatting en algemene indruk

De app staat er visueel volwassen bij. Er is een echt designsysteem: kleur, typografie, ruimte, radius en schaduw zijn netjes in tokens vastgelegd en worden consistent gebruikt. De donkere look is rustig, de kaarten zijn opgeruimd, de onboarding is kort (drie genummerde stappen) en de kerntaken kosten weinig taps. De toegankelijkheidsronde uit het vorige rapport is goed zichtbaar: labels, rollen, touch targets van minstens 44pt en het hogere contrast voor tertiaire tekst zitten er nu in. De microcopy in het Nederlands is warm en helder, en de lege en foutstaten zijn doordacht (GPS-terugval, routevraag, geen wedstrijd gekozen).

De grootste kansen liggen nu niet meer in losse bugs, maar in drie thema's die juist voor beginners zwaar wegen: leesbaarheid buiten in fel daglicht, flexibiliteit wanneer iemand een training mist of zich niet fit voelt, en beloning tussen de trainingen door. Op die punten lopen Runna en Strava voor, en daar valt voor deze doelgroep de meeste winst te halen. Daarnaast is er ruimte om de iconografie consistenter te maken (nu een mix van lijn-iconen en emoji) en om het hartslagzone-jargon op het actieve scherm te verzachten.

## Top geprioriteerde verbeteropties

### 1. Leesbaarheid in fel daglicht: bied een licht of hoog-contrast thema (prioriteit: hoog)

Probleem: de app is uitsluitend donker (`colors.bgBase` is `neutral[950]`, `#0A0F1A`). Een beginner loopt vrijwel altijd buiten, vaak overdag, en houdt het toestel op armlengte terwijl die zweet en beweegt. Donkere schermen met dunne, lichte tekst zijn in direct zonlicht slecht af te lezen, juist op het actieve scherm waar de cijfers ertoe doen. Runna en Strava bieden beide een licht thema.

Voorstel: voeg minimaal een licht of hoog-contrast variant toe, en idealiter een automatische schakeling op basis van het systeemthema. Begin bij het actieve sessiescherm (`app/session/active.tsx`): grotere, donkere cijfers op een lichte achtergrond zijn buiten veel beter leesbaar. Dit kan binnen het bestaande tokensysteem door een tweede kleurset naast `colors` te zetten.

Verwachte impact: hoog. Dit raakt het moment dat het hardst telt (lopen in de praktijk) en voorkomt frustratie die niets met de training te maken heeft.

### 2. Flexibiliteit bij een gemiste of zware training (prioriteit: hoog)

Probleem: het schema is vast. Wie ziek is, een drukke week heeft of een sessie overslaat, kan niets aanpassen en raakt achterop. Voor beginners is precies dit een van de grootste afhaakmomenten: een keer missen voelt als falen, en falen leidt tot stoppen. Runna heeft hier in 2026 bewust op ingezet met een "Not Feeling 100%"-functie en met inzichten die het plan veilig bijstellen.

Voorstel: bied een lichte vorm van bijsturen. Denk aan een knop "Training verzetten" op de sessiekaart en een optie "Ik voel me niet fit vandaag" die de sessie verschuift of verlicht in plaats van hem als gemist te markeren. Houd het simpel en geruststellend in toon: de boodschap is dat een keer overslaan normaal is en het doel niet in gevaar brengt.

Verwachte impact: hoog op het vasthouden van gebruikers. Dit verlaagt de drempel om terug te komen na een mindere week.

### 3. Koppel de voortgangsring aan werkelijk gedane trainingen, en controleer de drie-ringen-rij op kleine schermen (prioriteit: hoog)

Probleem: op het dashboard (`app/(tabs)/dashboard.tsx`) is de hoofdring "Voortgang" berekend als `(currentWeek - 1) / totalWeeks`. Die telt op kalenderbasis, niet op basis van wat de gebruiker daadwerkelijk heeft gelopen. Een beginner die net drie trainingen heeft afgewerkt ziet de grote ring niet bewegen, terwijl iemand die niets deed de ring toch ziet oplopen zodra de week omslaat. Dat ontkoppelt inspanning en beloning, precies omgekeerd aan wat motiveert. Daarnaast staan er drie `StatRing`-ringen van 110px naast elkaar met vaste breedte. Op smallere toestellen (ongeveer 360px breed) passen drie vaste ringen van 110px plus tussenruimte en schermmarges waarschijnlijk niet, met kans op afknippen of verspringen.

Voorstel: baseer de hoofdring op voltooide sessies of gelopen kilometers ten opzichte van het schematotaal, zodat elke training de ring zichtbaar vooruit duwt. Maak de ringgrootte responsief (bijvoorbeeld afgeleid van de schermbreedte) of overweeg twee ringen plus een compacte cijferregel, zodat het op elk toestel klopt.

Verwachte impact: hoog op motivatie en correctheid, en het voorkomt een mogelijke lay-outfout op kleine schermen.

### 4. Maak de iconografie consistent: vervang emoji door lijn-iconen (prioriteit: midden)

Probleem: de app mengt nette `lucide-react-native` lijn-iconen met emoji. Emoji renderen per Android-versie en fabrikant verschillend, volgen de huisstijl niet en ogen minder verzorgd. Het sterkst valt dit op bij de gekleurde bollen voor integraties in `settings.tsx` (`🟠🟢🔵🟡`), maar ook bij de doelkaarten in `goal.tsx` (`🎯💪🏅🏆`), de featurelijst in `welcome.tsx` en de stemkeuze (`👩👨`).

Voorstel: vervang in elk geval de integratie-bollen en de feature-iconen door lijn-iconen of door de officiele merklogo's waar dat mag. Houd eventueel een paar bewuste emoji aan voor pure feestmomenten (de 🎉 bij een afgeronde week), maar haal ze uit functionele lijsten.

Verwachte impact: midden. Een merkbare sprong in verzorgdheid en consistentie, met beperkte inspanning.

### 5. Beloning tussen de trainingen door: mijlpalen en consistentie (prioriteit: midden)

Probleem: er is een mooie afsluiting per week en per schema, en delen is mogelijk, maar tussen de sessies door is er weinig dat terugkomen beloont. Strava drijft op kleine, frequente erkenning (kudos, lokale ranglijsten); Runna viert de afronding met een verhalende terugblik. Lopen te Lopen kiest bewust voor privacy en lokaal bewaren, dus de sociale route past niet, maar persoonlijke mijlpalen wel.

Voorstel: voeg lokale, persoonlijke mijlpalen toe die niets met anderen delen: een reeks ("3 weken op rij getraind"), persoonlijke records (langste duurloop, snelste kilometer), en kleine badges bij eerste 5 km of eerste 10 km. Toon een rustige melding op het dashboard of in het sessieoverzicht.

Verwachte impact: midden tot hoog op terugkeren, passend binnen de privacy-positionering.

### 6. Verzacht het hartslagzone-jargon op het actieve scherm (prioriteit: midden)

Probleem: tijdens het lopen toont de zonecel "Z2" met "Aeroob" eronder (`app/session/active.tsx`). De `SessionCard` doet het al goed met gewone taal ("Rustige duurloop", "Tempoduurloop"), maar op het actieve scherm staat het abstracte zonelabel vooraan. Voor een echte beginner zegt "Z2 Aeroob" weinig.

Voorstel: leid met de gewone omschrijving ("Rustig tempo") en zet de zonecode als kleine ondersteuning erbij. De tikbare uitleg die vorig kwartaal is toegevoegd kan blijven. Zo blijft de informatie kloppen voor de gevorderde loper, maar wordt het meteen begrijpelijk voor de beginner.

Verwachte impact: midden. Lagere drempel en minder verwarring tijdens de training zelf.

### 7. Beheers de "binnenkort"-belofte (prioriteit: midden)

Probleem: "binnenkort" komt op meerdere plekken terug (de featurelijst in `welcome.tsx`, de hele integratiesectie in `settings.tsx`). Veel "binnenkort"-labels bij elkaar kunnen de indruk wekken dat de app nog niet af is.

Voorstel: toon alleen wat nu werkt prominent, en bundel toekomstige integraties in een rustiger blok, bijvoorbeeld een enkele regel "Koppelingen met Strava, Garmin en Apple Health volgen later" in plaats van vijf losse rijen met een "binnenkort"-pil. Eventueel een "houd me op de hoogte"-optie.

Verwachte impact: midden op vertrouwen en eerste indruk.

### 8. Voorkom ongewenste aanraking tijdens het lopen (prioriteit: laag tot midden)

Probleem: tijdens een actieve sessie kan het scherm per ongeluk worden bediend (broekzak, zweterige veeg). De sluitknop linksboven is een `ChevronDown`, wat vaak "minimaliseren" suggereert, terwijl die hier de annuleer-dialoog opent. De dialoog vangt verlies netjes af, maar een vergrendeloptie ontbreekt.

Voorstel: voeg een eenvoudige schermvergrendeling toe (een veeg- of houdgebaar om te ontgrendelen), zoals gangbaar in hardloop-apps. Overweeg een ander icoon dan de chevron voor het verlaten van het scherm.

Verwachte impact: laag tot midden, maar het voorkomt het zeer vervelende scenario van een per ongeluk afgebroken run.

### 9. Trek losse kleuren naar het tokensysteem (prioriteit: laag)

Probleem: in `paywall.tsx` staat een hardgecodeerde goudkleur (`const GOLD = '#F59E0B'`) en in `profile.tsx` worden de zonekleuren als letterlijke hex herhaald in plaats van `colors.zone1` tot en met `colors.zone5`. Dat is dubbel onderhoud en een klein consistentierisico.

Voorstel: voeg een premium- of accent-goudtoken toe aan `tokens.ts` en hergebruik de bestaande zone-tokens in `profile.tsx`.

Verwachte impact: laag, maar het houdt het systeem schoon en onderhoudbaar.

## Per-scherm bevindingen

### Welkom (`welcome.tsx`)
Sterke, rustige opening met een duidelijke belofte ("Van de bank naar de finish") en een eerlijke disclaimer over privacy. Aandachtspunt: de featurelijst gebruikt emoji en bevat al een "binnenkort"-label. Overweeg lijn-iconen en houd de eerste indruk bij wat nu werkt (zie punten 4 en 7).

### Doel kiezen (`goal.tsx`)
Goede tweedeling tussen vrij trainen en wedstrijd, met een nette modeschakelaar en duidelijke kaarten. De lege wedstrijdstaat heeft een directe uitweg naar het vrije schema, netjes. De premium-hint is eerlijk geformuleerd. Aandachtspunt: emoji als doel-iconen; de app is op de halve marathon gepositioneerd, dus overweeg de halve marathon visueel iets meer als aanbevolen pad te markeren.

### Profiel (`profile.tsx`)
Helder en kort. De hartslagzone-preview is een mooie uitleg en de leeftijdstepper werkt prettig. Aandachtspunt: de zonekleuren staan hier als letterlijke hex in plaats van tokens (punt 9). De toelichting "Heb je een nauwkeurige meting? Pas dit aan in Instellingen" is goed.

### Begeleiding/stem (`voice.tsx`)
Duidelijke keuze tussen gesproken begeleiding en alleen scherm, met directe stemvoorbeelden. De premium-uitleg over natuurlijke stemmen is eerlijk. Let op dat de stemkeuze afhankelijk is van een geldige ElevenLabs-sleutel; de terugval op de telefoonstem is correct beschreven.

### Dashboard (`dashboard.tsx`)
Goede informatiedichtheid: voortgangsringen, volgende sessie met directe startknop, weekoverzicht en weekfocus. Twee aandachtspunten: de hoofdring telt op kalenderbasis in plaats van op gedane trainingen, en de drie vaste ringen van 110px kunnen op smalle toestellen knellen (punt 3). De felicitatiekaart bij een afgeronde week is een fijne beloning.

### Schema (`schedule.tsx`)
Sterk scherm. De schakelaar tussen trainings- en wedstrijdschema, de zonelegenda, de inklapbare weken en het aanpassen van trainingsdagen zijn allemaal doordacht. De "geen wedstrijd gekozen"-melding heeft een directe knop naar het wedstrijdtabblad. Aandachtspunt: het persoonlijke tempo naast de afstand is een mooie premium-toevoeging; zorg dat dit voor gratis gebruikers niet als lege ruimte voelt.

### Wedstrijd (`races.tsx` plus `RacePickerScreen`)
De tab delegeert naar `RacePickerScreen`. De koppeling met het bouwen van een plan en het zetten van de doeltijd is logisch. Beoordeel of een gratis gebruiker hier helder ziet wat wel en niet gratis is, in lijn met de eerlijke premium-hint in de onboarding.

### Instellingen (`settings.tsx`)
Overzichtelijk met inline bewerken, een duidelijke hartslagzone-uitleg en een nette gevarenzone voor resetten. Aandachtspunten: de vijf integratierijen met "binnenkort"-pillen en gekleurde emoji-bollen (punten 4 en 7), en het privacybeleid dat extern opent, wat correct is.

### Actieve sessie (`active.tsx`)
Functioneel rijk en goed doordacht: GPS-wachtscherm met laadindicator en ontsnappingsroute, de routevraag als expliciete stap, de tikbare zone-uitleg, en een veilige stop- en annuleerstroom. Dit is het scherm waar de drie hoofdpunten samenkomen: daglicht-leesbaarheid (punt 1), zonejargon (punt 6) en bescherming tegen ongewenste aanraking (punt 8). Het is ook het scherm waar verbetering het meest oplevert.

### Samenvatting na sessie (`summary.tsx`)
Mooie afronding met grote afstand, kerncijfers, weekvoortgang met stippen en een coachbericht. Delen is goed bereikbaar. De doorstroom naar het schema-afgerond-scherm bij het einde van het plan is logisch.

### Schema voltooid (`complete.tsx`)
Een waardige eindbeloning met trofee, totaalcijfers, een motiverend citaat en een suggestie voor het volgende doel. Dit is precies het soort moment dat Runna met "Plan Replay" viert; overweeg hier op termijn een korte, persoonlijke terugblik op de hele reis (zie inspiratie).

### Paywall (`paywall.tsx`)
Clean en eerlijk: duidelijke voordelen, jaar- en maandoptie, herstel van aankopen en correcte terugval zonder RevenueCat. Aandachtspunt: de losse goudkleur naar een token trekken (punt 9).

## Visueel systeem

Kleur: het tokensysteem is sterk en consistent toegepast. De donkere basis is rustig en de zonekleuren zijn helder en logisch (blauw naar rood). Het hogere `textTertiary` uit vorig kwartaal helpt het contrast. Twee punten: er is geen licht of hoog-contrast thema (punt 1), en er zijn enkele kleuren die buiten de tokens leven (goud in de paywall, losse hex in `profile.tsx`).

Typografie: de Inter-familie met een ExtraBold display-variant geeft een prettige hierarchie. De schermtitels (2xl) en de grote meters (5xl met tabular-nums op het actieve scherm) zijn goed gekozen voor leesbaarheid. Let op de vele toepassingen van de kleinste maat (xs, 11px) voor hints en labels; in combinatie met de donkere achtergrond en fel daglicht kan dat krap worden.

Ruimte: het 8pt-grid wordt netjes aangehouden en de schermen ademen rustig. Kaarten hebben consistente padding en radius. Geen opvallende problemen.

Iconografie: hier zit de grootste inconsistentie. De lijn-iconen zijn netjes en uniform, maar de emoji ernaast (vooral de gekleurde integratiebollen) verlagen de verzorgdheid en renderen onbetrouwbaar op Android (punt 4).

Consistentie: kaarten, schakelaars, voortgangsdots, badges en knoppen volgen herkenbare patronen. De `Button`-component is solide met duidelijke varianten en correcte toegankelijkheidsstaten. Het geheel oogt als een samenhangend product.

## UX en flows

Navigatie: vier heldere tabs (Dashboard, Schema, Wedstrijd, Instellingen) en een logische onboarding van drie genummerde stappen met een duidelijke voortgangsindicator. De kerntaken kosten weinig taps: een training starten vanaf het dashboard is een tik, het schema bekijken een tik.

Lege en foutstaten: dit is een sterk punt. De GPS-terugval na 30 seconden, de expliciete routevraag, de "geen wedstrijd gekozen"-melding met directe actie en de lege wedstrijdlijst die terugvalt op het vrije schema zijn allemaal goed afgevangen. De gebruiker loopt nergens vast.

Gebruiksgemak voor beginners: de microcopy is warm en uitlegt veel (hartslag, zones, stemkeuze). De grootste resterende drempels zijn niet tekstueel maar gedragsmatig: wat gebeurt er als ik een training mis (punt 2), zie ik mijn inspanning terug in de voortgang (punt 3), en begrijp ik de zones tijdens het lopen (punt 6). Daar zit de meeste winst voor deze doelgroep.

Motivatie en beloning: per week en per schema zit het goed; tussendoor is er ruimte voor lokale mijlpalen en een consistentiebeloning (punt 5).

## Inspiratie: Komoot, Runna en Strava, vertaald naar Lopen te Lopen

Uit Runna: de kracht zit in flexibiliteit en persoonlijke begeleiding. Hun "Not Feeling 100%"-aanpak en het veilig bijstellen van het plan zijn direct toepasbaar als een bescheiden "training verzetten" of "ik voel me niet fit"-optie (punt 2). Hun verhalende eindterugblik ("Plan Replay") past mooi op het schema-voltooid-scherm: een korte, persoonlijke samenvatting van de hele reis (totale kilometers, langste loop, aantal weken volgehouden), volledig lokaal opgebouwd. Hun per-training briefings sluiten aan op de bestaande coachtips; die kunnen iets persoonlijker door de naam en de weekfocus te verwerken.

Uit Strava: de motor is frequente, kleine erkenning. Omdat Lopen te Lopen bewust privacy-vriendelijk en lokaal is, vertaal je dit niet naar sociale likes maar naar persoonlijke erkenning: reeksen, persoonlijke records en kleine mijlpalen die de app zelf viert (punt 5). Het idee achter hun segmenten, namelijk grote prestaties opdelen in kleine haalbare brokjes, past goed bij beginners: vier de eerste 5 km, de eerste 10 km, de eerste week vol.

Uit Komoot: hun sterkte is de route- en kaartbeleving, met afstandsmarkeringen, ondergrondtypes en een heldere kaartstijl. Lopen te Lopen heeft al een routeplanner en een live kaart; de inspiratie zit in leesbaarheid en context. Denk aan duidelijke afstandsmarkeringen op de geplande route en een rustige, goed afleesbare kaartstijl die ook in daglicht werkt. Neem geen merkspecifieke elementen over; het gaat om het principe dat de kaart in een oogopslag te lezen moet zijn terwijl je beweegt.

## Vergelijking met het vorige rapport (`reviews/2026-06-ux-review.md`)

Verbeterd en zichtbaar opgelost sinds vorig kwartaal:
- Toegankelijkheid: labels en rollen staan nu app-breed (te zien in de back-, stepper-, pauze-, stop-, deel- en stemkeuzeknoppen).
- Touch targets: knoppen en schakelaars halen nu minstens 44pt (`Button`, de schema-toggle, de stappers).
- Contrast: `textTertiary` is verhoogd, wat de vele hints leesbaarder maakt.
- Gedachtestreepjes zijn uit de gebruikerszichtbare copy; de teksten lezen nu met dubbele punt, komma of punt.
- De annuleer-dialoog tijdens een run is verduidelijkt ("Stop zonder opslaan", "Je voortgang wordt niet opgeslagen").
- Het GPS-wachtscherm heeft nu een laadindicator, de lege staten hebben een vervolgactie, en de zone-uitleg is tikbaar gemaakt vanaf het actieve scherm.
- De routeplanner is van een verstopt schuifje naar een expliciete startvraag gegaan.

Blijven liggen of nieuw in dit kwartaal:
- Het hartslagzone-jargon staat op het actieve scherm nog vooraan; vorig kwartaal is de uitleg tikbaar gemaakt, maar de gewone-taal-aanpak van de `SessionCard` is daar nog niet doorgetrokken (punt 6).
- Daglicht-leesbaarheid en een licht thema zijn nog niet opgepakt en zijn nu het zwaarste punt (punt 1).
- Flexibiliteit bij gemiste trainingen is nog afwezig (punt 2).
- De koppeling tussen voltooide trainingen en de hoofdvoortgangsring is nog kalendergebaseerd (punt 3).
- De emoji-iconografie en de "binnenkort"-labels stonden ook vorig kwartaal in de app en zijn nog ongewijzigd (punten 4 en 7).

Eindbeeld: de basis en de afwerking zijn dit kwartaal duidelijk gestegen, vooral op toegankelijkheid en op het wegwerken van losse UX-fouten. De volgende sprong zit niet in details maar in drie gedragsgerichte verbeteringen die voor beginners het verschil maken tussen volhouden en afhaken: buiten goed kunnen lezen, soepel kunnen omgaan met een mindere week, en je inspanning terugzien in de voortgang.
