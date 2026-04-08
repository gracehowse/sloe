-- Add micros + verification metadata for FatSecret-backed nutrition

alter table public.recipes
  add column if not exists fiber_g numeric not null default 0,
  add column if not exists sugar_g numeric not null default 0,
  add column if not exists sodium_mg numeric not null default 0,
  add column if not exists verified_source text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_confidence numeric;

alter table public.recipe_ingredients
  add column if not exists fiber_g numeric not null default 0,
  add column if not exists sugar_g numeric not null default 0,
  add column if not exists sodium_mg numeric not null default 0,
  add column if not exists fatsecret_food_id text,
  add column if not exists confidence numeric;

-- Defaults were true in Phase 0 schema; estimated rows should default to false.
alter table public.recipes alter column is_verified set default false;
alter table public.recipe_ingredients alter column is_verified set default false;

