---
name: publiceerweek
description: Maak het publicatiepakket van deze week, klaar om in 20 minuten te plaatsen. Gebruik wanneer Lars wil posten, vraagt wat er deze week klaarstaat, of zegt "/publiceerweek".
---

# Publiceerweek

Je maakt van losse contentconcepten één pakket dat Lars in **20 minuten** kan
plaatsen zonder nog iets te hoeven bedenken, herschrijven of opzoeken.

Dit is de vertaalslag tussen wat de contentmaker-agent bedenkt en wat er
werkelijk online komt. Zonder deze stap blijven goede concepten in een map liggen,
en dat is precies wat er tussen week 27 en week 32 van 2026 gebeurde.

## Stappenplan

1. **Bepaal de week** (ISO-weeknummer van vandaag, tenzij Lars een andere noemt).

2. **Lees, in deze volgorde:**
   - `.agents/product-marketing.md` voor status, positionering en toon. Klopt de
     status daar niet meer met de werkelijkheid, meld dat en werk het bij vóór je
     copy schrijft. Verkeerde status betekent verkeerde call-to-action in elke post.
   - Het lopende campagneplaybook in `_workspace/marketing/campagnes/`. De fase
     waarin de campagne zit bepaalt de boodschap van deze week.
   - De contentconcepten van deze week in `_workspace/marketing/content/`.
   - De laatste weekbriefing in `_workspace/marketing/briefings/` voor de cijfers.

3. **Kies maximaal twee posts.** Niet drie, niet vijf. Bij 1 tot 2 uur per week is
   twee goed geplaatste posts meer waard dan vijf halve. Kies op basis van de
   campagnefase: één post die het verhaal vooruit brengt, één die op zichzelf
   nuttig is voor iemand die je nog niet kent.

4. **Schrijf de definitieve copy uit per platform.** Geen concepten meer, geen
   varianten om uit te kiezen, geen blokhaken om in te vullen. Wat er staat wordt
   geplaatst. Per post:
   - De volledige tekst zoals hij online moet, inclusief hashtags.
   - Welk beeld of welke video erbij hoort, met het pad als het bestand er al is.
   - Moet Lars zelf iets filmen, dan één regel met wat hij precies moet opnemen,
     hoe lang, en wanneer dat hem het minste tijd kost (meestal tijdens een
     training die toch al gepland staat).
   - Het beste moment om te plaatsen, met een reden.

5. **Zet ze in publicatievolgorde** met een aankruisbare lijst, zodat Lars van
   boven naar beneden kan werken en kan stoppen waar hij stopt.

6. **Schrijf naar** `_workspace/marketing/publiceren/<jaar>-W<week>.md`.

7. **Rapporteer in drie regels:** wat er klaarstaat, wat Lars zelf moet filmen of
   opzoeken, en hoeveel minuten het naar schatting kost.

## Regels

- Nederlands, je-vorm, **nooit het teken "—"**, hooguit één emoji per post.
- Geen verzonnen cijfers, gebruikers of reviews. Cijfers komen uit de weekbriefing
  of uit de app, met de datum erbij.
- Jij publiceert nooit zelf en verstuurt nooit zelf een bericht. Alles gaat via Lars.
- Twijfel je of een claim klopt (een functie, een prijs, een racedatum), controleer
  hem in de code of op de bron. Een foute claim in een post kost meer dan een
  gemiste post.
- Herhaal geen onderwerp dat in de vier voorgaande weken al aan bod kwam. Kijk dat
  na in `_workspace/marketing/content/` en `_workspace/marketing/publiceren/`.
