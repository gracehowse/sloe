# Meal-nutrition: move Fiber into micros, drop Water (2026-05-05)

**Status:** Resolved.
**Authority:** Grace 2026-05-05 in-session feedback.
**Owner:** Grace / executor.

## Problem

The per-meal nutrition detail page (`/meal-nutrition?id=...`) had a
small "extras" strip beneath the macro split that surfaced two
fields:

- `Fiber 1g`
- `Water —`

Two issues:

1. **Fiber belongs with the rest of the per-entry breakdown.** The
   "Vitamins, minerals & more" table directly below already lists 34
   curated nutrient rows; placing fiber in its own strip above
   competed with the table for hierarchy and made fiber feel less
   tracked than it actually is.
2. **Water doesn't belong on this page at all.** Water is a daily
   total surface, not a per-meal-entry one — most rows render
   `Water —` because the importer / search source rarely publishes
   ml-per-entry, which trains the user to ignore the row.

## Fix

Two coordinated edits:

1. **`src/lib/nutrition/microNutrientDisplay.ts`** — add `fiberG` as
   the first entry in `MICRO_LINES`. Callers that already pass
   `micros.fiberG` get fiber surfaced automatically; callers that
   don't are unaffected (the row falls through to "—" the same as
   any other curated nutrient that's absent from the source).
2. **`apps/mobile/app/meal-nutrition.tsx`** — inject the resolved
   `fiberDisplay` value (which already reads from the top-level
   `meal.fiberG` column OR `meal.micros.fiberG`, via
   `mealContributedFiberG`) into the micros payload before passing
   to `listMicroNutrientsCompleteDisplay`. Remove the entire
   `extras` row (Fiber + Water lines) and the now-unused style
   definitions.

The micros table count line increments from `9 of 34` to `11 of 35`
on a typical apple_health entry that has fiber.

## Validation

- Sim screenshot at `/tmp/sim-check/after-meal-nutrition-fiber-water.png`
  shows: macro split card ends cleanly at the 3-up macro grid (no
  extras strip), and the table below leads with `Fiber 0.6g`.
- `tsc --noEmit` clean web + mobile.
- Vitest 4598/4602 web (4 unrelated household-scope flakes) and
  1404/1404 mobile pass.

## Cross-platform

`MICRO_LINES` is shared across web tracker, mobile tracker, and
import mapping. Adding `fiberG` is additive — any caller that
already filters or scopes the list (web tracker uses
`listMicroNutrientsForDisplay` for surplus-only) keeps its existing
behaviour because that variant only includes positive, present
nutrients. Web meal detail does not exist — this is a mobile-only
surface. No web change needed.

## Closes

- Grace's 2026-05-05 in-session feedback.
