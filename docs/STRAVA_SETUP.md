# Strava-koppeling instellen

Korte setupgids om de Strava-koppeling in "Lopen te Lopen" werkend te
krijgen. De code staat al klaar (Edge Function, service, UI); dit zijn de
stappen die alleen jij als accounthouder kunt doen.

## 1. Strava API-app aanmaken

1. Ga naar https://www.strava.com/settings/api en log in met je Strava-account.
2. Maak een nieuwe API-applicatie aan (naam bijv. "Lopen te Lopen").
3. Vul bij **Authorization Callback Domain** het domein van je
   Supabase-project in, zonder `https://` en zonder pad. Bijvoorbeeld:
   `xxxx.supabase.co`
   (Je vindt dit domein in het Supabase-dashboard onder Project Settings
   > API, bij "Project URL".)
4. Na het aanmaken zie je een **Client ID** en **Client Secret**. Bewaar
   beide, die heb je hierna nodig.

## 2. Client secret als Supabase function secret zetten

De client secret mag nooit in de app-bundel terechtkomen. Zet hem daarom
alleen als server-side secret bij Supabase:

```
supabase secrets set STRAVA_CLIENT_ID=jouw_client_id
supabase secrets set STRAVA_CLIENT_SECRET=jouw_client_secret
```

## 3. Client ID in de app zetten

De client ID zelf is niet geheim (die zit ook in de authorize-URL) en mag
dus wel publiek in de app staan.

- In `.env` (lokale ontwikkeling):
  ```
  EXPO_PUBLIC_STRAVA_CLIENT_ID=jouw_client_id
  ```
- In de EAS-omgevingsvariabelen (voor builds), bijvoorbeeld via:
  ```
  eas env:create --name EXPO_PUBLIC_STRAVA_CLIENT_ID --value jouw_client_id --visibility plaintext
  ```
  of via het EAS-dashboard onder Project Settings > Environment variables.

Zolang `EXPO_PUBLIC_STRAVA_CLIENT_ID` leeg is, blijft de koppeling in de
app uitgeschakeld en toont Instellingen een duidelijke melding dat de setup
nog moet gebeuren.

## 4. Edge Function deployen

```
supabase functions deploy strava-oauth --no-verify-jwt
```

De vlag `--no-verify-jwt` is nodig omdat de GET-callback van deze function
rechtstreeks door Strava wordt aangeroepen (na de gebruiker-goedkeuring),
zonder een Supabase-auth-header. Zonder deze vlag zou Supabase die
aanroep afwijzen voordat de function-code ook maar draait.

## 5. Nieuwe EAS dev build

De koppeling gebruikt het bestaande deep link-schema `lopentelopen://`
(geen nieuwe native config nodig), maar een nieuwe `EXPO_PUBLIC_...`
omgevingsvariabele wordt pas meegenomen in een nieuwe build:

```
eas build --profile development --platform android
```

(of het platform en profiel dat je gebruikt voor testen)

## 6. Testflow om te verifiëren

1. Open de app, ga naar **Instellingen > Koppelingen**.
2. Tik op **Verbind met Strava**. Dit opent de Strava-inlog- en
   toestemmingspagina in de browser.
3. Na goedkeuring stuurt Strava je terug naar de Supabase-function, die je
   automatisch doorstuurt naar de app. Je zou een melding "Verbonden met
   Strava" moeten zien met je atletennaam.
4. Loop een (korte) training af in de app. Controleer op strava.com of de
   activiteit verschenen is (kan een paar seconden duren, Strava verwerkt
   uploads asynchroon).
5. Zet in Instellingen de schakelaar "Upload runs automatisch" uit en aan
   om te controleren dat die goed bewaard blijft.
6. Test **Ontkoppel** en verifieer dat de rij weer "Verbind met Strava"
   toont.

Loopt er iets mis? Check eerst de logs van de Edge Function:

```
supabase functions logs strava-oauth
```
