-- T19 Path B (2026-04-25) — FatSecret Platform API Basic-tier compliance.
--
-- Grace confirmed account is on Basic tier. Basic tier ToS prohibits
-- caching macro values. We currently cache them in `recipe_ingredients`
-- and `recipes`. Decision doc:
--   docs/decisions/2026-04-25-fatsecret-tier-confirmation.md
--
-- This migration nullifies the cached macros on all FatSecret-derived
-- rows but **keeps `fatsecret_food_id`** — the food ID itself is a
-- permitted reference pointer; only the co-stored nutrition values are
-- the violation. Runtime re-fetch (separate code change) restores the
-- macros at recipe-detail-load time, so the user-visible behaviour is
-- "first detail-view per row triggers a re-verify, subsequent renders
-- from cache (HTTP-only, request-scoped) until the next reload".
--
-- Scope rules:
--   - `recipe_ingredients`: every row where `fatsecret_food_id IS NOT NULL`
--     loses its cached macros and is_verified flag.
--   - `recipes`: every row where `verified_source = 'FatSecret'` loses
--     its aggregate macros + verified state.
--   - `nutrition_entries` / `user_favorite_foods`: NOT TOUCHED. Once a
--     user logs a meal or stars a food, the macros are part of the
--     user's record of what they ate — that is owned user data, not a
--     FatSecret cache. The decision doc explains this distinction.

begin;

-- 0. Defensive schema repair (2026-04-25 — schema drift discovered on remote).
--
-- Migration 20260408143000_add_verified_nutrition_micros is recorded in
-- supabase_migrations.schema_migrations but its DDL did not actually
-- apply (likely an early MCP apply_migration that recorded the version
-- without running the statements — exactly the failure mode CLAUDE.md
-- warns about). Re-asserting the intended columns here is idempotent
-- and lets the UPDATE below match its WHERE clause when run on the
-- drifted DB. On a clean DB these IF NOT EXISTS guards are no-ops.
alter table public.recipes
  add column if not exists fiber_g numeric not null default 0,
  add column if not exists sugar_g numeric not null default 0,
  add column if not exists sodium_mg numeric not null default 0,
  add column if not exists verified_source text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_confidence numeric;

alter table public.recipe_ingredients
  add column if not exists fatsecret_food_id text,
  add column if not exists confidence numeric;

-- 1. recipe_ingredients — strip cached macros from every FatSecret-matched row.
update public.recipe_ingredients
set
  calories = 0,
  protein = 0,
  carbs = 0,
  fat = 0,
  fiber_g = 0,
  sugar_g = 0,
  sodium_mg = 0,
  is_verified = false,
  source = 'Unverified'
where fatsecret_food_id is not null;

-- 2. recipes — strip aggregate macros from every recipe whose verification
-- source was FatSecret. The recipe.calories/protein/etc are derivative of
-- recipe_ingredients (recomputed by application code on save), so once the
-- ingredient rows are zeroed, leaving the recipe aggregate populated would
-- create the same kind of cache the ToS prohibits.
update public.recipes
set
  calories = 0,
  protein = 0,
  carbs = 0,
  fat = 0,
  fiber_g = 0,
  sugar_g = 0,
  sodium_mg = 0,
  is_verified = false,
  verified_source = null,
  verified_confidence = null,
  verified_at = null
where verified_source = 'FatSecret';

-- 3. Sanity check — log row counts so the migration is auditable from logs.
do $$
declare
  ri_count bigint;
  r_count bigint;
begin
  select count(*) into ri_count
  from public.recipe_ingredients
  where fatsecret_food_id is not null and is_verified = false and source = 'Unverified';

  select count(*) into r_count
  from public.recipes
  where verified_source is null and is_verified = false;

  raise notice 'fatsecret_basic_tier_zeroing: % recipe_ingredients rows + % recipes rows now in unverified state',
    ri_count, r_count;
end $$;

commit;
