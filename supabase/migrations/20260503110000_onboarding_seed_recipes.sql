-- 20260503110000_onboarding_seed_recipes.sql
--
-- Phase 5 / B2.3 (2026-04-27) — onboarding seed recipes.
--
-- Seeds the 15 hand-picked recipes the onboarding picker offers as
-- the user's first cooking commitment. The seed JSON list lives at
-- src/lib/onboarding/onboardingSeeds.ts (web) +
-- apps/mobile/lib/onboardingSeeds.ts (mobile re-export). The picker
-- resolves seeds → recipes.id by case-insensitive title match;
-- this migration ensures the matchTitle values in the seed file
-- exist as published rows in `recipes`.
--
-- Authority:
--   - D-2026-04-27-14 (onboarding produces first plan).
--   - docs/decisions/2026-04-27-onboarding-candidate-source.md.
--
-- Apply with: supabase db push --linked
-- DO NOT apply via MCP `apply_migration` (project rule, CLAUDE.md).
--
-- Idempotency: each INSERT uses an `ON CONFLICT (title) DO NOTHING`
-- guard, so re-running the migration is safe. If a row already exists
-- with the matching title, we keep the existing row (it may have been
-- enriched with verified macros + ingredients by nutrition-engine
-- since seeding).
--
-- Macro values are conservative estimates — see the seed JSON file
-- for the canonical display numbers. The DB rows here exist primarily
-- so the resolver finds *something* on first onboarding completion.
-- nutrition-engine will follow up with verified ingredient rows +
-- adjusted macros via a separate review pass.
--
-- author_id: NULL (these are platform-curated seeds, not user-authored).
-- creator_id: NULL (no `creators` row attribution).
-- source_name: 'Suppr onboarding'.
--
-- We pre-create a `slug` index for forwards-compat (currently the
-- resolver uses title-match; future migration can add the slug column
-- and rewire the resolver. The decision doc accepts either path.).

-- Helper to insert a single seed row idempotently.
DO $$
BEGIN
  -- 1. Sheet-pan harissa chicken with chickpeas
  INSERT INTO public.recipes (
    title, calories, protein, carbs, fat, fiber_g, servings,
    prep_time_min, cook_time_min, published, is_verified,
    source_name, meal_type, allergens
  ) VALUES (
    'Sheet-pan harissa chicken with chickpeas',
    540, 45, 38, 22, 8, 1, 10, 20, true, false,
    'Suppr onboarding', ARRAY['lunch','dinner']::text[], ARRAY[]::text[]
  ) ON CONFLICT DO NOTHING;

  -- 2. Miso salmon with greens
  INSERT INTO public.recipes (
    title, calories, protein, carbs, fat, fiber_g, servings,
    prep_time_min, cook_time_min, published, is_verified,
    source_name, meal_type, allergens
  ) VALUES (
    'Miso salmon with greens',
    480, 38, 22, 24, 6, 1, 5, 15, true, false,
    'Suppr onboarding', ARRAY['lunch','dinner']::text[], ARRAY['fish','soy']::text[]
  ) ON CONFLICT DO NOTHING;

  -- 3. Beef ragu with pappardelle
  INSERT INTO public.recipes (
    title, calories, protein, carbs, fat, fiber_g, servings,
    prep_time_min, cook_time_min, published, is_verified,
    source_name, meal_type, allergens
  ) VALUES (
    'Beef ragu with pappardelle',
    620, 35, 65, 18, 5, 1, 10, 30, true, false,
    'Suppr onboarding', ARRAY['dinner']::text[], ARRAY['gluten','egg']::text[]
  ) ON CONFLICT DO NOTHING;

  -- 4. Halloumi and roast veg traybake
  INSERT INTO public.recipes (
    title, calories, protein, carbs, fat, fiber_g, servings,
    prep_time_min, cook_time_min, published, is_verified,
    source_name, meal_type, allergens
  ) VALUES (
    'Halloumi and roast veg traybake',
    510, 28, 32, 28, 7, 1, 10, 25, true, false,
    'Suppr onboarding', ARRAY['lunch','dinner']::text[], ARRAY['dairy']::text[]
  ) ON CONFLICT DO NOTHING;

  -- 5. Chicken katsu rice bowl
  INSERT INTO public.recipes (
    title, calories, protein, carbs, fat, fiber_g, servings,
    prep_time_min, cook_time_min, published, is_verified,
    source_name, meal_type, allergens
  ) VALUES (
    'Chicken katsu rice bowl',
    590, 42, 70, 14, 4, 1, 10, 20, true, false,
    'Suppr onboarding', ARRAY['dinner']::text[], ARRAY['gluten','egg']::text[]
  ) ON CONFLICT DO NOTHING;

  -- 6. Black bean and sweet potato chilli
  INSERT INTO public.recipes (
    title, calories, protein, carbs, fat, fiber_g, servings,
    prep_time_min, cook_time_min, published, is_verified,
    source_name, meal_type, allergens
  ) VALUES (
    'Black bean and sweet potato chilli',
    470, 22, 70, 8, 16, 1, 10, 25, true, false,
    'Suppr onboarding', ARRAY['lunch','dinner']::text[], ARRAY[]::text[]
  ) ON CONFLICT DO NOTHING;

  -- 7. Greek yoghurt overnight oats with berries
  INSERT INTO public.recipes (
    title, calories, protein, carbs, fat, fiber_g, servings,
    prep_time_min, cook_time_min, published, is_verified,
    source_name, meal_type, allergens
  ) VALUES (
    'Greek yoghurt overnight oats with berries',
    380, 25, 48, 8, 7, 1, 5, 0, true, false,
    'Suppr onboarding', ARRAY['breakfast']::text[], ARRAY['dairy','gluten']::text[]
  ) ON CONFLICT DO NOTHING;

  -- 8. Smoked salmon and scrambled egg bagel
  INSERT INTO public.recipes (
    title, calories, protein, carbs, fat, fiber_g, servings,
    prep_time_min, cook_time_min, published, is_verified,
    source_name, meal_type, allergens
  ) VALUES (
    'Smoked salmon and scrambled egg bagel',
    450, 32, 42, 16, 3, 1, 5, 5, true, false,
    'Suppr onboarding', ARRAY['breakfast']::text[], ARRAY['fish','egg','gluten']::text[]
  ) ON CONFLICT DO NOTHING;

  -- 9. Tofu and peanut soba bowl
  INSERT INTO public.recipes (
    title, calories, protein, carbs, fat, fiber_g, servings,
    prep_time_min, cook_time_min, published, is_verified,
    source_name, meal_type, allergens
  ) VALUES (
    'Tofu and peanut soba bowl',
    530, 24, 60, 22, 8, 1, 10, 15, true, false,
    'Suppr onboarding', ARRAY['lunch','dinner']::text[], ARRAY['soy','peanut']::text[]
  ) ON CONFLICT DO NOTHING;

  -- 10. Steak with chimichurri and new potatoes
  INSERT INTO public.recipes (
    title, calories, protein, carbs, fat, fiber_g, servings,
    prep_time_min, cook_time_min, published, is_verified,
    source_name, meal_type, allergens
  ) VALUES (
    'Steak with chimichurri and new potatoes',
    680, 45, 32, 38, 4, 1, 10, 15, true, false,
    'Suppr onboarding', ARRAY['dinner']::text[], ARRAY[]::text[]
  ) ON CONFLICT DO NOTHING;

  -- 11. Spicy turkey lettuce cups
  INSERT INTO public.recipes (
    title, calories, protein, carbs, fat, fiber_g, servings,
    prep_time_min, cook_time_min, published, is_verified,
    source_name, meal_type, allergens
  ) VALUES (
    'Spicy turkey lettuce cups',
    380, 35, 12, 22, 4, 1, 10, 10, true, false,
    'Suppr onboarding', ARRAY['lunch','dinner']::text[], ARRAY[]::text[]
  ) ON CONFLICT DO NOTHING;

  -- 12. Chickpea and spinach curry with basmati
  INSERT INTO public.recipes (
    title, calories, protein, carbs, fat, fiber_g, servings,
    prep_time_min, cook_time_min, published, is_verified,
    source_name, meal_type, allergens
  ) VALUES (
    'Chickpea and spinach curry with basmati',
    480, 18, 78, 10, 12, 1, 10, 20, true, false,
    'Suppr onboarding', ARRAY['lunch','dinner']::text[], ARRAY[]::text[]
  ) ON CONFLICT DO NOTHING;

  -- 13. Cottage cheese and tomato pasta
  INSERT INTO public.recipes (
    title, calories, protein, carbs, fat, fiber_g, servings,
    prep_time_min, cook_time_min, published, is_verified,
    source_name, meal_type, allergens
  ) VALUES (
    'Cottage cheese and tomato pasta',
    520, 30, 70, 12, 6, 1, 5, 15, true, false,
    'Suppr onboarding', ARRAY['lunch','dinner']::text[], ARRAY['dairy','gluten']::text[]
  ) ON CONFLICT DO NOTHING;

  -- 14. Korean chicken rice bowl
  INSERT INTO public.recipes (
    title, calories, protein, carbs, fat, fiber_g, servings,
    prep_time_min, cook_time_min, published, is_verified,
    source_name, meal_type, allergens
  ) VALUES (
    'Korean chicken rice bowl',
    580, 40, 70, 14, 5, 1, 10, 20, true, false,
    'Suppr onboarding', ARRAY['dinner']::text[], ARRAY['gluten','soy']::text[]
  ) ON CONFLICT DO NOTHING;

  -- 15. Lentil bolognese
  INSERT INTO public.recipes (
    title, calories, protein, carbs, fat, fiber_g, servings,
    prep_time_min, cook_time_min, published, is_verified,
    source_name, meal_type, allergens
  ) VALUES (
    'Lentil bolognese',
    460, 24, 70, 8, 14, 1, 10, 25, true, false,
    'Suppr onboarding', ARRAY['dinner']::text[], ARRAY['gluten']::text[]
  ) ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Index on lower(title) so the resolver's case-insensitive match
-- (`ilike` against the seed list's matchTitle values) hits an index
-- rather than scanning. recipes.title doesn't currently have a
-- case-insensitive index — adding one here for the onboarding picker
-- + general search performance.
CREATE INDEX IF NOT EXISTS recipes_lower_title_idx
  ON public.recipes ((lower(title)));

COMMENT ON INDEX public.recipes_lower_title_idx IS
  'Case-insensitive title lookup. Backs the onboarding seed resolver in src/lib/onboarding/onboardingSeedResolver.ts and any general-purpose ILIKE search.';
