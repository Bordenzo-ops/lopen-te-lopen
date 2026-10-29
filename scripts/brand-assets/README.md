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

App Store Connect Header- en Search Results-assets (twee kopvarianten per formaat,
variant via `?v=a|b` in `render.mjs`) komen in `store-assets/app-store-header/`:
`header-{a,b}-5244x2950.png` en `search-{a,b}-3840x2560.png`. Alleen deze baken je
met `node scripts/brand-assets/render.mjs app-store-header`.

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

## Store-screenshots (Apple 6.9" + Google Play)

```bash
node scripts/brand-assets/render.mjs store-screenshots
node scripts/brand-assets/verify-store-screenshots.mjs   # afmetingen + geen alfakanaal
```

Schrijft naar `store-assets/screenshots-2026-10/app-store-6.9/01.png…` (1320×2868, RGB zonder
alfa) en `…/google-play/01.png…` (1080×2160). Dezelfde ontwerpen, per formaat opnieuw opgemaakt.
Dezelfde run exporteert ook de websitebeelden (JPEG, 620 px breed) naar `_workspace/website/assets/`.

Alles wordt gestuurd door `store-screenshots.json`:

- `sources` — per bronbeeld de crop (`top`/`bottom` in px van het bronbestand; Android-statusbalk en
  -navigatiebalk moeten eruit), `quality: 'ok' | 'low'` (bij `low` print render een waarschuwing) en
  bij gestitchte beelden per deel een `offset`.
- `slides` — een regel per slide: `source`, `type` (`single`, `spread-left`, `spread-right`), `kop`, `sub`.
  `*woord*` krijgt het oranje accent. Maximaal 8 slides (Play-limiet).
- Een **panorama** is een spread: de layout tekent één dubbelbrede wereld en toont de linker of
  rechter helft. De oranje streep loopt over de naad door.
- **Vaste telefoonmaat:** `phoneAspect` (nu 0.51) geldt voor alle slides; het telefoonvlak is per formaat
  even breed en staat op dezelfde plek (Apple scherm 1045×2050, Play 782×1534, excl. rand). Een bron wordt een
  **uitsnede**: venster = bronbreedte / phoneAspect rijen hoog. Het venster begint bovenaan, of bij `winTop` op de
  slide (px in het samengestelde beeld na crop; `"end"` = onderkant van de bron). Bij een spread begint de rechterhelft
  standaard direct onder de linker (doorlopend); met een eigen `winTop` sla je bewust een stuk over (slide 05).
  Dit werkt in bronpixels, dus originelen met een andere resolutie schalen vanzelf mee; alleen `top`/`bottom`/`winTop` hoeven zo nodig bijgesteld.
- Een slide toevoegen (bijv. "Start vanaf nul") = een bron en een regel in `slides`; render, klaar.

Layouts: `store-screenshot.html` (single en spread-helft), `store-website-shot.html` (JPEG-export).

**Originelen vervangen = zelfde bestandsnaam in `_workspace/Screenshots Android/`, opnieuw
renderen.** Heeft het nieuwe origineel een andere resolutie, pas dan de `top`/`bottom`/`winTop`
(in px) in de manifest aan en zet `quality` op `ok`.

Bronnen zijn de 1200 px brede originelen (`Screenshot_2026-10-29-…jpg`). De lange scroll-screenshot van de
wedstrijdpagina heeft een scrollnaad-fout (dubbele tekstregel onder "Doeltijd en startvak", daaronder is het
beeld ca. 40 px verschoven). Daarom bestaat de bron `wedstrijd` uit twee delen: de lange screenshot tot rij 4100
en daarna de losse screenshot van het onderste deel (offset 2297, zie manifest). Is er een schone lange opname,
dan kan dat één deel worden.

### App Store "medium display" (6.1"/6.3")

App Store Connect toont soms alleen het vak *iPhone with Dynamic Island (medium display)*; dat accepteert uitsluitend 1206x2622 (of 1179x2556). `render.mjs store-screenshots` maakt daarom naast `app-store-6.9/` ook `app-store-6.3/`: een exacte verkleining van de 6.9"-render (zelfde verhouding binnen 0,06%).

De eerste set (oktober 2026) staat ook als Instagram-storyset in `store-assets/social/instagram-stories-2026-10/` (1080x2160 en 1320x2868); die map wordt niet door render overschreven.
