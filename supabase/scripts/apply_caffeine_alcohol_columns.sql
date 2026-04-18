-- One-off: align production with migration 20260421110000_caffeine_alcohol_tracking.sql
-- Safe to re-run (IF NOT EXISTS).

alter table public.profiles
  add column if not exists target_caffeine_mg integer not null default 400
    check (target_caffeine_mg >= 0);

alter table public.profiles
  add column if not exists target_alcohol_g_weekly integer not null default 0
    check (target_alcohol_g_weekly >= 0);

alter table public.profiles
  add column if not exists extra_caffeine_by_day jsonb not null default '{}'::jsonb;

alter table public.profiles
  add column if not exists extra_alcohol_g_by_day jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
