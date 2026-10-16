# Finish-garantie — draaiboek

**Status:** voorbereid, niet actief. De paywall toont niets zolang
`FINISH_GUARANTEE_TEXT` in [src/config/finishGuarantee.ts](../src/config/finishGuarantee.ts)
leeg is. Eerst laten toetsen door een jurist, samen met de rest van
`voorwaarden.html` (die staat nog als concept online).

**De belofte:** haal je je wedstrijd niet, dan krijg je een jaar Premium cadeau.
Dat kost ons vrijwel niets en is een sterk verkoopargument op het moment dat
iemand een doel kiest.

---

## 1. Tekst op de paywall

> Haal je je wedstrijd niet? Dan krijg je een jaar Premium cadeau. **Bekijk de voorwaarden**

De link opent `voorwaarden.html#finish-garantie` op de GitHub Pages-spiegel, op
iOS en Android (bewust niet de Apple-EULA; zie `FINISH_GUARANTEE_TERMS_URL` in
[src/config/legalLinks.ts](../src/config/legalLinks.ts)).

---

## 2. Paragraaf voor voorwaarden.html

Invoegen als nieuw hoofdstuk vóór "Wijzigingen" en de nummering daarna
aanpassen. Het `id` is nodig voor de link vanuit de app.

```html
<h2 id="finish-garantie">5. Finish-garantie</h2>
<p>
  Train je met Premium voor een wedstrijd en haal je die niet, dan krijg je een jaar Premium
  cadeau. Daarvoor gelden de volgende voorwaarden:
</p>
<ul>
  <li>Je hebt de wedstrijd in de app als doel gekozen en een wedstrijdschema gevolgd.</li>
  <li>Je had in de laatste acht weken vóór de wedstrijddag onafgebroken een betaald
    Premium-abonnement (maand of jaar). Een gratis proefperiode telt niet mee.</li>
  <li>Je bent in de app ingelogd met een account (e-mail, Apple of Google), zodat we je
    trainingen aan je account kunnen koppelen.</li>
  <li>Je hebt in de app minstens 80% van de trainingen uit je schema afgerond in de periode dat
    je het schema volgde.</li>
  <li>Je bent gestart maar niet binnen de officiële tijdslimiet gefinisht, of je kon door een
    blessure of ziekte niet starten.</li>
  <li>Je vraagt de garantie aan binnen 30 dagen na de wedstrijddag door een e-mail te sturen naar
    <a href="mailto:larsvdb1@hotmail.com">larsvdb1@hotmail.com</a>, met de naam van de wedstrijd en
    het e-mailadres of het Apple- of Google-account waarmee je inlogt. We kunnen je vragen om een
    korte toelichting of om een link naar de uitslag.</li>
</ul>
<p>
  Voldoe je aan de voorwaarden, dan sturen we je binnen 14 dagen een code voor twaalf maanden
  Premium, die je inwisselt in de App Store of Google Play. De garantie geldt één keer per account
  per twaalf maanden en is niet inwisselbaar voor geld. Wordt de wedstrijd door de organisatie
  afgelast of verplaatst, dan geldt de garantie niet. Je wettelijke rechten als consument blijven
  onverminderd van kracht.
</p>
```

**Punten voor de jurist:**
- Is "niet gehaald" zo eenduidig genoeg? Blessure of ziekte wordt bewust niet
  met een medische verklaring bewezen (gezondheidsgegevens willen we niet ontvangen).
- Past de 80%-eis bij art. 6:193 BW (geen misleidende voorwaarden)? Hij staat
  daarom direct onder de belofte gelinkt.
- Moet de garantie ook in de App Store-beschrijving of alleen in de app?

---

## 3. Claim afhandelen (intern)

1. **Account vinden.** Zoek de gebruiker in Supabase op e-mailadres of
   Apple/Google-identiteit (`auth.users` en `auth.identities`).
2. **Premium controleren.** In `public.entitlements` (gevuld door de
   RevenueCat-webhook) of in RevenueCat zelf: betaald abonnement actief in de
   acht weken vóór de wedstrijddag, geen trial.
3. **Inzet controleren.** Tel de events `run_completed` van de gebruiker in de
   schemaperiode tegenover het aantal schematrainingen (trainingsdagen × weken).
   Twijfelgeval of net onder de 80%: ruimhartig zijn, het kost ons weinig.
4. **Code versturen.**
   - iOS: App Store Connect → app → Subscriptions → het jaarabonnement →
     **Offer Codes** → een code voor "12 maanden gratis" (maak vooraf een
     kleine batch eenmalige codes aan).
   - Android: Play Console → Monetiseren → Promotiecodes, of een gratis-proef-
     aanbieding van 12 maanden voor dit doel.
   - Heeft iemand al een lopend jaarabonnement, dan gaat de gratis periode in
     bij de eerstvolgende verlenging; meld dat in de mail.
5. **Vastleggen.** Noteer datum, account en wedstrijd in
   `_workspace/notities/Testfeedback-log.md` of een eigen claimlijst, ook voor
   de regel "één keer per twaalf maanden".

---

## 4. Activeren

1. Jurist toetst `voorwaarden.html` inclusief hoofdstuk 2 hierboven.
2. Paragraaf invoegen in `voorwaarden.html` (bron op `master`), "Laatste update"
   bijwerken en de conceptmelding weghalen als de jurist akkoord is.
3. Op alle drie de plekken zetten: `master`, branch `main` (GitHub Pages) en
   lopentelopen.nl. Controleer dat `voorwaarden.html#finish-garantie` springt naar
   het hoofdstuk.
4. Een kleine batch Offer Codes (iOS) en promotiecodes (Android) klaarzetten.
5. `FINISH_GUARANTEE_TEXT` vullen met de tekst uit hoofdstuk 1. De tekst zit in de
   app-bundel, dus dit gaat live met de eerstvolgende release.
6. Na livegang: in Supabase per paywall-variant volgen of de conversie stijgt
   (`events.props->>'variant'`).
