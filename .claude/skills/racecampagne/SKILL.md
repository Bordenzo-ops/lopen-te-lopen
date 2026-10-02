---
name: racecampagne
description: Bouw of ververs een campagneplaybook rond één hardloopwedstrijd, bijvoorbeeld "/racecampagne bruggenloop-2026" of "maak een campagne voor de Amsterdam Marathon". Gebruik wanneer Lars een wedstrijd tot campagne wil maken, een bestaande campagne wil bijwerken, of wil weten of een race de moeite waard is.
---

# Racecampagne bouwen

Je maakt van één wedstrijd een compleet campagneplaybook. Dit is de mal die het
businessplan bedoelt met "Rotterdam is de speerpunt, niet het plafond": elke race
doorloopt dezelfde stappen en levert hetzelfde soort document op.

Het argument is een raceslug of racenaam. Bestaat er al een playbook in
`_workspace/marketing/campagnes/`, dan ververs je dat in plaats van een nieuw te maken.

## Harde randvoorwaarde: het tijdsbudget van Lars

Lars heeft **1 tot 2 uur per week** voor uitvoering en een toolbudget van
**maximaal 50 euro per maand, zonder advertenties**. Dat is geen detail maar het
ontwerpprincipe van elk playbook dat je schrijft:

- Alles wat tijd kost, is eenmalig en blijft daarna werken (leadmagnet, SEO-pagina,
  App Store-trefwoorden, deelkaart in de app).
- Alles wat wekelijks terugkomt, doet een agent of het gebeurt in één batch van
  maximaal 30 minuten.
- Een taak die elke week handwerk vraagt en niet binnen die 30 minuten past, hoort
  niet in het plan. Schrap hem liever dan hem op te schrijven en niet te doen.

Levert je playbook meer dan twee uur werk per week op, dan is het plan fout, niet Lars.

## Stappenplan

### 1. Lees de staande context

- `.agents/product-marketing.md` is bindend voor positionering, doelgroep en toon.
- `_workspace/marketing/MARKETINGPLAN.md` voor de vaste kanalen, cadans en het agent-team.
- `_workspace/notities/Businessplan-2026-2027.md` voor doelen, prijs en unit economics.

Spreekt je campagne die documenten tegen, dan pas je die documenten aan of je pas je
campagne aan. Laat ze nooit uit elkaar lopen: de agents lezen `product-marketing.md`
elke week en produceren verkeerde content zodra dat bestand veroudert.

### 2. Verifieer de racefeiten, verzin er nooit een

Zoek op het web en noteer per feit de bron en de datum waarop je hem ophaalde:

- Exacte datum en dag van de wedstrijd, en welke afstanden er zijn.
- Wanneer de inschrijving opent en sluit, en of de race pleegt uit te verkopen.
  Dit is het koopmoment en daarmee het scharnierpunt van de hele campagne.
- Aantal deelnemers bij de vorige editie (marktomvang).
- Bijzonderheden van het parcours of de sfeer die je in copy kunt gebruiken.

Kun je een feit niet bevestigen, zet het dan in het playbook als "te verifiëren"
met de vraag erbij. Nooit een aantal, datum of citaat verzinnen.

### 3. Onderzoek wat de concurrentie rond déze race doet

Dit is de stap die de campagne onderscheidend maakt. Kijk minimaal naar:

- **De organisatie zelf.** Bieden ze een trainingsschema, een groepstraining, een
  eigen app? Wat kost dat en wat krijg je ervoor? Dit is je directe alternatief.
- **De grote apps.** Heeft Runna een racepagina voor deze wedstrijd? Wat staat erop?
- **De vakmedia.** Wie staat bovenaan in Google op "trainingsschema <race>"?
  Sites als runners.nl en prorun.nl hebben domeinautoriteit die je niet verslaat op
  hoofdtermen. Zoek de longtail die niemand bezet in plaats van de kop te bevechten.
- **Lokale trainers en verenigingen.** Die vangen de mensen die begeleiding willen
  en bereid zijn te betalen. Wat bieden zij niet? Meestal: iets voor de avonden
  waarop je alleen loopt.

Formuleer daarna in één zin wat er ontbreekt in dat aanbod. Dat gat is de campagne.

### 4. Controleer de naam op botsingen

Zoek de beoogde campagnenaam op vóór je hem vastlegt. Namen die de organisatie zelf
gebruikt zijn onbruikbaar: je wint er nooit mee in Google en je wekt de indruk een
officiële partner te zijn. Dit is een echte val: "Road to Rotterdam" bleek de naam
van het officiële trainingsloopprogramma van de NN Marathon Rotterdam.

### 5. Doe de product-preflight vóór je een campagne voorstelt

Een campagne die verkeer stuurt naar iets dat de app nog niet kan, verbrandt het
verkeer. Controleer in de code en meld het als blokkade als er iets ontbreekt:

- Staat de race in `src/data/rotterdamRaces.ts` met de juiste datum, afstand en
  `registrationOpen`?
- Is de race te kiezen in de **live** versie van de app? Racedata gaat sinds
  augustus 2026 zonder build live via `scripts/publish-races.ts`, maar alleen
  versies vanaf 1.2.0 lezen de serverlijst. Draait er een oudere versie in de
  stores, dan moet de race in de bundel zitten van de build die live staat.
- Bestaat er een schema van de juiste afstand en lengte? Zie
  `src/data/buildRacePlan.ts` voor het bereik per afstand (minimum, basis, maximum
  aantal weken). Valt de tijd tot de race buiten dat bereik, dan is de belofte niet
  waar te maken en moet de campagne een andere insteek krijgen.
- Waar landt iemand die op de advertentie of post klikt? Bestaat die pagina al?

### 6. Bepaal de rol van deze race in het geheel

Een race staat nooit los. Beantwoord expliciet:

- Is dit het einddoel, of een tussenstap naar een grotere race?
- Hoeveel weken zitten er tussen deze race en de volgende in de reeks? Ligt dat
  tussen de 12 en 20 weken, dan is er een natuurlijke vervolgcampagne en dus
  retentie. Schrijf dat vervolg meteen in het playbook.
- Wat is het bewijs dat deze race oplevert voor de volgende? Finishers, verhalen,
  reviews en foto's zijn het startkapitaal van de campagne erna.

### 7. Schrijf het playbook

Naar `_workspace/marketing/campagnes/<slug>.md`, met deze vaste indeling:

1. **De race in feiten** (met bronnen en ophaaldatum)
2. **Het gat in de markt** (uit stap 3, in één zin, daarna onderbouwd)
3. **De campagne-idee** (naam, kernbelofte, waarom die klopt bij deze race)
4. **Preflight** (wat moet er af zijn vóór de eerste post, met blokkades benoemd)
5. **Wat we eenmalig bouwen** (assets die daarna vanzelf blijven werken)
6. **De kalender** (fasen met echte datums, gekoppeld aan het koopmoment)
7. **De wekelijkse routine** (maximaal 30 minuten, expliciet uitgeschreven)
8. **Meten** (welk getal bewijst dat het werkt, en waar je het afleest)
9. **Wat we bewust niet doen** (en waarom)
10. **Risico's en aannames**

Sectie 9 is geen opvulling. Bij 1 tot 2 uur per week is de lijst met dingen die je
laat liggen belangrijker dan de lijst met dingen die je doet.

### 8. Rapporteer aan Lars

Sluit af met: wat er nu klaarstaat, welke preflight-blokkades er zijn, en wat de
eerstvolgende handeling van Lars is. Eén handeling, niet vijf.

## Regels

- Nederlands, je-vorm, en **nooit het teken "—"** in copy of documenten.
- Geen verzonnen cijfers, gebruikers, citaten of reviews. Een testimonial bestaat
  pas als er een echte gebruiker met toestemming achter zit.
- Alles is concept. Agents publiceren nooit zelf en versturen nooit zelf een DM.
- Geen valse schaarste. Is een race werkelijk vaak uitverkocht, dan mag je dat
  zeggen met de bron erbij. Anders niet.
- Claims over de concurrentie moeten verifieerbaar zijn en gedateerd. Prijzen en
  functies van andere apps veranderen; noteer wanneer je ze checkte.
