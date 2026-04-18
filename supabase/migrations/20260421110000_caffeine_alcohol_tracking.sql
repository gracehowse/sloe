-- Hydration & stimulants — caffeine + alcohol tracking (Batch 2.5).
--
-- Mirrors the `extra_water_by_day` JSONB pattern introduced by
-- `20260413200000_*`, so the caffeine + alcohol maps live alongside the
-- existing daily-intake columns on `profiles`. Targets sit next to the
-- macro targets so `normalizeMacroTargets()` can read all of them in one
-- query.
--
-- Targets:
--   - `target_caffeine_mg` defaults to 400 mg — FDA upper bound for
--     healthy adults. The UI shows a factual "Over 400 mg" label (amber,
--     not red) when the daily total exceeds this value. No shame copy.
--   - `target_alcohol_g_weekly` defaults to 0 — the alcohol row is hidden
--     entirely until the user opts in via Settings. Setting it to, e.g.,
--     196 g represents 14 UK units (the UK Chief Medical Officer's
--     low-risk weekly limit).
--
-- Daily maps (`extra_caffeine_by_day`, `extra_alcohol_g_by_day`) are
-- `{YYYY-MM-DD: <number>}`. Caffeine is milligrams, alcohol is grams of
-- ethanol. Non-date-key values and non-positive numbers are dropped on
-- read by the shared `parseDayNumberMap` helper.
--
-- Types are NOT regenerated in this migration — the generated
-- `database.types.ts` files are already out of date (see
-- `docs/data/schema.md`); regeneration is tracked separately.

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

NOTIFY pgrst, 'reload schema';
