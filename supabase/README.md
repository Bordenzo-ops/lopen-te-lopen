# Supabase migraties

Deze map bevat de databasemigraties voor de backend van Lopen te Lopen.
De app blijft volledig offline werken: deze backend is additief.

## Inhoud

- `migrations/0001_profiles.sql`: tabel `profiles` (een rij per gebruiker, gekoppeld aan `auth.users`), met Row Level Security.
- `migrations/0002_runs.sql`: tabel `runs` (voltooide hardloopsessies), met Row Level Security.

Beide tabellen hebben RLS aan: een ingelogde gebruiker ziet en schrijft uitsluitend zijn eigen rijen.

## Migraties toepassen

Kies een van de twee manieren.

### Optie A: via de Supabase SQL Editor (snelst)

1. Open je project op https://supabase.com.
2. Ga naar SQL Editor.
3. Plak de inhoud van `0001_profiles.sql`, klik Run.
4. Plak daarna de inhoud van `0002_runs.sql`, klik Run.

Voer de bestanden in volgorde uit (eerst 0001, dan 0002).

### Optie B: via de Supabase CLI

1. Installeer de CLI: https://supabase.com/docs/guides/cli
2. Koppel je project: `supabase link --project-ref <jouw-project-ref>`
3. Pas de migraties toe: `supabase db push`

De CLI pakt de bestanden in `supabase/migrations/` automatisch op de bestandsvolgorde.

## Anonieme gebruikers

De app start standaard een anonieme sessie zodat data alvast veilig staat.
Zet anonieme logins aan in Supabase: Authentication, Providers, Anonymous sign-ins.
Wil je dat een gebruiker later een e-mailaccount koppelt, laat dan de
e-mailprovider aan staan (dat is de standaard).

## Veiligheid

- De app gebruikt alleen de `anon`-sleutel. Door RLS kan een gebruiker nooit
  bij data van een ander.
- Gebruik de `service_role`-sleutel nooit in de app of in versiebeheer.
