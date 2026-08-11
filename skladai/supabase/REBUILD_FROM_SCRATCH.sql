-- =====================================================================
-- SkładAI — PEŁNA ODBUDOWA BAZY OD ZERA
-- Użyj TYLKO gdy tworzysz NOWY projekt Supabase (stary usunięty/nie do odzyskania).
-- Jeśli stary projekt jest tylko SPAUZOWANY → NIE używaj tego, po prostu go wznów.
-- Wklej całość do: Supabase Dashboard → SQL Editor → New query → Run.
-- Wszystkie kroki idempotentne (IF NOT EXISTS) — można puścić wielokrotnie.
-- Wygenerowano: 2026-08-11T18:29Z
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────
-- ŹRÓDŁO: supabase/schema.sql
-- ─────────────────────────────────────────────────────────────────
-- SkładAI Database Schema
-- Run this in your Supabase SQL editor to set up the database

-- ============================================================
-- TABLES
-- ============================================================

-- Users profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  name text,
  gender text,
  age integer,
  weight_kg real,
  height_cm real,
  bmi real,
  activity text,
  goal text,
  health jsonb default '{}',
  daily_norms jsonb default '{}',
  onboarding_complete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Scan logs (the KEY table for improving AI and future recommendations)
create table public.scan_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete set null,
  mode text not null,
  scan_type text,                -- normalized: food/cosmetics/suplement/meal/fridge_scan/alcohol_scan/forma
  product_category text,         -- AI-detected: szampon/krem/serum/witamina D/białko serwatkowe/etc.
  brand text,                    -- product brand from AI result
  image_url text,
  image2_url text,
  ocr_text text,                 -- raw OCR text from Google Vision
  ingredients_raw text,          -- same as ocr_text (kept for clarity in recommendation queries)
  ingredients_parsed jsonb,      -- structured JSON array of ingredients from AI
  ai_result jsonb,               -- full AI response
  ai_model text,
  score integer,
  product_name text,
  user_feedback text,
  feedback_note text,
  prompt_version text,
  processing_time_ms integer,
  -- Analytics columns (queryable without jsonb parsing)
  risk_level text,               -- cosmetics: LOW/MED/HIGH
  has_pregnancy_warning boolean default false,
  ocr_succeeded boolean,         -- Vision OCR success (null for non-OCR modes)
  is_two_photo boolean default false,
  ingredient_count integer,      -- number of ingredients detected
  harmful_count integer,         -- ingredients flagged harmful/controversial
  verdict_short text,            -- AI verdict label (Dobry/Słaby/Unikaj/etc.)
  error_type text,               -- null=success, parse_failed/timeout/api_error
  created_at timestamptz default now()
);

-- Diary entries (synced from localStorage)
create table public.diary_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date text not null,
  meal_type text,
  product_name text,
  calories real default 0,
  protein real default 0,
  fat real default 0,
  carbs real default 0,
  sugar real default 0,
  salt real default 0,
  fiber real default 0,
  score integer,
  scan_log_id uuid references public.scan_logs on delete set null,
  created_at timestamptz default now()
);

-- Weight history
create table public.weight_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date text not null,
  weight_kg real not null,
  source text default 'manual',
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.scan_logs enable row level security;
alter table public.diary_entries enable row level security;
alter table public.weight_history enable row level security;

-- Profiles
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can delete own profile"
  on public.profiles for delete
  using (auth.uid() = id);

-- Scan logs
create policy "Users can view own scans"
  on public.scan_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert scans"
  on public.scan_logs for insert
  with check (auth.uid() = user_id OR user_id is null);

-- (Serwer zapisuje skany kluczem service_role, który omija RLS — NIE dodajemy
--  otwartej polityki "Anyone can insert", bo to wektor nadużycia z anon key.)

create policy "Users can delete own scans"
  on public.scan_logs for delete
  using (auth.uid() = user_id);

-- Diary entries
create policy "Users can view own diary"
  on public.diary_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert own diary"
  on public.diary_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update own diary"
  on public.diary_entries for update
  using (auth.uid() = user_id);

create policy "Users can delete own diary"
  on public.diary_entries for delete
  using (auth.uid() = user_id);

-- Weight history
create policy "Users can view own weight"
  on public.weight_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own weight"
  on public.weight_history for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own weight"
  on public.weight_history for delete
  using (auth.uid() = user_id);

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- STORAGE
-- ============================================================

-- Create storage bucket for scan images
insert into storage.buckets (id, name, public)
values ('scans', 'scans', true);

-- Upload robi serwer (service_role, omija RLS) — NIE dodajemy otwartej polityki
-- "Anyone can upload", bo pozwalałaby każdemu wrzucić dowolny plik do bucketu.

create policy "Anyone can view scan images"
  on storage.objects for select
  using (bucket_id = 'scans');


-- ─────────────────────────────────────────────────────────────────
-- ŹRÓDŁO: supabase/migrations/20260409_add_scan_recommendation_columns.sql
-- ─────────────────────────────────────────────────────────────────
-- Migration: Add columns to scan_logs for future recommendation engine
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- These columns enable:
--   - scan_type: normalized type for cross-mode queries
--   - product_category: AI-detected category (szampon, krem, witamina D, etc.)
--   - brand: product brand extracted from AI result
--   - ingredients_raw: raw OCR text from the label
--   - ingredients_parsed: structured JSON array of ingredients from AI
--
-- All columns are nullable so existing rows are unaffected.

ALTER TABLE public.scan_logs
  ADD COLUMN IF NOT EXISTS scan_type text,
  ADD COLUMN IF NOT EXISTS product_category text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS ingredients_raw text,
  ADD COLUMN IF NOT EXISTS ingredients_parsed jsonb;

-- Backfill scan_type from existing mode column where possible
UPDATE public.scan_logs
SET scan_type = mode
WHERE scan_type IS NULL AND mode IS NOT NULL;

-- Create index on scan_type + user_id for future recommendation queries
CREATE INDEX IF NOT EXISTS idx_scan_logs_type_user
  ON public.scan_logs (scan_type, user_id)
  WHERE user_id IS NOT NULL;

-- Create index on product_category for category-based recommendations
CREATE INDEX IF NOT EXISTS idx_scan_logs_category
  ON public.scan_logs (product_category)
  WHERE product_category IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────
-- ŹRÓDŁO: supabase/migrations/20260414_add_analytics_columns.sql
-- ─────────────────────────────────────────────────────────────────
-- Migration: Add queryable analytics columns to scan_logs
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- These columns promote key fields from the ai_result jsonb blob into
-- top-level columns so periodic analysis can use simple WHERE/GROUP BY
-- instead of jsonb operators.
--
-- All columns are nullable — existing rows are unaffected.

-- ── New columns ──

ALTER TABLE public.scan_logs
  ADD COLUMN IF NOT EXISTS risk_level text,
  ADD COLUMN IF NOT EXISTS has_pregnancy_warning boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ocr_succeeded boolean,
  ADD COLUMN IF NOT EXISTS is_two_photo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ingredient_count integer,
  ADD COLUMN IF NOT EXISTS harmful_count integer,
  ADD COLUMN IF NOT EXISTS verdict_short text,
  ADD COLUMN IF NOT EXISTS error_type text;

-- ── Indexes for common analytics queries ──

-- "Products scoring <5 by scan type"
CREATE INDEX IF NOT EXISTS idx_scan_logs_type_score
  ON public.scan_logs (scan_type, score);

-- "Which cosmetics are HIGH risk?"
CREATE INDEX IF NOT EXISTS idx_scan_logs_risk_level
  ON public.scan_logs (risk_level)
  WHERE risk_level IS NOT NULL;

-- "All scans with pregnancy warnings"
CREATE INDEX IF NOT EXISTS idx_scan_logs_pregnancy
  ON public.scan_logs (has_pregnancy_warning)
  WHERE has_pregnancy_warning = true;

-- "What % of scans fail and why?"
CREATE INDEX IF NOT EXISTS idx_scan_logs_error_type
  ON public.scan_logs (error_type)
  WHERE error_type IS NOT NULL;

-- ── Backfill from existing ai_result jsonb ──

-- risk_level (cosmetics only)
UPDATE public.scan_logs
SET risk_level = ai_result->>'risk_level'
WHERE risk_level IS NULL
  AND ai_result->>'risk_level' IS NOT NULL;

-- verdict_short (all modes)
UPDATE public.scan_logs
SET verdict_short = ai_result->>'verdict_short'
WHERE verdict_short IS NULL
  AND ai_result->>'verdict_short' IS NOT NULL;

-- ingredient_count (from ingredients array)
UPDATE public.scan_logs
SET ingredient_count = jsonb_array_length(ai_result->'ingredients')
WHERE ingredient_count IS NULL
  AND ai_result->'ingredients' IS NOT NULL
  AND jsonb_typeof(ai_result->'ingredients') = 'array';

-- harmful_count (cosmetics: count ingredients with category harmful/controversial or risk warning)
UPDATE public.scan_logs
SET harmful_count = (
  SELECT COUNT(*)
  FROM jsonb_array_elements(ai_result->'ingredients') AS elem
  WHERE elem->>'category' IN ('harmful', 'controversial')
     OR elem->>'risk' = 'warning'
)
WHERE harmful_count IS NULL
  AND scan_type IN ('cosmetics', 'suplement')
  AND ai_result->'ingredients' IS NOT NULL
  AND jsonb_typeof(ai_result->'ingredients') = 'array';

-- has_pregnancy_warning (cosmetics: check warnings[].pregnancy_risk)
UPDATE public.scan_logs
SET has_pregnancy_warning = true
WHERE has_pregnancy_warning IS NOT true
  AND scan_type = 'cosmetics'
  AND ai_result->'warnings' IS NOT NULL
  AND jsonb_typeof(ai_result->'warnings') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(ai_result->'warnings') AS w
    WHERE (w->>'pregnancy_risk')::boolean = true
  );

-- has_pregnancy_warning (food: check pregnancy_info.alerts)
UPDATE public.scan_logs
SET has_pregnancy_warning = true
WHERE has_pregnancy_warning IS NOT true
  AND scan_type = 'food'
  AND ai_result->'pregnancy_info' IS NOT NULL
  AND ai_result->'pregnancy_info'->'alerts' IS NOT NULL
  AND jsonb_typeof(ai_result->'pregnancy_info'->'alerts') = 'array'
  AND jsonb_array_length(ai_result->'pregnancy_info'->'alerts') > 0;

-- is_two_photo (from image2_url presence)
UPDATE public.scan_logs
SET is_two_photo = (image2_url IS NOT NULL)
WHERE is_two_photo IS NULL;

-- ocr_succeeded (from ocr_text presence)
UPDATE public.scan_logs
SET ocr_succeeded = (ocr_text IS NOT NULL AND length(ocr_text) > 20)
WHERE ocr_succeeded IS NULL
  AND scan_type IN ('food', 'cosmetics', 'suplement');

-- error_type (from failed scans)
UPDATE public.scan_logs
SET error_type = 'parse_failed'
WHERE error_type IS NULL
  AND ai_model = 'error'
  AND ai_result->>'failed' = 'true';


-- ─────────────────────────────────────────────────────────────────
-- ŹRÓDŁO: supabase/migrations/20260610_security_hardening.sql
-- ─────────────────────────────────────────────────────────────────
-- ════════════════════════════════════════════════════════════════════════
-- Migracja: hardening RLS przed publikacją w sklepach (2026-06-10)
-- Uruchom w Supabase → SQL Editor.
--
-- KONTEKST: zapisy do scan_logs i uploady do bucketu 'scans' robi WYŁĄCZNIE
-- serwer (/api/analyze) kluczem service_role, który OMIJA RLS. Dlatego otwarte
-- polityki "Anyone can insert/upload" są zbędne i stanowią wektor nadużycia
-- (każdy z anon key mógł zaśmiecać tabelę/bucket). Usuwamy je. Dodajemy też
-- brakujące polityki DELETE potrzebne przy usuwaniu konta.
-- ════════════════════════════════════════════════════════════════════════

-- 1) scan_logs: usuń otwarty anonimowy INSERT (serwer i tak używa service_role)
DROP POLICY IF EXISTS "Anyone can insert anonymous scans" ON public.scan_logs;

-- 2) scan_logs: pozwól userowi usunąć własne skany (usuwanie konta / historii)
DROP POLICY IF EXISTS "Users can delete own scans" ON public.scan_logs;
CREATE POLICY "Users can delete own scans"
  ON public.scan_logs FOR DELETE
  USING (auth.uid() = user_id);

-- 3) profiles: brakująca polityka DELETE (usuwanie konta)
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- 4) storage 'scans': usuń OTWARTY upload — uploady robi serwer (service_role).
--    Zostawiamy publiczny ODCZYT (apka wyświetla zeskanowane zdjęcie po URL).
--    TODO (P2): rozważyć prywatny bucket + signed URLs, szczególnie dla zdjęć
--    sylwetki (CheckForm) — wtedy zmienić też odczyt.
DROP POLICY IF EXISTS "Anyone can upload scan images" ON storage.objects;

-- (Świadomie NIE ruszamy "Anyone can view scan images" — apka renderuje obrazy
--  z publicznych URL-i. Zmiana wymagałaby signed URLs po stronie klienta.)


-- ─────────────────────────────────────────────────────────────────
-- ŹRÓDŁO: supabase/migrations/20260625_workout_journal.sql
-- ─────────────────────────────────────────────────────────────────
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

