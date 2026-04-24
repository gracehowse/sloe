-- Caption-vs-calculated sanity check for recipe imports.
--
-- Stores the per-serving nutrition claim we extracted from a creator's
-- caption / description at import time (e.g. "210 kcal per serving"), so
-- the Verify screen can flag when our ingredient-matched total diverges
-- from what the creator said — helps users spot obvious ingredient
-- mismatches like silken→firm tofu or "blonde or white chocolate"
-- disjunctions matching the wrong branch.
--
-- Shape: `{"caloriesPerServing": number|null, "proteinG": number|null,
--          "carbsG": number|null, "fatG": number|null}`.
--
-- Nullable — only populated when the creator actually stated a claim.
-- Never auto-overwrites calculated macros; this is advisory only.

alter table public.recipes
  add column if not exists caption_nutrition_claim jsonb;
