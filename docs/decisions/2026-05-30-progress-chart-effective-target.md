# Progress "Daily Calories" chart colours bars against the *effective* target (base + earned activity bonus)

**Date:** 2026-05-30
**Status:** Resolved (implemented web + mobile + shared tests; **no flag** — correctness fix; held for Grace's sim sign-off)
**Area:** Progress / Daily Calories chart / activity-adjusted budget
**Flag:** none — see "Why no flag" below
**Issue:** [ENG-787](https://linear.app/suppr/issue/ENG-787)
**Related:** [`2026-05-13-activity-bonus-projected-eod-model`](2026-05-13-activity-bonus-projected-eod-model.md) (the bonus helper this reuses), F-2 per-day snapshot targets (in `progressWeekReport.ts`)

## The bug

Grace, on her own Progress tab (verbatim): *"This implies i've been over
every day but hasn't taken into account the fact i earned bonus cals these
days."*

The Daily Calories bar chart colours each bar **amber/over** when the day's
intake exceeds the calorie target — but it compared against the **base**
target only, never adding the activity bonus the day earned. So on days she
ate into a bonus she'd genuinely earned (workouts, high step count, with
`prefer_activity_adjusted_calories` on), the bar still went amber as if she'd
blown the budget.

This is the same budget the **Today** ring already adds via
`dayActivityBudgetAddon` (mobile) / `dayActivityBudgetAddonWeb` (web). So the
two surfaces disagreed: Today said "you're under, you earned room"; Progress
said "over". Progress was simply wrong.

## The decision

Compute, per day, an **`effectiveTargetCalories` = base target + that day's
earned activity bonus**, and colour the chart bar over/under against THAT.
Do it in the shared `buildWeekStats` so web and mobile cannot drift, reusing
the exact `computeActivityBonusKcal` helper Today uses — so the chart now
reconciles bar-for-ring with the Today screen.

### Why no flag

CLAUDE.md gates *visual/structural* changes behind a flag. This is neither —
it's a **correctness fix**. The bar's green-vs-amber is a factual claim about
whether the user stayed within the budget the day was actually judged
against; today that claim is false on bonus days. A flag would mean
"keep showing some users the wrong colour", which is incoherent for a bug
fix. The colour *system* (green = at/under, amber = over) is unchanged; only
the threshold each bar is measured against is corrected. No new surface, no
layout move, no copy that changes meaning beyond a clarifying caption.

### Decision-framework note

Top failure modes considered: (1) double-counting — adding a bonus on top of
a budget that already baked it in; ruled out because `targetCalories` is the
plain plan target and the bonus helper subtracts maintenance, matching
Today's add-on exactly. (2) today's projected-EOD bonus drifting from the
Today ring mid-day; mitigated by passing the same `now` and the same helper,
so both compute identically at any instant. (3) a day with no burn data
silently losing its base colour; mitigated — the helper returns 0 (collapses
to base) when `prefer` is off or `active <= 0`, and the field defaults to
`targetCalories` when no `activity` bundle is supplied at all. Confidence: 8/10
— the math is shared and unit-pinned; the residual uncertainty is purely
whether the mobile host loads the burn columns on every code path, which the
sim pass will confirm.

## Implementation

### Shared — `src/lib/nutrition/progressWeekReport.ts`

- New per-day field `effectiveTargetCalories: number` on `WeekDayTotals`.
- New optional type `WeekActivityAdjustment` (prefer flag, resting/active/
  workout kcal-by-day maps, per-day snapshot maintenance + a fallback).
- New optional 6th param `activity?: WeekActivityAdjustment` on
  `buildWeekStats`. In the day loop:
  ```ts
  const activityBonus = activity
    ? computeActivityBonusKcal({
        prefer: activity.prefer, dateKey: key, todayDateKey,
        restingKcal: activity.restingByDay[key] ?? 0,
        activeKcal: activity.activeByDay[key] ?? 0,
        maintenanceKcal: activity.maintenanceByDay?.[key] ?? activity.maintenanceFallback,
        workoutKcal: activity.workoutKcalByDay?.[key] ?? 0,
        now,
      })
    : 0;
  // effectiveTargetCalories: targetCalories + activityBonus
  ```
  **Backwards-compatible:** no `activity` arg → bonus is 0 →
  `effectiveTargetCalories === targetCalories`, so every existing caller is
  unaffected until it opts in.

### Mobile — `apps/mobile/app/(tabs)/progress.tsx`

- The Progress host now loads the four burn inputs it was missing
  (`activity_burn_by_day`, `basal_burn_by_day`, `workouts_by_day`,
  `prefer_activity_adjusted_calories`) — previously only the
  AppleHealthCardHost child read them.
- A `weekActivity` memo builds the `WeekActivityAdjustment` (snapshot
  maintenance from `dailyTargetsByDay[*].maintenanceTdee`, fallback from
  `recapMaintenance.kcal`), gated on `preferActivityAdjusted`.
- `buildWeekStats(...)` now receives `weekActivity`.
- The chart bar (`overTarget = d.calories > d.effectiveTargetCalories`) and
  the `daysHitCalorieTarget` trend tile both switched from base to effective.

### Web — `src/app/components/ProgressDashboard.tsx`

- Destructures `preferActivityAdjustedCalories`, `activityBurnByDay`,
  `basalBurnByDay`, `workoutsByDay` from `AppDataContext` (already exposed).
- Same `weekActivity` memo + `buildWeekStats` 6th arg.
- `dailyCaloriesData` carries `effectiveTarget`; chart bar + the
  `daysHitCalorieTarget` trend tile both use it.
- Legend gains a **"Base target {n} kcal"** label and a caption — *"Each bar
  compares to your target for that day — higher on days you earned an
  activity bonus."* — so a green bar that legitimately sits **above** the
  dashed base-target reference line reads correctly rather than looking like a
  rendering bug. (The dashed reference line stays on the plain base target by
  design — it's a fixed visual anchor, not the pass/fail threshold.)

### Second instance of the same bug, fixed

The `daysHitCalorieTarget` "N/7 days at target" trend tile on **both**
platforms carried a comment claiming it counted against the effective target
but its code used base `targetCalories`. Aligned both to
`effectiveTargetCalories`, so the headline stat and the bar colours now agree.

## Tests

`tests/unit/progressWeekReport.test.ts` — 6 new cases (11/11 green):
collapses to base with no bundle; no bonus when `prefer` is false; past-day
bonus = `resting + active − maintenance`; no bonus when active burn is 0;
per-day snapshot maintenance beats the fallback; today uses the projected-EOD
model. Web render harness (`progressDashboardRender`), `progressWeekReport.edges`,
`progressDataContract`, `progressTodayBarDim` all green. Mobile progress unit
tests green; mobile typecheck clean.

## Parity

One shared helper, one shared field, identical colour rule and identical
`effectiveTargetCalories` threshold on both platforms. The only platform
difference is the mechanical source of the burn maps (mobile reads
`profiles.*_by_day` columns directly; web reads the same data via
`AppDataContext`). The bonus math is the single `computeActivityBonusKcal`
helper for Today **and** Progress on **both** platforms.

## Rollout

No flag. Held local-only for Grace to confirm in the iOS sim that a bonus day
now reads green (+ a browser parity glance). Once she signs off, it ships with
the next push — no PostHog ramp, because there is no old path worth keeping
alive.
