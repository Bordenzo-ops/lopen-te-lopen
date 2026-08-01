---
name: werkpakket
description: Voer een werkpakket (WP1 t/m WP13) uit het technisch jaarplan 2026-2027 uit. Gebruik wanneer Lars een werkpakket noemt, bijv. "/werkpakket WP1" of "voer WP5 uit".
---

# Werkpakket uitvoeren

Je voert één werkpakket uit het technisch jaarplan van Lopen te Lopen uit. Het argument is het WP-nummer (bijv. `WP3`), eventueel met extra aanwijzingen.

## Stappenplan

1. **Lees eerst** `_workspace/notities/Technisch-jaarplan-2026-2027.md` en zoek het genoemde werkpakket op. Lees ook de sectie "Conventies voor elk werkpakket" bovenaan — die gelden altijd.
2. Lees de zakelijke context in `_workspace/notities/Businessplan-2026-2027.md` alleen als het werkpakket dat vereist (bijv. paywall- of campagnewerk).
3. Verken de bestaande code rond het werkpakket vóór je bouwt; sluit aan op bestaande patronen (bijv. `usePremium` voor gating, edge-function-patroon van `supabase/functions/tts`, services in `src/services/`).
4. Voer het werkpakket uit tot aan de acceptatiecriteria die erbij staan. Onduidelijk of te groot? Stel eerst een korte opdeling voor aan Lars in plaats van half werk te leveren.
5. Controleer met `npx tsc --noEmit` dat alles compileert.
6. Commit alleen de bestanden van dit werkpakket (expliciet stagen, nooit `git add -A`), commitbericht in de stijl `Feat: ...` of `Fix: ...` in het Nederlands.

## Grenzen

- **Niet doen:** EAS-builds of store-submits (doet Lars zelf), secrets zetten (doet Lars zelf), prijzen of premium-limieten wijzigen zonder expliciete opdracht, nieuwe app-permissies toevoegen zonder overleg.
- UI-teksten en codecommentaar in het Nederlands; de app is offline-first, dus elke nieuwe feature moet zonder netwerk netjes degraderen.
- Rapporteer aan het eind: wat is af, hoe het aan de acceptatiecriteria voldoet, en wat Lars nog handmatig moet doen (secrets, deploy van edge functions, build).
