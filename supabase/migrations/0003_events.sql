-- 0003_events.sql
-- Tabel voor productanalytics-events (funnel-metingen, WP2).
-- Elke rij is één gebeurtenis van één gebruiker: onboarding gestart,
-- wedstrijddoel gekozen, paywall getoond, aankoop, run gestart/afgerond, enz.
-- De client stuurt ze offline-first en gebatcht vanuit src/services/analyticsService.ts.
--
-- Privacy: events bevatten géén persoonsgegevens (geen naam, geen locatie).
-- props is een kleine, generieke jsonb met bv. { plan: 'yearly' } of
-- { raceId: '...' }. Row Level Security staat aan: een gebruiker mag alleen
-- zijn eigen events TOEVOEGEN en kan ze niet teruglezen. Aggregatie gebeurt
-- serverside (views hieronder + de stats-functie met de service-role key).
--
-- client_event_id is een stabiele id die de app per event genereert, zodat
-- een herhaalde flush (na een mislukte batch) idempotent is: samen met
-- user_id is die uniek en veroorzaakt upsert geen duplicaten.

create table if not exists public.events (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users (id) on delete cascade,
  client_event_id text        not null,
  event_name      text        not null,
  props           jsonb       not null default '{}'::jsonb,
  occurred_at     timestamptz not null default now(),   -- clienttijd van het event
  created_at      timestamptz not null default now(),
  unique (user_id, client_event_id)
);

comment on table public.events is 'Anonieme productanalytics-events per gebruiker (funnel-metingen, WP2). Geen persoonsgegevens.';

create index if not exists events_event_name_idx on public.events (event_name);
create index if not exists events_occurred_at_idx on public.events (occurred_at);
create index if not exists events_user_id_idx     on public.events (user_id);

-- Row Level Security: alleen eigen events toevoegen, niet teruglezen.
alter table public.events enable row level security;

drop policy if exists "Eigen events toevoegen" on public.events;
create policy "Eigen events toevoegen"
  on public.events for insert
  with check (auth.uid() = user_id);

-- Bewust géén select/update/delete-policy voor gewone gebruikers: analytics
-- is aggregatie-only. Het wissen van een account ruimt de events op via de
-- foreign key (on delete cascade).

-- ── Funnel-views (serverside aggregatie) ──────────────────────────────────────
-- Deze views draaien als eigenaar (postgres) en zien dus alle rijen, langs
-- RLS heen. We ontnemen anon/authenticated expliciet leesrechten, zodat ze
-- alleen bereikbaar zijn vanuit de SQL-editor of via de service-role key.

-- Wekelijkse funnel: per kalenderweek (maandag) hoeveel unieke gebruikers elke
-- stap bereikten. Dit is de kernmeting van WP2:
--   install(≈onboarding) -> wedstrijddoel -> paywall -> aankoop.
create or replace view public.funnel_weekly as
select
  date_trunc('week', occurred_at)::date                                         as week_start,
  count(distinct user_id) filter (where event_name = 'onboarding_started')      as onboarding_started,
  count(distinct user_id) filter (where event_name = 'onboarding_completed')    as onboarding_completed,
  count(distinct user_id) filter (where event_name = 'race_goal_chosen')        as race_goal_chosen,
  count(distinct user_id) filter (where event_name = 'paywall_shown')           as paywall_shown,
  count(distinct user_id) filter (where event_name = 'paywall_plan_tapped')     as paywall_plan_tapped,
  count(distinct user_id) filter (where event_name = 'trial_started')           as trial_started,
  count(distinct user_id) filter (where event_name = 'purchase_completed')      as purchase_completed
from public.events
group by 1
order by 1 desc;

comment on view public.funnel_weekly is 'Unieke gebruikers per funnelstap per week (maandag). Kernmeting WP2.';

-- Algemene teller per event per week: handig voor losere analyses (bv. hoeveel
-- runs gestart/afgerond, hoeveel run-kaarten gedeeld).
create or replace view public.events_weekly as
select
  date_trunc('week', occurred_at)::date as week_start,
  event_name,
  count(*)                              as events,
  count(distinct user_id)               as users
from public.events
group by 1, 2
order by 1 desc, 2;

comment on view public.events_weekly is 'Aantal events en unieke gebruikers per event per week.';

revoke all on public.funnel_weekly from anon, authenticated;
revoke all on public.events_weekly from anon, authenticated;
