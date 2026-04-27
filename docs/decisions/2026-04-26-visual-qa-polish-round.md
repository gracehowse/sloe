# Decision log: 2026-04-26 visual-QA polish round (9 fixes)

**Date:** 2026-04-26
**Status:** Resolved
**Trigger:** Tester feedback (Grace, with screenshots) flagging 9 distinct visual / UX / accuracy issues observed on the live mobile app and web Discover feed. All P0/P1/P2 launch work was already closed (see `2026-04-full-sweep-ship-verdict.md`); this is a follow-on visual-QA pass to clear the last obvious roughness before TestFlight expansion.

---

## Decision

Land 9 fixes in one polish round, each with a shared helper or test pin so the same regression cannot recur quietly.

### 1. `[TEMP SEED]` description leak

**Problem:** Discover-seeder rows shipped to prod with the cleanup-tag prefix `[TEMP SEED] ` still attached to `recipes.description`. Recipe Detail rendered the description verbatim, so the internal bookkeeping tag leaked to users (e.g. "Best Lentil Soup" detail page).

**Fix:** Two-layer.
- `scripts/seed-discover-recipes.ts` — stopped emitting the prefix; cleanup uses `source_url` (already canonical via `scripts/delete-seeded-recipes.ts`).
- `src/lib/recipes/sanitizeRecipeDescription.ts` — defensive render-time strip applied at both render sites (`RecipeDetail.tsx` web; `apps/mobile/app/recipe/[id].tsx`). Catches any prod row already carrying the tag.

Pinned by `tests/unit/sanitizeRecipeDescription.test.ts` (5 tests).

### 2. Floating-point macro display ("C 105.80000000000001g")

**Problem:** Each render site rolled its own `Math.round`. When upstream produced `recipe.carbs * scale` and the float landed on `105.80000000000001`, integer-rounding sites showed `106g` (lost precision) and 1-decimal sites showed `105.80000000000001g` (raw). Tester saw the latter.

**Fix:** Single source of truth at `src/lib/nutrition/formatMacro.ts`. Per-macro rules:
- Calories, sodium → integer
- Protein, carbs, fat, fibre, sugar → 1 decimal with trailing `.0` trimmed (so 105.0 → "105", 105.8 → "105.8")
- NaN / Infinity / null / undefined → 0

Wired into 5 render sites: `RecipeDetail.tsx`, `suppr/macro-card.tsx`, `today-dashboard-macro-tiles.tsx` (web); `MacroRingSmall.tsx`, `TodayDashboardMacroTiles.tsx` (mobile); plus the mobile recipe-detail nutrition tab.

Pinned by `tests/unit/formatMacro.test.ts` (8 tests including the exact `105.80000000000001` regression).

### 3. Discover macro icon parity

**Problem:** On Discover cards (web + mobile), only protein had an icon; carbs and fat were tacked onto the protein-row text as "Xg P · Yg C · Zg F". Fibre wasn't shown at all.

**Fix:** Each macro now gets its own icon + value pair (Beef · Wheat · Droplets · Leaf). Fibre joins the row when `recipe.fiberG > 0`. Added `fiber: Leaf` to the central `src/app/components/ui/icons.ts` map.

Web: `DiscoverFeed.tsx` desktop grid (lines 628-700) + mobile-web hero (lines 717-755).
Mobile: `apps/mobile/app/(tabs)/discover.tsx` hero card (lines 275-318).

### 4. ALL-CAPS imported recipe titles

**Problem:** Many publisher schema.org `name` fields are stored in ALL CAPS for visual emphasis. Imports ("PEANUT LIME CHIC...") rendered verbatim across the app, reading as broken or spammy.

**Fix:** `src/lib/recipes/normalizeRecipeTitle.ts` — heuristic Title Case. If the input has any lowercase character, leave alone (respect author's casing). If fully uppercase, title-case word-by-word with a stop-word list (`and`, `of`, `the`, etc.) so "OF MICE AND MEN" → "Of Mice and Men". First/last words are always capitalised. Hyphenated compounds preserved.

Applied at 3 save sites: `apps/mobile/lib/saveImportedRecipe.ts`, `apps/mobile/app/create-recipe.tsx`, `src/app/components/RecipeUpload.tsx`.

Pinned by `tests/unit/normalizeRecipeTitle.test.ts` (6 tests).

### 5. Recipe Detail spacing (calories ↔ macros)

**Problem:** Visible vertical void between the calories hero card and the macro tiles on mobile Recipe Detail.

**Fix:** Two changes in `apps/mobile/app/recipe/[id].tsx`:
- Dropped the redundant uppercase "MACROS" overline label between the calories hero and the tiles. Each tile already self-labels with a coloured chip + label; the overline was visual dead weight.
- Tightened the calories-hero `marginBottom` from `Spacing.md` (12) to `Spacing.sm` (8).

### 6. Search tokenization ("wasabi katsu curry" → no results)

**Problem:** Pre-fix, both Discover surfaces did `r.title.toLowerCase().includes(searchQuery.toLowerCase())`. Querying `"wasabi katsu curry"` against a title `"Katsu Curry"` (creator: `"Wasabi"`) failed because the literal substring wasn't contiguous.

**Fix:** `src/lib/recipes/recipeSearchMatch.ts` — tokenized AND match. Splits the query into tokens (apostrophe-stripped, punctuation-folded), requires every token to appear somewhere across `{ title, description, creatorName, source, tags }`. Token order doesn't matter.

Wired into:
- `src/app/components/DiscoverFeed.tsx` (line 366)
- `apps/mobile/app/(tabs)/discover.tsx` (line 175)

Pinned by `tests/unit/recipeSearchMatch.test.ts` (7 tests including the exact "wasabi katsu curry" regression).

### 7. Zero-cal serving accepted at high confidence ("olive oil at 98% → 0 kcal")

**Problem:** FatSecret occasionally returns placeholder rows with `calories=0` and all macros zero. The match scorer correctly identifies `"olive oil"` at high confidence, the `scaledMacrosPlausible` check returns `true` for the all-zero short-circuit (intentionally, to allow tiny pinch amounts), and the empty row ships as `"olive oil — 0 kcal · 0g P · 0g C · 0g F"` at 98% confidence.

**Fix:** Added `sourceIsAllZero` guard in `src/lib/nutrition/verifyIngredients.ts` immediately after `normalizeServingToMacros(serving)` in the FatSecret path. When the serving has no positive calorie/protein/carb/fat value, log a warning and fall through to the next source (USDA-other, OFF, local estimator). The downstream `scaledMacrosPlausible` semantics are unchanged for legitimate tiny-pinch cases.

Pinned by `tests/unit/portionClampPolish.test.ts` (structural assertions on the guard placement).

### 8. Meal-plan portion clamp + low-fit fallback re-sample

**Problems (twin):**
- **Weird fractions:** plans showed portions like `0.3×`, `0.5×`, `1.2×`, `0.7×` mixed across slots. Tester feedback: "always do 1× where possible, only reduce where necessary."
- **Calorie / macro drift:** generated plans landed far from goals (1,181 kcal vs ~1,800 target on a 4-meal day) when the optimizer's joint sampler couldn't satisfy bands and the independent fallback accepted the very first build no matter how badly it drifted.

**Fix (in `src/lib/nutrition/mealPlanAlgo.ts` and `src/lib/planning/generateMealPlan.ts`):**

(a) `PORTION_MULTIPLIER_CLAMP` tightened from `{ min: 0.2, max: 2.5, step: 0.1 }` (23 legal positions per slot) to `{ min: 0.5, max: 2.0, step: 0.5 }` (4 positions: 0.5 / 1 / 1.5 / 2). The optimizer's existing `mealPlanDeviationFromOnePenalty` (×18) already biases toward 1×; with only 4 legal positions plus that 18× pressure, the optimizer now lands on whole portions in the common case and only reaches for 0.5× / 1.5× / 2× when bands genuinely demand it.

(b) Independent-fallback re-sample loop. Both web (`generateMealPlan.ts`) and mobile (`generateSmartPlan` inside `mealPlanAlgo.ts`) now build 4 candidate fallback days with offset RNG seeds and keep whichever is closest to the calorie target. Bounded cost (4× one fallback build) — dramatically tightens fit on small pools where the joint sampler gives up.

Pinned by `tests/unit/portionClampPolish.test.ts` (5 tests) plus the existing `mealPlanWebMobileParity.test.ts` (10 tests, behavioural, all green) and `mealPlanMacroFit.test.ts` (15 tests, updated to assert the new clamp shape).

### 9. Micronutrient breadth — deferred until FatSecret upgrade (see separate decision)

**Problem:** Tester feedback: "micronutrients list is very short — all other providers (MFP, Lose It etc) show all nutrients."

**Root cause:** FatSecret v3 free tier returns 7 nutrients (cal/protein/carbs/fat/fibre/sugar/sodium). Suppr's storage and renderer already handle a much wider set (32 nutrients via OFF barcode imports), but the search path that powers most ingredient resolution is FatSecret-bound.

**Resolution:** Deferred to a separate decision (`2026-04-26-fatsecret-upgrade.md`) — Grace has decided to upgrade the FatSecret tier rather than build a parallel OFF-search path. Not a polish-round line item.

---

## Rationale

Each fix has the same shape: ship a small shared helper (or constant change), wire it into every consumer, pin the contract with a vitest. The polish round is end-of-band cleanup, not feature work — the 9 issues are the gap between "P2 done, GO for cohort expansion" and "no obvious roughness on the screen the tester sees."

The portion-clamp and fallback-retry changes (#8) are the most structurally significant. The previous wide clamp gave the optimizer too much surface area; reducing it to 4 legal positions per slot makes the planner output legible to a human and the re-sample loop closes the calorie-drift complaint on the same line. The behavioural parity test passed unchanged after both changes, which is the strongest signal that the optimizer's intent (driven by `mealPlanDeviationFromOnePenalty` and band scoring) is robust to a tighter constraint set — it was already wanting whole portions; the wider clamp just let it drift when bands were tight.

## Alternatives considered

- **Re-do the whole calorie-drift complaint via target-band tightening rather than the fallback re-sample loop.** Rejected. The drift complaint was specifically about the *fallback* path (joint sampler couldn't satisfy bands → first independent build accepted regardless of fit). Tightening bands at the joint sampler doesn't help the fallback; the fallback was the bug.
- **Strip `[TEMP SEED]` only at render, leave the source emitting it (so legacy rows stay tagged for cleanup).** Rejected. The source-side tag was redundant — `delete-seeded-recipes.ts` keys off `source_url` which is canonical. Stripping at source AND render is belt-and-braces; one fix, two safeguards.
- **Build a shadow OFF-backed ingredient search to expand micronutrient breadth.** Rejected (per Grace). FatSecret upgrade is simpler, single-vendor-relationship, and the storage / renderer already accept the wider nutrient set. See sibling decision.

## Tests

- 5 new test files (31 new tests): `formatMacro.test.ts`, `normalizeRecipeTitle.test.ts`, `recipeSearchMatch.test.ts`, `sanitizeRecipeDescription.test.ts`, `portionClampPolish.test.ts`.
- 2 existing tests updated to match new behaviour: `mealPlanMacroFit.test.ts` (clamp shape), `discoverThreeSectionLayout.test.ts` (search tokenization).
- All affected suites green: planner family (96), verifyIngredients (24), Discover (19), recipe-import + cook + integration (89), polish (31). Web `tsc --noEmit` clean. Mobile `tsc --noEmit` clean.

## Outcome

9 visual-QA fixes landed in a single polish round. No P0/P1/P2 work re-opened. Launch posture unchanged from the 2026-04-25 ship verdict: GO for cohort expansion.
