-- 0001_profiles.sql
-- Tabel voor gebruikersprofielen, gekoppeld aan auth.users.
-- Velden zijn afgeleid van UserProfile in src/store/appStore.ts.
-- Row Level Security staat aan: een gebruiker ziet en schrijft alleen
-- zijn eigen rij.

create table if not exists public.profiles (
  id                    uuid        primary key references auth.users (id) on delete cascade,
  name                  text        not null default '',
  goal                  text        not null,
  start_date            text        not null,            -- ISO datum-string
  max_heart_rate        integer     not null default 0,
  age                   integer     not null default 0,
  voice_guidance        boolean     not null default true,
  voice_type            text,                            -- 'female' of 'male'
  route_planner_enabled boolean,
  is_premium            boolean,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.profiles is 'Hardloopprofiel per gebruiker, gekoppeld aan auth.users.';

-- Row Level Security inschakelen
alter table public.profiles enable row level security;

-- Policies: alleen de eigenaar mag lezen, toevoegen, wijzigen en wissen.
drop policy if exists "Eigen profiel lezen" on public.profiles;
create policy "Eigen profiel lezen"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Eigen profiel toevoegen" on public.profiles;
create policy "Eigen profiel toevoegen"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Eigen profiel wijzigen" on public.profiles;
create policy "Eigen profiel wijzigen"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Eigen profiel wissen" on public.profiles;
create policy "Eigen profiel wissen"
  on public.profiles for delete
  using (auth.uid() = id);
