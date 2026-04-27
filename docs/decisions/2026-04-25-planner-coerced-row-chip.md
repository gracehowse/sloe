# Decision log: planner-row "Estimated · verify" chip on coerced rows (P1-19, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved
**Trigger:** P1-19 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). The `nutrition-approximation-policy.md` §A1 follow-up tracked it: "the planner display should eventually show a 'macros estimated — verify for accuracy' chip on coerced rows."

---

## Decision

Threaded `macrosAreEstimated?: boolean` through both the mobile (`PlanMeal`) and web (`DayPlanMeal`) types. Both `generateSmartPlan` (`src/lib/nutrition/mealPlanAlgo.ts`) and `generatePlanFromLibrary` (`src/lib/planning/generateMealPlan.ts`) now set the flag on output rows when the underlying pool recipe was coerced by `coerceMacrosWhenCaloriesButNoGrams` (kcal known, P/C/F unknown → neutral 28/42/30 split).

UI rendering:
- **Mobile** — `apps/mobile/app/(tabs)/planner.tsx` — pill in `Accent.warning` amber below the kcal/macros row, "Estimated · verify".
- **Web** — `src/app/components/MealPlanner.tsx` — same wording, same accent, in the meal card.

Pinned by `tests/unit/mealPlanCoercedRowChip.test.ts` — 4 tests covering coerced-only pool, coherent-only pool, mixed pool, and web-platform parity. Sibling `mealPlanAlgo.test.ts` (14) + `generateMealPlan.test.ts` (13) all green at the new shape.

## Rationale

P0-3 closed the correctness loop — coerced rows can't be persisted to `nutrition_entries` (the journal-write paths refuse them and route the user to verify). What was missing was the visual loop: a planner row showing "Pad Thai · 580 kcal · 41 P · 60 C · 19 F" with no flag, when those P/C/F are a synthesized split.

The chip is the cheapest possible "you should verify this before relying on these macros" signal. Same wording on web + mobile, same amber colour the verify screen's "needs density" hint already uses (consistency hygiene). No copy bikeshedding — "Estimated · verify" is short, factual, and routes to the correct action.

## Alternatives considered

- **Render the chip only on mobile (web users have a wider viewport, can fit a fuller explanation).** Rejected. The chip is the same data; the wording is the same; rendering it in two different shapes is exactly the kind of cross-platform divergence the parity non-negotiable exists to prevent.
- **Replace the macro values with em-dashes (`— P / — C / — F`) when coerced.** Rejected. The values aren't unknown — they're "kcal explained, P/C/F neutralized." The em-dash treatment would mislead the user about what the planner actually had to work with. The chip leaves the values visible and says "this is an estimate, not a measurement."
- **Tap the chip → opens recipe verifier.** Considered. Out of scope for this iteration; the chip's `aria-label` / `accessibilityLabel` already says "open the recipe to verify". Tap-to-verify is a P3 polish item.

## Implementation

- `src/lib/nutrition/mealPlanAlgo.ts` — added `macrosAreEstimated?: boolean` to `PlanMeal`. Threaded through both the joint-fit and the independent-slot fallback path.
- `src/lib/planning/generateMealPlan.ts` — same threading on `DayPlanMeal`. Also added `recipeId` to the rows produced by both paths (was missing on the independent-slot fallback; small bonus parity fix).
- `src/types/recipe.ts` — added `macrosAreEstimated?: boolean` to the `DayPlanMeal` interface.
- `src/app/components/MealPlanner.tsx` — chip rendered between the kcal/macro line and the swap button. Conditional on `meal.macrosAreEstimated` and not `isPlaceholder`.
- `apps/mobile/app/(tabs)/planner.tsx` — chip rendered below the macros row using existing `Accent.warning` colour.
- `tests/unit/mealPlanCoercedRowChip.test.ts` — new. **4/4 green.**

Web + mobile `tsc --noEmit` clean.

## Platforms affected

- **Mobile:** chip visible on every coerced row in the planner. No behaviour change otherwise.
- **Web:** chip visible on every coerced row in `MealPlanner`. No behaviour change otherwise.
- **Supabase:** none.

## Verification

- 31/31 across the meal-plan algorithm + chip surface (`mealPlanAlgo.test.ts`, `generateMealPlan.test.ts`, `mealPlanCoercedRowChip.test.ts`).
- Typecheck clean web + mobile.
- Manual visual confirmation deferred to TestFlight smoke (run under a recipe library that contains at least one kcal-only row; chip should render on the planner's slot for that recipe).

## Related artefacts

- [Opus 4.7 codebase review §3.10](../audits/2026-04-25-opus47-codebase-review.md) (P1-19 entry)
- [P0-3 — wouldCoerceMacros at journal write paths](./2026-04-25-coerce-macros-journal-guards.md) — the correctness counterpart
- [Nutrition approximation policy §A1](../product/nutrition-approximation-policy.md) — the policy this chip implements

## Revisit when

- Tap-to-verify follow-up ships — wire `onPress` / `onClick` on the chip to navigate to `/recipe/verify?id=<id>`.
- A new approximation type is added to `coerceRecipeMacrosForPlanning.ts` (e.g. fiber inference). Add a separate flag (`fiberIsEstimated`) and a separate chip; don't overload `macrosAreEstimated`.
- Telemetry shows users tapping the recipe row 3+ times before tapping verify — the chip wording isn't strong enough; A/B test alternatives.
