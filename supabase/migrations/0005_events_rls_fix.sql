-- 0005_events_rls_fix.sql
-- Repareert de analytics-inname en ruimt de RLS-adviezen van Supabase op.
--
-- WAAROM
-- ------
-- 0003_events gaf `events` bewust alleen een INSERT-policy: analytics is
-- aggregatie-only, een gebruiker hoefde zijn events niet terug te lezen.
-- De client verstuurt echter met `.upsert(..., { onConflict: ... })`, wat
-- PostgREST vertaalt naar `INSERT ... ON CONFLICT DO UPDATE`. Die combinatie
-- kan niet: `ON CONFLICT` moet de unieke index kunnen arbitreren en heeft
-- daarvoor leesrecht op de tabel nodig. Zonder SELECT-policy is de tabel voor
-- de gebruiker onleesbaar en faalt élke upsert met 42501
-- ("new row violates row-level security policy"), ook als er niets botst.
-- Gevolg: sinds 04-08-2026 kwam er geen enkel event binnen (tabel was leeg)
-- en bleven funnel_weekly en events_weekly leeg.
--
-- Gemeten gedrag (INSERT-policy aanwezig, upsert door een ingelogde gebruiker):
--   policies                | plain INSERT | DO NOTHING | DO UPDATE bij conflict
--   alleen INSERT           | ok           | 42501      | 42501
--   INSERT+SELECT           | ok           | ok         | 42501
--   INSERT+SELECT+UPDATE    | ok           | ok         | ok
--
-- WAT DEZE MIGRATIE DOET
-- ----------------------
-- 1. SELECT-policy op events: nodig om ON CONFLICT te laten werken.
-- 2. UPDATE-policy op events: nodig zolang er nog app-versies in omloop zijn
--    die `resolution=merge-duplicates` sturen (t/m 1.3.0, build 27). Vanaf de
--    volgende release gebruikt de client `ignoreDuplicates: true` (DO NOTHING),
--    waarna deze policy weg kan zodra 1.3.0 uitgefaseerd is.
-- 3. Alle policies expliciet op rol `authenticated` in plaats van `public`,
--    wat de "Anonymous Access Policies"-waarschuwingen wegneemt. Anonieme
--    sessies van de app hebben rol `authenticated` (met is_anonymous = true),
--    dus die blijven gewoon werken.
-- 4. `auth.uid()` vervangen door `(select auth.uid())`, zodat Postgres de
--    waarde eenmalig berekent in plaats van per rij. Dit is de fix voor de
--    negen "Auth RLS Initialization Plan"-adviezen.
--
-- Privacy blijft gelijk: een gebruiker raakt uitsluitend zijn eigen rijen. De
-- funnel-views draaien nog steeds als eigenaar en blijven afgeschermd voor
-- anon en authenticated.

-- ── 1 & 2. Ontbrekende policies op events ────────────────────────────────────
drop policy if exists "Eigen events lezen"    on public.events;
drop policy if exists "Eigen events wijzigen" on public.events;

create policy "Eigen events lezen"
  on public.events for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Eigen events wijzigen"
  on public.events for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── 3 & 4. Bestaande policies aanscherpen ────────────────────────────────────
-- ALTER POLICY past rol en expressie in één klap aan, zodat er geen moment
-- ontstaat waarop een tabel zonder policy staat.

alter policy "Eigen events toevoegen" on public.events
  to authenticated
  with check ((select auth.uid()) = user_id);

alter policy "Eigen profiel lezen" on public.profiles
  to authenticated
  using ((select auth.uid()) = id);

alter policy "Eigen profiel toevoegen" on public.profiles
  to authenticated
  with check ((select auth.uid()) = id);

alter policy "Eigen profiel wijzigen" on public.profiles
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy "Eigen profiel wissen" on public.profiles
  to authenticated
  using ((select auth.uid()) = id);

alter policy "Eigen runs lezen" on public.runs
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "Eigen runs toevoegen" on public.runs
  to authenticated
  with check ((select auth.uid()) = user_id);

alter policy "Eigen runs wijzigen" on public.runs
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Eigen runs wissen" on public.runs
  to authenticated
  using ((select auth.uid()) = user_id);
