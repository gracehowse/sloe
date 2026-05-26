# Decision: post-onboarding "Edit goal & pace" editor (web + mobile)

**Date:** 2026-05-25
**Area:** Nutrition / Targets / Onboarding
**Status:** Resolved
**Owner:** Engineering (spec locked by nutrition-engine)
**Related:** `docs/specs/2026-04-27-mobile-target-edits-parity.md`,
`docs/decisions/2026-04-30-reset-targets-is-inline-not-re-onboarding.md`,
`src/lib/nutrition/recomputeTargetsForActivity.ts`,
`src/lib/nutrition/weeklyDigestSuggestion.ts`

---

## Problem

The onboarding pace step promises "You can change this anytime", but
until now there was no surface to change **goal type / pace / goal
weight** after onboarding. The Targets screen's Goal-card edit
affordance dead-ended at the Profile screen, which only edits raw
calorie/macro numbers (manual `source = "user"` override) and has no
goal control. The promise was unkept.

## What shipped

A flag-gated "Edit goal & pace" editor on both platforms, reachable from
the Targets screen's Edit action (and the "Why this number → Adjust
target" action):

- **Web:** `src/app/components/suppr/goal-pace-editor-dialog.tsx`,
  wired into `src/app/components/Targets.tsx` via `goEdit`.
- **Mobile:** `apps/mobile/components/recap/GoalPaceEditorSheet.tsx`,
  wired into `apps/mobile/app/targets.tsx`'s Edit button.

Both call the shared compute helper `recomputeTargetsFromProfile`
(the static Mifflin-St Jeor formula, renamed from
`recomputeTargetsForActivity` with a back-compat alias) and the new
shared write helper `src/lib/nutrition/persistRecomputedTargets.ts`.

Gated behind the `goal-editor` PostHog feature flag
(`isFeatureEnabled("goal-editor")`, web `@/lib/analytics`, mobile
`apps/mobile/lib/analytics`). The flag gates only the new UI entry; the
recompute logic itself is unconditional. When the flag is off, the Edit
action keeps the old behaviour (deep-link to the Profile manual editor).

## Locked correctness decisions

1. **Goal-type or pace change → recompute `target_calories` + ALL FOUR
   macros atomically** via `recomputeTargetsFromProfile` (the same static
   formula the Settings activity-level edit uses). Never calories without
   macros. The adaptive `computeRetunedTargets` path is NOT used here —
   Settings-style edits use the static formula, matching the
   activity-level precedent.

2. **`goal_weight_kg` change → does NOT recompute calories.** Goal weight
   does not feed TDEE or the budget — it drives the projected reach-date
   only. The editor writes `goal_weight_kg` alone. When the user changes
   both goal and weight in one save, the recompute fires only when `goal`
   or `plan_pace` actually changed (diffed against the loaded values).

3. **Provenance is stamped `target_calories_source = "recompute"`
   (NEVER `"user"`)** plus `target_calories_set_at = now`. A `"user"`
   stamp would wrongly trigger the 14-day digest-suppression cooldown in
   `weeklyDigestSuggestion.ts`. A goal change overwrites a prior manual
   `"user"` target — that's correct: the goal is the newer, more specific
   intent.

4. **Goal → maintain clears `plan_pace`** (mirrors `GoalPaceRetuneSheet`).

5. **Snapshot + history sequencing.** Before the profile write (only when
   calories change) the helper reads the about-to-be-old profile and
   backfills past-day `daily_targets` snapshots
   (`backfillDailyTargetsFromProfile`) so history doesn't flip to the new
   target. After the write it fire-and-forgets `recordGoalHistory`
   (source `"goal_retune"` — an allowed value in the
   `goal_history.source` CHECK constraint; the editor's intent is exactly
   a retune, so no schema change was needed).

6. **Today's `daily_targets` snapshot is NOT rewritten.** Today reads live
   `target_calories`. The editor's `onSaved` callback refreshes the parent
   (web: `refreshProfileBasics` + local goal reload; mobile: `loadTargets`)
   so the change shows in place without an app restart.

7. **Safety floor is soft-warn-not-block.** When the recomputed target
   dips below `safetyFloorFor(sex)`, the editor shows the amber notice;
   Save stays enabled.

## Persistence centralisation

The read-old → backfill → upsert (+ provenance) → record-history sequence
lives in ONE shared helper, `persistRecomputedTargets`, called by both
platforms. `recomputed === null` (goal-weight-only) writes `profileUpdate`
only — no target / macro / source touch, no backfill, no history row.

The existing Settings activity-level path (`handleActivityLevelConfirm`)
was left as-is — it already does the same sequence inline and is pinned by
`tests/unit/profileTargetCaloriesProvenance.test.ts`; refactoring it onto
the shared helper is a low-value follow-up, not part of this change.

## Tests

- `tests/unit/goalChangeRecompute.test.ts` — pure compute (lose / maintain
  / gain calorie targets + all-four-macros recompute, numbers derived from
  the real formula) + the persistence contract (provenance `"recompute"`,
  manual-`"user"`-overwrite, maintain clears pace, goal-weight-only writes
  no target, goal_history seal).
- `tests/unit/profileTargetCaloriesProvenance.test.ts` — extended with the
  goal-change → `"recompute"` provenance case through
  `persistRecomputedTargets`.
- `apps/mobile/tests/unit/goalPaceEditorSave.test.ts` — mobile-distinct
  decision logic (the goal/pace diff, maintain → clear-pace, goal-weight-
  only no-recompute) and that mobile builds the same write payload web does.

## Parity

Both platforms ship the editor + recompute + goal-weight field + soft-warn
+ flag gate, sharing the compute and persistence helpers. No intentional
platform divergence beyond the native presentation difference (web `Dialog`
vs mobile bottom-sheet `Modal`), which matches every other shared editor on
the product.
