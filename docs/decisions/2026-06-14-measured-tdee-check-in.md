# Measured TDEE for weekly check-in (ENG-1111)

**Date:** 2026-06-14  
**Status:** Shipped (flag `measured_tdee_check_in`, default off until PostHog ramp)  
**Area:** Weekly check-in / maintenance resolution (web + mobile)  
**Parent:** ENG-793 partial — core burn-aware estimate split out per launch audit P1-10

## Problem

Under-loggers drove adaptive TDEE toward logged intake (~1,329 kcal) while Apple
Health measured ~1,750–2,100 kcal/day. The check-in suggested dangerously low
targets despite high real expenditure.

## Decision

1. **Estimator (`measuredTdee.ts`):** median of `(basal + active)` per day over
   28 days, counting only **complete-wear** days (resting ≥ 60% of window median
   resting and ≥ 70% of BMR when known). Requires ≥ 14 complete-wear days.
2. **Resolution priority (flag on):** measured → adaptive → formula in
   `resolveMaintenance()`. Stale measured data uses the same 14-day window as
   adaptive.
3. **Double-count mutual exclusion:** when maintenance `source === "measured"`,
   `computeActivityBonusKcal()` returns **0** — active energy is already inside
   measured TDEE; the per-day bonus must not stack on top.
4. **Check-in:** uses resolved maintenance kcal/confidence (not raw adaptive
   columns) for `shouldShowWeeklyCheckin` + `buildWeeklyCheckinContent`.
5. **Writer:** `refreshAdaptiveTdeeForUser` persists `measured_tdee*` alongside
   adaptive when confidence is medium/high.

## Flag

PostHog: `measured_tdee_check_in`. Off → legacy adaptive/formula path unchanged.

## Tests

`tests/unit/measuredTdee.test.ts`, extended `resolveMaintenance.test.ts`,
`activityBonus.test.ts`, `weeklyCheckin.test.ts`.
