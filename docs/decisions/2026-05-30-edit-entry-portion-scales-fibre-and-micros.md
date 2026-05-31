# Editing a logged entry's portion must scale fibre + micros, not just kcal/P/C/F

**Date:** 2026-05-30
**Status:** Resolved (mobile fixed; web parity is forward-looking — see "Parity")
**Area:** Today / Logging / Nutrition correctness
**Flag:** none — nutrition-correctness fix ships un-gated (CLAUDE.md nutrition rules)
**Issue:** [ENG-784](https://linear.app/suppr/issue/ENG-784)
**Related:** [`2026-05-30-edit-entry-v2-and-saved-meal-portion.md`](2026-05-30-edit-entry-v2-and-saved-meal-portion.md) (ENG-783), [`2026-05-13-portion-picker-and-macro-display.md`](2026-05-13-portion-picker-and-macro-display.md), ENG-785 (web subtotal double-count)

## The bug

Grace, editing the Dinner entries on mobile (verbatim): *"fibre didnt
change even though i went in and changed the portion to 0.5 for every
ingredient and cals protein etc halved appropriately."*

Opening a logged entry and changing its portion to 0.5× correctly halved
kcal / protein / carbs / fat, but **fibre and every micro** (sugar,
sodium, vitamins…) rode through unchanged — so a Dinner whose macros all
halved still reported its original fibre (e.g. stuck at 10.5 g).

## Root cause

The mobile edit sheet (`app/(tabs)/index.tsx`) only exposes four macro
fields. As the portion stepper moves, `applyEditPortionMultiplier`
recomputes those four from a per-1-portion canonical (`editCanonicalRef`)
— but there is **no fibre/micros field**, so on save the original values
passed straight through the `...editingMeal` spread untouched. The four
macros scaled; fibre/micros did not.

This is the same family as the F-70 "baked storage" rule
(`portionMultiplier.ts`): stored `calories/protein/carbs/fat/fiberG/
micros` are already display-ready (baked at the entry's portion);
`portionMultiplier` is a label, never re-applied at display. So when the
portion changes, the baked fibre/micros must be re-baked by the **same
ratio** the four macros move — `newPortion / oldPortion`.

## The fix

New shared pure helper
[`src/lib/nutrition/scaleLoggedMealPortion.ts`](../../src/lib/nutrition/scaleLoggedMealPortion.ts):

```ts
scaleLoggedMealFiberAndMicros({ fiberG, micros, ratio })
  // ratio = newPortion / oldPortion
  // → { fiberG?, micros? }, or {} when ratio is 1 / non-finite / ≤ 0
```

- Scales `fiberG` by `ratio` (1 dp), and the whole micros map via the
  existing `scaleMicrosPerServing` (grams 1 dp, mg 0 dp, drops
  zero/sub-rounding micros — never invents a phantom trace).
- `ratio === 1` (or non-finite / ≤ 0) returns `{}` so a title- or
  slot-only edit leaves the caller's `...meal` spread authoritative and
  never re-rounds fibre.

Mobile `saveEditMeal` spreads it after the four macros, with
`ratio = portionMul / p0` where `p0` is the portion the entry was opened
at. This is **the same ratio** the four macros use — `editKcal` at save
is `canonical.cal × portionMul = (meal.calories / p0) × portionMul` — so
fibre/micros and the macros can never diverge.

`persistMealUpdateImmediate` already writes `fiber_g` + `nutrition_micros`,
so the scaled values sync to Supabase with no further change.

## Why a shared helper (not inline)

The mobile edit path and the forthcoming web edit dialog (ENG-783 web
parity) must scale fibre/micros identically or they drift — exactly the
failure mode the shared `buildMealEntriesFromSavedMeal` builder prevents
for saved meals. One pure unit, one set of rounding rules, called from
both platforms.

## Sibling surfaces checked (root-cause the class, not the instance)

- **`buildMealEntriesFromSavedMeal`** (saved-meal log path) — already
  scales `fiberG` by the effective portion (`savedMealsLogic.ts:219`).
  `SavedMealItem` carries no micros map, so micros are N/A there. No fix
  needed.
- **Web post-log edit** — `useNutritionJournalState` exposes no
  `updateLoggedMeal`; web has no edit-portion flow yet, so there is no
  identical live bug to fix. The requirement is forward-looking (below).
- **Web slot subtotals** (`today-meals-section.tsx:301,344`) apply
  `scaledMacro(m.calories, pm)` at display against already-baked storage
  → double-counts when `pm ≠ 1`. Separate display-only bug, same F-70
  family; **ticketed (ENG-785), not fixed here** to keep this P0 scoped.

## Tests

[`tests/unit/scaleLoggedMealPortion.test.ts`](../../tests/unit/scaleLoggedMealPortion.test.ts)
— 9 cases: the reported 0.5× scenario (fibre 10.5 → 5.3, micros halved),
2×, compounding 0.25×, a `fiberG` key nested in the micros map, the
gram-1dp / mg-0dp convention, `ratio === 1` no-op, invalid-ratio no-ops
(0 / negative / NaN / Infinity), absent-field omission, and zero-scaling
micro drop. Green via `vitest.unit.config.ts`.

## Parity

The future web edit dialog (ENG-783 web parity) **must** call
`scaleLoggedMealFiberAndMicros` with `ratio = newPortion / oldPortion`
when its portion control changes — same helper, same ratio. This is the
single guard that keeps the two platforms from drifting once web gains an
edit flow. Tracked on the ENG-783 web-parity issue; folded into its
acceptance checks.
