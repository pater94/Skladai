-- ════════════════════════════════════════════════════════════════════════
-- FORMA RPG, etap 2 — sezony, ligi, questy, osiągnięcia, ciało.
-- Uruchom w Supabase → SQL Editor. Bezpieczna do ponownego uruchomienia.
--
-- ZAŁOŻENIE BEZPIECZEŃSTWA bez zmian: klient nie zapisuje NICZEGO, co
-- wpływa na ranking. Wszystkie nowe kolumny ustawia wyłącznie serwer
-- (service_role) w /api/game/sync. Polityka aktualizacji poniżej rozszerza
-- listę pól chronionych o punkty sezonowe i ligę.
-- ════════════════════════════════════════════════════════════════════════

alter table gm_profiles
  -- Liga: 0 = Brąz … 6 = Legenda. `league_week` pilnuje, żeby rozliczenie
  -- tygodnia wykonało się dokładnie raz.
  add column if not exists league         int  not null default 0,
  add column if not exists best_league    int  not null default 0,
  add column if not exists league_week    text,
  -- Kohorta: numer grupy ~30 osób wewnątrz ligi na dany tydzień.
  add column if not exists cohort         int  not null default 0,
  -- Sezon: punkty resetowane co 8 tygodni. Poziom i XP NIGDY się nie zerują.
  add column if not exists season_key     text,
  add column if not exists season_points  int  not null default 0,
  -- Punkty bieżącego tygodnia — to one decydują o miejscu w lidze.
  add column if not exists week_points    int  not null default 0,
  add column if not exists streak_days    int  not null default 0,
  add column if not exists best_streak    int  not null default 0,
  -- Kompozycja ciała napędzająca wygląd postaci (lib/game/body.ts).
  add column if not exists muscle         int  not null default 30,
  add column if not exists leanness       int  not null default 50,
  add column if not exists body_samples   int  not null default 0,
  -- Płeć kopiowana z profilu, żeby ranking mógł narysować postać bez
  -- sięgania do danych osobowych z tabeli `profiles`.
  add column if not exists gender         text;

create index if not exists gm_profiles_league_cohort on gm_profiles (league, cohort, week_points desc);

/*
  Osiągnięcia — jedyna rzecz w grze, której nie da się stracić.
  Klucz (user_id, achievement_id) jest unikalny, więc XP za odznakę
  nie kapnie dwa razy nawet przy wielokrotnym przeliczeniu.
*/
create table if not exists gm_achievements (
  user_id        uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null,
  xp             int  not null default 0,
  unlocked_at    timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create index if not exists gm_achievements_user on gm_achievements (user_id, unlocked_at desc);

/*
  Historia lig — po co: bez niej po awansie znika ślad, że w ogóle był.
  Jeden wiersz na zamknięty tydzień. Służy też odznakom („byłeś w Diamencie").
*/
create table if not exists gm_league_history (
  user_id     uuid not null references auth.users(id) on delete cascade,
  week_key    text not null,
  league      int  not null,
  cohort      int  not null,
  rank        int  not null,
  points      int  not null,
  outcome     text not null,        -- promoted | stayed | relegated
  created_at  timestamptz not null default now(),
  primary key (user_id, week_key)
);

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table gm_achievements   enable row level security;
alter table gm_league_history enable row level security;

drop policy if exists "gm_ach_read_own" on gm_achievements;
create policy "gm_ach_read_own" on gm_achievements
  for select using (user_id = auth.uid());

drop policy if exists "gm_hist_read_own" on gm_league_history;
create policy "gm_hist_read_own" on gm_league_history
  for select using (user_id = auth.uid());

-- Zapis do obu tabel: wyłącznie service_role. Brak polityki INSERT/UPDATE
-- dla zalogowanego użytkownika oznacza, że nie ma jak ich dotknąć.

/*
  Aktualizacja profilu przez użytkownika: nadal TYLKO nick.

  Lista pól chronionych rośnie razem z grą — gdyby ktoś mógł podnieść sobie
  `season_points` albo `league`, cała rywalizacja przestałaby cokolwiek
  znaczyć. Serwer działa na service_role i te polityki go nie dotyczą.
*/
drop policy if exists "gm_profiles_update_nick" on gm_profiles;
create policy "gm_profiles_update_nick" on gm_profiles
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and level         = (select p.level         from gm_profiles p where p.user_id = auth.uid())
    and xp            = (select p.xp            from gm_profiles p where p.user_id = auth.uid())
    and week_xp       = (select p.week_xp       from gm_profiles p where p.user_id = auth.uid())
    and stat_sila     = (select p.stat_sila     from gm_profiles p where p.user_id = auth.uid())
    and league        = (select p.league        from gm_profiles p where p.user_id = auth.uid())
    and season_points = (select p.season_points from gm_profiles p where p.user_id = auth.uid())
    and week_points   = (select p.week_points   from gm_profiles p where p.user_id = auth.uid())
    and muscle        = (select p.muscle        from gm_profiles p where p.user_id = auth.uid())
    and leanness      = (select p.leanness      from gm_profiles p where p.user_id = auth.uid())
  );

/*
  ── TABLICA LIGOWA ──────────────────────────────────────────────────────
  Publiczna, ale wąska: nick, liga, kohorta, punkty tygodnia i tyle, ile
  trzeba, żeby narysować obok miniaturę postaci. Bez user_id, bez dat
  treningów, bez wagi i bez czegokolwiek, po czym da się kogoś rozpoznać.

  Klient filtruje po swojej lidze i kohorcie — 30 osób, z którymi realnie
  się ściga.
*/
create or replace view gm_league_board
with (security_invoker = false) as
  select
    nick, league, cohort, week_points, season_points, level,
    muscle, leanness, gender, condition
  from gm_profiles
  where nick is not null;

grant select on gm_league_board to anon, authenticated;

-- Ranking wszech czasów zyskuje ligę i sylwetkę; reszta bez zmian.
create or replace view gm_ranking
with (security_invoker = false) as
  select
    nick, level, xp, week_xp, season_points,
    stat_sila, stat_wytrz, stat_dyscyp, condition,
    league, muscle, leanness, gender
  from gm_profiles
  where nick is not null;

grant select on gm_ranking to anon, authenticated;
