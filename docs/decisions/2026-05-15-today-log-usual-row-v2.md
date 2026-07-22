# Today section header — relocate `Log usual: <name>` chip

**Date:** 2026-05-15
**Area:** Today screen / meal logging
**Status:** Resolved — flag collapsed permanently ON 2026-07-22 (ENG-1651,
see "Update" below). Originally shipped behind PostHog flag
`today_log_usual_row_v2`.

## Symptom

TestFlight session captured 2026-05-15 on the mobile Today screen showed the
Snacks section header rendering as:

```
[cookie] S 2 ^ + [Log usual: Peanut B…] 122 kcal
```

— the slot title (`Snacks`) collapsed to a single character "S", the item
count digit ("2") overlapped the collapse chevron, and the trailing chip
crowded the entire row. Two food rows inside the same screen
("PB2 · Original Powdered Peanut Butter (2 tbsp)" and the Waitrose Greek
yogurt) showed the kcal value sitting on top of the food name text rather
than to the right of a truncated name.

## Root cause (header)

`apps/mobile/components/today/TodayMealsSection.tsx` rendered the section
header as a single flex row containing:

- slot icon (32 wide)
- title column (`flex: 1`, `minWidth: 0`)
- collapse chevron (~26 wide, when `onPressSlotSummary` is set)
- `+` add pill (26 wide)
- `Log usual: <name>` chip (`maxWidth: 160`, `flexShrink: 1`)
- kcal number + "kcal" label

The trailing cluster carried `flexShrink: 0`, so its child chip's
`flexShrink: 1` only triggered when the cluster itself was asked to
shrink — which it never was. With a long saved-meal name on a 390pt-wide
phone the trailing cluster's natural width consumed ~256pt of the
available ~352pt content row, leaving ~70pt for the title column — barely
enough for the slot icon + gap, and ~28pt for text.

## Root cause (food rows)

The same component's food-row layout placed the food name `Text` (with
`numberOfLines: 1`) inside a row container that itself had no
`flex`/`flexShrink` constraint. React Native row children default to
`flexShrink: 0`, so the `Text` kept its full intrinsic width and ran
underneath the right-column kcal value rather than ellipsising. The
fix is purely restoring intended layout — a one-line style addition,
no flag.

## Resolution

Two changes, shipped together:

1. **Food-row truncation (unflagged bug fix).** Add `flexShrink: 1` +
   `minWidth: 0` to the food-name `Text` so `numberOfLines: 1` actually
   ellipsises against the right-column kcal value. Restores intent.
2. **`Log usual` chip relocation (flag-gated structural change).** New
   PostHog flag `today_log_usual_row_v2`. When ON, the chip moves out of
   the section-header trailing cluster into a dedicated row directly
   below the header, left-aligned at the same indent as food rows. When
   OFF, the prior in-header chip renders verbatim — no visual regression
   risk during ramp.

The dedicated row renders regardless of slot collapse state, so the
single-tap re-log affordance stays reachable from a collapsed slot too.

Mirrored on web (`src/app/components/suppr/today-meals-section.tsx`)
using the same flag so mobile-web (the surface where the bug surfaces
on landscape phones) gets the same treatment.

## Why a flag

`CLAUDE.md > Feature flags — non-negotiable`: visual / structural
changes ship behind a feature flag with the old path preserved in the
`else` branch. The chip relocation changes the layout of every meal
section on Today — that's a structural change. The truncation fix has
no visible-when-it-shouldn't-be surface (it only changes behaviour when
the text was already overflowing), so it ships unflagged as a defect
fix.

## Rollout

- 0% → 10% → 50% → 100% over the next two weeks (PostHog dashboard).
- Once flag has held 100% for two weeks with no regression, remove the
  `else` branch and the flag in a follow-up cleanup PR.
- Watch for: any TF feedback about not finding the `Log usual` action
  on collapsed slots (we expect the new placement to remain discoverable
  since it sits one row below the section header).

## Tests

`apps/mobile/tests/unit/todayLogUsualRowV2.test.tsx` covers:

- Flag OFF (default): chip renders inside the section header — existing
  behaviour preserved.
- Flag ON: chip renders in a dedicated row below the header, NOT in the
  header trailing cluster.
- Flag ON: tapping the chip with one saved meal calls `onLogSavedMeal`
  with the right (meal, slot) pair.

The existing `mealSlotAddMore.test.tsx` continues to pass unchanged —
its fixture has `savedMeals: []` and the test shim defaults
`isFeatureEnabled` to `false`, so neither chip path is taken.

## Files touched

- `apps/mobile/components/today/TodayMealsSection.tsx`
- `src/app/components/suppr/today-meals-section.tsx`
- `apps/mobile/tests/unit/todayLogUsualRowV2.test.tsx` (new)
- `docs/decisions/2026-05-15-today-log-usual-row-v2.md` (this file)

## Update — 2026-07-22 (ENG-1651, flag-collapse sweep round 2)

The flag held at 100% far longer than the planned two-week ramp (confirmed
default-on with no `isFeatureDisabled` kill-switch dependency) and a
2026-07-22 stale-flag audit flagged it for collapse per this doc's own
"Rollout" section above. Collapsed to the ON branch permanently on both
platforms:

- The dedicated-row layout (chip below the section header) is now the only
  code path; the legacy in-header chip `else` branch was deleted.
- `const usualRowV2 = isFeatureEnabled("today_log_usual_row_v2")` and the
  flag string were removed from both call sites, `REDESIGN_DEFAULT_ON`
  (both platforms), the `GATE_15_SHARED` list in
  `tests/unit/redesignDefaultOnParity.test.ts`, the mobile dev
  flag-override picker, and `tests/e2e/redesign-flag-registry.json`.
- `apps/mobile/tests/unit/todayLogUsualRowV2.test.tsx` and
  `tests/unit/todayMealsSectionLogUsualRowV2.test.tsx` were updated to
  drop the flag-OFF matrix (that code path no longer exists) and keep
  coverage of the dedicated row's rendering, tap handling, and
  collapsed-slot reachability.
- The PostHog flag row itself (id 678945) was already archived in the
  2026-07-22 stale-flag audit that fed this ticket.
