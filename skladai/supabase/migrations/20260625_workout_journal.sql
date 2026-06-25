-- ════════════════════════════════════════════════════════════════════════
-- FORMA — Dziennik treningowy (Workout Notebook). Prefiks wn_ żeby nie kolidować
-- z istniejącymi funkcjami Forma (CheckForm, 1RM, Rekordy, Pomiary).
-- Uruchom w Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════════════

-- katalog ćwiczeń użytkownika
create table if not exists wn_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'weighted',   -- 'weighted' | 'bodyweight' | 'weighted_bw' | 'duration'
  unit text not null default 'kg',
  created_at timestamptz not null default now()
);

-- treningi (dni) — szablony rotacji: Góra A, Góra B, Nogi 1...
create table if not exists wn_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  position int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- ćwiczenia przypisane do treningu (szablon + kolejność)
create table if not exists wn_workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references wn_workouts(id) on delete cascade,
  exercise_id uuid not null references wn_exercises(id) on delete cascade,
  position int not null default 0
);

-- wykonana sesja treningu
create table if not exists wn_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid references wn_workouts(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,                  -- null = trening w toku
  note text,
  created_at timestamptz not null default now()
);

-- pojedyncza seria w sesji
create table if not exists wn_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references wn_sessions(id) on delete cascade,
  exercise_id uuid not null references wn_exercises(id) on delete cascade,
  set_index int not null,
  weight_kg numeric(6,2),                   -- null dla bodyweight/duration
  reps int,                                 -- null dla duration
  duration_sec int,                         -- dla 'duration'
  created_at timestamptz not null default now()
);

create index if not exists wn_sets_session_idx on wn_sets (session_id);
create index if not exists wn_sets_exercise_idx on wn_sets (exercise_id);
create index if not exists wn_sessions_user_workout_idx on wn_sessions (user_id, workout_id, finished_at);
-- jedna seria na (sesja, ćwiczenie, numer serii) → czysty upsert z onConflict
create unique index if not exists wn_sets_unique_idx on wn_sets (session_id, exercise_id, set_index);

-- ════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — każdy widzi/edytuje tylko swoje dane.
-- ════════════════════════════════════════════════════════════════════════
alter table wn_exercises enable row level security;
alter table wn_workouts enable row level security;
alter table wn_workout_exercises enable row level security;
alter table wn_sessions enable row level security;
alter table wn_sets enable row level security;

-- wn_exercises: user_id = auth.uid()
drop policy if exists "wn_exercises_owner" on wn_exercises;
create policy "wn_exercises_owner" on wn_exercises
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- wn_workouts: user_id = auth.uid()
drop policy if exists "wn_workouts_owner" on wn_workouts;
create policy "wn_workouts_owner" on wn_workouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- wn_sessions: user_id = auth.uid()
drop policy if exists "wn_sessions_owner" on wn_sessions;
create policy "wn_sessions_owner" on wn_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- wn_workout_exercises: dostęp przez właściciela wn_workouts (join po workout_id)
drop policy if exists "wn_workout_exercises_owner" on wn_workout_exercises;
create policy "wn_workout_exercises_owner" on wn_workout_exercises
  for all
  using (exists (select 1 from wn_workouts w where w.id = workout_id and w.user_id = auth.uid()))
  with check (exists (select 1 from wn_workouts w where w.id = workout_id and w.user_id = auth.uid()));

-- wn_sets: dostęp przez właściciela wn_sessions (join po session_id)
drop policy if exists "wn_sets_owner" on wn_sets;
create policy "wn_sets_owner" on wn_sets
  for all
  using (exists (select 1 from wn_sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from wn_sessions s where s.id = session_id and s.user_id = auth.uid()));

-- ════════════════════════════════════════════════════════════════════════
-- WIDOK POMOCNICZY — progres = najcięższa seria na (user, ćwiczenie, sesja).
-- security_invoker=true → widok respektuje RLS użytkownika pytającego.
-- ════════════════════════════════════════════════════════════════════════
drop view if exists wn_exercise_top_sets;
create view wn_exercise_top_sets
with (security_invoker = true) as
select
  s.user_id,
  st.exercise_id,
  st.session_id,
  s.finished_at,
  max(st.weight_kg) as top_weight,          -- dla 'weighted'
  max(st.reps) as top_reps                  -- dla 'bodyweight'
from wn_sets st
join wn_sessions s on s.id = st.session_id
where s.finished_at is not null
group by s.user_id, st.exercise_id, st.session_id, s.finished_at;
