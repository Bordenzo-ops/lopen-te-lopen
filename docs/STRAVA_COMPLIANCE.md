# Strava-review: aanvraag Standard Tier Level 2

Dossier voor de aanvraag om de athlete-limiet van 10 naar 9.999 te verhogen
(Standard Tier Level 1 → Level 2). Bevat de compliance-check, kant-en-klare
antwoordteksten en de openstaande acties.

Bronnen: [Brand Guidelines](https://developers.strava.com/guidelines/),
[API Agreement](https://www.strava.com/legal/api_policy),
[API FAQ](https://communityhub.strava.com/developers-knowledge-base-14/strava-api-faq-12906).

---

## 1. Waar het over gaat

| | |
|---|---|
| App | Lopen te Lopen (`com.lopentelopen.app`) |
| Huidige tier | Standard Tier Level 1 — 10 atleten |
| Gevraagd | Standard Tier Level 2 — 9.999 atleten |
| Kosten | Geen, boven op het Strava-abonnement dat al loopt |
| Doorlooptijd | Strava noemt 7–10 werkdagen; reken in de praktijk op langer |
| Indienen via | het reviewformulier op [strava.com/settings/api](https://www.strava.com/settings/api) |

Goedkeuring is nadrukkelijk **geen garantie**. Daarom is dit dossier opgezet
als bewijsstuk: elk punt hieronder is aantoonbaar in de code, niet alleen
beloofd.

---

## 2. Compliance-checklist

### Merkgebruik

| Eis | Status | Bewijs |
|---|---|---|
| Officiële "Connect with Strava"-knop bij OAuth | ✅ gedaan | [StravaBrand.tsx](../src/components/ui/StravaBrand.tsx), asset `assets/strava/btn_strava_connect_with_orange.png` |
| Knop ongewijzigd: niet verkleurd, vertaald, bijgesneden of geanimeerd | ✅ gedaan | `<Image>` met originele afmetingen 237×48, `resizeMode="contain"` |
| Interoperabiliteitslogo aanwezig | ✅ gedaan | "Compatible with Strava", horizontaal, licht/donker-variant |
| Logo niet prominenter dan het eigen merk | ✅ gedaan | 16pt hoog, onderaan de kaart, buiten de primaire actie |
| Geen Strava-logo (of deel ervan) als app-icoon | ✅ al goed | app-icoon is eigen huisstijl |
| "Strava" niet in de app-naam | ✅ al goed | app heet "Lopen te Lopen" |
| Strava alleen feitelijk genoemd, in dezelfde tekstgrootte | ✅ al goed | alleen in de koppelingsuitleg in [settings.tsx](<../app/(tabs)/settings.tsx>) |

**Was fout, nu gerepareerd:** de app had een zelfgebouwde knop in de eigen
merkkleur met de tekst "Verbind met Strava". Dat is precies wat de guidelines
verbieden en de meest voorkomende afkeurgrond.

### Datagebruik

| Eis | Status | Bewijs |
|---|---|---|
| Minimale scope | ✅ gerepareerd | `activity:write` — was `activity:write,read` ([stravaService.ts](../src/services/stravaService.ts)) |
| Geen Strava-data lezen, tonen of opslaan | ✅ al goed | de app kent alleen `POST /uploads` en `POST /activities` |
| Geen data naar derden | ✅ al goed | upload gaat rechtstreeks van toestel naar Strava |
| Geen data voor AI/ML-training | ✅ al goed | expliciet vastgelegd in de privacyverklaring |
| Client secret niet in de app-bundel | ✅ al goed | staat als Supabase-secret in [strava-oauth](../supabase/functions/strava-oauth/index.ts) |
| Tokens versleuteld opgeslagen | ✅ al goed | `expo-secure-store` (Keychain/Keystore) |
| CSRF-bescherming op de OAuth-flow | ✅ al goed | state-parameter, gevalideerd in `handleStravaCallback()` |
| Ontkoppelen trekt toegang echt in | ✅ al goed | `disconnectStrava()` roept `/oauth/deauthorize` aan |
| Privacyverklaring benoemt de koppeling | ✅ aangevuld | [privacy-policy.html](../privacy-policy.html), punt 3 |

### Commerciële voorwaarden

| Eis | Status |
|---|---|
| Koppeling **niet** achter een betaalmuur | ✅ gratis voor alle gebruikers |
| Premium verkoopt alleen niet-Strava functionaliteit | ✅ coachstemmen, schema's, routeplanner |

> De API Agreement is hier hard over: *"You may not charge end users, in any
> manner, for access to or use of the Strava API Materials."* De
> Strava-koppeling premium maken is dus geen optie — niet nu, niet later.
> Betaalde functies moeten los staan van Strava en mogen bovendien niet
> "substantially duplicative" zijn van wat Strava zelf aanbiedt.

---

## 3. Antwoordteksten voor het formulier

Strava reviewt in het Engels. Onderstaande teksten kun je overnemen.

**What does your application do?**

> Lopen te Lopen is a Dutch-language running coach app for beginner and
> intermediate runners training toward a specific race distance (5K, 10K,
> half marathon, marathon). The app generates a personalised training schedule,
> records the run with GPS, and delivers real-time audio coaching during the
> session. It is available on the App Store and Google Play.

**How do you use the Strava API?**

> Strictly one-way, write-only. When a runner finishes a session in our app, we
> upload that completed run to their own Strava account — as a GPX file when a
> route was recorded, or as a manual activity when it was not. We request the
> `activity:write` scope and nothing else. We never read, display, store or
> process any data from a user's Strava account: no activities, no segments, no
> social graph, no profile beyond the athlete's name shown on our settings
> screen to confirm which account is connected.

**Why do you need more than 10 athletes?**

> The app is publicly available on both app stores and the Strava connection is
> an optional feature offered to every user free of charge. Ten connections
> covers the developer and a handful of testers only. We are requesting Standard
> Tier Level 2 so that regular users can send their own runs to their own Strava
> account.

**How do you store and protect athlete data?**

> OAuth tokens are stored encrypted on the user's own device using the platform
> keystore (iOS Keychain / Android Keystore). The authorization-code exchange
> runs in a server-side Supabase Edge Function, because that is where the OAuth
> client secret lives; the function passes the resulting tokens straight back
> to the device and never stores or logs them. The client secret is never
> shipped in the app bundle. The OAuth flow is protected
> with a CSRF state parameter. Disconnecting in our app calls Strava's
> `/oauth/deauthorize` endpoint, so access is genuinely revoked and not merely
> forgotten locally.

**Do you share athlete data with third parties or use it to train AI models?**

> No. Run data is uploaded directly from the user's device to Strava and is not
> shared with any third party. We do not use Strava data — or any user data — to
> train AI or machine-learning models. This is stated explicitly in our privacy
> policy.

---

## 4. Screenshots om mee te sturen

Maak deze op een echt toestel, in de nieuwe build:

1. **Instellingen → Koppelingen, niet verbonden.** De officiële "Connect with
   Strava"-knop en het "Compatible with Strava"-logo moeten allebei in beeld.
2. **Het Strava-toestemmingsscherm** zoals de gebruiker het krijgt, met de
   gevraagde permissie zichtbaar.
3. **Instellingen → Koppelingen, verbonden.** Atletennaam, de schakelaar voor
   automatisch uploaden, de ontkoppelknop en het merklogo.
4. **Een geüploade activiteit op strava.com**, als bewijs dat de flow werkt.

---

## 5. Wat jij nog moet doen

1. **Nieuwe build maken en de flow testen.** De smallere scope en de nieuwe knop
   zitten pas in een verse build. Let op: jouw eigen koppeling draait nog op een
   token met de oude scope — ontkoppel en verbind opnieuw, anders test je de
   oude situatie.
2. **Screenshots maken** volgens de lijst hierboven.
3. **Het formulier invullen** op [strava.com/settings/api](https://www.strava.com/settings/api) met de teksten uit paragraaf 3.
4. **Privacyverklaring op alle drie de plekken bijwerken.** Ik heb `master`
   aangepast; branch `main` (GitHub Pages) en de upload naar lopentelopen.nl
   moeten mee, anders wijst de reviewer naar een verouderde versie.
5. **Play Store-link opzoeken** en toevoegen aan de aanvraag — die staat nergens
   in de repo genoteerd.

---

## 6. De limiet ná deze review

Level 2 geeft 9.999 atleten, maar de **rate limits** worden eerder krap dan dat
aantal: 400 verzoeken per 15 minuten en 4.000 per dag, gedeeld over al je
gebruikers samen.

Eén geüploade run kost ongeveer twee verzoeken (de upload plus af en toe een
tokenverversing, want tokens leven zes uur). Dat is grofweg 2.000 runs per dag.
Bij een gemiddelde van een halve run per dag per actieve loper loopt het
tegen de **3.000 à 4.000 gekoppelde actieve gebruikers** aan — ruim vóór de
9.999 atleten.

Dat is geen ramp: de uploadwachtrij in `retryStravaQueue()`
([stravaService.ts](../src/services/stravaService.ts)) vangt een geweigerde
upload al op en probeert het later opnieuw, dus je verliest geen runs. Maar het
is wél het moment om Strava te benaderen over de Extended Access Tier — en dat
is de tier waar die "contact us for a quote" over ging.
