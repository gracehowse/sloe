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
   28 days, counting only **complete-wear** days (resting ≥ 80% of window median
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

## Under-eating safety guards (ENG-1111 nutrition-engine review, 2026-06-18)

A pre-ramp calorie-safety review found two ways measured TDEE could still
recommend **too little food**. Both are closed before `measured_tdee_check_in`
ramps. Root cause: `basal_burn_by_day` is the plain SUM of on-wrist
BasalEnergyBurned samples with **no full-day extrapolation**, so a partially-worn
day stores a truncated (low) basal — and a truncated basal biases the median
DOWN, toward a lower maintenance and a lower suggested intake.

1. **Tighter wear-completeness floor.** `RESTING_VS_MEDIAN_FLOOR` raised
   **0.6 → 0.8** (≈80% wear — the standard wear-validity threshold). The old 0.6
   floor let a ~60%-worn day pass and drag the median down.
   `RESTING_VS_BMR_FLOOR` is **kept at 0.7** (a sensible absolute physiological
   backstop; raising it risks excluding genuine low-RMR days), and
   `MIN_COMPLETE_WEAR_DAYS` is **kept at 14**.
2. **Estimator-level plausibility floor.** `computeMeasuredTDEE` now accepts
   optional `sedentaryTdeeKcal` + `restingEnergyFloorKcal` (mirroring
   `adaptiveTdee.ts` R3) and **rejects (returns null)** a measured median below
   the resting-energy floor or below `0.85 × sedentary TDEE`
   (`PLAUSIBILITY_LOWER_FRACTION`). This is the estimator-level home for the
   floor, so every consumer of `computeMeasuredTDEE` is protected. The writer
   (`refreshAdaptiveTdeeForUser`) passes the same floors it already computes for
   adaptive, so an implausibly-low median is never persisted to `measured_tdee`.
3. **Measured-branch formula floor in the resolver.** `resolveMaintenance`'s
   measured branch now mirrors the ENG-1057 adaptive guard: if the measured
   candidate is below the user's own sedentary `formulaKcal`, it surfaces the
   **formula** instead and records `measuredRejectedBelowFormula` +
   `rejectedMeasuredKcal`. Measured can never recommend below the user's own
   sedentary formula maintenance. (Defence-in-depth: the resolver floor catches
   any value already persisted before the estimator clamp shipped, and any
   future writer that bypasses the clamp.)

## Flag

PostHog: `measured_tdee_check_in`. Off → legacy adaptive/formula path unchanged.

## Tests

- `tests/unit/measuredTdee.test.ts` — per-day sum, median (robust to a workout
  outlier), partial-wear exclusion, BMR-floor null, medium→high threshold,
  Grace's fixture (measured ~1,900 vs intake ~1,329). **ENG-1111 under-eating
  guards:** a 70%-worn day (resting = 0.7 × median) is now EXCLUDED by the 0.8
  floor (was included at 0.6); `computeMeasuredTDEE` returns null when the median
  falls below the resting-energy floor or below `0.85 × sedentary TDEE`.
- `tests/unit/resolveMaintenance.test.ts` — measured wins when trustworthy +
  flag-on, **flag-off regression** (adaptive wins, legacy path unchanged), stale
  measured falls through, `source: "measured"` + measured popover copy. **ENG-1111
  under-eating guard:** a measured candidate below the sedentary formula surfaces
  the FORMULA (`measuredRejectedBelowFormula` + `rejectedMeasuredKcal`), and the
  measured-above-formula happy path still surfaces measured.
- `tests/unit/activityBonus.test.ts` — double-count assertion
  (`computeActivityBonusKcal` returns 0 on `maintenanceSource: "measured"`).
- `tests/unit/weeklyCheckin.test.ts` — Grace case: measured maintenance raises
  the suggested target above the under-logged current target; sex-aware floor
  clamp still binds (no sub-floor spiral).
- `tests/unit/weeklyCheckinDialogWeb.test.tsx` +
  `apps/mobile/tests/unit/weeklyCheckinModal.test.tsx` — the measured-driven
  raised target renders to the user (web ↔ mobile parity).
