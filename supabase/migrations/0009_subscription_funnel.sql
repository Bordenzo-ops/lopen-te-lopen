-- 0009_subscription_funnel.sql
-- Klantoverzicht voor het abonnement: per klant in een query zien of de trial
-- gestart, omgezet, opgezegd of verlopen is, en wat die klant in de app deed.
--
-- Bronnen (alleen lezen, geen schemawijziging aan bestaande tabellen):
--  - public.revenuecat_events: ruwe RevenueCat-webhookevents (0007).
--  - public.events:            productanalytics-events (0003), voor onboarding,
--                              wedstrijdkeuze en hardloopgedrag.
--
-- Wat de view doet:
--  - Eén rij per klant. De klant is de Supabase-uuid uit app_user_id, met
--    terugval op original_app_user_id en daarna de aliassen (zelfde volgorde als
--    de webhook). Ids die geen uuid zijn (`$RCAnonymousID:...`) komen in
--    rc_anonymous_id, zodat anonieme klanten zichtbaar blijven. Heeft een klant
--    een uuid, dan wordt die gebruikt en groeien anonieme en ingelogde events
--    samen tot een rij (mits de uuid in de aliassen van het event staat).
--  - Alleen environment PRODUCTION; PROMOTIONAL-periodes en TEST-events vallen af.
--  - status: 'trial' (loopt), 'trial_cancelled' (trial loopt maar is opgezegd),
--    'paying' (omgezet, verlengt), 'cancelled' (betaald, opgezegd, loopt nog uit),
--    'expired' (EXPIRATION ontvangen, of de laatst bekende einddatum is voorbij).
--  - converted_at = eerste RENEWAL met period_type NORMAL bij een klant die met
--    een TRIAL begon.
--  - real_runs_* tellen run_completed met props.distanceKm > 0.
--  - last_event_at = laatste rij in public.events van die user: benadering van
--    "laatst actief". Klanten zonder uuid hebben geen app-events.
--
-- Beveiliging: security_invoker = true en alle rechten voor anon/authenticated
-- ingetrokken. Alleen service_role en de SQL-editor in het dashboard (postgres)
-- kunnen de view lezen. Ruwe betaaldata mag nooit via de client-API komen.
--
-- Voorbeeldqueries (SQL Editor):
--
--   -- Funnel in een oogopslag
--   select status, count(*) from public.subscription_customers group by 1 order by 2 desc;
--
--   -- Trials die verlopen of opgezegd zijn: deden ze iets in de app?
--   select user_id, product_id, trial_started_at, status, cancel_reason,
--          onboarding_goal, race_chosen, real_runs_first_14d, last_event_at
--     from public.subscription_customers
--    where status in ('trial_cancelled', 'expired') and converted_at is null
--    order by trial_started_at desc;
--
--   -- Omzetting trial -> betaald, naar aantal echte runs in de eerste 14 dagen
--   select least(real_runs_first_14d, 5) as runs_14d,
--          count(*) as trials,
--          count(*) filter (where converted_at is not null) as omgezet
--     from public.subscription_customers
--    where trial_started_at is not null
--    group by 1 order by 1;
--
--   -- Omzet per valuta
--   select currency, sum(revenue) from public.subscription_customers group by 1;

create or replace view public.subscription_customers
with (security_invoker = true)
as
with raw as (
  -- 1. Relevante events met getypeerde velden. Ids blijven tekst.
  select
    r.id,
    r.event_type,
    r.payload ->> 'period_type'                          as period_type,
    r.payload ->> 'product_id'                           as product_id,
    r.payload ->> 'store'                                as store,
    r.payload ->> 'cancel_reason'                        as cancel_reason,
    r.payload ->> 'currency'                             as currency,
    (r.payload ->> 'price_in_purchased_currency')::numeric as price,
    to_timestamp((r.payload ->> 'event_timestamp_ms')::double precision / 1000.0) as event_at,
    to_timestamp((r.payload ->> 'purchased_at_ms')::double precision / 1000.0)    as purchased_at,
    to_timestamp((r.payload ->> 'expiration_at_ms')::double precision / 1000.0)   as expires_at,
    r.payload ->> 'app_user_id'                          as app_user_id,
    r.payload ->> 'original_app_user_id'                 as original_app_user_id,
    case when jsonb_typeof(r.payload -> 'aliases') = 'array'
         then r.payload -> 'aliases' else '[]'::jsonb end as aliases
  from public.revenuecat_events r
  where r.payload ->> 'environment' = 'PRODUCTION'
    and r.event_type not in ('TEST', 'TRANSFER')
    and coalesce(r.payload ->> 'period_type', '') <> 'PROMOTIONAL'
),
ev as (
  -- 2. Klant bepalen: eerste uuid (app_user_id, original, aliassen), anders het
  --    eerste niet-uuid id als rc_anonymous_id.
  select
    raw.*,
    coalesce(
      case when raw.app_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then raw.app_user_id::uuid end,
      case when raw.original_app_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then raw.original_app_user_id::uuid end,
      (select a.alias::uuid
         from jsonb_array_elements_text(raw.aliases) with ordinality as a(alias, n)
        where a.alias ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        order by a.n
        limit 1)
    ) as user_id,
    coalesce(
      case when raw.app_user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then raw.app_user_id end,
      case when raw.original_app_user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then raw.original_app_user_id end
    ) as rc_anonymous_id
  from raw
),
keyed as (
  select ev.*, coalesce(ev.user_id::text, ev.rc_anonymous_id) as customer_key
  from ev
  where coalesce(ev.user_id::text, ev.rc_anonymous_id) is not null
),
sub as (
  -- 3. Abonnementsgeschiedenis per klant.
  select
    k.customer_key,
    min(k.user_id::text)::uuid                                   as user_id,
    min(k.rc_anonymous_id)                                       as rc_anonymous_id,
    (array_agg(k.product_id order by k.event_at desc)
       filter (where k.product_id is not null))[1]               as product_id,
    (array_agg(k.store order by k.event_at desc)
       filter (where k.store is not null))[1]                    as store,
    min(coalesce(k.purchased_at, k.event_at))
       filter (where k.event_type = 'INITIAL_PURCHASE')          as first_purchase_at,
    min(coalesce(k.purchased_at, k.event_at))
       filter (where k.event_type = 'INITIAL_PURCHASE' and k.period_type = 'TRIAL') as trial_started_at,
    -- purchased_at = start of the paid period (the actual conversion moment);
    -- event_at can be hours later when the store notification arrives late.
    min(coalesce(k.purchased_at, k.event_at))
       filter (where k.event_type = 'RENEWAL' and k.period_type = 'NORMAL')         as first_normal_renewal_at,
    max(k.event_at) filter (where k.event_type = 'CANCELLATION')      as last_cancel_at,
    max(k.event_at) filter (where k.event_type = 'UNCANCELLATION')    as last_uncancel_at,
    max(k.event_at) filter (where k.event_type = 'EXPIRATION')        as last_expiration_at,
    max(k.event_at) filter (where k.event_type in
       ('INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION')) as last_active_at,
    (array_agg(k.cancel_reason order by k.event_at desc)
       filter (where k.event_type = 'CANCELLATION'))[1]          as cancel_reason,
    (array_agg(k.expires_at order by k.event_at desc)
       filter (where k.expires_at is not null))[1]               as expires_at,
    coalesce(sum(k.price) filter (where k.event_type in
       ('INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE')), 0) as revenue,
    min(k.currency) filter (where k.price is not null)                as currency,
    max(k.event_at)                                                   as last_revenuecat_event_at
  from keyed k
  group by k.customer_key
),
cust as (
  -- 4. Afgeleide momenten en status.
  select
    s.*,
    coalesce(s.trial_started_at, s.first_purchase_at) as started_at,
    case when s.trial_started_at is not null then s.first_normal_renewal_at end as converted_at,
    case when s.last_cancel_at is not null
          and (s.last_uncancel_at is null or s.last_cancel_at > s.last_uncancel_at)
         then s.last_cancel_at end as cancelled_at,
    case when s.last_expiration_at is not null
          and (s.last_active_at is null or s.last_expiration_at >= s.last_active_at)
         then s.last_expiration_at end as expired_at
  from sub s
),
usage as (
  -- 5. Gedrag in de app, alleen voor klanten met een uuid.
  select
    c.customer_key,
    (array_agg(e.props ->> 'goal' order by e.occurred_at desc)
       filter (where e.event_name = 'onboarding_completed'))[1] as onboarding_goal,
    coalesce(bool_or(e.event_name = 'race_goal_chosen'), false) as race_chosen,
    count(*) filter (where e.event_name = 'run_completed'
      and case when e.props ->> 'distanceKm' ~ '^[0-9]+(\.[0-9]+)?$'
               then (e.props ->> 'distanceKm')::numeric end > 0)   as real_runs_total,
    count(*) filter (where e.event_name = 'run_completed'
      and case when e.props ->> 'distanceKm' ~ '^[0-9]+(\.[0-9]+)?$'
               then (e.props ->> 'distanceKm')::numeric end > 0
      and c.started_at is not null
      and e.occurred_at >= c.started_at
      and e.occurred_at <  c.started_at + interval '14 days')      as real_runs_first_14d,
    min(e.occurred_at) filter (where e.event_name = 'run_completed'
      and case when e.props ->> 'distanceKm' ~ '^[0-9]+(\.[0-9]+)?$'
               then (e.props ->> 'distanceKm')::numeric end > 0)   as first_real_run_at,
    max(e.occurred_at)                                             as last_event_at
  from cust c
  join public.events e on e.user_id = c.user_id
  group by c.customer_key
)
select
  c.user_id,
  c.rc_anonymous_id,
  c.product_id,
  c.store,
  c.trial_started_at,
  c.converted_at,
  c.cancelled_at,
  c.cancel_reason,
  c.expired_at,
  c.expires_at,
  case
    when c.expired_at is not null or c.expires_at < now() then 'expired'
    when c.converted_at is null and c.trial_started_at is not null then
      case when c.cancelled_at is not null then 'trial_cancelled' else 'trial' end
    when c.cancelled_at is not null then 'cancelled'
    else 'paying'
  end as status,
  c.revenue,
  c.currency,
  u.onboarding_goal,
  coalesce(u.race_chosen, false)          as race_chosen,
  coalesce(u.real_runs_total, 0)          as real_runs_total,
  coalesce(u.real_runs_first_14d, 0)      as real_runs_first_14d,
  u.first_real_run_at,
  u.last_event_at,
  c.last_revenuecat_event_at
from cust c
left join usage u on u.customer_key = c.customer_key;

comment on view public.subscription_customers is 'Een rij per betalende/trial-klant (PRODUCTION): trial, omzetting, opzegging, verloop, omzet en appgedrag. Alleen service-role/SQL-editor.';

revoke all on public.subscription_customers from public, anon, authenticated;
grant select on public.subscription_customers to service_role;
