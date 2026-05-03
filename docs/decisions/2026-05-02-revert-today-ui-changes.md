# Today UI revert — segmented chip + 4-tile micros widget

**Date:** 2026-05-02
**Status:** Resolved
**Area:** Mobile + web Today screen
**Owner:** Grace

## Decision

Revert two recently-shipped Today changes in response to user feedback:

1. **Mobile segmented Remaining/Consumed chip control (PR #50).** The
   chip stack under the calorie ring is removed. The long-press on the
   ring is restored as the **single** mode-switch gesture on mobile
   and now toggles **both** the display mode (Remaining ⇆ Consumed)
   **and** the visibility of the inner protein/carbs/fat sub-rings
   in lock-step.
2. **Today 4-tile micronutrient widget (PR #30).** The 4 tiles
   (fibre / iron / vitamin D / sodium) below the macro tiles are
   removed from Today's canvas on both mobile and mobile-web.

PR #58 (revert of PR #52, ring central-number size) is left intact —
the ring number stays at the post-#58 size and is not changed by
this PR.

PR #47 (the full nutrient panel sheet) is **kept**. The panel-open
trigger is rewired to the existing "Nutrients" link in
`TodayDashboardMacroTiles` on mobile (replacing the legacy
`TodayNutrientsModal`) and to a new "View all N nutrients" pill at
the bottom of the inline nutrient rows on web. The Cronometer-grade
breadth still ships for the power-user persona; it's just one tap
away from the macro tiles instead of permanently parked on Today.

## Why

User feedback (verbatim, 2026-05-02):

- "the remaining and consumed is bad too — the click and hold to
  switch between views was better showing and hiding macro rings"
- "fibre is now duplicated"
- "I don't think we need the micronutrients section [on Today] —
  this should be shown in the full nutrients detail section"

Read against the code:

- **Chip control was redundant.** The long-press already toggled the
  central number; PR #50 added a second affordance for the same
  state change. The user finds the chips visually cluttering and
  prefers the gesture-only path. Removing the chips also reclaims
  vertical space around the ring.
- **Micros widget duplicated fibre.** `TodayDashboardMacroTiles`
  renders a Fibre tile when fibre is one of the user's tracked
  macros (default for the macro-tracker persona). The 4-tile widget
  added a second Fibre surface immediately below. The widget also
  pushed Today's macro density past the threshold the user is
  comfortable with — the customer-lens audit's "Cronometer-power-
  user persona gap" was not the same gap as the dashboard-density
  bar, and the wrong fix landed.
- **Micros depth still belongs in the panel.** Closing the
  Cronometer gap is still wanted, but inside the dedicated
  full-nutrient panel (PR #47), not on the Today canvas. One tap
  from the macro tiles to a sheet that lists all 34 entries with
  %DV bars is the correct depth for that persona without
  cluttering the macro-tracker primary surface.

## Implementation

- `apps/mobile/components/today/TodayHeroRing.tsx` — chip render
  block deleted; `onSetDisplayMode` prop dropped.
- `apps/mobile/app/(tabs)/index.tsx` — long-press handler now
  toggles both `calorieDisplayMode` and `ringExpanded`.
  `TodayMicrosWidget` import + render block dropped.
  `TodayNutrientsModal` swapped for `FullNutrientPanelSheet` (the
  PR #47 sheet) so the existing "Nutrients" link in
  `TodayDashboardMacroTiles` opens the richer panel.
- `src/app/components/NutritionTracker.tsx` — `TodayMicrosWidget`
  removed; `FullNutrientPanelSheet` rendered at the host;
  `TodayDashboardMacroTiles` now receives an
  `onPressViewAllNutrients` callback that toggles its visibility.
- `src/app/components/suppr/today-dashboard-macro-tiles.tsx` — new
  `onPressViewAllNutrients` + `viewAllNutrientsCount` props render a
  "View all N nutrients" pill below the inline nutrient rows.
- `src/app/components/suppr/today-hero-ring.tsx` — segmented chip
  block removed for mobile-web parity with mobile.
- `src/app/components/suppr/today-hero-stats.tsx` — desktop chip
  control intentionally **kept**. Desktop is mouse-driven and has no
  long-press equivalent for the ring; removing the chip would leave
  desktop users with no mode-switch affordance at all. Documented
  inline as a deliberate web-vs-mobile divergence.

Component files removed:

- `apps/mobile/components/today/TodayMicrosWidget.tsx`
- `src/app/components/suppr/today-micros-widget.tsx`

Test files removed (covered the now-deleted widgets):

- `apps/mobile/tests/unit/todayMicrosWidget.test.tsx`
- `tests/unit/todayMicrosWidgetWeb.test.tsx`
- `apps/mobile/tests/unit/todayHeroRingDisplayMode.test.tsx`

`src/lib/nutrition/dailyValues.ts`, `fullNutrientPanel.ts`, and the
`FullNutrientPanelSheet` component pair (mobile + web) all stay —
they came from PR #47 and remain the canonical depth surface.

## Web vs mobile

| Surface              | Mobile / mobile-web               | Desktop (`>= md`)                  |
| -------------------- | --------------------------------- | ---------------------------------- |
| Mode-switch gesture  | Long-press on ring (toggles both display mode + sub-rings) | Floating chip top-right of hero card |
| Mode-switch chips    | **Removed**                       | Kept (no long-press equivalent)    |
| 4-tile micros widget | **Removed**                       | **Removed**                        |
| Full-nutrient panel  | "Nutrients" link in macro tiles   | "View all 34 nutrients" pill below inline nutrient rows |

The desktop chip is the deliberate exception. It is documented
inline in `today-hero-stats.tsx` so future sweeps don't re-flag it
as drift.

## Validation

- Today canvas no longer renders the segmented chip control on
  mobile or mobile-web.
- Long-press on the ring on mobile toggles both the central
  number's display mode and the inner sub-rings' visibility.
- The 4-tile micronutrient widget is gone on both platforms.
- Fibre renders **once** on Today (in the macro tiles).
- "View all nutrients" is reachable in one tap on both platforms
  and opens the rich Cronometer-parity sheet from PR #47.

## Related

- PR #58 (already shipped): reverts ring central-number size from
  PR #52. Not touched by this change.
- PR #47: full-nutrient panel sheet. Kept; rewired to the legacy
  Nutrients link entry point.
- PR #31: "Why this number?" pill under the ring. Untouched.
