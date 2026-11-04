# Website lopentelopen.nl

Bron van de website. Sinds 04-11-2026 staat de site in git (eerder `_workspace/website/`, buiten git).

## Publiceren

```bash
node website/src/build.mjs
```

Upload daarna de **inhoud** van `website/public/` naar de webroot bij STRATO, inclusief het verborgen bestand `.htaccess`. `public/` wordt bij elke build opnieuw gemaakt en staat niet in git.

Na de eerste upload van deze versie (eenmalig):

1. Controleer `https://lopentelopen.nl/`, `https://www.lopentelopen.nl/` (moet doorsturen) en een niet-bestaande URL (moet de 404-pagina tonen). Geeft de site een 500-fout, verwijder dan `.htaccess` en meld het.
2. Google Search Console: voeg het domein toe en dien `https://lopentelopen.nl/sitemap.xml` in.
3. Bing Webmaster Tools: importeer de site vanuit Search Console (Bing voedt ook ChatGPT search en Copilot).

## Structuur

| Pad | Wat |
|---|---|
| `src/pages/` | Handgeschreven pagina's (front matter + HTML). `index.html` is de homepage |
| `src/content/` | Artikelen in Markdown (schema's, wedstrijden, tips) |
| `src/layouts/basis.html` | Gedeelde kop, navigatie, footer en meta-tags |
| `src/static/` | Wordt 1-op-1 gekopieerd: `site.css`, `tools.js`, fonts, beelden, `.htaccess`, `bevestigd.html` |
| `src/shots.mjs` | Snijdt app-screenshots bij voor de telefoonmockups |
| `src/og/og.html` | Bron van het deelbeeld `assets/og-image.jpg` (1200×630) |
| `../privacy-policy.html`, `../voorwaarden.html`, `../account-verwijderen.html` | Juridische pagina's, worden bij de build uit de repo-root gekopieerd |

## Een artikel toevoegen

Maak `src/content/<sectie>/<slug>.md` met front matter (zie de kop van `src/build.mjs` voor alle velden) en draai de build. De pagina verschijnt vanzelf in het sectie-overzicht en in `sitemap.xml`.

Vaste opbouw per artikel: H1 = de zoekvraag, `antwoord:` = kort antwoord bovenaan, H2's als vragen met eerst het antwoord, minstens één tabel, een `:::ervaring`-blok met eigen ervaring van Lars of Anne, bronnen in `bronnen:`. Blessure-onderwerpen altijd met `:::disclaimer`.

## Screenshots vervangen

Zet de nieuwe opnames in `_workspace/Screenshots …`, pas de bestandsnamen in `SHOTS` in `src/shots.mjs` aan en draai `node website/src/shots.mjs`. De uitvoernamen (`shot-vandaag.jpg` enz.) blijven gelijk, dus de pagina's hoeven niet te veranderen. Pas wel de `alt`-teksten in `src/pages/index.html` aan als het beeld iets anders toont.

Deelbeeld opnieuw maken: open `src/og/og.html` headless in Chrome op 1200×630 en sla op als `src/static/assets/og-image.jpg` (zie de sessie van 04-11-2026, of vraag Claude).
