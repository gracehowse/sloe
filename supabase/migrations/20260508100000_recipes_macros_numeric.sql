-- 20260508100000_recipes_macros_numeric.sql
--
-- F-72 (2026-05-02) — recipe save crashes on non-integer macros.
--
-- TestFlight Build 41 + repro on web /recipe/new: saving any recipe
-- whose computed-per-serving macros are non-integer (e.g. fat 2.3 g)
-- fails with:
--
--   invalid input syntax for type integer: "2.3"
--
-- Root cause: `recipes.{calories,protein,carbs,fat}` and
-- `recipe_ingredients.{calories,protein,carbs,fat}` were defined as
-- `integer` in the Phase 0 schema. The product has always exposed
-- 1-decimal precision in the UI (compute helpers in
-- `src/lib/recipes/createRecipeWizard.ts` and the seeded-recipes
-- backfill at `20260503113000` both round protein/carbs/fat to 1 dp),
-- but Postgres rejected those values on insert because the column
-- type only accepted whole numbers.
--
-- Mobile mitigated this for `recipe_ingredients` by `Math.round`-ing
-- before insert (CreateRecipeWizard.tsx) — that hid the bug for the
-- ingredient rows but ate decimal precision. The top-level `recipes`
-- row was inserted raw and that's where the surface error fires.
--
-- Fix: widen all four columns on both tables to NUMERIC(10, 2). 10
-- digits with 2 decimals comfortably covers any per-serving macro
-- (max ~99,999,999.99 g — recipes will never approach this) and
-- 2-decimal precision matches USDA / FatSecret display rounding.
--
-- The `fiber_g`, `sugar_g`, `sodium_mg` columns on both tables are
-- already `numeric` (added by migration 20260408143000) so they don't
-- need widening.
--
-- Apply with: supabase db push --linked
-- DO NOT apply via MCP `apply_migration` (project rule, CLAUDE.md).
--
-- Reversibility: NUMERIC(10, 2) -> integer would silently truncate
-- decimals on existing rows. Reverting is therefore lossy and is not
-- a sanctioned rollback — the only safe direction is forward.

ALTER TABLE public.recipes
  ALTER COLUMN calories TYPE NUMERIC(10, 2) USING calories::numeric,
  ALTER COLUMN protein  TYPE NUMERIC(10, 2) USING protein::numeric,
  ALTER COLUMN carbs    TYPE NUMERIC(10, 2) USING carbs::numeric,
  ALTER COLUMN fat      TYPE NUMERIC(10, 2) USING fat::numeric;

ALTER TABLE public.recipe_ingredients
  ALTER COLUMN calories TYPE NUMERIC(10, 2) USING calories::numeric,
  ALTER COLUMN protein  TYPE NUMERIC(10, 2) USING protein::numeric,
  ALTER COLUMN carbs    TYPE NUMERIC(10, 2) USING carbs::numeric,
  ALTER COLUMN fat      TYPE NUMERIC(10, 2) USING fat::numeric;

COMMENT ON COLUMN public.recipes.calories IS
  'Per-serving calories. NUMERIC(10, 2) since 2026-05-08 — was integer; '
  'see migration 20260508100000_recipes_macros_numeric for the why. '
  'NULL or 0 is permitted but always produces a "Not yet computed" UI state. '
  'URL-seeded discover rows are backfilled from SUM(recipe_ingredients) by '
  'migration 20260503113000_seeded_recipes_macros_backfill (Build 41, 2026-05-01).';
COMMENT ON COLUMN public.recipes.protein IS
  'Per-serving protein in grams. NUMERIC(10, 2) since 2026-05-08 (was integer).';
COMMENT ON COLUMN public.recipes.carbs IS
  'Per-serving carbs in grams. NUMERIC(10, 2) since 2026-05-08 (was integer).';
COMMENT ON COLUMN public.recipes.fat IS
  'Per-serving fat in grams. NUMERIC(10, 2) since 2026-05-08 (was integer).';

NOTIFY pgrst, 'reload schema';
