-- 0008_strava_waitlist.sql
-- Waitlist for the Strava athlete cap, plus a small remote config table.
--
-- Why: Strava allows at most 10 connected athletes until our capacity request
-- is approved. When the cap is full the token exchange returns a 403 and the
-- app offers a waitlist. Once the cap is raised, flipping app_config
-- 'strava_open' to true makes the app show a "connecting works again" card to
-- everyone on the waitlist (no push, the app reads the flag on dashboard focus).
--
-- What this migration does:
--  - strava_waitlist: one row per user. A user may only insert, read and delete
--                     their own row. No update policy: clients never change a row.
--                     notified_at is reserved for server-side use (service-role).
--                     Rows disappear with the account (on delete cascade).
--  - app_config:      generic key/value config, readable by anon and
--                     authenticated, writable by the service-role only.
--                     Seeded with strava_open = false.
--
-- To open Strava connecting for waitlisted users (run as service-role / SQL editor):
--   update public.app_config set value = 'true'::jsonb, updated_at = now()
--    where key = 'strava_open';

-- 1. Strava waitlist --------------------------------------------------------

create table if not exists public.strava_waitlist (
  user_id     uuid        primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  notified_at timestamptz
);

comment on table public.strava_waitlist is 'Users waiting for a free Strava athlete slot. Own row only for clients.';

alter table public.strava_waitlist enable row level security;

drop policy if exists "Own waitlist row insert" on public.strava_waitlist;
create policy "Own waitlist row insert"
  on public.strava_waitlist for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Own waitlist row select" on public.strava_waitlist;
create policy "Own waitlist row select"
  on public.strava_waitlist for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Own waitlist row delete" on public.strava_waitlist;
create policy "Own waitlist row delete"
  on public.strava_waitlist for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.strava_waitlist from public, anon, authenticated;
grant select, insert, delete on public.strava_waitlist to authenticated;
grant all on public.strava_waitlist to service_role;

-- 2. Remote config ----------------------------------------------------------

create table if not exists public.app_config (
  key        text        primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now()
);

comment on table public.app_config is 'Remote app flags. Read-only for clients, written by the service-role only.';

alter table public.app_config enable row level security;

drop policy if exists "Config readable by everyone" on public.app_config;
create policy "Config readable by everyone"
  on public.app_config for select
  to anon, authenticated
  using (true);

revoke all on public.app_config from public, anon, authenticated;
grant select on public.app_config to anon, authenticated;
grant all on public.app_config to service_role;

insert into public.app_config (key, value)
values ('strava_open', 'false'::jsonb)
on conflict (key) do nothing;
