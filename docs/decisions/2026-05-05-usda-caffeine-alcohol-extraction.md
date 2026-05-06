# USDA caffeine + alcohol extraction (2026-05-05)

**Status:** Resolved.
**Authority:** Grace 2026-05-05 in-session bug report.
**Owner:** Grace / executor.

## Problem

Logging a glass of wine or a cup of coffee via the food search did
nothing to the Today caffeine / alcohol charts. The 2026-05-02
"stimulant bump centralisation" decision (`docs/decisions/2026-05-02-stimulant-bump-helper-and-net-carbs-focus-refresh.md`)
shipped the central helper and the bump fired correctly from every
mobile log path — yet the bump was being called with `caffeineMg: 0`
and `alcoholG: 0` for every USDA-sourced beverage.

### Root cause

`src/lib/nutrition/usdaNormalize.ts` → `fdcFoodMacrosPer100g()`
extracted only seven nutrients (calories / protein / carbs / fat /
fiber / sugar / sodium) from the USDA `foodNutrients[]` list. It did
not match `Caffeine` (USDA nutrient id 1057 / number 262) or
`Alcohol, ethyl` (id 1018 / number 221). So:

- Live DB confirmed via SQL on 2026-05-05:
  ```
  Wine, white       — nutrition_micros.alcoholG = NULL
  Wine, sparkling   — nutrition_micros.alcoholG = NULL
  Cosmopolitan      — nutrition_micros.alcoholG = NULL
  Coffee with Milk  — caffeineMg = 72 (came from Apple Health import,
                      not USDA — i.e. only the non-USDA path worked)
  ```
- The `bumpStimulantsForLoggedMeal` helper at
  `src/lib/nutrition/bumpStimulantsForLoggedMeal.ts` short-circuits at
  zero. So the supabase write was correct in form but had nothing to
  write.
- `profiles.extra_caffeine_by_day` for Grace's primary account showed
  ONE entry: `{"2026-04-04": 72}` — the single Apple Health import.
  Every other coffee or wine log was a no-op.

## Fix

Two coordinated changes in
[src/lib/nutrition/usdaNormalize.ts](../../src/lib/nutrition/usdaNormalize.ts):

1. Extended `VerifiedMacros` type with `caffeineMgPer100g: number | null`
   and `alcoholGPer100g: number | null`. Both nullable to honour the
   "no invented nutrition values" project rule.
2. Added two `findAmount()` matchers inside `fdcFoodMacrosPer100g`:
   - `caffeine` → matched against the lower-case nutrient name
     "caffeine" (never conflated with "caffeic acid").
   - `alcohol, ethyl` / `alcohol` → matched against either canonical
     USDA name. Some Branded / SR Legacy rows lower-case both forms.
3. Returns the value via `toMg()` / `toGrams()` for unit safety, with
   zero-amount → `null` (USDA returns 0 for "not measured" on some
   rows; we'd rather `null` than fabricate "0 caffeine in your
   espresso").

The downstream chain already supported these fields:
- `apps/mobile/lib/verifyRecipe.ts` → `MacrosPer100g` already declared
  the fields as optional `number | null`.
- `apps/mobile/components/food-search/FoodSearchPanel.tsx` already
  forwards them in the preview / onSelect path.
- `apps/mobile/app/(tabs)/index.tsx` → `handleFoodSearchSelect` already
  reads `result.macrosPer100g.{caffeineMgPer100g, alcoholGPer100g}` and
  scales them via `scaleCaffeineAlcohol()` before constructing
  `meal.micros`.
- `bumpStimulantsForLoggedMeal()` already reads `meal.micros.{caffeineMg, alcoholG}`.

So the upstream extractor was the single broken link.

## Validation

- 3 new vitest cases in [tests/unit/usdaNormalize.test.ts](../../tests/unit/usdaNormalize.test.ts):
  - "espresso parity" — caffeine extracted at 212 mg/100g.
  - "white wine parity" — alcohol extracted at 10.3 g/100g.
  - "no fabrication" — zero amount or missing entry returns `null`.
- Full vitest pass: 4598 / 4602 (4 failures are pre-existing flakes
  in `useShoppingListStateHouseholdScope.test.tsx` unrelated to this
  fix).
- Existing 5 fdcFoodMacrosPer100g tests still pass.

## What's still broken (filed separately)

- **Apple Health imports of alcoholic beverages** still don't carry
  `alcoholG` in `nutrition_micros`. The Apple Health → meal mapper
  is a separate code path that this fix doesn't touch. New task in
  Notion: "Apple Health alcohol/caffeine extraction parity with USDA".
- **FatSecret search returning no results** — separate P0.

## Cross-platform

`fdcFoodMacrosPer100g` lives in `src/lib/nutrition/` which both web
and mobile import. Single fix covers both platforms.

## Closes

- Grace's 2026-05-05 in-session bug report.
- Notion task [`Audit P0] Stimulant bump for wine + coffee — STILL BROKEN`](https://www.notion.so/35759b41503081ae8670f380c86d1ad8) → mark Done.
