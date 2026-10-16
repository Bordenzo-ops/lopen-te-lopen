-- 0007_entitlements.sql
-- Server-side bron van waarheid voor premium, gevoed door de RevenueCat-webhook
-- (edge function `revenuecat-webhook`).
--
-- Waarom: `profiles.is_premium` werd client-side geschreven vanuit
-- UserProfile.isPremium en stond daardoor bij iedereen op false. Een edge
-- function als `tts` kon dus niet vertrouwen op de premium-status. Nu schrijft
-- alleen de webhook (service-role) naar `entitlements`; een trigger zet daarna
-- profiles.is_premium, zodat bestaande queries (zoals app_stats) blijven werken.
--
-- Wat deze migratie doet:
--  - entitlements:         een rij per gebruiker. Gebruiker mag alleen zijn eigen
--                          rij LEZEN; schrijven kan alleen de service-role.
--  - revenuecat_events:    ruwe webhook-events, id = RevenueCat event-id (PK, dus
--                          idempotent). Geen enkele client-toegang.
--  - apply_entitlement_event(): upsert die verouderde (te laat aankomende)
--                          events negeert, alleen aanroepbaar met service-role.
--  - trigger op entitlements: houdt profiles.is_premium gelijk aan is_active.
--  - trigger op profiles:  clients (ook oudere app-versies die nog is_premium
--                          meesturen) kunnen is_premium niet meer zetten; bij een
--                          nieuw profiel wordt de waarde uit entitlements gehaald.
--
-- Let op: is_active is de status op het moment van het laatste event. Wie
-- "nu premium" wil weten voor een gevoelige beslissing, checkt ook
-- expires_at > now() (zie docs/REVENUECAT_SETUP.md).

-- 1. Entitlements ----------------------------------------------------------

create table if not exists public.entitlements (
  user_id         uuid        primary key references auth.users (id) on delete cascade,
  is_active       boolean     not null default false,
  product_id      text,
  store           text,                 -- APP_STORE, PLAY_STORE, ...
  period_type     text,                 -- TRIAL, INTRO, NORMAL, ...
  environment     text,                 -- SANDBOX of PRODUCTION
  expires_at      timestamptz,
  last_event_type text,
  last_event_at   timestamptz,
  updated_at      timestamptz not null default now()
);

comment on table public.entitlements is 'Premium-status per gebruiker, uitsluitend geschreven door de RevenueCat-webhook.';

alter table public.entitlements enable row level security;

drop policy if exists "Eigen entitlement lezen" on public.entitlements;
create policy "Eigen entitlement lezen"
  on public.entitlements for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.entitlements from public, anon, authenticated;
grant select on public.entitlements to authenticated;
grant all on public.entitlements to service_role;

-- 2. Ruwe webhook-events ---------------------------------------------------

create table if not exists public.revenuecat_events (
  id           text        primary key,          -- RevenueCat event.id (blijft gelijk bij retries)
  event_type   text        not null,
  payload      jsonb       not null,             -- zonder subscriber_attributes
  received_at  timestamptz not null default now(),
  processed_at timestamptz                       -- null = nog niet (succesvol) verwerkt
);

comment on table public.revenuecat_events is 'Ruwe RevenueCat-webhookevents voor idempotentie en debugging. Alleen service-role.';

alter table public.revenuecat_events enable row level security;

revoke all on public.revenuecat_events from public, anon, authenticated;
grant all on public.revenuecat_events to service_role;

-- 3. Upsert die oude events negeert ---------------------------------------

create or replace function public.apply_entitlement_event(
  p_user        uuid,
  p_is_active   boolean,
  p_product_id  text,
  p_store       text,
  p_period_type text,
  p_environment text,
  p_expires_at  timestamptz,
  p_event_type  text,
  p_event_at    timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hit integer;
begin
  insert into public.entitlements as e
    (user_id, is_active, product_id, store, period_type, environment,
     expires_at, last_event_type, last_event_at, updated_at)
  values
    (p_user, p_is_active, p_product_id, p_store, p_period_type, p_environment,
     p_expires_at, p_event_type, p_event_at, now())
  on conflict (user_id) do update set
    is_active       = excluded.is_active,
    product_id      = coalesce(excluded.product_id, e.product_id),
    store           = coalesce(excluded.store, e.store),
    period_type     = coalesce(excluded.period_type, e.period_type),
    environment     = coalesce(excluded.environment, e.environment),
    expires_at      = coalesce(excluded.expires_at, e.expires_at),
    last_event_type = excluded.last_event_type,
    last_event_at   = excluded.last_event_at,
    updated_at      = now()
  where e.last_event_at is null or e.last_event_at <= excluded.last_event_at;
  get diagnostics v_hit = row_count;
  return v_hit > 0;
end;
$$;

revoke all on function public.apply_entitlement_event(uuid, boolean, text, text, text, text, timestamptz, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_entitlement_event(uuid, boolean, text, text, text, text, timestamptz, text, timestamptz) to service_role;

-- 4. profiles.is_premium volgt entitlements --------------------------------

create or replace function public.sync_profile_premium()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set is_premium = new.is_active
   where id = new.user_id
     and is_premium is distinct from new.is_active;
  return null;
end;
$$;

drop trigger if exists entitlements_sync_profile on public.entitlements;
create trigger entitlements_sync_profile
  after insert or update of is_active on public.entitlements
  for each row execute function public.sync_profile_premium();

-- Clients mogen is_premium niet schrijven. Een BEFORE-trigger (in plaats van
-- een kolomrecht) zodat oudere app-versies die de kolom nog meesturen in hun
-- upsert niet stuk gaan: hun waarde wordt stilletjes genegeerd.
create or replace function public.guard_profile_premium()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_premium := (select e.is_active from public.entitlements e where e.user_id = new.id);
    else
      new.is_premium := old.is_premium;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_premium on public.profiles;
create trigger profiles_guard_premium
  before insert or update on public.profiles
  for each row execute function public.guard_profile_premium();

-- Eenmalig: profielen die al een entitlement hebben (leeg bij eerste run).
update public.profiles p
   set is_premium = e.is_active
  from public.entitlements e
 where e.user_id = p.id and p.is_premium is distinct from e.is_active;
