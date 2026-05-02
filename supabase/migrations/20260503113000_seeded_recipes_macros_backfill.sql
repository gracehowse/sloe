-- 20260503113000_seeded_recipes_macros_backfill.sql
--
-- Build 41 follow-up (2026-05-01) — F-71 sibling.
--
-- Grace re-flagged on TestFlight `AHQdqnRxBaTHxYN3vuzV4CM` (2026-04-23):
-- "Seeded recipes still don't have macros or calories."
--
-- Root cause: `scripts/seed-discover-recipes.ts` populates
-- `recipes.{calories,protein,carbs,fat,fiber_g,...}` from
-- `parsed.siteNutrition` extracted from JSON-LD on the source page.
-- For ~half the URL-seeded recipes the source site doesn't ship
-- nutrition in JSON-LD, so the columns end up at 0. The seeder DOES,
-- however, populate `recipe_ingredients` rows with per-ingredient
-- macros (allocated by `allocateIngredientMacrosFromLines`). When the
-- top-level `recipes` row had 0 calories, the per-ingredient totals
-- summed to non-zero — but the UI reads the top-level columns first,
-- so the surface showed 0.
--
-- This migration backfills `recipes.calories/protein/carbs/fat/fiber_g`
-- from the SUM of `recipe_ingredients.{calories,protein,carbs,fat,fiber_g}`
-- ONLY for the 20 URL-seeded discover rows (matched by source_url against
-- the same canonical list `unpoison_seed_author_ids` uses). Per-serving
-- division is applied because `recipe_ingredients` carry whole-recipe
-- macros while `recipes` columns are per-serving.
--
-- Authority: docs/decisions/2026-05-01-seeded-recipes-macros-backfill.md
-- (created in same PR).
--
-- Apply with: supabase db push --linked
-- DO NOT apply via MCP `apply_migration` (project rule, CLAUDE.md).
--
-- Idempotency: only updates rows where calories <= 0 (or NULL). Re-runs
-- are safe. If a future seeder re-imports with non-zero JSON-LD nutrition
-- the row will already have calories > 0 and this migration won't touch
-- it again.
--
-- Reversibility: source_urls are listed below for forensic auditing.
-- Restoring "all-zeros" would require a manual UPDATE referencing the
-- pre-migration values; we don't snapshot those because zero is not a
-- legitimate state we want to preserve.

DO $$
DECLARE
  affected_count int := 0;
BEGIN
  -- Same canonical list the unpoison migration uses.
  WITH seed_urls AS (
    SELECT url FROM (VALUES
      ('https://cookieandkate.com/best-lentil-soup-recipe/'),
      ('https://cookieandkate.com/mediterranean-quinoa-salad/'),
      ('https://downshiftology.com/recipes/mediterranean-chickpea-salad/'),
      ('https://downshiftology.com/recipes/green-shakshuka/'),
      ('https://downshiftology.com/recipes/best-shakshuka-recipe/'),
      ('https://downshiftology.com/recipes/smoked-salmon-avocado-salad/'),
      ('https://downshiftology.com/recipes/salmon-avocado-salad/'),
      ('https://downshiftology.com/recipes/flaky-salmon-salad/'),
      ('https://downshiftology.com/recipes/green-goddess-hummus/'),
      ('https://www.halfbakedharvest.com/sheet-pan-chicken-fajitas/'),
      ('https://minimalistbaker.com/spicy-red-lentil-curry/'),
      ('https://minimalistbaker.com/sweet-potato-chickpea-buddha-bowl/'),
      ('https://minimalistbaker.com/quinoa-chickpea-buddha-bowl/'),
      ('https://minimalistbaker.com/1-pot-lentil-green-curry/'),
      ('https://minimalistbaker.com/1-pot-golden-curry-lentil-soup/'),
      ('https://pinchofyum.com/easy-red-lentil-dhal'),
      ('https://pinchofyum.com/spicy-peanut-soba-noodle-salad'),
      ('https://pinchofyum.com/one-pot-creamy-spinach-lentils'),
      ('https://pinchofyum.com/the-best-detox-crockpot-lentil-soup'),
      ('https://pinchofyum.com/smoky-red-lentil-soup-with-spinach')
    ) AS u(url)
  ),
  -- For each seeded recipe with zero/null calories, sum the
  -- per-ingredient macros and divide by servings (default 1 for
  -- safety — matches the seeder's recipeRow shape).
  ingredient_totals AS (
    SELECT
      r.id AS recipe_id,
      GREATEST(r.servings, 1) AS servings,
      ROUND(SUM(COALESCE(ri.calories, 0)) / GREATEST(r.servings, 1)) AS calories,
      ROUND(SUM(COALESCE(ri.protein, 0))::numeric / GREATEST(r.servings, 1), 1) AS protein,
      ROUND(SUM(COALESCE(ri.carbs, 0))::numeric / GREATEST(r.servings, 1), 1) AS carbs,
      ROUND(SUM(COALESCE(ri.fat, 0))::numeric / GREATEST(r.servings, 1), 1) AS fat,
      ROUND(SUM(COALESCE(ri.fiber_g, 0))::numeric / GREATEST(r.servings, 1), 1) AS fiber_g
    FROM recipes r
    JOIN recipe_ingredients ri ON ri.recipe_id = r.id
    WHERE r.source_url IN (SELECT url FROM seed_urls)
      AND (r.calories IS NULL OR r.calories <= 0)
    GROUP BY r.id, r.servings
    HAVING SUM(COALESCE(ri.calories, 0)) > 0
  )
  UPDATE recipes r
  SET
    calories = it.calories,
    protein  = it.protein,
    carbs    = it.carbs,
    fat      = it.fat,
    fiber_g  = it.fiber_g
  FROM ingredient_totals it
  WHERE r.id = it.recipe_id;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled macros on % seeded recipes', affected_count;

  -- Sanity guard: the seed manifest is 20 rows. If we updated more
  -- than that something is matching beyond the URL whitelist.
  IF affected_count > 20 THEN
    RAISE EXCEPTION 'Refusing to backfill >20 rows (got %) — manifest mismatch', affected_count;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Document the contract on `recipes.calories` so future readers know
-- the seeded-row backfill flow.
COMMENT ON COLUMN public.recipes.calories IS
  'Per-serving calories. NULL or 0 is permitted but always produces a "Not yet computed" UI state. URL-seeded discover rows are backfilled from SUM(recipe_ingredients) by migration 20260503113000_seeded_recipes_macros_backfill (Build 41, 2026-05-01).';
