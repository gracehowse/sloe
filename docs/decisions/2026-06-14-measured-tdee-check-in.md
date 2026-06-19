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
   resting AND ≥ 70% of BMR when known — a day must clear both floors). Requires
   ≥ 14 complete-wear days (`MIN_COMPLETE_WEAR_DAYS`); ≥ 21 complete-wear days
   (`HIGH_CONFIDENCE_WEAR_DAYS`, mirrors `HIGH_CONFIDENCE_LOGGING_DAYS` in
   `adaptiveTdee.ts`) promotes the estimate from `medium` to `high`. The result
   is the **median** (not mean) so a single marathon/workout day does not inflate
   the full-day expenditure number.
2. **Resolution priority (flag on):** measured → adaptive → formula in
   `resolveMaintenance()`. Stale measured data uses the same 14-day window as
   adaptive.
3. **Double-count mutual exclusion (load-bearing):** measured TDEE is FULL-day
   expenditure (resting + active). When maintenance `source === "measured"`,
   `computeActivityBonusKcal()` returns **0** — active energy is already inside
   measured TDEE; the per-day bonus must not stack on top. The rule is documented
   at the measured branch in `resolveMaintenance.ts`, enforced in
   `computeActivityBonusKcal` (`activityBonus.ts`), and asserted in
   `tests/unit/activityBonus.test.ts`. Only the measured branch zeros the bonus;
   the adaptive + formula branches stay the sedentary/NEAT seed so the bonus pays
   for activity exactly once.
4. **Check-in:** uses resolved maintenance kcal/confidence (not raw adaptive
   columns) for `shouldShowWeeklyCheckin` + `buildWeeklyCheckinContent`.
5. **Writer:** `refreshAdaptiveTdeeForUser` persists `measured_tdee*` alongside
   adaptive when confidence is medium/high.

## Flag

PostHog: `measured_tdee_check_in`. Off → legacy adaptive/formula path unchanged.

## Tests

- `tests/unit/measuredTdee.test.ts` — per-day sum, median (robust to a workout
  outlier), partial-wear exclusion, BMR-floor null, medium→high threshold,
  Grace's fixture (measured ~1,900 vs intake ~1,329).
- `tests/unit/resolveMaintenance.test.ts` — measured wins when trustworthy +
  flag-on, **flag-off regression** (adaptive wins, legacy path unchanged), stale
  measured falls through, `source: "measured"` + measured popover copy.
- `tests/unit/activityBonus.test.ts` — double-count assertion
  (`computeActivityBonusKcal` returns 0 on `maintenanceSource: "measured"`).
- `tests/unit/weeklyCheckin.test.ts` — Grace case: measured maintenance raises
  the suggested target above the under-logged current target; sex-aware floor
  clamp still binds (no sub-floor spiral).
- `tests/unit/weeklyCheckinDialogWeb.test.tsx` +
  `apps/mobile/tests/unit/weeklyCheckinModal.test.tsx` — the measured-driven
  raised target renders to the user (web ↔ mobile parity).
