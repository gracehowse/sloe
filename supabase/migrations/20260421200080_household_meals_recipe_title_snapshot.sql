-- household_meals: explicit provenance snapshot of the source recipe's title.
--
-- Context: `household_meals.recipe_id` is ON DELETE SET NULL. `recipe_title` is
-- already required on every row, but its role today is ambiguous — it can be
-- typed free-form OR sourced from a recipe. This migration adds a dedicated
-- `recipe_title_snapshot` column so we can always answer "what recipe was this
-- originally planned from?" even after the upstream recipe is deleted.
--
-- Insert-time contract (see app/api/household/meals/route.ts):
--   - When `recipe_id` is supplied, populate `recipe_title_snapshot` with the
--     recipe's title at the moment of insert (stored as the immutable source
--     of truth for provenance).
--   - When no `recipe_id` is supplied (ad-hoc meal), `recipe_title_snapshot`
--     is left null — `recipe_title` remains the display name.
-- The snapshot is never rewritten after insert; it is write-once by design.

alter table public.household_meals
  add column if not exists recipe_title_snapshot text;

comment on column public.household_meals.recipe_title_snapshot is
  'Title of the source recipe at insert time. Preserved after the recipe is deleted (recipe_id SET NULL) so provenance survives. Null for ad-hoc meals not linked to a recipe.';

NOTIFY pgrst, 'reload schema';
