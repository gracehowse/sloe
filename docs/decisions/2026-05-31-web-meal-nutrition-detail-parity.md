# Web per-meal nutrition-detail surface (web↔mobile parity gap #15)

- **Date:** 2026-05-31
- **Area:** Today tab / nutrition detail (web)
- **Status:** Resolved (shipped behind a default-OFF flag)
- **Parity gap:** P5 parity audit gap **#15** — `docs/planning/2026-05-31-p5-parity-audit-worklist.md`

## Problem

Mobile has a per-meal nutrition-detail **screen**
(`apps/mobile/app/meal-nutrition.tsx`) reachable from a Today meal row: total
kcal, the macro calorie-split bar with "% of kcal" per macro, the
macro-split confidence (incomplete-data) state, and a "Vitamins, minerals &
more" micronutrient table. Web had **no equivalent** — the Today meal row's
kebab exposed only Copy / Share / Delete, and the only "all nutrients" surface
on web (`full-nutrient-panel-sheet.tsx`) is **day-level**, not per-meal. A user
on web could not open a single meal's full nutrition breakdown.

## What shipped

A new web **Dialog**, `src/app/components/suppr/meal-nutrition-dialog.tsx`,
mirroring the mobile single-meal mode:

- meal title header + meta line (slot · time · source) + optional portion line
  (shown only when the portion multiplier ≠ 1, mobile parity)
- total kcal headline
- macro calorie-split bar + per-macro grams / kcal / "% of kcal", gated on the
  shared `macroSplitConfidence` policy: `complete` draws the bar + %,
  `single_macro` shows the incomplete-data explainer (grams only, no misleading
  %), `empty` draws a neutral bar
- a "Vitamins, minerals & more" micronutrient table (fibre injected as the first
  row), with the same source-attributed empty / populated copy as mobile

Opened from a **"View nutrition"** item in each Today meal row's kebab
(`DropdownMenu`), hosted by `NutritionTracker.tsx` (the composition root), which
resolves the full `LoggedMeal` (with `micros`) from `mealsForSelectedDate` by id
and feeds it to the dialog.

## Decisions

### Dialog, not a route

Web is a single-page app — the live Today surface is `NutritionTracker`,
mounted once. A new App Router route would be wrong on two counts: it breaks the
SPA model, and it would force a Supabase refetch. Mobile fetches by id **only
because** its screen is a deep-linkable route. On web the meal object is already
in memory (`mealsForSelectedDate`), so the dialog computes the breakdown from
the passed-in meal — **no Supabase fetch**. This matches the existing web modal
pattern (`MacroDetailPanel.tsx`, `full-nutrient-panel-sheet.tsx`).

### `macroCalorieSplit` extracted to shared (not mirrored)

The mobile screen's largest-remainder (Hamilton) rounding — so the three
displayed percentages always sum to exactly 100 (audit M01, 2026-05-05) — was a
private helper inside `meal-nutrition.tsx`, with a mobile test re-implementing it
to pin the shape. It is now extracted to
`src/lib/nutrition/macroCalorieSplit.ts` and imported by **both** platforms
(web via `@/lib/nutrition/macroCalorieSplit`; mobile via
`@suppr/shared/nutrition/macroCalorieSplit`, which the mobile tsconfig aliases to
`../../src/lib/*`). One source of truth ⇒ the rounding can never drift between
web and mobile. The mobile test now imports the shared impl directly instead of
re-implementing it (resolving the test's own "until it's extracted to a shared
lib" note). `macroSplitConfidence`, `macroSplitIncompleteCopy`, and the micro
display helpers (`listMicroNutrientsCompleteDisplay`, `mealContributedFiberG`)
were **already** shared modules under `src/lib/nutrition/` — reused as-is.

### Feature flag: `web_meal_nutrition_detail` (default OFF)

The audit worklist listed gap #15 as `flag: none`, but per the CLAUDE.md
feature-flag non-negotiable a new **structural** surface ships behind a flag with
the old path alive in the `else`. The entire affordance + dialog mount behind
`isFeatureEnabled("web_meal_nutrition_detail")` in `NutritionTracker.tsx`. Flag
OFF is the current behaviour byte-for-byte: the `onOpenMealNutrition` prop is
`undefined`, so no "View nutrition" kebab item renders and the dialog does not
mount; the meal row is unchanged. The flag defaults OFF (PostHog returns `false`
for an unknown/unloaded flag), which equals today's behaviour since this is
additive. Grace creates + ramps the flag in PostHog when ready.

### Read-only on web (Edit deferred — intentional, not a gap)

The mobile screen has a header-right "Edit" action that routes back to Today's
edit-meal flow. Web has no per-meal edit modal to route to, so the dialog is
**read-only** (the `onEdit` prop is supported but intentionally not wired by the
host). This is a documented platform-native deviation, not a parity gap; wiring
web meal-edit is separate, larger work.

## Files

- `src/lib/nutrition/macroCalorieSplit.ts` (new, shared) — Hamilton-rounded macro kcal split
- `src/app/components/suppr/meal-nutrition-dialog.tsx` (new) — the web dialog
- `src/app/components/suppr/today-meals-section.tsx` — `onOpenMealNutrition` prop + "View nutrition" kebab item (flag-gated via prop presence)
- `src/app/components/NutritionTracker.tsx` — host state + flag-gated prop wiring + dialog mount
- `apps/mobile/app/meal-nutrition.tsx` — now imports shared `macroCalorieSplit` (inline copy removed)
- `apps/mobile/tests/unit/macroCalorieSplitLargestRemainder.test.ts` — repointed at the shared impl
- `tests/unit/mealNutritionDialogWeb.test.tsx` (new) — web dialog + wiring coverage

## Tests

- web: render with data (title / kcal / P-C-F % / micro rows), low-data confidence
  state, empty micros state, the sum-to-100 Hamilton guarantee, and flag-OFF vs
  flag-ON kebab wiring
- mobile/shared: the largest-remainder edge cases now pin the single shared impl
