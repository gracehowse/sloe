# Decision — Plan day summary strip is web-omitted (intentional divergence)

**Date:** 2026-04-28
**Area:** Planner / cross-platform parity
**Status:** Resolved

## Decision

Mobile shows a top-of-screen day summary strip
(`apps/mobile/app/(tabs)/planner.tsx:1815-1849`) when plan length > 1.
Web Planner does **not** ship the equivalent. The web 7-column grid
already serves the same spatial function — every day is visible at
once, and the per-column day-totals row (F2-E, batch 24 `8d7fd2e`)
already shows day-of-week + kcal/goal.

The only signal the strip carries that the grid doesn't is the
**coloured progress bar** per day. That goes into the existing
day-totals row — see the F2 follow-up roadmap row for the
implementation.

## Why

- Mobile stacks days vertically; without a strip, a user reviewing
  day 5 has no peripheral awareness of days 1-4 or 6-7.
- Web's 7-column grid is fundamentally different — peripheral
  awareness is built into the layout. A top-of-page strip on web
  would re-print signal the layout already conveys.
- Per memory `feedback_no_duplicate_today_hero_content.md` (the same
  principle applied to Today): don't double-print signal the layout
  already conveys.

## What's NOT a parity violation

- Mobile keeps the strip. Web doesn't grow one.
- The substantive piece of signal (coloured progress bar) lands on
  web in the existing day-totals row, so web isn't behind on the
  user-meaningful information.

## Update — Sloe day-row macro polish (2026-06-07)

The mobile per-day macro line (the vertical-stacked equivalent of the
web grid's P/C/F delta chips) was re-skinned to the Sloe calm rhythm.
The old inline run `P 0g ⁻¹⁰¹  C 0g ⁻⁶⁸  F 0g ⁻²⁵  Fi 0g ⁻¹⁵` jammed
four coloured letter+value+gap tokens into one wrapping line — it read
as clutter and was hard to scan across a 7-day stack.

It now renders as `apps/mobile/components/plan/PlanDayMacroSummary.tsx`:
four evenly-spread cream cells (one per macro), each with the macro
letter + grams on top (coloured to the macro hue) and a quieter status
caption below — a sage "On track" check inside the ±15% close band, else
a signed amber gap (`+N g` over / `−N g` under, never red). The weekday
label moved to Newsreader serif to match the "Meal plan" header.

This stays an intentional divergence from web: web still renders the
same signal as P/C/F chips inside its 7-column grid (the calm web
treatment already in place). The two layouts differ by platform, not by
information — same per-decision rationale as the strip itself.

## sync-enforcer note

This is an intentional divergence. Sibling carve-outs:
- `project_move_meal_web_gap.md` — Move-meal is mobile-only.
- `project_recipe_go_public_web_only.md` — Go Public is web-only.
- `project_onboarding_welcome_divergence.md` — Onboarding welcome
  copy diverges intentionally.

When sync-enforcer runs, this file is its source of truth for "the
day summary strip is missing on web — don't re-flag".

## Notion mirror

- Roadmap row: "F2 follow-up — Web day progress bar (replaces day
  summary strip)" — state Open, target Next sprint (mirrored
  2026-04-28).

## Implementation note (when the executor batch lands)

In `src/app/components/MealPlanner.tsx`, inside the existing F2-E
day-totals row, add a 3px-tall progress bar:
- Width 100% of the column footer.
- Filled width = `min(1, dayKcal / planTargets.calories) * 100%`.
- Colour from `getProgressColor(dayKcal, planTargets.calories)`
  (shared utility — verify import path matches mobile usage at
  `planner.tsx:1815-1849`).
- `tabular-nums` on any numeric labels nearby.
- Today's column already has the F2-E "today" highlight; don't
  double-highlight.

No standalone strip component on web. No top-of-page row.
