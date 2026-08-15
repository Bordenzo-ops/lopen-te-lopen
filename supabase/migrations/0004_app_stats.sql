-- 0004_app_stats.sql
-- Databasefunctie achter de edge function `stats`.
--
-- Waarom: de edge function haalde eerder tot honderdduizend rijen op om ze in
-- JavaScript op te tellen, en telde gebruikers uit `profiles`. Dat ondertelde
-- fors, want een profiel bestaat pas na de onboarding terwijl elke installatie
-- al een (anoniem) account in auth.users heeft. Hier telt totalUsers de echte
-- accounts en staat het aantal afgeronde onboardings apart als onboardedUsers.
--
-- Privacy: geeft uitsluitend totalen terug, nooit namen, routes of andere
-- gegevens van individuele gebruikers. Security definer, zodat de functie over
-- RLS heen kan tellen; execute is ontnomen aan anon en authenticated, dus
-- alleen de service-role key (de edge function) kan hem aanroepen.
--
-- runs.completed_at is een ISO-tekstveld. Die wordt hier veilig naar
-- timestamptz gecast, met terugval op created_at als de tekst geen datum is.

create or replace function public.app_stats()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
with runs_norm as (
  select
    user_id,
    case when completed_at ~ '^\d{4}-\d{2}-\d{2}' then completed_at::timestamptz else created_at end as ts,
    actual_distance_km,
    duration_seconds
  from public.runs
),
wk as (
  select generate_series(
    date_trunc('week', now()) - interval '7 weeks',
    date_trunc('week', now()),
    interval '1 week') as w
)
select jsonb_build_object(
  'generatedAt',    now(),
  'totalUsers',     (select count(*) from auth.users),
  'newUsers7d',     (select count(*) from auth.users where created_at > now() - interval '7 days'),
  'newUsers30d',    (select count(*) from auth.users where created_at > now() - interval '30 days'),
  'anonymousUsers', (select count(*) from auth.users where is_anonymous),
  'linkedAccounts', (select count(*) from auth.users where not is_anonymous),
  'onboardedUsers', (select count(*) from public.profiles),
  'premiumUsers',   (select count(*) from public.profiles where is_premium),
  'goals',          (select coalesce(jsonb_object_agg(goal, aantal), '{}'::jsonb)
                     from (select goal, count(*) as aantal from public.profiles group by 1) g),
  'totalRuns',      (select count(*) from public.runs),
  'realRuns',       (select count(*) from runs_norm where actual_distance_km > 0 and duration_seconds >= 60),
  'runs7d',         (select count(*) from runs_norm where ts > now() - interval '7 days'),
  'activeUsers7d',  (select count(distinct user_id) from runs_norm where ts > now() - interval '7 days'),
  'activeUsers30d', (select count(distinct user_id) from runs_norm where ts > now() - interval '30 days'),
  'totalKm',        (select coalesce(round(sum(actual_distance_km)::numeric, 1), 0) from public.runs),
  'weeks',          (select coalesce(jsonb_agg(jsonb_build_object(
                        'weekStart', to_char(w, 'YYYY-MM-DD'),
                        'runs',  (select count(*) from runs_norm r where date_trunc('week', r.ts) = w),
                        'km',    (select coalesce(round(sum(r.actual_distance_km)::numeric, 1), 0)
                                  from runs_norm r where date_trunc('week', r.ts) = w),
                        'users', (select count(distinct r.user_id) from runs_norm r where date_trunc('week', r.ts) = w)
                      ) order by w), '[]'::jsonb) from wk),
  'totalEvents',    (select count(*) from public.events),
  'events',         (select coalesce(jsonb_object_agg(event_name, users), '{}'::jsonb)
                     from (select event_name, count(distinct user_id) as users from public.events group by 1) e)
);
$$;

comment on function public.app_stats() is
  'Geaggregeerde, anonieme appstatistieken voor de stats edge function. Security definer: telt over RLS heen, geeft uitsluitend totalen terug. Alleen aanroepbaar met de service-role key.';

revoke all on function public.app_stats() from public, anon, authenticated;
grant execute on function public.app_stats() to service_role;
