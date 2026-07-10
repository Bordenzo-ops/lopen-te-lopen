# UX/UI Review: juni 2026

Eerste maandelijkse review van de hardloopapp (Expo/React Native, doelgroep: beginners die trainen voor een halve marathon). Er is geen eerder rapport in `reviews/`, dus een vergelijking met een vorige maand is nog niet mogelijk. Alle schermen in `app/` en componenten in `src/` zijn beoordeeld. Na elke fix is `npx tsc --noEmit` uitgevoerd; het project compileert zonder fouten.

**Tap-telling kerntaken:** run starten vanaf dashboard: 1 tap (plus GPS-wachttijd), run stoppen en opslaan: 2 taps, schema bekijken: 1 tap, onboarding: 3 stappen met duidelijke voortgangsindicator. Dat is compact en goed.

## Bevindingen (gesorteerd op impact)

### 1. Geen enkel accessibilityLabel in de hele app: GEFIXT
**Bestanden:** alle schermen en componenten. Er stond nul keer `accessibilityLabel` of `accessibilityRole` in de codebase. Icoonknoppen (terug-pijlen, plus/min-steppers, pauze/stop, opslaan/annuleren bij bewerken) waren voor schermlezers onzichtbaar of betekenisloos. Voor beginners met een visuele beperking was de app feitelijk onbruikbaar. Toegevoegd: rollen, labels en states op Button.tsx, terugknoppen (goal, profile, voice), pauze/stop-knoppen (active), steppers en bewerkknoppen (profile, settings), beide Switches, mode-toggles (goal, schedule), deelknoppen (summary, complete) en de infoknop in SessionCard.

### 2. Touch targets onder de 44pt: GEFIXT
**Bestanden:** Button.tsx, settings.tsx, schedule.tsx, goal/profile/voice.tsx, active.tsx. De opslaan/annuleren-knopjes in instellingen waren effectief 26pt, terugknoppen 40pt, de schema-toggle 32pt en de kleine Button-variant 36pt. Beginners gebruiken de app al rennend met zweterige vingers; mistikken is dan extra frustrerend. Gefixt met `minHeight: 44`, grotere `hitSlop` en aangepaste paddings.

### 3. Te laag contrast voor tertiaire tekst: GEFIXT
**Bestand:** src/theme/tokens.ts. `textTertiary` (neutral 600 op donkere achtergrond) haalde circa 3,3:1, onder de WCAG-norm van 4,5:1 voor kleine tekst. Dit raakt juist de uitlegteksten waar beginners op leunen (disclaimers, veldnotities, placeholders, inactieve tabs). Token verhoogd naar neutral 500 (circa 4,6:1), een consistente verbetering door de hele app.

### 4. Gedachtestreepje in vrijwel alle copy: GEFIXT
**Bestanden:** dashboard, schedule, settings, trainingPlans.ts, buildRacePlan.ts, SessionTypeSheet, RacePickerScreen, rotterdamRaces.ts. Het teken stond in sessietitels, coachtips, zonelabels en meldingen. Alle gebruikerszichtbare teksten herschreven met dubbele punt, komma of punt, passend bij de zin.

### 5. Verwarrende knoppen in de annuleer-dialoog tijdens een run: GEFIXT
**Bestand:** app/session/active.tsx. De destructieve knop heette "Annuleren" terwijl "Annuleren" in dialogen normaal betekent: dialoog sluiten. Een beginner die net 5 km heeft gelopen kan zo per ongeluk de hele sessie weggooien. Knop hernoemd naar "Stop zonder opslaan" en de melding verduidelijkt naar "Je voortgang wordt niet opgeslagen."

### 6. Hooks na een vroege return (React rules-of-hooks): GEFIXT
**Bestanden:** dashboard.tsx, summary.tsx en active.tsx. Store-hooks stonden na `if (!profile) return null`, wat tot crashes of stille bugs kan leiden zodra `profile` wisselt. In active.tsx is de vroege return nu na alle hooks geplaatst; `resolveWeek`, de GPS-effect en de voice-instelling zijn beveiligd tegen een ontbrekend profiel.

### 7. Inconsistente uitleg van gesproken begeleiding: GEFIXT
**Bestanden:** voice.tsx en settings.tsx. Onboarding beloofde "hartslagzone, afstand per kilometer en aanmoedigingen", instellingen "kilometer-updates". "Afstand per kilometer" is bovendien logisch krom. Onboardingtekst herschreven naar "een update bij elke kilometer". Ook "Wedstrijd-tabje" in schedule.tsx vervangen door "het tabblad Wedstrijd" en "Integraties (binnenkort)" consistent gemaakt.

### 8. GPS-wachtscherm heeft geen bewegende laadindicator: GEFIXT
**Bestand:** app/session/active.tsx. Tijdens het zoeken naar GPS (tot 30 seconden) stond er alleen statische tekst en een icoon, waardoor een beginner niet weet of de app bezig is of vastgelopen. Er staat nu een ActivityIndicator boven "GPS-signaal zoeken...". De copy en de ontsnappingsroute ("Nu starten zonder GPS") waren al goed.

### 9. Lege wedstrijdstaat zonder vervolgactie: GEFIXT
**Bestanden:** goal.tsx (onboarding) en schedule.tsx. Bij "geen wedstrijd gekozen" in het schema staat nu een knop "Kies een wedstrijd" die direct naar het tabblad Wedstrijd navigeert. In de onboarding leidt een lege wedstrijdlijst nu naar een knop die terugschakelt naar het vrije trainingsschema, zodat de gebruiker nooit vastloopt.

### 10. Zone-jargon op het actieve scherm: GEFIXT
**Bestanden:** active.tsx. Tijdens de run zag een beginner alleen "Z2" met het woord "Aeroob" eronder. De zone-statcel is nu aantikbaar (met info-icoon als visuele hint) en opent de bestaande SessionTypeSheet met de volledige uitleg van het trainingstype, inclusief de praattest.

## Aanvulling na testronde Lars

**Routeplanner zichtbaar gemaakt als startvraag (active.tsx).** Uit de test bleek dat de routeplanner onvindbaar was: het was een klein schuifje op het GPS-wachtscherm dat standaard uit stond. Dat schuifje is vervangen door een expliciete vraag. Zodra GPS je locatie heeft gevonden, verschijnt nu een kaart: "Wil je een route plannen?" met de trainingsafstand erbij, en twee knoppen: "Plan mijn route" (opent de routevoorvertoning) en "Start zonder route". Je antwoord wordt onthouden als voorkeur, maar de vraag komt bij elke training terug zodat de functie altijd vindbaar is. Zonder locatietoestemming of GPS-signaal start de training direct zonder route.

## Aanvulling 2: ElevenLabs stemmen

**Coaching en routebegeleiding via ElevenLabs, met stemkeuze.** De spraak liep via de ingebouwde telefoonstem (expo-speech). Er is nu een centrale spraakservice (src/services/voiceService.ts) die ElevenLabs text-to-speech gebruikt zodra er een API-sleutel staat in src/config/voiceConfig.ts. Gegenereerde zinnen worden op het toestel gecachet zodat herhaalde teksten geen nieuwe API-kosten veroorzaken. Zonder sleutel, zonder netwerk of bij een fout valt de app automatisch terug op de telefoonstem, zodat de coaching tijdens een run nooit wegvalt.

De gebruiker kiest een vrouwenstem of mannenstem in stap 3 van de onboarding (met directe voorbeeldweergave bij het aantikken) en kan dit later wijzigen via Instellingen, onder Begeleiding tijdens het lopen. De keuze wordt opgeslagen in het profiel en geldt voor de kilometer-updates, aanmoedigingen, zone-meldingen en de turn-by-turn routebegeleiding.

Nog nodig om dit live te zetten (zie takenlijst hieronder): ElevenLabs API-sleutel invullen, twee pakketten installeren en een nieuwe development build maken.

## Samenvatting

**Alle 10 bevindingen zijn opgelost.** In de eerste ronde: accessibilityLabels en rollen app-breed, touch targets naar 44pt, contrast-token verhoogd, gedachtestreepjes uit alle copy, annuleer-dialoog verduidelijkt, twee hooks-bugs en microcopy. In de tweede ronde: hooks-volgorde in active.tsx hersteld, laadindicator op het GPS-wachtscherm, lege staten voorzien van een directe vervolgactie en de zone-uitleg bereikbaar gemaakt vanaf het actieve sessiescherm. Daarnaast zijn drie lege rommelbestanden uit de projectroot verwijderd ("navigation.goBack()}", "setShowShare(false)}" en "{"). Het project compileert foutloos na alle wijzigingen.

**Nog te doen door Lars (handmatige controle, kan niet vanaf hier):**
1. Start de app op een telefoon (Expo) en loop de flows na: onboarding, run starten met en zonder GPS, de nieuwe zone-uitleg tijdens een run, en de nieuwe knoppen in de lege staten van Schema en onboarding.
2. Test met een schermlezer (TalkBack op Android of VoiceOver op iPhone) of de nieuwe labels logisch klinken.
3. Beoordeel visueel of de iets lichtere tertiaire tekstkleur (contrastfix) overal goed oogt, vooral op het dashboard en in instellingen.
