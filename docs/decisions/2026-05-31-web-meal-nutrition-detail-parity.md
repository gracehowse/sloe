# Web per-meal nutrition-detail surface (web↔mobile parity gap #15)

- **Date:** 2026-05-31 (per-meal); **updated 2026-06-19** (slot-aggregate, ENG-837); **updated 2026-07-22** (flag collapsed, ENG-1651)
- **Area:** Today tab / nutrition detail (web)
- **Status:** Resolved (shipped behind a default-OFF flag, ramped default-ON 2026-06-22). **Slot-aggregate parity closed 2026-06-19 (ENG-837)** — web reached full mobile parity (per-meal AND per-slot) behind the same `web_meal_nutrition_detail` flag. **Flag collapsed entirely 2026-07-22 (ENG-1651)** — it had been permanently ON via `REDESIGN_DEFAULT_ON` with no live PostHog kill switch, so `NutritionTracker.tsx` now mounts both dialogs and wires both opener props unconditionally. The flag no longer exists anywhere in the codebase.
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

## Slot-aggregate parity (2026-06-19, ENG-837)

The mobile screen `apps/mobile/app/meal-nutrition.tsx` has TWO modes: single-meal
(`?id=`) and **slot-aggregate** (`?slot=&date=`), which sums every logged item in
a slot (e.g. all "Breakfast" entries) into one combined breakdown. The 2026-05-31
web work shipped the single-meal mode only. ENG-837 closes the slot-aggregate half.

### What shipped (slot-aggregate)

- A quiet **"View slot nutrition"** affordance on each **populated** web slot
  header (`today-meals-section.tsx`) — a tertiary ghost icon-button (pie-chart
  glyph + "Slot nutrition" label), NOT a filled CTA (one-filled-CTA rule). It
  `stopPropagation`s so it opens the aggregate instead of toggling slot collapse,
  and renders on populated slots only (an empty slot has nothing to aggregate).
- A new **aggregate mode** on the existing `MealNutritionDialog` via an optional
  `slotAggregate?: { slotLabel; meals }` prop. When set, the dialog sums the
  slot's meals and renders the slot label as the title + the combined breakdown
  (kcal headline, "Combined macros across N items" caption, macro split bar,
  micro table attributed to "your logged items in this slot"). The per-meal
  branch (`meal` prop) is untouched.
- Host wiring in `NutritionTracker.tsx`: a `slotNutritionTarget` slot-name state,
  the `onOpenSlotNutrition` prop, and a second `MealNutritionDialog` mount in
  aggregate mode that resolves the slot's meals from `mealsGrouped` (keyed by the
  same `normalizeJournalSlotName` the section uses).

### Same shared summing helpers as mobile (numbers match by construction)

The aggregate reuses the **exact** helpers mobile's slot total uses — no re-invented
macro/micro math:

- **Micros:** `sumMicrosFromLoggedMeals(items)` then `delete mergedMicros.fiberG`
  (fibre is drawn from the summed `fiberG` column once, not double-counted —
  identical to mobile's delete).
- **Fibre:** `sumDayFiberFromMeals(items)`.
- **Macros:** kcal `Math.round(reduce(+calories))`; P/C/F raw `reduce` (the shared
  `macroCalorieSplit` rounds them) — the same inline reduce mobile uses.

Both helpers live in `src/lib/nutrition/microNutrientDisplay.ts`. Mobile imports
them via `@suppr/shared/nutrition/microNutrientDisplay` (the mobile tsconfig
aliases that to this same file) and re-exports them through
`apps/mobile/lib/healthDietaryNutrients.ts`. One source of truth ⇒ the web slot
sum and the mobile slot sum can never drift.

### Same flag, flag-OFF unchanged

The slot affordance + aggregate dialog mount are gated behind the SAME
`isFeatureEnabled("web_meal_nutrition_detail")` flag as the per-meal dialog. Flag
OFF → `onOpenSlotNutrition` is `undefined` (no header affordance) and the
aggregate dialog does not mount → byte-identical to today. The per-meal mode is
unchanged either way.

### Edit hidden on the aggregate (intentional)

The aggregate has no single entry to route an edit to, so the dialog never renders
the Edit affordance in slot mode — mirroring mobile, which also hides Edit on its
aggregate. Not a parity gap.

## Files

- `src/lib/nutrition/macroCalorieSplit.ts` (new, shared) — Hamilton-rounded macro kcal split
- `src/app/components/suppr/meal-nutrition-dialog.tsx` (new 2026-05-31; **+slot-aggregate mode 2026-06-19**) — the web dialog
- `src/app/components/suppr/today-meals-section.tsx` — `onOpenMealNutrition` prop + "View nutrition" kebab item; **`onOpenSlotNutrition` prop + "View slot nutrition" header affordance (ENG-837)** (both flag-gated via prop presence)
- `src/app/components/NutritionTracker.tsx` — host state + flag-gated prop wiring + dialog mount (per-meal **and slot-aggregate**)
- `apps/mobile/app/meal-nutrition.tsx` — now imports shared `macroCalorieSplit` (inline copy removed); the slot-aggregate source web now mirrors
- `apps/mobile/tests/unit/macroCalorieSplitLargestRemainder.test.ts` — repointed at the shared impl
- `tests/unit/mealNutritionDialogWeb.test.tsx` (new 2026-05-31; **+slot-aggregate + affordance + flag-gate coverage 2026-06-19**) — web dialog + wiring coverage

## Tests

- web (per-meal): render with data (title / kcal / P-C-F % / micro rows), low-data
  confidence state, empty micros state, the sum-to-100 Hamilton guarantee, and
  flag-OFF vs flag-ON kebab wiring
- web (slot-aggregate, ENG-837): the dialog sums kcal (700) / protein (45g) /
  carbs (67g) / fat (18g) / fibre (6g) / sugar (11g) / sodium (350mg) / iron (1mg)
  for a hand-computed 3-meal fixture; the slot label renders as the title; the
  combined-macros caption + sum-to-100 split; the slot-empty state; Edit hidden;
  single-meal mode unchanged; the header affordance flag-gated (present on
  populated slots only, calls handler with slot name, stopPropagation); plus a
  source-check that the host gates both the affordance prop and the aggregate
  dialog mount behind `web_meal_nutrition_detail`
- mobile/shared: the largest-remainder edge cases now pin the single shared impl

## Flag collapse (2026-07-22, ENG-1651)

`web_meal_nutrition_detail` was added to `REDESIGN_DEFAULT_ON` 2026-06-22 (the
sloe-v3 flag-collapse sweep) and held permanently ON with no live PostHog kill
switch for a full month. Per the feature-flag policy's collapse step, the four
`isFeatureEnabled("web_meal_nutrition_detail")` call sites in
`NutritionTracker.tsx` were removed and the ON branch now ships
unconditionally: `onOpenMealNutrition` / `onOpenSlotNutrition` are always
passed to `TodayMealsSection`, and both `MealNutritionDialog` mounts (per-meal
and slot-aggregate) render unconditionally. `TodayMealsSection`'s own
`onOpenMealNutrition?` / `onOpenSlotNutrition?` props stay optional (the
component's own contract), but the host wires them every time now — the
"flag-OFF vs flag-ON kebab wiring" and "gates both the affordance prop and the
aggregate dialog mount behind `web_meal_nutrition_detail`" test coverage
listed above was updated accordingly in
`tests/unit/mealNutritionDialogWeb.test.tsx`: the source-check now pins the
flag's ABSENCE + the unconditional shape. `web_meal_nutrition_detail` no
longer exists in `REDESIGN_DEFAULT_ON`, `tests/e2e/redesign-flag-registry.json`,
or `tests/unit/redesignDefaultOnParity.test.ts`'s `WEB_ONLY` set. Web and
mobile are now symmetric: unconditional on both platforms.
