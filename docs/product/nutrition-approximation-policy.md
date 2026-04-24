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
  - `nutrition_entries` inserts: mobile `logPlannedMealWithPortion` and web `onLogPlanMeal` both call `fetchPlannedMealMicros` first and check `macrosAreCoerced`. When true, the log is refused and the user is prompted to Verify the recipe.
- **Detection helper for write-path guards:** [`wouldCoerceMacros`](../../src/lib/nutrition/coerceRecipeMacrosForPlanning.ts) — cheap boolean, takes only the raw recipe macros.
- **Follow-up:** the planner display should eventually show a "macros estimated — verify for accuracy" chip on coerced rows. Tracked separately; today those rows just show the coerced numbers without a visual flag.

### A2 — ml-to-g density assumption (`totalGramsForVerifyScale`)

- **File:** [`src/lib/nutrition/totalGramsForVerifyScale.ts`](../../src/lib/nutrition/totalGramsForVerifyScale.ts)
- **Fires when:** a recipe ingredient is entered with unit `ml` and no `chosenPortion` provides a resolved `gramWeight`.
- **Output today:** `ml === g` — treats the ml amount as grams for per-100g scaling.
- **Known error:** water-only correct. For common liquids:
  - Olive oil ≈ 0.92 g/ml → **-9%** on kcal.
  - Whole milk ≈ 1.03 g/ml → **+3%**.
  - Honey ≈ 1.42 g/ml → **+42%**.
  - 40% ABV spirits ≈ 0.95 g/ml → **-5%**.
- **Status:** **KNOWN INCORRECT.** Scheduled for fix via density lookup on the matched food. Pinned by a deliberately-failing test (`tests/unit/totalGramsForVerifyScale.test.ts` "T-density: 100 ml of an ingredient without a resolved density must not be reported as 100 g"). Red until density ships.
- **Workaround for callers:** pass a `chosenPortion` with a pre-resolved `gramWeight` when possible (e.g. when the food match supplies a density).

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
