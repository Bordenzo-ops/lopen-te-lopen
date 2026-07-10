# Supabase instellen voor Lopen te Lopen

Deze backend is additief en optioneel. Zonder de stappen hieronder blijft de
app volledig offline werken: lokaal blijft altijd de bron van waarheid. Door
deze stappen krijg je accounts en synchronisatie, zodat data te herstellen is
op een nieuw toestel.

Volg de stappen in volgorde.

## 1. Supabase-project aanmaken

1. Ga naar https://supabase.com en log in (of maak een gratis account).
2. Klik New project. Kies een naam, bijvoorbeeld lopen-te-lopen, en een regio
   dichtbij (bijvoorbeeld Frankfurt of West Europe).
3. Kies een databasewachtwoord en bewaar dat veilig.
4. Wacht tot het project klaar is met opstarten.

## 2. Sleutels invullen in .env

1. Open in Supabase: Project Settings, API.
2. Kopieer de Project URL en de anon public key.
3. Open in de projectmap het bestand .env (kopieer eerst .env.example naar .env
   als die er nog niet is).
4. Vul in:

   EXPO_PUBLIC_SUPABASE_URL=hier de Project URL
   EXPO_PUBLIC_SUPABASE_ANON_KEY=hier de anon public key

Gebruik nooit de service_role key in de app. Die hoort niet in .env van de app
en niet in versiebeheer.

## 3. Anonieme logins aanzetten

De app start standaard een anonieme sessie zodat data alvast veilig staat.

1. Open in Supabase: Authentication, Providers.
2. Zet Anonymous sign-ins aan.
3. Laat de e-mailprovider aan staan (standaard), zodat een gebruiker later een
   e-mailaccount kan koppelen om data te herstellen.

## 4. Migraties draaien

De tabellen profiles en runs (met Row Level Security) staan in
supabase/migrations/. Twee manieren, kies er een.

### Optie A: SQL Editor (snelst)

1. Open in Supabase: SQL Editor.
2. Plak de inhoud van supabase/migrations/0001_profiles.sql, klik Run.
3. Plak daarna supabase/migrations/0002_runs.sql, klik Run.

Voer ze in volgorde uit: eerst 0001, dan 0002.

### Optie B: Supabase CLI

1. Installeer de CLI: https://supabase.com/docs/guides/cli
2. supabase link --project-ref jouw-project-ref
3. supabase db push

Zie ook supabase/README.md voor meer detail.

## 5. Pakketten installeren

De backend gebruikt twee pakketten. Installeer ze met de Expo-installer zodat de
juiste versies voor SDK 56 worden gekozen:

   npx expo install @supabase/supabase-js react-native-url-polyfill

## 6. Nieuwe EAS dev build maken

Supabase gebruikt AsyncStorage voor de auth-opslag. Dat werkt in een dev build.
Maak een nieuwe build zodat de native onderdelen meekomen:

   eas build --profile development --platform android

Installeer die build op je toestel en start de Metro-server opnieuw met
npx expo start zodat de nieuwe .env-waarden geladen worden.

## 7. Controleren dat het werkt

1. Open de app op de dev build.
2. De app start stilletjes een anonieme sessie. Voltooi een sessie of pas je
   profiel aan.
3. Kijk in Supabase: Table Editor, profiles en runs. Daar horen nu rijen te
   verschijnen die alleen voor jouw gebruiker zichtbaar zijn.

Ziet je geen rijen, dan controleer je: staan de sleutels in .env, is de Metro-
server herstart, staan anonieme logins aan, en zijn de migraties gedraaid.

## Wat er gebeurt zonder backend

Zonder sleutels of zonder netwerk slaat de app alles lokaal op (AsyncStorage)
en blijft alles werken. De synchronisatie is best-effort: ze blokkeert de app
nooit en crasht nooit, ook niet bij een netwerkfout.
