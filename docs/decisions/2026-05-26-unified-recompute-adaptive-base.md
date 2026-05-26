# Decision: unified target recompute — one core, adaptive maintenance, continuous pace

- **Date:** 2026-05-26
- **Area:** Nutrition / Targets / Onboarding
- **Status:** Resolved (Stage 1 logic + data + tests landed 2026-05-26; **Stage 2 editor-UI landed in the working tree 2026-05-26** — adaptive-aware preview + continuous pace slider + weight/height editing + restored fibre/manual-macro access; pending sim validation + `supabase db push` of the staged migration; Stage 4 open)
- **Owner:** Engineering (spec locked by nutrition-engine)
- **Supersedes:** decision #1 of `docs/decisions/2026-05-25-edit-goal-and-pace-editor.md`
- **Related:** `src/lib/nutrition/goalPaceRetune.ts`, `src/lib/nutrition/recomputeTargetsForActivity.ts`, `src/lib/onboarding/targets.ts`, `src/lib/nutrition/resolveMaintenance.ts`

## Problem (found by Grace, 2026-05-25)

Three recompute paths had diverged:

| Path | Maintenance base | Pace model |
|---|---|---|
| Onboarding (`computeV2Targets`) | static BMR×activity | **continuous** kg/week |
| Weekly check-in (`computeRetunedTargets`) | **adaptive** (`resolveMaintenance`) | continuous |
| "Edit goal & pace" editor (`recomputeTargetsFromProfile`) | **static** | **preset buckets** |

Grace's own profile exposed it: adaptive maintenance **1,582** (high confidence) vs the editor's static **1,671**, and her stored target **901** (onboarding continuous 0.70 kg/wk → −770) vs what the editor would recompute at the "accelerated" preset (−825 → 846). So the editor showed the wrong calories AND ignored her real, measured maintenance — the number every other surface displays.

## Decision

**One canonical core, `deriveTargets()`** (refactored out of `computeRetunedTargets`, the path that was already correct), used by onboarding, the editor, and the weekly check-in:

```
deriveTargets({ maintenanceKcal, goal, paceKgPerWeek, strategy, weightKg, sex }):
  kcalAdj = paceToKcalAdjustment(goal, paceKgPerWeek)   // continuous, 7700/7
  target  = round(maintenanceKcal + kcalAdj)
  strat   = strategy ?? mapGoalToStrategy(goal)          // NOT a blanket "balanced"
  macros  = calculateMacros(target, strat, weightKg)
  belowSafetyFloor = (goal∈{lose,recomp}) && target < safetyFloorFor(sex)
  safety  = budgetSafety(target, sex)
```

Locked points:

1. **Maintenance source is caller-supplied and explicit.** Onboarding passes the static formula (a new user has no logged data — formula is the only honest base). The editor + weekly check-in pass `resolveMaintenance(profile).kcal` (adaptive when confidence medium/high AND fresh per `adaptive_tdee_updated_at`, else static Mifflin). This is the fix for "doesn't use the correct maintenance." Onboarding using static is a **legitimate, documented divergence**, not a bug.
2. **Pace is continuous** (kg/week → daily kcal via `paceToKcalAdjustment`). The editor's preset-bucket deficit (`PACE_DAILY_DEFICIT`) is retired from the goal/pace path. To round-trip losslessly, add a `pace_kg_per_week numeric` column (the continuous source of truth); `plan_pace` stays as a derived/snapped mirror for legacy reads.
3. **Strategy: preserve the user's explicit `nutrition_strategy` across goal changes; map from goal only when null** (via `mapGoalToStrategy`, NOT the old `"balanced"` default). The editor *not* remapping a chosen strategy on goal change is intentional — the goal→strategy map is a default-picker, not a coupling.
4. **Safety floor stays soft-warn-not-block on every path**, and the floor flag/warning must be computed from the *adaptive-based* target so the preview and the warning agree.

## Known consequence (accepted)

Measuring the deficit from the (lower) adaptive base surfaces honest sub-floor targets. Grace's own example: adaptive 1,582 − 770 (her 0.70 kg/wk) = **~812 kcal**, below the 1,200 female floor → the danger banner now fires. Her stored 901 was built off too-high a base; the unified editor will show a *lower* number with a warning. This is correct disclosure, not a regression. The dieting-off-adaptive compounding risk (under-logging → low adaptive → stacked deficit) is backstopped only by the soft-warn floor — which must read the adaptive-based target.

## Scope / sequencing

- **Stage 1 (logic + data) — LANDED 2026-05-26 (working tree, pre-push):**
  - `deriveTargets()` core extracted into `src/lib/nutrition/goalPaceRetune.ts`; `computeRetunedTargets` is now a thin alias over it (weekly check-in call-site unchanged).
  - All three callers routed through it: `computeV2Targets` (onboarding, static maintenance — byte-identical numbers, pinned by `tests/unit/onboardingTargetsParity.test.ts`), `recomputeTargetsFromProfile` (editor + Settings — `resolveMaintenance` base + continuous pace from the `plan_pace` preset + `mapGoalToStrategy` strategy default), `computeRetunedTargets` (weekly check-in).
  - `PACE_WEEKLY_KG` exported from `tdee.ts`; `PACE_DAILY_DEFICIT`/`calculateBudget` retired from the recompute path.
  - Migration `supabase/migrations/20260526100000_profiles_pace_kg_per_week.sql` STAGED (nullable `numeric`, no backfill). **Not applied** — Grace runs `supabase db push --linked`. Persist paths (`persistRecomputedTargets`, onboarding `persist.ts`) write `pace_kg_per_week` alongside the snapped `plan_pace`, with a defensive retry that strips the column if the migration isn't pushed yet (so it can never block a save).
  - Tests: `deriveTargets.test.ts`, `recomputeAdaptiveMaintenance.test.ts`, `onboardingTargetsParity.test.ts`, updated `goalChangeRecompute.test.ts` (gain target corrected 2321→2596 — the half-magnitude surplus bug), `onboardingPersist.test.ts` (pace column).
  - **Editor UIs unchanged** (they still don't pass adaptive columns → static fallback today; wiring the adaptive read is the editor-UI Stage 2 task). Function signatures preserved so they compile as-is.
- **Stage 2 (editor UI) — LANDED 2026-05-26 (working tree, pre-push):**
  - **Adaptive maintenance wired into the preview.** Both editors now load `adaptive_tdee` / `adaptive_tdee_confidence` / `adaptive_tdee_updated_at` (via the shared `GOAL_EDITOR_PROFILE_COLUMNS` SELECT + `parseGoalEditorProfileRow`) and pass them into `recomputeTargetsFromProfile`, so the live preview is computed off adaptive maintenance when confident + fresh (else static Mifflin) — matching the rest of the app. The amber safety-floor notice reads off that adaptive-based preview target, so it fires more often (and correctly) for users with a lower adaptive maintenance.
  - **Continuous pace slider** replaces the four preset buttons. Reuses the onboarding slider component (web `BrandedSlider`, mobile `MobileMiniSlider`) + `PACE_RANGES`. Seated from the stored `pace_kg_per_week` when present, else inferred from the legacy `plan_pace` preset (relaxed .25 / steady .5 / accelerated .75 / vigorous 1.0), clamped into the goal's range. **Dirty-tracking diffs against the seated continuous value**, not the snapped preset — opening + saving unchanged never moves the target (fixes the silent 901→846 preset-snap drift). On save the continuous value persists; `persistRecomputedTargets` snaps `plan_pace`.
  - **Weight + height editable in the editor**, respecting `measurement_system` (kg/cm vs lb/ft-in). They feed BMR→maintenance→target so the live preview recomputes; invalid/blank inputs don't recompute. Persisted as `weight_kg` / `height_cm` via the existing persist path.
  - **Fibre / manual macros (thread C) — access restored.** The goal editor does NOT rebuild manual-override provenance; instead the Targets macro tiles tap through to the `/profile` manual editor (incl. the Fibre field), and the editor itself carries a "Customise macros (incl. fibre)" link to the same place. `/profile` still saves `target_fiber_g` with `target_calories_source = "user"`.
  - **Parity:** identical behaviour web ↔ mobile. Logic lives in shared `src/lib/nutrition/goalEditorPace.ts` (seat / dirty / parse / body-field helpers) + mobile `useGoalPaceEditor` composition-root hook (sheet broken into `GoalPaceSlider` / `GoalPaceBodyFields` / `GoalPaceControls` to stay under the 400-line limit).
  - Tests: new `tests/unit/goalEditorPace.test.ts` (seat from pace_kg_per_week vs preset, clamp, no-op-not-dirty, body-field parsing); `tests/unit/goalChangeRecompute.test.ts` extended (adaptive-maintenance preview drops + floor fires, stale/low-confidence fallback); mobile `goalPaceEditorSave.test.ts` rewritten for the recompute diff + weight/height write + continuous-pace persist + no-op-not-dirty.
- **Stage 4:** restore the rolling-vs-current deficit window toggle on Today.

All UI/structural stages ship behind the existing `goal-editor` flag and require sim validation before push (per `feedback_validate_in_sim_before_push`). The migration needs data-integrity sign-off.
