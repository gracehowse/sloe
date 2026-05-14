# Activity bonus formula — adopt Lose It!'s projected-EOD model

**Date:** 2026-05-13
**Status:** Resolved
**Area:** Nutrition / Today / Burn detail
**Supersedes:** the prorated-maintenance branch of `dayActivityBudgetAddon` documented in `docs/decisions/2026-05-05-debug-audit-decisions.md` §1 (which spoke about deficit, not bonus, but established the canonical helper).

## Decision

The Activity Bonus shown on Today, on the Burn detail screen, and added to
the food budget is now:

```
bonus = max(0, projected EOD burn − full-day maintenance)
```

For **today**, projected EOD burn = `restingBurn + activeBurn + (hourlyResting × hoursLeft)`
where `hourlyResting = restingBurn / hoursElapsed`. For **closed days**, projected
collapses to actual burn so the formula reads `max(0, actualBurn − maintenance)`.

The previous prorated-maintenance "bonus so far" path is removed.

## Why

The prior model compared partial-day burn to a prorated share of maintenance.
That number was honest as a snapshot ("you're ahead of pace right now") but
silently set up overeating: at 19:49 a user might see +262 bonus added to
their food budget, eat it, then end the day with only +213 actually earned —
~50 kcal of phantom budget.

Maintenance is a 24-hour average. Bonus only meaningfully exists when the
day's *total* burn exceeds that average. "Ahead of pace at this moment" does
not translate to "permission to eat extra today" unless the pace holds.

Lose It! — a multi-year-tested industry comparable — uses exactly the
projected-EOD model. Their UI structure (Active / Resting / Future →
Projected / Target / Bonus) makes the math visibly add up; the reader can
do the subtraction.

## What changed

**Mobile**

1. `apps/mobile/app/(tabs)/index.tsx` — `dayActivityBudgetAddon`: today
   path now computes projected EOD burn vs full maintenance.
2. `apps/mobile/app/burn-detail.tsx` — `totals` useMemo: today bonus is
   `projected − maintenance`. Card simplified to three rows
   (`Projected burn / Maintenance / Bonus earned`), no separate "so far"
   row.
3. `apps/mobile/components/today/TodayActivityBonusCard.tsx` — inline chip
   under the burn row reads `+N bonus earned` for both today and past.

**Web (parity sweep)**

4. `src/app/components/NutritionTracker.tsx` —
   `dayActivityBudgetAddonWeb` helper now mirrors mobile: today uses
   projected-EOD vs full maintenance, closed days unchanged.
5. `src/app/components/NutritionTracker.tsx` — `activityAdjustment`
   (value added to `effectiveCalorieTarget`) now uses projected-EOD math
   for today, actual for past days. Same number as the helper.
6. `src/app/components/BurnDetailPanel.tsx` — already uses projected-EOD
   math; explainer copy is factually correct. (Currently dead code —
   not imported anywhere — but left in place.)
7. Popover copy unchanged: `Bonus = burn above maintenance.` (still true,
   no longer misleading since "burn" universally means projected/total).

## Consequences

- The Today bonus value can **decrease through the evening** if a user logs
  no further activity, because future-resting (the dominant driver of
  projection) shortens as `hoursLeft` shrinks. This is honest: the bonus
  the user can safely eat reflects what they'll actually burn.
- Number Grace saw at 19:49 changes: +262 → +213 (the value that's been
  legitimately earned by EOD assuming rest of day is resting only).
- For closed days nothing changes.
- For early-morning today, projection is dominated by future-resting and
  may show no bonus until activity is logged — same UX as Lose It!.

## How to apply

When future bonus-related work touches the formula, treat
`dayActivityBudgetAddon` as canonical. Don't reintroduce a second
"earned so far" path in any card — the user should never see a bonus
larger than what they're committed to actually earn.

When new burn-detail surfaces are added (web parity expansion, etc.),
mirror the Lose It! row order: per-component breakdown above the divider,
projected/target/bonus subtraction below it. Reader does the math.
