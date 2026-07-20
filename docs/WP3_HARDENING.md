# WP3 — Sleutelhygiëne & hardening (stappen voor Lars)

De code van WP3 staat in de repo. Deze stappen moet je zelf uitvoeren, omdat
ze secrets zetten en externe consoles raken (harness mag dat niet).

## 1. Route-proxy deployen + ORS-sleutel als secret

De OpenRouteService-sleutel zit niet meer in de app. Alle routeplanner-calls
lopen nu via de edge function `route` (zie `supabase/functions/route/index.ts`),
die de sleutel serverside bewaart en de gebruiker via JWT verifieert.

```
supabase functions deploy route
supabase secrets set ORS_API_KEY=<jouw-openrouteservice-sleutel>
```

- De sleutel die vroeger hardcoded in `premiumConfig.ts` stond is verwijderd.
- **Roteer die oude sleutel** in je OpenRouteService-account: hij heeft in de
  git-historie (en in eerdere app-builds) gestaan en is dus niet meer geheim.
  Maak een nieuwe aan, zet die als `ORS_API_KEY`-secret, en trek de oude in.
- `SUPABASE_URL` en `SUPABASE_ANON_KEY` zijn binnen edge functions standaard al
  beschikbaar; die hoef je niet apart te zetten.

Zonder deze deploy werkt de routeplanner niet meer (hij faalt netjes met
"Route plannen lukt nu niet…"). De rest van de app werkt gewoon door.

## 2. Google Maps-sleutel beperken (Google Cloud Console)

De Maps-sleutel in `app.json` (`android.config.googleMaps.apiKey`) moet in de
app-bundel staan om de kaart te laten werken — dat is normaal voor een
client-side Maps-sleutel. De bescherming zit niet in geheimhouding maar in
**restrictie**, zodat niemand anders de sleutel kan misbruiken:

1. Ga naar https://console.cloud.google.com → APIs & Services → Credentials.
2. Open de Maps-sleutel.
3. Onder **Application restrictions**: kies **Android apps** en voeg toe:
   - Package name: `com.lopentelopen.app`
   - SHA-1 fingerprint van je release-signing certificaat
     (te vinden via Play Console → Setup → App integrity, of
     `keytool -list -v -keystore <jouw.keystore>`).
4. Onder **API restrictions**: beperk tot alleen **Maps SDK for Android**.
5. Opslaan.

> Je gaf eerder in de sessie aan beide sleutels al tot je app te hebben beperkt.
> Deze stappen zijn dan alleen ter controle/vastlegging.

## 3. voiceService — al opgelost door WP1

De oorspronkelijke WP3-taak "voiceService moet het sessie-access-token
meesturen i.p.v. de anon key" is niet meer van toepassing: WP1 (stempakketten)
heeft het runtime-pad naar de `tts`-edge-function volledig verwijderd. De app
roept ElevenLabs/tts tijdens gebruik niet meer aan, dus er gaat daar geen anon
key meer overheen. De `tts`-functie blijft in de repo staan maar wordt door de
app niet aangeroepen.

## Acceptatie WP3

- ✅ Geen werkende geheime sleutels meer in de repo: de ORS-sleutel is uit
  `premiumConfig.ts` verwijderd en zit serverside; de Maps-sleutel is
  client-side (hoort zo) en wordt via GCP-restrictie beschermd.
- ✅ Routeplanner werkt via de edge function `route` (na deploy + secret).
