-- ENG-674: Add CHECK constraint to nutrition_entries.source so only canonical
-- labels can be written going forward. NOT VALID → skips the historical rows
-- (which are all clean per SELECT DISTINCT source audit on 2026-05-27);
-- VALIDATE in a follow-up once the code path that writes
-- "Open Food Facts (adjusted)" is unified.
--
-- Canonical values:
--   USDA FoodData Central — full label from early NutritionTracker path
--   USDA                  — short form from verifyIngredients / recipe_ingredients
--   FatSecret             — FatSecret API
--   Open Food Facts       — OFF barcode / import
--   Open Food Facts (adjusted) — OFF barcode with local macro override
--   Edamam                — Edamam API (recipe import fallback)
--   manual                — user-typed manual entry
--   custom                — custom food (legacy alias for manual)
--   custom_food           — analytics discriminator; may land in source column
--   Recipe                — entry derived from a logged recipe
--   Saved meal            — entry copied from a saved meal
--   apple_health          — HealthKit import
--   AI voice              — AI voice-logging path
--   AI photo              — AI photo-logging path
--   Suppr                 — internal Suppr match (recipe verify)
--   Estimated             — low-confidence estimate (recipe verify fallback)
--   Unverified            — no match found (recipe verify fallback)
--   barcode               — legacy barcode label (now maps to Open Food Facts)

alter table public.nutrition_entries
  add constraint nutrition_entries_source_canonical
  check (
    source is null
    or source in (
      'USDA FoodData Central',
      'USDA',
      'FatSecret',
      'Open Food Facts',
      'Open Food Facts (adjusted)',
      'Edamam',
      'manual',
      'custom',
      'custom_food',
      'Recipe',
      'Saved meal',
      'apple_health',
      'AI voice',
      'AI photo',
      'Suppr',
      'Estimated',
      'Unverified',
      'barcode'
    )
  )
  not valid;
