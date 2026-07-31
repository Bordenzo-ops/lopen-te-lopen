# Merk-assets

Bronbestanden voor de store- en social-beelden van Lopen te Lopen.

## Herrenderen

```bash
node scripts/brand-assets/render.mjs
```

Schrijft naar:

| Bestand | Formaat | Waarvoor |
|---|---|---|
| `store-assets/feature-graphic.png` | 1024×500 | Google Play feature graphic |
| `store-assets/social/promo-story-1080x1920.png` | 1080×1920 | Instagram Story / Reel-cover / TikTok |
| `store-assets/social/promo-feed-1080x1350.png` | 1080×1350 | Instagram feed (4:5) |
| `store-assets/social/deelkaart-story-1080x1920.png` | 1080×1920 | Story/TikTok — toont de deelkaart |
| `store-assets/social/deelkaart-feed-1080x1350.png` | 1080×1350 | Feed — toont de deelkaart |

Vereist een geïnstalleerde Chrome of Edge; `render.mjs` zoekt zelf de juiste plek.
Verder zijn er geen dependencies — de tekst wordt met de Inter-fonts uit
`node_modules/@expo-google-fonts/inter` gezet.

## Waarom een browser en geen AI-beeld met tekst

Het artwork (`plates/`) komt uit Higgsfield, maar bevat bewust géén letters:
AI-modellen zetten typografie onbetrouwbaar, en de merknaam moet altijd goed
gespeld en in Inter staan. De browser zet daarom alle tekst er pixelscherp
overheen. Wil je nieuw artwork, vervang dan een bestand in `plates/` — de
layouts blijven werken zolang de compositie klopt (leeg vlak waar de tekst staat).

## Bestanden

- `brand.css` — kleuren, fonts en de gedeelde merkelementen (oranje streep,
  woordmerk, CTA-pil, merkbalk). Kleuren spiegelen `src/theme/tokens.ts`.
- `plates/` — AI-artwork zonder tekst. `wide` (21:9), `vert` (9:16),
  `feed` (4:5), `texture` (rustige topografie-plaat).
- `*.html` — één pagina per export.
- `preview-cards.html` — layoutcontrole van de vier in-app deelkaarten op
  ware grootte (360×640). Spiegelt de styles van `SharePeriodCard.tsx` en
  `ShareRunCard.tsx`; hiermee zie je overflow zonder de app te bouwen.
  Werk dit bestand bij als je die componenten wijzigt.

## Relatie met de app

`card-story.html` is exact 3× `SharePeriodCard` (die rendert op 360×640 en
wordt op 3× vastgelegd). Deel elke waarde daar door 3 om bij de React
Native-styles uit te komen.

De achtergronden die de app zelf gebruikt staan in `assets/brand/`
(`share-bg-hero.jpg`, `share-bg-texture.jpg`) — 810×1440 JPEG op quality 82
met 4:4:4 chroma, samen ~135 KB.

## Let op

De Google Play feature graphic draagt bewust **geen** store-CTA. Een
"Nu in de App Store"-knop op een Play-asset is tegenstrijdig en kan bij de
review opvallen. De download-CTA staat alleen op de social-beelden.
