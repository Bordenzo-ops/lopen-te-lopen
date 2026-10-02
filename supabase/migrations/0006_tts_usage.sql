-- 0006_tts_usage.sql
-- Databasegebaseerde dagelijkse limiet voor de edge function `tts`.
--
-- Waarom: de function begrensde verzoeken met een in-memory Map. Die is per
-- instantie leeg na elke cold start en wordt niet gedeeld tussen instanties,
-- terwijl anonieme Supabase-gebruikers gratis aan te maken zijn. Zo kon
-- iedereen met een vers anoniem account ElevenLabs-credits verbruiken.
--
-- Wat deze migratie doet:
--  - tts_usage:        teller per gebruiker per UTC-dag (aanroepen + tekens).
--  - tts_usage_global: teller per UTC-dag over alle gebruikers (noodrem).
--  - tts_consume():    telt atomair op en weigert boven de limiet. De limieten
--                      worden door de edge function als parameters meegegeven,
--                      zodat ze zonder nieuwe migratie bij te stellen zijn.
--
-- Privacy en toegang: de tabellen bevatten alleen user-id, dag en aantallen,
-- nooit teksten. RLS staat aan zonder policies, en anon/authenticated krijgen
-- geen rechten: alleen de service-role key (de edge function) kan erbij.

create table if not exists public.tts_usage (
  user_id uuid    not null references auth.users (id) on delete cascade,
  day     date    not null default (now() at time zone 'utc')::date,
  calls   integer not null default 0,
  chars   integer not null default 0,
  primary key (user_id, day)
);

create table if not exists public.tts_usage_global (
  day   date    primary key default (now() at time zone 'utc')::date,
  chars integer not null default 0
);

alter table public.tts_usage        enable row level security;
alter table public.tts_usage_global enable row level security;

revoke all on public.tts_usage        from public, anon, authenticated;
revoke all on public.tts_usage_global from public, anon, authenticated;
grant all on public.tts_usage        to service_role;
grant all on public.tts_usage_global to service_role;

-- Reserveert `p_chars` tekens en één aanroep voor `p_user` op de huidige UTC-dag.
-- Geeft 'ok', 'user_limit' of 'global_limit' terug. Bij een weigering blijft
-- er niets geteld staan. De upserts nemen een rijlock, dus gelijktijdige
-- verzoeken van dezelfde gebruiker kunnen de limiet niet omzeilen.
create or replace function public.tts_consume(
  p_user              uuid,
  p_chars             integer,
  p_max_calls         integer,
  p_max_chars         integer,
  p_max_global_chars  integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day  date := (now() at time zone 'utc')::date;
  v_hit  integer;
begin
  -- 1. Globale noodrem (eerst, zodat een geweigerde aanroep niets blijft tellen).
  insert into public.tts_usage_global as g (day, chars)
  values (v_day, p_chars)
  on conflict (day) do update set chars = g.chars + p_chars
    where g.chars + p_chars <= p_max_global_chars;
  get diagnostics v_hit = row_count;
  if v_hit = 0 then
    return 'global_limit';
  end if;

  -- 2. Limiet per gebruiker.
  insert into public.tts_usage as u (user_id, day, calls, chars)
  values (p_user, v_day, 1, p_chars)
  on conflict (user_id, day) do update
    set calls = u.calls + 1, chars = u.chars + p_chars
    where u.calls + 1 <= p_max_calls and u.chars + p_chars <= p_max_chars;
  get diagnostics v_hit = row_count;
  if v_hit = 0 then
    -- Gebruiker over de limiet: de globale reservering weer terugdraaien.
    update public.tts_usage_global set chars = chars - p_chars where day = v_day;
    return 'user_limit';
  end if;

  return 'ok';
end;
$$;

comment on function public.tts_consume(uuid, integer, integer, integer, integer) is
  'Telt atomair een TTS-aanroep per gebruiker en globaal per UTC-dag en weigert boven de limiet. Alleen aanroepbaar met de service-role key.';

revoke all on function public.tts_consume(uuid, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.tts_consume(uuid, integer, integer, integer, integer) to service_role;
