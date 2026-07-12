# Nutrition approximation policy

**Status:** live
**Owner:** `nutrition-engine`
**Source of truth for:** every place in the codebase where Suppr inserts or computes nutrition numbers that are NOT fully measured.

---

## The contract

Project rule (from `CLAUDE.md`, non-negotiable):

> If nutrition / ingredient matching is uncertain, do not guess.

Some approximations are **unavoidable** (missing data, unit ambiguity) and **bounded** enough to be useful. Those live here, documented. Every approximation in the codebase must be one of:

1. **Listed below**, with its trigger conditions, output, known error bounds, and explicit "safe for which surfaces" contract.
2. **Refused.** The code returns null / refuses to act / prompts the user to verify.

No third path. If you are about to add a new approximation and it isn't listed, either add it here (with `nutrition-engine` sign-off) or refuse the case.

---

## Approximations currently in use

### A1 — Macro coercion for kcal-only recipes (`coerceMacrosWhenCaloriesButNoGrams`)

- **File:** [`src/lib/nutrition/coerceRecipeMacrosForPlanning.ts`](../../src/lib/nutrition/coerceRecipeMacrosForPlanning.ts)
- **Fires when:** a recipe has stated `calories > 0` but the gram columns (`protein`, `carbs`, `fat`) explain less than 45% of those calories (threshold constant `MACRO_COERCION_THRESHOLD`).
- **Output:** neutral 28% protein / 42% carbs / 30% fat split of the stated calories. Result carries `isCoerced: true`.
- **Known error bound:** fabricated P/C/F values are plausible but arbitrary. For a 400 kcal recipe with actual macros 30P / 50C / 5F, the coerced output (28/42/13g) is off by roughly ±20g per macro — enough to mislead planning **and** to violate the "no guessing" rule if shown as real data.
- **Safe surfaces (display-only):**
  - Meal-plan fitter input (sampler uses coerced values for scoring; neutral split keeps the optimiser coherent).
  - Planner row display on mobile (prevents the "calories with 0g macros" confusion).
- **Refused surfaces (journal writes):**
  - `nutrition_entries` inserts from the planner: mobile `logPlannedMealWithPortion` (`apps/mobile/app/(tabs)/index.tsx`) and web `onLogPlanMeal` (`src/app/components/NutritionTracker.tsx`) both call `fetchPlannedMealMicros` first and check `macrosAreCoerced`. When true, the log is refused and the user is prompted to Verify the recipe.
  - `nutrition_entries` inserts from recipe-detail "Add to Today" (mobile, P0-3 2026-04-25): `addRecipeToTodayJournal` in `apps/mobile/app/recipe/[id].tsx` calls `wouldCoerceMacros(scaledForLog)` against the in-memory ingredient sum and refuses to insert when the gram columns don't explain the stated calories. Routes the user to `/recipe/verify?id=<id>`. (Web has no equivalent direct-log CTA on the recipe page; web users reach the journal through the planner path which is already guarded.)
- **Allow-listed surfaces (no coercion possible by provenance):**
  - HealthKit sync (`apps/mobile/lib/healthSync.ts`) — Apple-Health-sourced macros, never run through Suppr's coercion path.
  - Barcode log (`apps/mobile/app/(tabs)/barcode.tsx`) — explicit kcal + P/C/F resolved by the barcode → OFF/USDA pipeline, gated through `macroPlausibility` (F-77 per-100g Atwater gate + G2 post-scale guard below).
  - Copy-meal / duplicate-day bulk inserts (`apps/mobile/app/(tabs)/index.tsx`, `src/context/appData/useNutritionJournalState.ts`) — rows clone existing `nutrition_entries` data that was already validated when first inserted.
- **Detection helper for write-path guards:** [`wouldCoerceMacros`](../../src/lib/nutrition/coerceRecipeMacrosForPlanning.ts) — cheap boolean, takes only the raw recipe macros.
- **Follow-up (P1):** the planner display should show a "Estimated · verify" chip on coerced rows so users can see the planner is showing a neutral split before deciding to log. Today the journal-write refusal catches the bad path; the chip is a visual-honesty enhancement. Tracked as P1 in the launch roadmap.

### A2 — ml-to-g density resolution (`totalGramsForVerifyScale`)

- **File:** [`src/lib/nutrition/totalGramsForVerifyScale.ts`](../../src/lib/nutrition/totalGramsForVerifyScale.ts)
- **Fires when:** a recipe ingredient is entered with unit `ml`.
- **Output today (post P0-2, 2026-04-25):** density-aware. Resolution priority:
  1. `chosenPortion.gramWeight` when present and not the trivial `{label:"ml", gramWeight:1}` placeholder.
  2. `options.gPerMl` when supplied by the caller.
  3. `densityForName(ing.name)` via the STAPLES table in `estimateIngredientMacros.ts` (olive oil 0.92, honey 1.42, water 1.0, etc.).
  4. **Refused** — function returns 0 with `densityRefused: true` (use `totalGramsForVerifyScaleDetailed` for the flag). Caller surfaces a "needs density — switch to g/oz" hint.
- **Known error:** zero for the staples covered by the STAPLES table. For ingredients NOT in STAPLES with unit `ml`, the function refuses rather than guessing (per CLAUDE.md "if nutrition is uncertain, do not guess"). Add the ingredient to STAPLES (with sign-off) or the user picks a g/oz portion.
- **Status:** **FIXED.** Tests in `tests/unit/totalGramsForVerifyScale.test.ts` cover priority order, name lookup, options override, trivial-placeholder routing, and refusal. The previously deliberate `it.fails(...)` markers are now plain `it(...)` and pass.
- **Workaround when STAPLES misses a food:** add the ingredient to STAPLES with its `gPerMl` density (USDA / CIBSE / standard sources), or pass `options.gPerMl` from the caller, or have the user pick the g portion in verify.tsx. Mobile verify screen renders the "needs density — switch to g/oz" hint inline.

### A3 — Size-fallback ordering in `measureToGrams` — FIXED (ENG-701, 2026-05-26)

- **File:** [`src/lib/nutrition/measureToGrams.ts`](../../src/lib/nutrition/measureToGrams.ts)
- **Was:** a unit parsing as a size word (`large` / `medium` / `small`) matched the generic `COUNT_WEIGHT_G.large = 180 g` (etc.) *before* any food-specific count rule, so the per-piece weight of the actual food was ignored.
- **Fixed error cases:**
  - "2 large chicken breasts" → was 360 g (generic 180 × 2); now **400 g** (food-specific breast 200 g × 2).
  - "1 large chicken thigh" → was 180 g; now **120 g** (food-specific).
  - "1 large walnut" → was 180 g (generic); now **2.5 g** (walnut half; see A4).
- **Fix:** introduced `foodSpecificCountRef(name)` (and the thin `foodSpecificCountGramsEach(name)` wrapper) as the single source of truth for "what does ONE of this food weigh?". It is consulted FIRST by both the size-word path and the count/no-unit path. Lookup order is now **food-specific override → generic size → default**. Eggs keep their dedicated `EGG_SIZE_G` table (checked before the resolver). Bulk staples (rice/pasta/herbs) return `null` from the resolver and fall through to the generic size / heuristic path, as "one large rice" is not a meaningful piece.
- **Status:** **FIXED.** Pinned in `tests/unit/measureToGrams.test.ts` (ENG-701 block): walnut + large → 2.5 g, 2 large chicken breasts → 400 g, cooked-aware 300 g, count-path and size-word path agree for a discrete piece, and bulk staples still fall through to generic large (180 g).
- **Workaround for callers (still valid):** when the food match provides a gram weight, pass it via `chosenPortion.gramWeight` and skip this path.

### A4 — Per-piece count reference weights + confidence gating — FIXED (ENG-1544, 2026-07-12)

- **File:** [`src/lib/nutrition/measureToGrams.ts`](../../src/lib/nutrition/measureToGrams.ts)
- **Was (two defects):**
  1. **Miscalibrated coarse buckets.** `foodSpecificCountGramsEach` collapsed whole classes onto one number: *any* nut = 5 g (≈4× too heavy — an almond is ~1.2 g) and *any* small stone fruit = 15 g (60–77% too light — an apricot is ~35 g, a plum ~65 g).
  2. **Coarse guesses surfaced as HIGH confidence.** Every match returned `"high"` from `measureToGramsConfidence`, so the shopping-list count-to-weight normaliser aggregated counts into weight rows on those coarse guesses — violating "if nutrition is uncertain, do not guess".
- **Fix:** `foodSpecificCountRef(name)` now returns `{ grams, confident }`. Foods with a defensible **single-piece USDA FoodData Central / Handbook** reference weight are `confident: true`: almond 1.2 g, walnut half 2.5 g, cashew 1.5 g, pistachio kernel 0.7 g, hazelnut 1.0 g, pecan half 1.0 g, macadamia 2.5 g, peanut 1.0 g; fig fresh 50 g / dried 8 g; apricot fresh 35 g / dried 8 g; plum 65 g; prune 9.5 g; date 7 g; button mushroom 20 g; strawberry 12 g (plus the existing meat cuts and medium-produce references). The two remaining **catch-all buckets** — misc pickled/allium bits (olive/caper/cornichon/gherkin/radish/shallot ≈ 5 g) and misc small shellfish (prawn/shrimp/mussel/clam/scallop/oyster ≈ 15 g) — still return a weight so downstream math works, but are `confident: false`. `measureToGramsConfidence` rates a count/size word `"high"` only when `foodSpecificCountRef(...).confident === true`; a coarse-bucket or no-rule match is `"low"`, so the normaliser keeps the count and weight as separate rows instead of aggregating a guess.
- **Status:** **FIXED.** Pinned in `tests/unit/measureToGrams.test.ts` (ENG-1544 block: almonds ×10 → 12 g, plums ×2 → 130 g, apricot/fig fresh-vs-dried, date/prune/mushroom/strawberry references, coarse buckets stay non-confident) and `tests/unit/measureToGramsConfidence.test.ts` (defensible nut/stone-fruit counts → HIGH; olive/shallot/shrimp coarse counts → LOW).

---

## Plausibility guards (rejection, not approximation)

These are the "refuse" arm of the contract — code that detects a physically-
impossible nutrition value and rejects / soft-flags it rather than persisting
it.

### G1 — Open Food Facts per-100g basis reconcile (`reconcileOffPer100g`)

- **File:** [`src/lib/openFoodFacts/reconcilePer100g.ts`](../../src/lib/openFoodFacts/reconcilePer100g.ts)
- **Problem (P0, 2026-05-26):** OFF products with `nutrition_data_per: "serving"` store per-serving values in the `*_100g` fields. The code trusted `energy-kcal_100g` as genuine per-100g, so a 500 g pot of Greek yogurt's per-pot energy scaled ×5 to a physically-impossible **1,325 kcal / 265 g protein**.
- **Fires when:** `nutrition_data_per === "serving"` OR a `serving_quantity` is present, AND per-serving fields + a serving mass are available.
- **Output:** reconstructs per-100g as `(*_serving) / (serving_quantity/100)` and cross-checks against the published `*_100g`. When they disagree by >25% on a per-serving-basis row, the reconstructed value wins and the row is flagged `corrected: true` (→ `basisCorrected` / `_basisCorrected` downstream). When no per-serving fields exist, falls back to published (no invention).
- **ENG-774 (2026-06-13) — serving-basis WITHOUT a serving mass:** when a product *declares* `nutrition_data_per: "serving"` but omits `serving_quantity`, there is no mass to reconstruct or verify — the `*_100g` field may itself hold per-serving values (the same Chobani-class disguise) and we cannot correct it. Rather than silently trust it (the prior behaviour), the row is flagged `corrected: true` (→ soft-warn + demoted confidence); the value is left as published and `per100gFactor` stays `1` (no scaling on an unverifiable row). A genuine per-100g row missing `serving_quantity` stays unflagged (no false positive). **Gate (live OFF, popularity-sorted ×100): 0 hit this case** — rare, so it's defense-in-depth at P1, not P0. (Remaining ENG-774 #1/#2 — the barcode `PortionPicker` "1 serving" UI + `lookupBarcode` `macrosPerServing` branch — are a separate UI wave.)
- **Wired at every OFF ingest point (web + mobile parity):**
  - Web search: `src/lib/openFoodFacts/searchProducts.ts`
  - Web barcode: `src/lib/openFoodFacts/fetchProductByBarcode.ts` (also **removed** the `?? n["energy-kcal"]` / `?? n.proteins` per-serving fallbacks that masqueraded as per-100g)
  - Mobile search + barcode: `apps/mobile/lib/verifyRecipe.ts` (`searchOpenFoodFacts`, `lookupBarcode`)
- **Confidence consequence:** `verifyIngredients.ts` demotes a `_basisCorrected` OFF row's confidence (≤ 0.60) so a corrected row can't claim a high-trust match.

### G2 — Post-scale log plausibility guard (`checkScaledLogPlausibility`)

- **File:** [`src/lib/nutrition/macroPlausibility.ts`](../../src/lib/nutrition/macroPlausibility.ts)
- **Why distinct from the Atwater gate (F-77):** the Atwater gate runs on PER-100g rows and checks macro internal consistency. It does NOT catch the yogurt bug, because the inflated row is internally Atwater-consistent — the fault is the source basis, not the macro sum. This guard runs on POST-SCALE macros for a known gram weight.
- **Flags implausible when ANY of:**
  - kcal per gram > **9.1** (nothing edible exceeds pure fat ~9 kcal/g)
  - protein > grams × **0.95** (no whole food is >95% protein by mass)
  - derived per-100g (scaled ÷ grams/100) exceeds ceilings: kcal/100g > **900**, protein/100g > **90**, carbs/100g > **100**, fat/100g > **100**
  - **source-basis cross-check** (the most direct catch): when a `sourcePer100g` panel is supplied, scaled kcal must be within **25%** of `sourcePer100g.calories × grams/100`
- **Generous by design:** pure oil (~884 kcal/100g, 9 kcal/g) and protein isolate (~90 g/100g) PASS. The yogurt bug (1,325 kcal / 265 g protein / 500 g, panel 60 kcal/100g) FAILS on the source-basis arm.
- **Wired at both write boundaries (web + mobile parity):**
  - Recipe verify pipeline: `src/lib/nutrition/verifyIngredients.ts` — runs on every source branch (OFF, USDA, Edamam, Suppr DB, FatSecret, barcode override) after `scaleMacros(...)`. Failure → the candidate is rejected and the pipeline falls through (never persists the bad number).
  - Barcode / direct-log commit (soft-flag, not hard-block): mobile `apps/mobile/app/(tabs)/barcode.tsx` + `apps/mobile/components/BarcodeScannerModal.tsx`; web `src/app/components/suppr/today-barcode-dialog.tsx`. On failure (or `basisCorrected`), surface a "Double-check these numbers" warning with Edit / Log-anyway — never silently log, never trap a legit edge food.

### G3 — Accept floor + sub-floor totals exclusion (ENG-691, Decision D-05, 2026-05-25)

- **File:** [`src/lib/nutrition/verifyIngredients.ts`](../../src/lib/nutrition/verifyIngredients.ts)
- **Problem:** the engine accepted matches down to `MIN_MATCH_CONFIDENCE = 0.42` (`MIN_OFF_CONFIDENCE = 0.52`) with only a "needs review" badge below, while the published confidence bands say **reject < 0.70**. Worse, local-estimator rows (0.15–0.35 confidence) summed into recipe totals — a guess presented as part of the headline number, contradicting "if nutrition is uncertain, do not guess".
- **Fix:**
  - Single tunable accept floor `MIN_ACCEPT_CONFIDENCE = 0.55`. `MIN_MATCH_CONFIDENCE = 0.55`; `MIN_OFF_CONFIDENCE = 0.57` (one notch stricter for noisy product names). (D-05 proposed 0.70; the nutrition-engine review set it to 0.55 — see below.)
  - Any line whose final confidence is `< MIN_ACCEPT_CONFIDENCE` is flagged `belowAcceptFloor: true`. Its best-estimate macros stay on the row (so the UI can show "estimated — please verify"), but it is **excluded from `totals` / `perServing`**. `VerifyResult.belowAcceptFloorCount` reports how many lines were excluded so callers can prompt verification (since ENG-1305 the count is passed to `ingredientVerifyNeedsReview` directly — see the ENG-1305 entry below; excluded rows no longer drag `minIngredientConfidence`).
- **Single tuning knob:** `MIN_ACCEPT_CONFIDENCE`. Re-tune here (not in pipeline logic) once the impact review lands.
- **✅ NUTRITION-ENGINE IMPACT REVIEW DONE (2026-05-26) → shipped at 0.55, not 0.70.** The review (hand-verified against the scorer + alias pipeline) found 0.70 over-rejects verbose-descriptor staples — "brown rice" (~0.50), "whole milk" vs "Whole milk, 3.25%" (~0.66), "canned tomatoes" (~0.46), "all-purpose flour" (~0.28–0.46), "salmon" → "Fish, salmon, Atlantic, wild" (~0.36) — because the precision/extra-word penalties punish multi-word USDA descriptors (correct matches, verbose labels), and `genericFoods.ts` (clean aliases) isn't wired into the recipe pipeline. 0.55 tightens from the old 0.42 (kills weak dish-word matches) while keeping staples. The 0.70 *band* stays the display/trust signal in `verifyConfidencePolicy`. A genuine 0.70 accept floor needs scorer/alias work → **ENG-746**. Brown rice (~0.50 < 0.55) is still pinned as a canary in `tests/unit/confidenceGating.test.ts`.
- **✅ ENG-746 PIECE 1 SHIPPED (2026-06-13) — curated tables wired into the verify cascade.** `matchGenericFood` + `matchGenericBeverage` now run as a high-priority exact-alias short-circuit in `verifyIngredients.ts` (after the barcode override, before the network providers): a curated staple (brown rice, salmon, chicken breast, egg, canned tuna, whole milk, all-purpose flour, …) resolves at fixed confidence **0.95** with `source: "Suppr"`, bypassing `confidenceForMatch` entirely — so the verbose-USDA-descriptor penalty can't demote it. Added an `all-purpose flour` entry to the genericFoods corpus (USDA SR Legacy #20081 macros + Foundation #789890 micros, bake kcal Δ 0.5%). Mobile inherits via `/api/nutrition/verify-recipe` (no mobile-side edit). Pinned: `tests/unit/verifyIngredientsGenericFoods.test.ts` (staples resolve at 0.95 with every provider mocked off; unknowns fall through). **Piece 2 — raising `MIN_ACCEPT_CONFIDENCE` to a genuine 0.70 + re-tuning `confidenceForMatch` for the verbose USDA long-tail — remains OPEN (ENG-746):** broad blast radius on the recipe-import critical path, needs an empirical over-rejection measurement on a real ingredient corpus (can't be validated against mocked providers). A `canned tomatoes` corpus entry was also deferred — its no-salt-added (plain tin) vs salted (#11531) macro basis and a wrong micro-bake match (the plain-name search hit "Tomato products, canned, sauce") need resolving together first.
- **Status:** implemented + pinned. Tests: `tests/unit/confidenceGating.test.ts` (constants + over-rejection canary), `tests/integration/verify-ingredients-fatsecret-mock.test.ts` (accepted row sums, sub-floor row excluded, mixed recipe), `tests/integration/verify-ingredients-golden.test.ts` (estimation-only rows excluded from totals), `tests/unit/genericFoods.test.ts` + `tests/unit/genericFoodMicros.test.ts` (curated corpus + flour).
- **Parity:** the accept gate lives only in the shared `verifyIngredients.ts`; mobile's recipe-import verify path consumes it via the `/api/nutrition/verify-recipe` route + `verifyImportRecipe`, so the change applies to both platforms with no mobile-side edit. Mobile's `verifyRecipe.ts` search/picker flow has no independent accept gate (it keys on `RECIPE_INGREDIENT_REVIEW_CONFIDENCE`).
- **UI caller — honest under-count surfacing (ENG-1283, 2026-07-01):** the below-floor exclusion above means the review's macro total is silently under-counted whenever a row is flagged. The import review now says so — a calm "N of M ingredients need review — the macro total may be incomplete." line + the "needs review" row marking, on web (`RecipeUpload`) + mobile (`import-shared`), derived from the shared `importQualitySignal` predicate (same `isStructuredSource`/`calories > 0` gate as `is_verified`). Flag-gated `import_review_flagged_ingredients_v1` (default-ON). It surfaces the exclusion; it does NOT change the floor, the parser, or the persistence path. Decision: `docs/decisions/2026-07-01-import-review-honest-undercount-surfacing.md`.
- **✅ ENG-1305 (2026-07-01) — trust-label + stats consistency pass.** Three fixes, no change to the accept floor's value:
  - **Canonical home moved.** `MIN_ACCEPT_CONFIDENCE` / `MIN_MATCH_CONFIDENCE` / `MIN_OFF_CONFIDENCE` now live in `verifyConfidencePolicy.ts` (pure, shim-shared to mobile via `@suppr/nutrition-core`); `verifyIngredients.ts` re-exports them. Every floor consumer — the web accept gate, `isVerifiedFromVerifyRow`, and both platforms' `recipe_ingredients.is_verified` write paths — reads the SAME constants. Pinned: `tests/unit/verifyConfidencePolicy.test.ts` (ENG-1305 block).
  - **`is_verified` reads the accept floor.** The web/mobile add-ingredient inserts and `isVerifiedFromVerifyRow` used a hand-typed `>= 0.5` — rows the pipeline would EXCLUDE from totals (0.50–0.55) still got the "verified" trust label. All now use `MIN_ACCEPT_CONFIDENCE` (0.55). Tightening only removes labels: trust-safe. Pinned: `tests/unit/verifyRecipeResponse.test.ts`.
  - **Stats describe the accepted row set.** `minIngredientConfidence` / `avgIngredientConfidence` previously included below-floor rows already excluded from `totals` — the recipe-level trust numbers described a different recipe than the headline macros. They now compute over the same row set the totals sum; excluded rows force the review nudge via a new optional `belowAcceptFloorCount` parameter on `ingredientVerifyNeedsReview` (wired at every fresh-verify call site on web + mobile). Stored-row callers (`recipeIngredientsNeedReview`) are unchanged — persisted rows carry every confidence, so their stats were already row-set-complete. Pinned: `tests/unit/verifyIngredientsGenericFoods.test.ts` (ENG-1305 block).

### Parity footgun fix — `scaleMacrosByGrams`

Web `verifyIngredients.scaleMacros` takes a **factor** (grams/100); mobile `verifyRecipe.scaleMacros` took **grams**. Same name, different arg meaning — a second-order cause of this bug class. Mobile's is renamed to `scaleMacrosByGrams` (2026-05-26) so a grams value can never flow into a factor slot. Behaviour unchanged. (Note: `mealPlanAlgo.scaleMacros` is a separate, multiplier-taking function and is intentionally not renamed.)

---

## Rules for adding a new approximation

1. **Document here first.** New entry with trigger conditions, output shape, quantified error bounds, and safe/refused surface list.
2. **Add the branded signal.** Either `isCoerced` / `isEstimated` on the return type, or a sibling `wouldCoerce*` detection helper.
3. **Guard the journal.** Any path writing to `nutrition_entries`, `user_foods`, `recipes.*_per_serving`, `meal_plan_meals`, or equivalents MUST check the signal and either refuse or prompt for verification. Never persist coerced values silently.
4. **Ship a test that fails on regression.** Pin the signal-read behaviour AND the journal-write refusal path. Both.
5. **Source-file reference.** The source file that implements the approximation must carry a header comment pointing back to this doc.

---

## Related

- [2026-04-24 full-sweep ship verdict](../decisions/2026-04-24-full-sweep-ship-verdict.md) — T4 decision that gated this doc.
- [Full-sweep audit](../audits/2026-04-24-full-sweep.md) §C — nutrition correctness findings.
- [Executor backlog](../planning/sweep-2026-04-24-executor-backlog.md) T4, T16.
