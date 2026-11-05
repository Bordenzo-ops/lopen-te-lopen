# RevenueCat instellen voor Lopen te Lopen

Met RevenueCat regel je de premium-abonnementen op **beide platforms**: Google
Play Billing (Android) en de App Store (iOS). De app is offline-first en
defensief: zonder API-sleutel, zonder netwerk of bij een fout valt alles
stilletjes terug op "geen premium". De gratis laag blijft dan volledig
bruikbaar.

Dit document beschrijft de **volledige, werkende setup** zoals die nu draait,
inclusief de valkuilen die we onderweg tegenkwamen (zie ook de
Probleemoplossing onderaan). Volg de stappen per platform.

> **Eén bron van waarheid: het entitlement `premium`.** De app checkt
> hardgecodeerd op een entitlement met de identifier **`premium`** (kleine
> letters, geen spatie) — zie `src/services/purchaseService.ts`
> (`PREMIUM_ENTITLEMENT_ID`). De *Display Name* mag "Premium toegang" heten,
> maar de **Identifier** moet exact `premium` zijn, anders ziet de app een
> geslaagde aankoop niet als premium.

---

## 1. RevenueCat-project en apps

1. Maak op https://www.revenuecat.com een project aan (bijv. "Lopen te Lopen").
2. Voeg **twee apps** toe binnen het project:
   - een **Google Play Store**-app (Android)
   - een **App Store**-app (iOS)
3. Onthoud dat de config (producten, entitlement, offering) op **projectniveau**
   gedeeld is tussen sandbox en productie; alleen de *klantdata* is per omgeving
   gescheiden.

---

## 2. Producten aanmaken in de stores

### Android (Google Play Console → Monetiseren → Producten → Abonnementen)

Maak twee abonnementen en **activeer** ze:

| Product-ID            | Prijs            | Periode  |
| --------------------- | ---------------- | -------- |
| `premium_maandelijks` | € 5,99 per maand | 1 maand  |
| `premium_jaarlijks`   | € 49 per jaar    | 1 jaar   |

### iOS (App Store Connect → je app → Abonnementen)

Maak dezelfde twee auto-verlengende abonnementen aan in één subscription group:

| Product-ID            | Prijs            | Periode  |
| --------------------- | ---------------- | -------- |
| `premium_maandelijks` | € 5,99 per maand | 1 maand  |
| `premium_jaarlijks`   | € 49 per jaar    | 1 jaar   |

Voor de 14-daagse gratis proefperiode: voeg een **Introductory Offer** (Free
trial) toe aan het jaarabonnement. De app leest de proef automatisch uit
(`getTrialInfo`).

---

## 3. Producten en entitlement koppelen in RevenueCat

1. **Products**: voeg alle vier de store-producten toe (twee Play-, twee
   App-Store-product-ID's), elk gekoppeld aan de juiste app.
2. **Entitlements**: maak één entitlement met identifier exact **`premium`**.
3. **Koppel alle vier de producten** aan het entitlement `premium`
   (zowel de Play- als de App-Store-varianten). Dit is cruciaal: een iOS-aankoop
   die niet aan `premium` hangt, ontgrendelt de app niet.

## 4. Offering aanmaken

1. **Offerings** → maak een offering en zet die als **current** (default).
2. Voeg twee packages toe:
   - **Monthly** → koppel de maandproducten.
   - **Annual** → koppel de jaarproducten.

De app leest de prijzen rechtstreeks uit deze offering. Lukt dat niet, dan
toont de app de vaste terugvalteksten (€ 5,99 p/m, € 49 p/j).

---

## 5. iOS: App-Specific Shared Secret

RevenueCat moet Apple-bonnen kunnen valideren. Zonder dit verschijnen
iOS-aankopen niet en activeert het entitlement niet.

1. App Store Connect → je app → **App Information** (of onder In-App Purchases)
   → kopieer de **App-Specific Shared Secret**.
2. RevenueCat → je **App Store**-app → plak de Shared Secret in het
   bijbehorende veld. (Optioneel, aanbevolen voor StoreKit 2: ook een
   **In-App Purchase Key** toevoegen.)

TestFlight-aankopen zijn **sandbox**; die zie je in RevenueCat alleen met de
**Sandbox data**-toggle aan.

---

## 6. Android: service-account + realtime notificaties (RTDN)

Dit is de Android-tegenhanger van de iOS Shared Secret. Het bestaat uit meerdere
lagen die **allemaal** moeten kloppen. De volgorde hieronder is belangrijk.

### 6a. Service-account aanmaken en aan RevenueCat geven

1. Maak in het **Google Cloud-project dat aan je Play Console hangt** een
   service-account aan (bijv. `revenuecat@<project>.iam.gserviceaccount.com`).
2. Download de **JSON-sleutel** en upload die in RevenueCat → je Play Store-app
   → Service Account Credentials. Status moet **"Valid credentials"** (groen)
   worden.

### 6b. Play Console-rechten — óók op app-niveau (valkuil!)

Rechten in de Play Console bestaan op **twee niveaus**: account-breed én per
app. Het service-account moet de rechten **ook op app-niveau toegewezen**
krijgen voor Lopen te Lopen, anders mag het niets voor deze app — zelfs met
geldige credentials.

- Play Console → **Users & permissions** → het service-account → geef toegang
  tot de app met o.a. **financiële gegevens bekijken** en **bestellingen en
  abonnementen beheren** ("Manage orders and subscriptions").

### 6c. Google Cloud API's aanzetten

In hetzelfde Google Cloud-project (zie `project_id` in de JSON):

- **Google Play Android Developer API** → Enable
- **Cloud Pub/Sub API** → Enable

### 6d. IAM-rol voor het service-account (valkuil!)

Voor RTDN moet RevenueCat namens jou een Pub/Sub-topic kunnen **aanmaken**. Geef
het service-account daarvoor een Pub/Sub-rol in **IAM & Admin → IAM**:

- Principal: `revenuecat@<project>.iam.gserviceaccount.com`
- Rol: **Pub/Sub Admin** (`roles/pubsub.admin`) — Editor volstaat vaak niet.

Zonder deze rol blijft in RevenueCat de topic-dropdown leeg en blijft de melding
"Google Cloud Pub/Sub API must first be enabled" hangen, óók al staat de API aan.

### 6e. RTDN verbinden

RevenueCat → Play Store-app → **Google developer notifications**:

1. Herlaad de pagina (na 6c/6d even 1–2 min wachten op propagatie).
2. Kies de voorgestelde topic in de dropdown (bijv. `Play-Store-Notifications`).
3. Klik **Connect to Google** → **Save changes**. Dit hoort **groen**
   ("Connected") te worden. RevenueCat regelt de Play Console-koppeling dan
   automatisch; je hoeft zelf niets in de Play Console te plakken.

Vanaf nu pusht Google elke aankoop, verlenging, opzegging en refund realtime
naar RevenueCat.

---

## 7. API-sleutels invullen in .env

1. RevenueCat → Project Settings → **API keys**.
2. Kopieer de **public app-specific keys** (niet de secret key):
   - Google Play key (begint met `goog_`)
   - App Store key (begint met `appl_`)
3. Vul in `.env` (kopieer eerst `.env.example` naar `.env`):

   ```
   EXPO_PUBLIC_REVENUECAT_API_KEY=<goog_...>        # Android (Google Play)
   EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=<appl_...>    # iOS (App Store)
   ```

   > Deze namen staan vast in `src/services/purchaseService.ts` (Android leest
   > `EXPO_PUBLIC_REVENUECAT_API_KEY`, iOS `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`).
   > Zet nooit de secret key in de app-bundel of in versiebeheer.

---

## 8. Native build maken

RevenueCat is een native module — werkt niet in Expo Go. Maak een dev- of
release-build met de juiste `goog_`/`appl_`-sleutel erin:

```
npx expo install react-native-purchases
eas build --profile development --platform android   # of ios
```

Installeer die build op je toestel; test **niet** met een lokale debug-build
zonder de sleutel, want dan meldt de app aankopen niet aan RevenueCat.

---

## 9. Betaalmuur en verifiëren

- De betaalmuur staat aan via `PREMIUM_CONFIG.PAYWALL_ACTIVE = true`
  (`src/config/premiumConfig.ts`). Met de muur aan telt uitsluitend een actieve
  RevenueCat-entitlement als premium.
- **Testaankoop Android**: gepubliceerde testtrack (internal testing) +
  license-tester-account. De transactie hoort binnen seconden in RevenueCat te
  verschijnen.
- **Testaankoop iOS**: TestFlight + sandbox-Apple-ID.
- Let bij het zoeken op de **Sandbox/Production**-toggle: TestFlight = sandbox,
  Android license-tester-aankopen staan vaak in de **productie**-weergave.
- Test **Aankopen herstellen** na opnieuw installeren.

---

## Wat de app zelf al doet

- RevenueCat wordt bij app-start best-effort geïnitialiseerd en de
  premium-status wordt ververst (`app/_layout.tsx`).
- Na een geslaagde aankoop wacht de paywall kort tot het entitlement echt
  doorkomt (`waitForPremiumActivation`) en toont altijd feedback — nooit meer
  stil niets doen bij een lag (`app/paywall.tsx`).
- Een `CustomerInfoUpdateListener` werkt de store ook bij zonder dat de
  gebruiker het scherm hoeft te verversen (automatische verlenging, verlopen
  abonnement, aankoop op een ander toestel).
- De appUserID wordt aan de Supabase-user-id gekoppeld wanneer die bekend is
  (`init` / `identifyUser` in `purchaseService.ts`). **Let op:** zonder echte
  login is er vaak geen Supabase-sessie en gebruikt RevenueCat een *anonieme,
  aan de installatie gebonden* id. Zie de sectie hieronder.
- Premium-status leeft in de store (`isPremium`) en is op te vragen via de hook
  `usePremium`. De store **persisteert `isPremium` bewust wél**: een betalende
  gebruiker die offline start mag niet per ongeluk de gratis laag zien. Bij een
  netwerkfout blijft de laatst bekende waarde staan; alleen een bevestigd
  antwoord van RevenueCat overschrijft de cache (`refreshPremium`).

## Bekende beperking: entitlement hangt aan de installatie, niet aan de persoon

Zolang er geen echte gebruikersauthenticatie is, hangt het entitlement aan een
**anonieme RevenueCat-id per installatie**, niet aan een account. Gevolgen:

- Premium "plakt" aan het toestel, ook als je in de store van account wisselt.
- Premium volgt de persoon niet netjes over toestellen heen (alleen via
  store-account-herstel met "Aankopen herstellen").

De nette oplossing is echte auth + `Purchases.logIn(userId)` zodat de RevenueCat
App User ID gelijk is aan de ingelogde gebruiker. Zie het aparte
authenticatie-werkpakket.

---

## Webhook naar Supabase

Voor een server-side bron van waarheid over premium stuurt RevenueCat elk
abonnementsevent naar de edge function `revenuecat-webhook`. Die houdt de tabel
`public.entitlements` bij (een rij per Supabase-gebruiker: `is_active`,
`product_id`, `store`, `period_type`, `expires_at`, ...). Een databasetrigger
zet daarna `profiles.is_premium`. De app zelf schrijft `is_premium` niet meer
(ook oudere app-versies niet: een trigger negeert het).

- Migratie: `supabase/migrations/0007_entitlements.sql`
- Function: `supabase/functions/revenuecat-webhook/index.ts` (draait met
  `--no-verify-jwt` en controleert de `Authorization`-header zelf tegen het
  secret `REVENUECAT_WEBHOOK_AUTH`)
- Ruwe events staan in `public.revenuecat_events` (id = RevenueCat event-id,
  dus idempotent; `subscriber_attributes` worden niet bewaard).

### Instellen

1. Migratie toepassen: Supabase Dashboard, SQL Editor, plak de inhoud van
   `0007_entitlements.sql`, Run. (Vanuit PowerShell kopieer je hem met
   `type supabase\migrations\0007_entitlements.sql | clip`.)
2. Secret aanmaken. Genereer een sterke waarde, bijvoorbeeld met Node:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   Zet hem met `npx supabase secrets set REVENUECAT_WEBHOOK_AUTH=<waarde> --project-ref zefiknynxppgbhiiunre`
   (of Dashboard, Edge Functions, Secrets). Bewaar de waarde even; je plakt
   hem zo ook in RevenueCat.
3. Deployen: `npx supabase functions deploy revenuecat-webhook --project-ref zefiknynxppgbhiiunre --no-verify-jwt`
4. In RevenueCat: Project, **Integrations**, **Webhooks**, **+ New**:
   - Webhook URL: `https://zefiknynxppgbhiiunre.supabase.co/functions/v1/revenuecat-webhook`
   - Authorization header value: `Bearer <waarde van REVENUECAT_WEBHOOK_AUTH>`
   - Environment: sandbox en productie, events: alle.
   - Opslaan, daarna **Send test event**. Verwacht 200; in Supabase, Edge
     Functions, Logs staat dan `revenuecat-webhook <id> TEST test`.
5. Optioneel, alleen voor het `TRANSFER`-event (herstel op een ander account):
   zet `REVENUECAT_API_KEY` (secret API key v1, `sk_...`, RevenueCat, Project
   settings, API keys) als Supabase-secret. Zonder deze sleutel verliest de
   bron-gebruiker zijn entitlement en krijgt de bestemming het bij zijn
   eerstvolgende event.

### Hoe events vertaald worden

- `is_active` = het entitlement `premium` hoort bij het event **en**
  `expiration_at_ms` ligt in de toekomst. `EXPIRATION` zet altijd op false.
- `CANCELLATION`, `BILLING_ISSUE` (tot het einde van de grace period) en
  `SUBSCRIPTION_PAUSED` trekken de toegang niet in; die loopt door tot de
  verloopdatum. Een refund zet de verloopdatum in het verleden en dus op false.
- De gebruiker wordt bepaald via `app_user_id`, dan `original_app_user_id`, dan
  de aliassen; alleen uuid's die in `auth.users` bestaan. Events zonder bekende
  gebruiker krijgen 200 en staan ruw in `revenuecat_events`.
- Te laat aankomende events overschrijven een nieuwer event niet.

### Premium controleren in een edge function (bijv. `tts`)

`tts` is hiervoor nog niet aangepast. Met de service-role client:

```ts
const { data } = await supabase
  .from('entitlements')
  .select('is_active, expires_at')
  .eq('user_id', user.id)
  .maybeSingle();
const isPremium = !!data?.is_active && (!data.expires_at || new Date(data.expires_at) > new Date());
```

### Actieve abonnees tellen (SQL Editor)

```sql
select store, period_type, environment, count(*) as actief
from public.entitlements
where is_active and (expires_at is null or expires_at > now())
group by store, period_type, environment
order by store, period_type;
```

Let op: `SANDBOX` (TestFlight, license testers) staat in dezelfde tabel; filter
op `environment = 'PRODUCTION'` voor echte abonnees.

---

## Analyse van klanten

Migratie `supabase/migrations/0009_subscription_funnel.sql` maakt de view
`public.subscription_customers`: een rij per klant (alleen PRODUCTION, zonder
PROMOTIONAL en TEST) met trial, omzetting, opzegging, verloop, omzet en
appgedrag (onboarding-doel, wedstrijd gekozen, echte runs, laatst actief). Toepassen
zoals 0007: plak de inhoud in de SQL Editor en Run. De view is alleen leesbaar
via de SQL Editor of de service-role, nooit via de client-API.

```sql
-- Funnel in een oogopslag
select status, count(*) from public.subscription_customers group by 1 order by 2 desc;

-- Trials die niet zijn omgezet: deden ze iets in de app?
select user_id, product_id, trial_started_at, status, cancel_reason,
       onboarding_goal, race_chosen, real_runs_first_14d, last_event_at
  from public.subscription_customers
 where status in ('trial_cancelled', 'expired') and converted_at is null
 order by trial_started_at desc;

-- Omzetting naar aantal echte runs in de eerste 14 dagen
select least(real_runs_first_14d, 5) as runs_14d,
       count(*) as trials,
       count(*) filter (where converted_at is not null) as omgezet
  from public.subscription_customers
 where trial_started_at is not null
 group by 1 order by 1;
```

Klanten met een `rc_anonymous_id` maar zonder `user_id` hebben gekocht zonder
Supabase-account; voor hen is er geen appgedrag te koppelen.

## Controle: komen opzeggingen binnen?

Vaststelling op 05-11-2026: `revenuecat_events` heeft tot nu toe nog **nooit** een
`CANCELLATION`-event ontvangen, terwijl er wel een trial is opgezegd. Controleer
waar het misgaat:

1. Check in de database wat er wel binnenkomt:
   `select event_type, payload->>'environment' as env, count(*) from public.revenuecat_events group by 1, 2 order by 1;`
2. RevenueCat-dashboard, **Project settings**, **Integrations**, **Webhooks**,
   open de webhook en controleer:
   - het **event-type-filter** laat alle events door (geen enkel type uitgevinkt,
     CANCELLATION en UNCANCELLATION zeker niet);
   - de **environment** staat op Production en Sandbox (of in elk geval op
     Production).
3. Zoek de klant op (Customers, zoek op app user id of via de aankoop) en open
   het CANCELLATION-event in de tijdlijn. Bekijk de **delivery-log** van de
   webhook: is het event verstuurd, en wat was de HTTP-status? 200 betekent
   ontvangen; 401 is een fout `Authorization`-header (secret
   `REVENUECAT_WEBHOOK_AUTH`); 500 is een verwerkingsfout (zie Supabase, Edge
   Functions, Logs).
4. Let op: een opzegging van een trial komt als `CANCELLATION` zodra de klant
   auto-renew uitzet in de store. Is er in de tijdlijn van de klant geen
   CANCELLATION te zien, dan heeft de store het nog niet gemeld (Apple en Google
   kunnen dat vertragen) en ligt het niet aan de webhook.

---

## Probleemoplossing

| Symptoom | Oorzaak / oplossing |
| --- | --- |
| Aankoop bevestigd, maar app doet niets / premium gaat niet aan | Entitlement-lag: is opgelost met `waitForPremiumActivation` + feedback in de paywall. Check ook dat de entitlement-**identifier** exact `premium` is en dat het gekochte product eraan gekoppeld is. |
| iOS-aankoop verschijnt niet in RevenueCat | App-Specific Shared Secret ontbreekt/onjuist (stap 5). |
| Android-aankoop verschijnt niet in RevenueCat | Kijk eerst naar de **Sandbox/Production**-toggle — Android test-aankopen staan vaak in productie. Anders: service-account of app-niveau-rechten (stap 6a/6b). |
| "Pub/Sub API must first be enabled" blijft hangen / topic-dropdown leeg | Pub/Sub API aanzetten (6c) **én** het service-account de rol **Pub/Sub Admin** geven (6d). Daarna 1–2 min wachten en de RevenueCat-pagina herladen. |
| "Connect to Google" geeft een rechtenfout | Service-account mist Play Console-rechten **op app-niveau** (6b) of de Pub/Sub Admin IAM-rol (6d). |
| Premium blijft actief na wisselen van store-account | Verwacht gedrag door de anonieme install-gebonden id (zie beperking hierboven). Los op met echte auth. |

## Gevolgen voor de Android-build en Play Console

- Billing-permissie `com.android.vending.BILLING` wordt automatisch aan de
  samengevoegde AndroidManifest toegevoegd door react-native-purchases.
- In-app betalingen vragen geen losse runtime-permissie (zoals locatie).
- Wel nodig: een actief betaalprofiel (Merchant account), de abonnementen uit
  stap 2, en een gepubliceerde build in minstens een testtrack.
