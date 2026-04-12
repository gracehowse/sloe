-- Idempotent: ensures per-ingredient micros exist (matches verified_nutrition_micros + schema.sql).
alter table public.recipe_ingredients
  add column if not exists fiber_g numeric not null default 0,
  add column if not exists sugar_g numeric not null default 0,
  add column if not exists sodium_mg numeric not null default 0;
