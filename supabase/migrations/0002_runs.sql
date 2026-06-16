-- 0002_runs.sql
-- Tabel voor voltooide hardloopsessies, gekoppeld aan auth.users.
-- Velden zijn afgeleid van CompletedSession in src/store/appStore.ts.
-- Row Level Security staat aan: een gebruiker ziet en schrijft alleen
-- zijn eigen rijen.
--
-- client_run_id is een stabiele id die de app per sessie genereert
-- (sessionId-weekNumber-completedAt). Samen met user_id is die uniek,
-- zodat herhaalde sync idempotent is en geen duplicaten maakt.

create table if not exists public.runs (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users (id) on delete cascade,
  client_run_id       text        not null,
  session_id          text        not null,
  week_number         integer     not null,
  completed_at        text        not null,             -- ISO datum-string
  actual_distance_km  double precision not null default 0,
  duration_seconds    integer     not null default 0,
  avg_pace_sec_per_km double precision not null default 0,
  avg_heart_rate      integer,
  route               jsonb,                            -- array van punten lat, lon, timestamp
  source              text        not null default 'app',
  created_at          timestamptz not null default now(),
  unique (user_id, client_run_id)
);

comment on table public.runs is 'Voltooide hardloopsessies per gebruiker, gekoppeld aan auth.users.';

create index if not exists runs_user_id_idx on public.runs (user_id);

-- Row Level Security inschakelen
alter table public.runs enable row level security;

-- Policies: alleen de eigenaar mag lezen, toevoegen, wijzigen en wissen.
drop policy if exists "Eigen runs lezen" on public.runs;
create policy "Eigen runs lezen"
  on public.runs for select
  using (auth.uid() = user_id);

drop policy if exists "Eigen runs toevoegen" on public.runs;
create policy "Eigen runs toevoegen"
  on public.runs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Eigen runs wijzigen" on public.runs;
create policy "Eigen runs wijzigen"
  on public.runs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Eigen runs wissen" on public.runs;
create policy "Eigen runs wissen"
  on public.runs for delete
  using (auth.uid() = user_id);
