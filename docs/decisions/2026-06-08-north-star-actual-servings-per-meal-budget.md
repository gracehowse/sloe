# North-star "what to eat next" — actual servings + per-meal budget

**Date:** 2026-06-08
**Area:** Nutrition / Today
**Status:** Resolved
**Linear:** ENG-995
**Source file:** `src/lib/nutrition/northStarSuggestion.ts`
**Journey doc:** `docs/journeys/what-to-eat-next.md` (renamed 2026-07-18 from
`north-star-2026-04-27.md`)

## Context

Founder feedback on the Today "what to eat next" north-star suggestion:
the suggestion "makes no sense." Two concrete problems, verbatim:

> "use actual servings when suggesting recipes, not scaled up ones. also
> it needs to be smarter. it's the morning — you shouldn't suggest a
> double portion of one meal to fill the whole day's calories, that
> makes no sense."

Root causes in the original scorer:

1. **Portion scaling.** Each recipe was scored at `{0.5, 1.0, 1.5, 2.0}`
   multipliers and the *scaled* number surfaced. A 573-kcal/serving
   recipe could display as 860 kcal (1.5×) — which doesn't match the
   recipe detail screen and isn't a real serving.
2. **Whole-day calorie target.** Every recipe was scored against the
   *entire* remaining-calorie envelope. In the morning, with a full day
   left, the "best fit" was whatever recipe was nearest the whole day's
   worth of calories — i.e. it deliberately preferred a giant double
   portion.

## Decision

Two changes to `bestPortionForRecipe` / `pickNorthStarSuggestion`,
shipped as a **correctness fix without a feature flag** (it has no
"old path worth keeping" — the old behaviour was simply wrong):

1. **Actual servings only.** Drop the portion multipliers.
   `predictedCalories = recipe.calories` and predicted macros are the
   recipe's per-serving macros. The card shows the recipe's real
   per-serving number, identical to the recipe detail.
   `portionMultiplier` is retained on the result type for source
   compatibility but is always `1`.

2. **Score against a per-meal budget, not the whole remaining day:**

   ```
   perMealTarget = min(slotShare[slot] · dailyCalorieTarget, remaining.calories)
   ```

   - `dailyCalorieTarget` (the user's **full** daily target) is added as
     a **required** field on `NorthStarRemaining`, threaded from each
     Today host (`effectiveCalorieTarget` web / `effectiveCalorieGoal`
     mobile). Required-not-optional so the compiler forces every call
     site to supply it — no silent fall-back to whole-day scoring.
   - The calorie penalty measures distance of one serving from
     `perMealTarget` (keeping the over ×3 / under ×1.5 asymmetry).
   - Protein-direction + carb/fat pulls still use the **day's** remaining
     macros (one meal legitimately closes part of the day's gap).
   - The `tight`/`close`/`loose` band is recomputed on the per-serving
     fit to `perMealTarget`. The why-line's "calorie fits" signal reads
     off that band so the chip and the subtitle always agree.

### Slot shares (tunable)

`NORTH_STAR_SLOT_SHARE` (exported) — documented defaults; a future flag
/ experiment can rebind without a code change:

| Slot      | Share |
|-----------|-------|
| breakfast | 0.25  |
| lunch     | 0.35  |
| dinner    | 0.35  |
| snack     | 0.10  |

No slot detected (late night / pre-dawn): `NORTH_STAR_NO_SLOT_SHARE =
1.0` — the whole remaining day is the meal budget, because we don't know
which meal it is and the `min(…, remaining)` cap never oversizes.

## Result

- Wide-open morning (full day left) → targets ~25–35% of the day, a
  normal single meal — picks the meal-sized recipe over a day-sized one.
- Late in the day with little left → the budget caps at `remaining`.
- It never sizes one meal to the whole day.

## Parity

Identical on web and mobile — the scorer is shared
(`src/lib/nutrition/northStarSuggestion.ts`, imported by mobile via
`@suppr/shared`). Both Today hosts thread the daily target through the
new required field. The presentational `NorthStarBlock` on both
platforms already read `predictedCalories` (now per-serving) — no display
edit needed.

## Tests

`tests/unit/northStarSuggestion.test.ts` pins the three load-bearing
behaviours: (a) 573-kcal recipe shows 573 (one serving); (b) morning
with a large remaining targets a meal-sized share, not the whole day;
(c) never more than one serving. Mobile host test
(`northStarBlockHostPhase5.test.tsx`) updated for the required
`dailyCalorieTarget` prop.
