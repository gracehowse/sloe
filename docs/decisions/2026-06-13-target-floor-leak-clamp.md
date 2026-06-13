# Sub-floor calorie-target leak — read-time safety clamp (ENG-793, partial)

**Date:** 2026-06-13
**Area:** Nutrition / calorie targets (web + mobile)
**Status:** Resolved (the two safe sub-fixes). **The core TDEE-vs-Apple-Health algorithm remains open — pending Grace's design call.**
**Flag:** none — a calorie-safety floor is an invariant; you never want a flag that can switch it off (mirrors the existing unflagged suggestion-floor).

## Context

Grace's weekly check-in suggested a target of 901 → 701 kcal/day (her Watch shows
1,750–2,100 burned). ENG-793 has **three stacked issues**:

1. **(Core)** TDEE/maintenance estimate ignores measured Apple Health burn and
   collapses toward logged intake for under-loggers.
2. **(Label)** "Avg this week 1,329" reads as *burn* but is average *intake*.
3. **(Floor leak)** A stored target of **901 sits below the safety floor** — the
   floor only guarded new check-in *suggestions*, not the stored/effective target.

This change ships **#2 and #3** — the non-design-gated, harm-reducing fixes. **#1
is deliberately NOT touched** (the issue routes it to a nutrition-engine design
pass; double-count avoidance — Mifflin already bakes in activity, activity-bonus
subtracts maintenance — and wear-completeness gating are too health-critical to
guess; confidence on a clean ship without a design pass was 6/10).

## Decision

### #3 — read-time safety clamp

There is no `MIN_SUGGESTED_TARGET_KCAL` constant; the real floor is the
**sex-aware** `safetyFloorFor(sex)` (1500 M / 1200 F / 1350 unspecified) in
`src/lib/onboarding/targets.ts`, enforced only on the check-in suggestion preview.
Two new shared helpers in that file:

- `coerceSex(raw)` — raw `profiles.sex` → `Sex | null`. Unknown/missing → `null`
  → 1350 floor. **Never** defaults to male (1500), which would wrongly raise a
  legitimate female 1,200 target.
- `clampTargetToSafetyFloor(targetKcal, sex)` — `Math.max(safetyFloorFor(sex),
  targetKcal)`. Monotonic (only raises), macros untouched, non-finite/≤0 pass
  through.

Applied at **every LIVE effective-target read** on both platforms, via the single
shared export (parity):

- Mobile `resolveTargets` explicit stored-DB branch (`apps/mobile/lib/calcTargets.ts`).
- Mobile **Progress tab** raw `target_calories` read (`apps/mobile/app/(tabs)/progress.tsx`) — this reads `profiles` directly, not via `resolveTargets`; an adversarial nutrition-engine review caught it as a residual leak + a web↔mobile parity break (web Progress reads the clamped context).
- Web `AppDataContext` — added `sex` to both `profiles` SELECTs; clamp at both DB `setNutritionTargets` sites and the three local-cache error fallbacks (`local.sex` is already the `Sex` union).

**Deliberately NOT clamped:**
- The **derive/write layer** (`deriveTargets`, `computeV2Targets`,
  `recomputeTargetsForActivity`, `persistRecomputedTargets`) — clamping there
  would defeat the deliberate soft-warn-not-block onboarding design and zero the
  `belowSafetyFloor` flag.
- **Past-day snapshots** (`normalizeMacroTargets` stays sex-free;
  `dailyTargetRead.resolveDisplayTarget` untouched) — clamping would
  retroactively rewrite what a past day's target was.

### #2 — label

`WeeklyCheckinModal.tsx` + `weekly-checkin-dialog.tsx`: "Avg this week" →
**"Avg logged daily"** (the value is average daily *intake*, not burn). Copy-only.

## Why monotonic-safe

The clamp can only RAISE a target to the floor, never lower it, so it cannot make
a target more dangerous. Macros are left unchanged — the kcal floor is the safety
control; under-eating macros is not the harm vector.

## Files

- `src/lib/onboarding/targets.ts` — `coerceSex`, `clampTargetToSafetyFloor`
- `apps/mobile/lib/calcTargets.ts`, `apps/mobile/app/(tabs)/progress.tsx` — mobile read clamps
- `src/context/AppDataContext.tsx` — web read clamps (+ `sex` in SELECTs)
- `apps/mobile/components/today/WeeklyCheckinModal.tsx`, `src/app/components/suppr/weekly-checkin-dialog.tsx` — label
- Tests: `tests/unit/targetFloorLeakClamp.test.ts` (helper), `tests/unit/targetFloorLeakCoverage.test.ts` (every clamp site + the must-NOT-clamp sites), `apps/mobile/tests/unit/resolveTargetsFloorClamp.test.ts`, label test updates.

## Verified

Both typechecks clean; helper + resolver + coverage + label suites green. Adversarial
nutrition-engine pass confirmed: read-only clamp, no derive/snapshot rewrite,
monotonic, sex-safe, and full live-read coverage on both platforms (it found and we
fixed the mobile Progress + web local-fallback gaps before closing).

## Still open

**ENG-793 core (#1)** — measured-burn maintenance signal — stays open for Grace's
design call. This change reduces the *harm* (no sub-floor target reaches any
surface; honest label) but does not make the TDEE estimate itself measured-burn-aware.
