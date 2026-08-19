-- ════════════════════════════════════════════════════════════════════════
-- FORMA RPG — postać, poziomy, ranking. Prefiks gm_ (game).
-- Uruchom w Supabase → SQL Editor.
--
-- ZAŁOŻENIE BEZPIECZEŃSTWA: klient NIE MOŻE zapisywać XP ani poziomu.
-- Te kolumny ustawia wyłącznie serwer (service_role) w /api/game/sync,
-- przeliczając wszystko od zera z tabeli wn_sets. Polityki RLS poniżej dają
-- użytkownikowi prawo do odczytu swojego profilu i do zmiany WYŁĄCZNIE nicku.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists gm_profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  -- nick widoczny w rankingu; unikalny bez względu na wielkość liter
  nick          text unique,
  level         int  not null default 1,
  xp            int  not null default 0,
  condition     int  not null default 0,      -- „forma", 0-100
  stat_sila     int  not null default 0,
  stat_wytrz    int  not null default 0,
  stat_dyscyp   int  not null default 0,
  -- XP zdobyte w bieżącym tygodniu ISO — do ligi tygodniowej
  week_xp       int  not null default 0,
  week_key      text,                          -- np. '2026-W34'
  last_training date,
  synced_at     timestamptz,
  created_at    timestamptz not null default now()
);

-- Nick unikalny niezależnie od wielkości liter — „Patryk" i „patryk" to ten sam.
create unique index if not exists gm_profiles_nick_lower on gm_profiles (lower(nick));

/*
  Dziennik przyznanych XP. Klucz (user_id, day, source) jest UNIKALNY, więc
  ponowne przeliczenie tego samego dnia NADPISUJE wpis zamiast go dublować.
  Dzięki temu /api/game/sync można wołać dowolnie często — wynik jest zawsze
  ten sam, a nie rosnący. To także audyt: widać, skąd wzięło się każde XP.
*/
create table if not exists gm_xp_log (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  day       date not null,
  source    text not null,                     -- session | volume | record | steps | streak
  amount    int  not null,
  meta      jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, day, source)
);

create index if not exists gm_xp_log_user_day on gm_xp_log (user_id, day desc);

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table gm_profiles enable row level security;
alter table gm_xp_log   enable row level security;

-- Profil: właściciel czyta swój wiersz.
drop policy if exists "gm_profiles_read_own" on gm_profiles;
create policy "gm_profiles_read_own" on gm_profiles
  for select using (user_id = auth.uid());

/*
  Zapis przez użytkownika: TYLKO nick. Poziom, XP i statystyki muszą zostać
  nietknięte — inaczej wystarczyłby jeden request z DevTools, żeby wskoczyć
  na szczyt rankingu. Serwer działa na service_role i RLS go nie dotyczy.
*/
drop policy if exists "gm_profiles_update_nick" on gm_profiles;
create policy "gm_profiles_update_nick" on gm_profiles
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and level     = (select p.level     from gm_profiles p where p.user_id = auth.uid())
    and xp        = (select p.xp        from gm_profiles p where p.user_id = auth.uid())
    and week_xp   = (select p.week_xp   from gm_profiles p where p.user_id = auth.uid())
    and stat_sila = (select p.stat_sila from gm_profiles p where p.user_id = auth.uid())
  );

-- Zakładanie własnego profilu (z zerowym dorobkiem).
drop policy if exists "gm_profiles_insert_own" on gm_profiles;
create policy "gm_profiles_insert_own" on gm_profiles
  for insert with check (
    user_id = auth.uid() and level = 1 and xp = 0 and week_xp = 0
  );

-- Dziennik XP: użytkownik może go czytać (przejrzystość), ale nie zapisywać.
drop policy if exists "gm_xp_log_read_own" on gm_xp_log;
create policy "gm_xp_log_read_own" on gm_xp_log
  for select using (user_id = auth.uid());

/*
  ── RANKING ────────────────────────────────────────────────────────────
  Widok pokazuje WYŁĄCZNIE to, co ma być publiczne: nick, poziom, XP i
  statystyki. Żadnych user_id, dat treningów ani czegokolwiek, po czym dałoby
  się kogoś zidentyfikować. Profile bez nicku nie trafiają do rankingu —
  dopóki nie wybierzesz nazwy, jesteś niewidoczny.
*/
create or replace view gm_ranking
with (security_invoker = false) as
  select
    nick,
    level,
    xp,
    week_xp,
    stat_sila,
    stat_wytrz,
    stat_dyscyp,
    condition
  from gm_profiles
  where nick is not null;

grant select on gm_ranking to anon, authenticated;
