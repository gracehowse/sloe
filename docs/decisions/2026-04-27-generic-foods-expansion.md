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

## Follow-up: micronutrient pull-through (ENG-738, 2026-05-26)

**Gap:** the generic-food rows above seeded only the seven `per100g`
macros (kcal/P/C/F/fibre/sugar/sodium). When a user logged a generic
staple (carrot, spinach, …) the select→commit path never attached a
`microsPer100g` panel, so `nutrition_micros` was written empty and the
meal-detail "Vitamins, minerals & more" card showed "did not publish…".
The real-USDA and OFF branches already threaded `microsPer100g` (F-79);
the GenericFood branch did not.

**Data (already baked, not regenerated here):**
`src/lib/nutrition/genericFoodMicros.ts` — a per-100g micronutrient panel
for all **35 generic FOODS**, keyed by the `GenericFood.id` and using the
same canonical camelCase keys as the runtime USDA path
(`fdcFoodMicrosPer100g`). Auto-generated from real USDA Foundation /
SR-Legacy rows, calorie-anchored at bake time so a wrong row can't slip
in. Each entry cites its source `fdcId`. **Do not hand-edit numbers —
re-run the bake.** Beverages are deliberately out of scope (deferred).

**Wiring (web + mobile, byte-for-byte equivalent logic):**
- Row construction attaches the panel the same way the OFF row does:
  - web `src/app/components/food-search/FoodSearchPanel.tsx`
    `buildGenericMatchRow()` → `...(genericMicros ? { microsPer100g } : {})`
  - mobile `apps/mobile/lib/verifyRecipe.ts` `genericFoodToUnifiedResult()`
    → same conditional spread, via `genericFoodMicrosPer100g(f.id)`.
- The select branch threads `item.microsPer100g` onward (both panels),
  identical to the OFF branch. The combined GenericBeverage/GenericFood
  branch uses a conditional spread, so beverages (no baked micros) are
  untouched.
- **No commit-path change.** The existing
  `scaleMicrosForGrams(result.microsPer100g ?? {}, grams, …)` callsite
  (mobile `(tabs)/index.tsx`, web `NutritionTracker.tsx`) already scales +
  persists once `microsPer100g` is present on the selection.

**Tests:**
- `tests/unit/genericFoodMicros.test.ts` — table shape (35 foods, 1:1 with
  the dictionary, every panel non-empty + all values > 0) + spot-checked
  USDA values (carrot vitamin A ≈ 835 µg / potassium ≈ 320 mg; spinach
  vitamin K ≈ 483 µg / folate ≈ 194 µg).
- `tests/unit/foodSearchPanelGenericMicros.test.tsx` — web select→commit:
  picking a carrot / spinach row emits an `onSelect` selection carrying the
  baked micros.
- `apps/mobile/tests/unit/genericFoodMicrosCommit.test.ts` — mobile
  select→commit: real `searchFoods` → generic row → real
  `scaleMicrosForGrams` → non-empty, grams-scaled `nutrition_micros`.
- `apps/mobile/tests/unit/offMicrosPullThroughParity.test.ts` — extended
  with an ENG-738 section pinning the threading on both platforms.

---

## Follow-up: no-salt-added canned tomatoes (ENG-1083, 2026-06-17)

**Gap:** the table had a raw `tomato` row but nothing for canned/tinned
tomatoes — a staple recipe ingredient. A plain "canned tomatoes" / "chopped
tomatoes" query fell through to the live USDA/OFF fan-out, which surfaces a mix
of salted, branded, and puree rows. There was also no low-sodium option, so a
recipe built on tinned tomatoes silently logged the salted default.

**Data (real USDA, not invented):**
- `src/lib/nutrition/genericFoods.ts` — new entry `canned-tomatoes-no-salt`
  ("Canned tomatoes (no salt added)"). Per-100g macros from USDA SR Legacy
  **#170138** "Tomatoes, red, ripe, canned, packed in tomato juice, no salt
  added": 16 kcal, 0.8 P / 3.5 C / 0.3 F, fibre 1.9 g, sugar 2.6 g, **sodium
  10 mg**. Default serving 200 g (½ of a standard 400 g can). Aliases are
  distinct from the raw `tomato` row (canned/tinned/chopped variants), so the
  bare "tomato" query still lands the raw entry — verified by the alias-
  uniqueness pin and an explicit matcher test.
- `src/lib/nutrition/genericFoodMicros.ts` — matching per-100g micro panel
  baked from the same #170138 row via the runtime normaliser
  (`fdcFoodMicrosPer100g`), the exact source the bake script uses. The
  defining contrast: sodium **10 mg/100g** here vs **115 mg/100g** on the
  salted canned counterpart (#170051). Cites the fdcId per convention.

This is shared business logic in `src/lib/nutrition/` — mobile imports the same
two files via the `@suppr/shared` alias, so the entry lands on both platforms
from a single change (no mobile-specific copy exists).

**Tests:**
- `tests/unit/genericFoods.test.ts` — matcher routing (canned/tinned/chopped →
  `canned-tomatoes-no-salt`; bare "tomato"/"tomatoes" still → raw `tomato`) +
  a per-100g lock on the low-sodium macros.
- `tests/unit/genericFoodMicros.test.ts` — count bumped 36 → 37; a spot-check
  pinning the LOW sodium (10 mg) + hallmark potassium/vitamin C so a re-bake
  that picks the salted row fails loudly.
- `tests/unit/genericFoodMicrosAudit.test.ts` (unchanged) — its "every
  GENERIC_FOODS id has a baked micro row" invariant covers the new entry; the
  kcal-vs-macro plausibility check passes (≈19.3 kcal-from-macros vs 16).

---

## Outcome

- F-73 cortado pattern extended from 12 coffee drinks to 30 beverages (coffee + tea + milk + juice + alcohol) and 33 generic foods (fruit + veg + grains + protein + dairy + nuts).
- Web ↔ mobile parity restored: both platforms now route through the generic-match shim before the live USDA / OFF / Edamam fan-out.
- Selection bug fixed in same turn — Grace can now tap a cortado / apple / chicken-breast row and land on the portion picker.

Backlog: post-launch usage data will tell us which queries are still hitting USDA Branded noise. Add the next ~20 most-frequent miss-misroutes to the table in a v1.1 sweep.
