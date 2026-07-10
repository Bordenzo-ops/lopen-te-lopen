# Bouwplan: Premium en backend

Branch: `feature/premium-backend`. Alle code wordt hier op gecommit, jij reviewt daarna.

## Beslissingen (vastgesteld met Lars)

- Richting deze ronde: Premium en monetisatie plus afmaken/polish van v1.
- Backend: Supabase (auth, Postgres, sync). Abonnementen: RevenueCat (Play Billing, premium-rechten).
- Premium-paywall ontgrendelt: onbeperkt routes plannen en alle wedstrijdschema's, plus ElevenLabs premium-stemmen en coaching. Gratis laag blijft volledig bruikbaar (telefoonstem, basislimieten).
- Prijs (uit strategie): EUR 5,99 per maand of EUR 49 per jaar.
- Agents schrijven productiecode op deze branch, met `tsc --noEmit` verificatie per stap.

## Vaste projectregels (voor elke agent)

- Alle gebruikerszichtbare copy in het Nederlands.
- Nooit het teken "—" gebruiken in copy of code-strings. Gebruik dubbele punt, komma of punt.
- Expo SDK 56, expo-router, zustand, TypeScript. Store: `src/store/appStore.ts`.
- Spraak loopt via `src/services/voiceService.ts` (ElevenLabs met fallback naar expo-speech).
- Mount-cache valkuil: na Edit-wijzigingen bestanden cache-busten (`mv f f.cb && mv f.cb f`) voordat `npx tsc --noEmit` draait, anders ziet tsc afgekapte bestanden.
- Secrets niet hardcoden in versiebeheer. Supabase/RevenueCat keys via `.env` (EXPO_PUBLIC_*) en `app.json` extra, met `.env.example` bijwerken.
- Native modules (Supabase auth storage, RevenueCat) vereisen een nieuwe EAS dev build; documenteer dit, breek de bestaande build niet.

## Domeinen en agents

1. Backend (Supabase): auth, datamodel, client, sync van lokaal naar account.
2. Monetisatie (RevenueCat): SDK, entitlement "premium", paywall-scherm, restore, koppeling aan Supabase-user.
3. Premium-gating: limieten gratis vs premium voor routes/wedstrijden en premium-stemmen.
4. Polish/QA: openstaande review-punten afronden, store-gereed maken, eindverificatie.

## Setup die Lars zelf moet doen (agents leveren code + instructies)

- Supabase-project aanmaken, URL en anon key invullen in `.env`.
- RevenueCat-account, Play Billing-producten en entitlement "premium" configureren, API key invullen.
- Nieuwe EAS dev build maken om native modules te testen.
