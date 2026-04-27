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
  - Barcode log (`apps/mobile/app/(tabs)/barcode.tsx`) — explicit kcal + P/C/F resolved by the barcode → OFF/USDA pipeline, gated through `macroPlausibility` (F-77).
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

### A3 — Size-fallback ordering in `measureToGrams`

- **File:** [`src/lib/nutrition/measureToGrams.ts`](../../src/lib/nutrition/measureToGrams.ts)
- **Fires when:** a unit parses as a size word (`large` / `medium` / `small`) before a food-specific count rule is checked.
- **Output today:** generic `COUNT_WEIGHT_G.large = 180 g` is applied regardless of the food.
- **Known error cases:**
  - "2 large chicken breasts" → 360 g (generic 180 × 2) vs the food-specific intended 400 g (breast = 200 g × 2). **-10%**.
  - "1 large chicken thigh" → 180 g vs 120 g intended. **+50%**.
  - "1 large avocado" → 180 g (within typical range; low error).
- **Status:** known ordering bug; scheduled for fix — evaluate name-specific rules first, fall through to size defaults.
- **Workaround for callers:** when the food match provides a gram weight, pass it via `chosenPortion.gramWeight` and skip this path.

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
