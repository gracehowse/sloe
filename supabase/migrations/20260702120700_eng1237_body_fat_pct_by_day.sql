-- ENG-1237 — body-fat % history for Pro-gated body-composition trends on Progress.
-- Mirrors `weight_kg_by_day`: map YYYY-MM-DD → body fat % (0–100).

alter table public.profiles
  add column if not exists body_fat_pct_by_day jsonb not null default '{}'::jsonb;

comment on column public.profiles.body_fat_pct_by_day is
  'Map YYYY-MM-DD → body fat % (0–100). Powers Pro-gated body-composition trends on Progress (ENG-1237). Latest scalar remains `body_fat_pct`.';
