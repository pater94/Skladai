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

-- Scan logs (the KEY table for improving AI)
create table public.scan_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete set null,
  mode text not null,
  image_url text,
  image2_url text,
  ocr_text text,
  ai_result jsonb,
  ai_model text,
  score integer,
  product_name text,
  user_feedback text,
  feedback_note text,
  prompt_version text,
  processing_time_ms integer,
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

-- Scan logs
create policy "Users can view own scans"
  on public.scan_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert scans"
  on public.scan_logs for insert
  with check (auth.uid() = user_id OR user_id is null);

create policy "Anyone can insert anonymous scans"
  on public.scan_logs for insert
  with check (user_id is null);

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

create policy "Anyone can upload scan images"
  on storage.objects for insert
  with check (bucket_id = 'scans');

create policy "Anyone can view scan images"
  on storage.objects for select
  using (bucket_id = 'scans');
