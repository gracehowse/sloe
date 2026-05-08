-- 20260510100100_recipes_caffeine_alcohol_aggregates.sql
--
-- F-74 follow-up — recipe-level caffeine/alcohol aggregates.
--
-- Closes the "Log today" + "Add to today" gap in the planner-tab and
-- recipe-detail surfaces, where stimulant chip totals dropped
-- caffeine/alcohol because `recipes` had no aggregated value to read.
-- Mirrors the existing fiber_g / sugar_g / sodium_mg pattern from
-- migration 20260408143000_add_verified_nutrition_micros.
--
-- Per-ingredient values are required so re-saves (override edits,
-- ingredient additions) re-roll up correctly without re-hitting the
-- third-party APIs. Per-100g caffeine/alcohol already flow through the
-- verifier (USDA caffeineMgPer100g + alcoholGPer100g, OFF via
-- parseOffMicros, Edamam CAFFN/ALC, generic beverages); the verifier
-- write path will scale + persist them here.
--
-- LOCK SAFETY:
--   ALTER TABLE ADD COLUMN with NOT NULL DEFAULT 0 — Postgres 11+ rewrites
--   the default in catalogue only (no full-table rewrite). Both target
--   tables are bounded (recipes ~hundreds of rows, recipe_ingredients
--   ~thousands at this scale), so even a worst-case rewrite would be
--   sub-second.
--
-- Apply with: supabase db push --linked
-- DO NOT apply via MCP apply_migration (project rule, CLAUDE.md).
--
-- DOWN SQL:
--   alter table public.recipes drop column if exists caffeine_mg;
--   alter table public.recipes drop column if exists alcohol_g;
--   alter table public.recipe_ingredients drop column if exists caffeine_mg;
--   alter table public.recipe_ingredients drop column if exists alcohol_g;

alter table public.recipes
  add column if not exists caffeine_mg numeric not null default 0
    check (caffeine_mg >= 0),
  add column if not exists alcohol_g numeric not null default 0
    check (alcohol_g >= 0);

alter table public.recipe_ingredients
  add column if not exists caffeine_mg numeric not null default 0
    check (caffeine_mg >= 0),
  add column if not exists alcohol_g numeric not null default 0
    check (alcohol_g >= 0);

comment on column public.recipes.caffeine_mg is
  'Per-serving caffeine (mg). Aggregated by saveVerifiedIngredients from '
  'sum(recipe_ingredients.caffeine_mg) / servings. 0 when no ingredient '
  'source published caffeine — F-74 follow-up, 2026-05-10.';
comment on column public.recipes.alcohol_g is
  'Per-serving ethanol (g). Aggregated by saveVerifiedIngredients from '
  'sum(recipe_ingredients.alcohol_g) / servings. 0 when no ingredient '
  'source published alcohol — F-74 follow-up, 2026-05-10.';
comment on column public.recipe_ingredients.caffeine_mg is
  'Caffeine (mg) for this ingredient at its scaled gram weight. Sourced '
  'per-100g from USDA / OFF / Edamam (FatSecret basic tier returns 0).';
comment on column public.recipe_ingredients.alcohol_g is
  'Ethanol (g) for this ingredient at its scaled gram weight. Sourced '
  'per-100g from USDA / OFF / Edamam (FatSecret basic tier returns 0).';

notify pgrst, 'reload schema';
