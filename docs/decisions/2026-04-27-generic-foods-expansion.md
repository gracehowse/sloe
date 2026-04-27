# Generic foods + drinks expansion (F-73 follow-up) — 2026-04-27

**Date:** 2026-04-27
**Status:** Resolved (shipped same day as F-73 itself)
**Trigger:** Grace asked whether the F-73 generic-beverages pattern could be extended to other ambiguous-search categories. Answer: yes, the same in-memory match shim works for any class where USDA Branded outranks the canonical row. Same day Grace also reported a tap-to-select bug ("unable to select the options that we have created (eg cortado)") which is captured in the bug fix section below.

---

## What shipped

### Beverage table extended (12 → 30)
`src/lib/nutrition/genericBeverages.ts` — appended 18 entries beyond
the original 12 coffee drinks:
- **Tea (6):** black tea (alias "tea"), green tea, matcha latte, chai latte, herbal tea, Earl Grey
- **Milk (6):** whole milk (alias "milk"), semi-skimmed milk, skim milk, oat milk, almond milk, soy milk
- **Juice (2):** orange juice, apple juice
- **Alcohol (4):** red wine, white wine, lager (alias "beer"/"pint"), IPA

The `GenericBeverage` type gained an optional `alcoholGPer100ml?: number`
field so wine / beer entries plumb their ethanol content through the F-13
auto-track path (parallel to the existing `caffeineMgPer100ml` pull-through
on coffee + tea). Per-100ml macros are USDA SR Legacy / OFF-curated
averages; ABV → g ethanol uses ethanol density 0.789 g/ml.

### New `genericFoods.ts` module (33 entries)
`src/lib/nutrition/genericFoods.ts` — sister module covering solid
foods that hit the same USDA-Branded-noise class as coffee drinks did.
Same matcher pattern (exact-alias, normalisation-tolerant) but with
`per100g` macros and a `servingG` + `servingLabel` for the curated
default portion ("1 medium (182g)" for an apple, "1 fillet (174g)"
for chicken breast, etc.). Coverage:
- **Fruit (8):** apple, banana, orange, pear, grapes, strawberries, blueberries, mango
- **Vegetables (8):** broccoli, carrot, onion, potato, sweet potato, spinach, tomato, cucumber, mushroom
- **Grains (6):** white rice (cooked), brown rice (cooked), oats (raw), quinoa (cooked), pasta (cooked), white bread
- **Protein (7):** chicken breast (raw), salmon (raw), canned tuna, beef mince 5%, beef mince 20%, eggs (whole), tofu (firm)
- **Dairy (3):** Greek yogurt, cheddar, butter
- **Nuts / spreads (2):** almonds, peanut butter

### Wiring (web + mobile)
- `apps/mobile/lib/verifyRecipe.ts searchFoods()` — calls `matchGenericBeverage(query)` first, falls through to `matchGenericFood(query)` when no beverage hit. Either match prepends a synthesised `UnifiedSearchResult` (with `_source: "GenericBeverage"` / `"GenericFood"`) ABOVE the parallel USDA + OFF + Edamam fan-out so the user sees the right row first.
- `src/app/components/FoodSearch.tsx` — same pattern via `buildGenericMatchRow(query)` helper, threaded through `mergeAndDedup` as a new `generics` parameter. Closes a parity gap from F-73 itself (the original cortado fix only landed on mobile).

### Selection-path bug fix (Grace's report)
**Bug:** "unable to select the options that we have created (eg cortado)" — tapping a generic-beverage / generic-food row was a no-op because `onPickResult` had no branch for `_source === "GenericBeverage"` / `"GenericFood"`. The handler fell off the end of the if/else chain and silently reset the loading key.

**Fix:** added a new branch in both `onPickResult` paths (web `FoodSearch.tsx`, mobile `FoodSearchModal.tsx`) that reads macros + `primaryServing` directly off the row (no fetch needed — both are already in-row) and projects the source to `"USDA"` at the preview boundary. We project to USDA because the seeded macros came from USDA Foundation / SR Legacy averages, so downstream attribution ("USDA FoodData Central") stays honest. The `SearchRow` discriminator on mobile was widened to allow the new sources.

---

## Why exact-alias match (not substring)

Every entry is matched with `normaliseForMatch(query) === normaliseForMatch(alias)` for some alias on the row. We deliberately do **not** substring-match because that produces false positives:

- "rice pudding" must NOT collapse to "rice"
- "apple pie" must NOT collapse to "apple"
- "chicken breast with skin" must NOT collapse to "chicken breast" (the user wants the with-skin USDA row, which has higher fat)
- "macchiato latte" (a non-real drink name) must NOT collapse to either "latte" or "macchiato"

The trade-off: queries that don't exactly match an alias miss. We mitigate by listing the most common aliases per row (singular + plural, British + American spelling, common typos like "cappucino"/"capuccino"), and any miss falls through to the regular USDA / OFF / Edamam fan-out — which is what was happening before F-73 anyway, so no regression. Tests pin the no-substring behaviour explicitly.

---

## Tests

- `tests/unit/genericBeverages.test.ts` (14 tests) — pins the matcher contract, table integrity (30 entries, unique aliases, distinct names), alcohol-bearing entries set `alcoholGPer100ml`, common alias routes (milk → whole-milk, tea → black-tea, beer → lager).
- `tests/unit/genericFoods.test.ts` (11 tests) — same shape: matcher contract (case-insensitive, plural-tolerant, British-spelling variants), no-substring guard (rice pudding ≠ rice; apple pie ≠ apple), table integrity (≥30 entries, unique aliases, calories within sane 0..900 floor/ceiling).

`npm run vitest run tests/unit/generic*` → 25 / 25 green.
`npx tsc --noEmit` (root + apps/mobile) → clean.

---

## Why "USDA" attribution at log time

The seeded macros came from USDA Foundation / SR Legacy averages. Logging the meal with `source: "USDA FoodData Central"` is correct attribution — the curation step here just preempts USDA Branded noise; the underlying numbers ARE USDA. This is why both `onPickResult` branches set `setPreview({ ..., source: "USDA", ... })`.

If we ever start mixing in non-USDA-derived rows (e.g. brand partnerships, manual curation from FoodData.com.au) we'll need to broaden `FoodSearchSelection.source` to track the curation source separately.

---

## Outcome

- F-73 cortado pattern extended from 12 coffee drinks to 30 beverages (coffee + tea + milk + juice + alcohol) and 33 generic foods (fruit + veg + grains + protein + dairy + nuts).
- Web ↔ mobile parity restored: both platforms now route through the generic-match shim before the live USDA / OFF / Edamam fan-out.
- Selection bug fixed in same turn — Grace can now tap a cortado / apple / chicken-breast row and land on the portion picker.

Backlog: post-launch usage data will tell us which queries are still hitting USDA Branded noise. Add the next ~20 most-frequent miss-misroutes to the table in a v1.1 sweep.
