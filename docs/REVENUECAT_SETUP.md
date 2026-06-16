# RevenueCat instellen voor Lopen te Lopen

Met RevenueCat regel je de premium-abonnementen via Google Play Billing. De
app is offline-first en defensief: zonder API-sleutel, zonder netwerk of bij
een fout valt alles stilletjes terug op "geen premium". De gratis laag blijft
dan volledig bruikbaar. Door de stappen hieronder krijg je echte abonnementen,
een werkende betaalmuur en herstel van aankopen op een nieuw toestel.

Volg de stappen in volgorde.

## 1. RevenueCat-account aanmaken

1. Ga naar https://www.revenuecat.com en maak een gratis account.
2. Maak een nieuw project, bijvoorbeeld Lopen te Lopen.
3. Voeg in het project een app toe van het type Google Play Store.

## 2. Play Billing-producten aanmaken

Maak in de Google Play Console twee abonnementsproducten aan. Open de Play
Console, kies je app, ga naar Monetiseren, Producten, Abonnementen.

Maak deze twee abonnementen:

1. Maandelijks abonnement
   - Product-ID, bijvoorbeeld: premium_maandelijks
   - Prijs: EUR 5,99 per maand
   - Factureringsperiode: 1 maand

2. Jaarlijks abonnement
   - Product-ID, bijvoorbeeld: premium_jaarlijks
   - Prijs: EUR 49 per jaar
   - Factureringsperiode: 1 jaar

Activeer beide abonnementen. Zonder een actief verkoopaccount en een
ondertekende app in een testtrack kun je niet testen met echte aankopen,
gebruik daarvoor een interne test of de licentietester.

## 3. Producten koppelen in RevenueCat

1. Open in RevenueCat: Products. Voeg de twee Play-product-IDs toe
   (premium_maandelijks en premium_jaarlijks).
2. Open Entitlements. Maak een entitlement met de identifier exact: premium
   Let op: de app verwacht precies deze naam (kleine letters).
3. Koppel beide producten aan het entitlement premium.

## 4. Offering aanmaken

1. Open in RevenueCat: Offerings.
2. Maak een offering en zet die als current (de standaard).
3. Voeg twee packages toe in deze offering:
   - Het maandpakket: kies het type Monthly en koppel premium_maandelijks.
   - Het jaarpakket: kies het type Annual en koppel premium_jaarlijks.

De app leest de prijzen rechtstreeks uit deze offering (Monthly en Annual).
Lukt dat niet, dan toont de app de vaste teksten EUR 5,99 per maand en
EUR 49 per jaar als terugval.

## 5. API-sleutel invullen in .env

1. Open in RevenueCat: Project Settings, API keys.
2. Kopieer de public app-specific key voor Google Play (begint meestal met
   goog_). Gebruik niet de secret key.
3. Open in de projectmap het bestand .env (kopieer eerst .env.example naar
   .env als die er nog niet is).
4. Vul in:

   EXPO_PUBLIC_REVENUECAT_API_KEY=hier de Google Play public key

Zet nooit de secret key in .env van de app en niet in versiebeheer.

## 6. Pakket installeren

Installeer react-native-purchases met de Expo-installer, zodat de juiste
versie voor SDK 56 wordt gekozen:

   npx expo install react-native-purchases

## 7. Nieuwe EAS dev build maken

RevenueCat is een native module. Die werkt alleen in een dev build of een
release build, niet in Expo Go. Maak een nieuwe build:

   eas build --profile development --platform android

Installeer die build op je toestel en start de Metro-server opnieuw met
npx expo start zodat de nieuwe .env-waarden geladen worden.

## 8. Betaalmuur activeren

Tijdens de testfase staat de betaalmuur uit, zodat iedereen premium features
kan proberen. Zet de muur aan zodra je de aankopen getest hebt:

1. Open src/config/premiumConfig.ts.
2. Zet PAYWALL_ACTIVE op true.

De feature-gating zelf wordt in een aparte laag geregeld via de hook
usePremium. Dit document gaat alleen over RevenueCat en de paywall.

## 9. Controleren dat het werkt

1. Open de app in de nieuwe dev build.
2. Navigeer naar de betaalmuur (later vanuit een premium feature, of tijdelijk
   via een testknop).
3. Controleer dat de twee opties met de juiste prijzen verschijnen.
4. Doe een testaankoop met een licentietester-account. Daarna hoort de app
   premium te tonen.
5. Test Aankopen herstellen op een schoon toestel of na opnieuw installeren.

## Wat de app zelf al doet

- RevenueCat wordt bij app-start best-effort geinitialiseerd en de
  premium-status wordt ververst (app/_layout.tsx).
- De appUserID wordt gekoppeld aan de Supabase-user-id als die bekend is,
  zodat aankopen aan hetzelfde account hangen op een nieuw toestel.
- Het paywall-scherm staat op de route /paywall (app/paywall.tsx).
- Premium-status leeft in de store (isPremium) en is op te vragen via de hook
  usePremium. De store persisteert isPremium bewust niet: RevenueCat is de
  bron van waarheid en de status wordt elke app-start opnieuw opgehaald.

## Gevolgen voor de Android-build en Play Console

- Billing-permissie: react-native-purchases voegt de permissie
  com.android.vending.BILLING automatisch toe aan de samengevoegde
  AndroidManifest tijdens de build. Je hoeft die dus niet handmatig in
  app.json onder android.permissions te zetten. Controleer na de eerste
  build wel even in de Play Console (App-inhoud, of het gebouwde bundel)
  dat de billing-permissie aanwezig is.
- Geen extra runtime-toestemming: in-app betalingen vragen niet om een
  losse runtime-permissie zoals locatie. Er is dus geen nieuwe toestemming
  die je in de Play Console-vragenlijst (Data safety) hoeft te verklaren
  vanwege RevenueCat zelf.
- Wel nodig in de Play Console: een actief betaalprofiel (Merchant account)
  en de twee abonnementsproducten uit stap 2, plus een gepubliceerde build
  in minstens een testtrack. Zonder dat kun je niet met echte aankopen testen.
- Native module: zowel RevenueCat als de Supabase-auth-opslag zijn native
  afhankelijkheden. Ze werken niet in Expo Go en vereisen een nieuwe EAS
  dev build (stap 7). De bestaande release-build blijft werken zolang de
  drie pakketten nog niet geinstalleerd zijn, want de code valt zonder de
  modules stilletjes terug op offline en geen premium.
