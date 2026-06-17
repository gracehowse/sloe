# Today's Meals — legacy per-slot layout restored as the default (ENG-1091)

**Date:** 2026-06-13
**Area:** Today tab / meals (web + mobile)
**Status:** Resolved. The dead Figma summary layout + its `today_meals_figma_layout` flag were deleted on 2026-06-17 (ENG-1096 — see "Cleanup" below); the legacy per-slot list is now the sole layout. Web empty-state parity landed via ENG-1095 (`today_meals_all_slots_v1`).
**Flag:** ~~new `today_meals_figma_layout` (NOT in `REDESIGN_DEFAULT_ON` → defaults **off** → legacy per-slot list)~~ removed 2026-06-17 (ENG-1096); the flag no longer exists and the legacy per-slot list renders unconditionally.

## Context

Grace (2026-06-13): "for meals we need to go back to how it used to look before the
redesign — we obviously use the new palette and fonts etc but the old design of
how it looked and functioned." Confirmed against the rendered flag-off capture:
"yes this is what i wanted."

The old design was never deleted — it was the flag-off branch of
`today_meals_figma_654`. **But that flag was overloaded:** it also gates the North
Star ("What to eat next" → `NorthStarFigmaHero`) and the Weekly Insight card.
Flipping the whole flag off would have reverted those too — which Grace did **not**
ask for.

## Decision

**Split the flag.** The meals-layout switch now reads its own
`today_meals_figma_layout`; `today_meals_figma_654` keeps gating North Star +
Weekly Insight (unchanged). `today_meals_figma_layout` is deliberately left OUT of
`REDESIGN_DEFAULT_ON`, so it resolves off → the **legacy per-slot meal list**
(Breakfast / Lunch / Dinner / Snacks rows with slot icons, "Log usual" pills,
swipe-delete, save-as-usual). It's already on the Sloe palette/fonts — exactly the
"old layout + new palette" ask.

- Mobile `apps/mobile/components/today/TodayMealsSection.tsx`
- Web `src/app/components/suppr/today-meals-section.tsx`

## Verified

- Mobile: legacy per-slot rows render on empty Today (matches Grace's confirmed
  capture). ✓
- Web: the Figma summary cards are gone (flag off); the meals section renders the
  legacy path. Meals + North-Star + Weekly-Insight test suites green on both
  platforms (web 52 / mobile 51). Both typechecks clean.

## Follow-up — web empty-state parity (not yet aligned)

On an **empty** day the web legacy path renders a "No meals logged → Log a meal"
empty state, whereas mobile renders the four per-slot rows. This is a pre-existing
web↔mobile legacy divergence the flag flip exposes. Flagged to Grace; align the
web empty meals to the per-slot rows (or confirm the simpler web empty is
intentional) in a follow-up. The Figma summary-card layout (now dead behind the
off flag) should also be removed in a cleanup once the revert is settled.

## Cleanup — ENG-1096 (2026-06-17): dead Figma summary layout removed

The revert settled; the off-by-default Figma summary layout had no live consumer
and was removed in full (no behaviour change to the live per-slot meals path):

- Deleted `src/app/components/suppr/today-meals-figma-layout.tsx` and
  `apps/mobile/components/today/TodayMealsFigmaLayout.tsx`.
- Removed the `mealsFigmaLayout = isFeatureEnabled("today_meals_figma_layout")`
  read and the figma branch from both `today-meals-section.tsx` (web) and
  `TodayMealsSection.tsx` (mobile); the legacy per-slot list now renders
  unconditionally. Dropped the now-unused `figmaSlotSummaryTitle` /
  `TodayMealsFigmaLayout` imports (the `figmaSlotSummaryTitle` copy helper in
  `src/lib/copy/today.ts` is retained — it has its own tests and is independent).
- The web empty-state condition simplified from
  `!mealsFigmaLayout && !allSlotsOn && …` to `!allSlotsOn && …`.
- Figma-only tests deleted; the per-slot swipe-delete test re-pointed to the live
  layout; a source-pin in `tests/unit/todayMealsSectionTd4.test.tsx` now locks the
  deletion (flag gone, component imports gone, component files gone).