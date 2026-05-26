/**
 * Shared write-orchestration for goal / pace / goal-weight edits made
 * AFTER onboarding (ENG goal-editor, 2026-05-25). Web + mobile both call
 * this so the persistence sequence stays identical — no duplicated
 * pipeline, no silent drift.
 *
 * The sequence (locked by the nutrition-engine spec):
 *
 *   1. When `recomputed` is non-null (a goal/pace change that moves
 *      `target_calories`): read the about-to-be-OLD profile and call
 *      `backfillDailyTargetsFromProfile` so historical days that lack a
 *      `daily_targets` snapshot freeze at the OLD target instead of
 *      silently flipping to the new one. Best-effort — never blocks.
 *
 *   2. Build the profile UPDATE payload:
 *        - always include the caller's `profileUpdate` (goal / plan_pace /
 *          goal_weight_kg / any other column the editor touched);
 *        - when `recomputed` is non-null, layer in the four macros +
 *          target_calories, AND stamp provenance:
 *            target_calories_source = "recompute"  (NEVER "user" — a
 *              "user" stamp wrongly triggers the 14-day digest-suppression
 *              cooldown in weeklyDigestSuggestion.ts);
 *            target_calories_set_at = now.
 *          A goal change deliberately overwrites a prior manual "user"
 *          target: the goal is the newer, more specific intent.
 *
 *   3. Write the profile row.
 *
 *   4. After a successful write, fire-and-forget
 *      `recordGoalHistory(..., "goal_retune")` with the new values so
 *      future past-day reads can resolve "what goal was in force on day
 *      D?" — the backfill in step 1 protects PAST days; this seals
 *      TODAY-and-forward.
 *
 * goal-weight-only edits (`recomputed === null`): we DO NOT touch
 * target_calories / macros / provenance — goal weight does not feed
 * TDEE or the budget. Step 1 (backfill) and step 4 (history) are skipped
 * because no goal-shape field changed; we just write `profileUpdate`.
 *
 * Pure-ish + loosely typed (matching `dailyTargetSnapshot.ts` /
 * `goalHistory.ts`) so a single copy lives under `src/lib/nutrition/…`
 * and the mobile bundle imports it via `@suppr/shared/nutrition/…`.
 */

import type { RecomputedTargets } from "./recomputeTargetsForActivity";
import { backfillDailyTargetsFromProfile } from "./dailyTargetSnapshot";
import { recordGoalHistory, type GoalHistorySource } from "./goalHistory";
import { PACE_WEEKLY_KG, type PlanPace } from "./tdee";

/** The four legacy `plan_pace` preset names. */
const PLAN_PACE_PRESETS: readonly PlanPace[] = [
  "relaxed",
  "steady",
  "accelerated",
  "vigorous",
];

/**
 * Resolve the lossless continuous pace (kg/week) to persist into the new
 * `profiles.pace_kg_per_week` column, given the editor's profile update.
 *
 * Precedence:
 *   1. An explicit `paceKgPerWeek` on the input (continuous value the
 *      caller already holds — the most faithful source). Set this once
 *      the editor UI exposes a continuous slider.
 *   2. The `plan_pace` preset in `profileUpdate` → its `PACE_WEEKLY_KG`
 *      value (the editor passes a snapped preset today, so this is the
 *      best continuous reconstruction available until the slider lands).
 *   3. `plan_pace === null` (goal → maintain) → `0` kg/week.
 *
 * Returns `undefined` when no pace signal is present (e.g. a goal-weight-
 * only edit) so the caller can omit the column from the write entirely.
 */
function resolveContinuousPace(
  profileUpdate: Record<string, unknown>,
  explicit: number | null | undefined,
): number | undefined {
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit >= 0) {
    return explicit;
  }
  if (!("plan_pace" in profileUpdate)) return undefined;
  const preset = profileUpdate.plan_pace;
  if (preset === null) return 0; // maintain
  if (
    typeof preset === "string" &&
    (PLAN_PACE_PRESETS as readonly string[]).includes(preset)
  ) {
    return PACE_WEEKLY_KG[preset as PlanPace];
  }
  return undefined;
}

/** Same loose client shape the sibling helpers use — both web
 *  `SupabaseClient<Database>` and mobile `@/lib/supabase` satisfy it. */
export type PersistTargetsClient = any;

export type PersistRecomputedTargetsInput = {
  /**
   * Columns the editor changed that are NOT derived from the recompute —
   * e.g. `goal`, `plan_pace`, `goal_weight_kg`. Always written. When the
   * editor clears `plan_pace` (goal → maintain), pass `plan_pace: null`.
   */
  profileUpdate: Record<string, unknown>;
  /**
   * The recomputed target set, or `null` for a goal-weight-only edit
   * (no calorie/macro write, no backfill, no history row).
   */
  recomputed: RecomputedTargets | null;
  /**
   * Provenance source for the target write. The goal/pace editor always
   * passes "recompute" — see the module header for why "user" is wrong.
   */
  source?: "recompute";
  /** Injectable clock for deterministic tests. */
  now?: Date;
  /**
   * goal_history source tag. Defaults to "goal_retune" — the goal/pace
   * editor is a post-onboarding retune, the same shape the weekly
   * check-in records, and `goal_retune` is one of the values the
   * `goal_history.source` CHECK constraint accepts (migration
   * 20260515100000). We deliberately do NOT introduce a new source
   * value here: that would require a schema change, and the editor's
   * intent is exactly a retune.
   */
  historySource?: GoalHistorySource;
  /**
   * Lossless continuous pace (kg/week) to persist into the
   * `profiles.pace_kg_per_week` column. OPTIONAL: when omitted, it's
   * reconstructed from the `plan_pace` preset in `profileUpdate` (the
   * editor passes a snapped preset today; pass the exact value once the
   * editor exposes a continuous slider). Only written when targets move
   * (a goal/pace change) — a goal-weight-only edit doesn't touch pace.
   */
  paceKgPerWeek?: number | null;
};

export type PersistRecomputedTargetsResult = {
  ok: boolean;
  /** True when the profile UPDATE included target_calories + macros. */
  wroteTargets: boolean;
  /** Error message when the profile write failed; null on success. */
  error: string | null;
};

export async function persistRecomputedTargets(
  supabase: PersistTargetsClient,
  userId: string | null | undefined,
  input: PersistRecomputedTargetsInput,
): Promise<PersistRecomputedTargetsResult> {
  if (!userId) {
    return { ok: false, wroteTargets: false, error: "no_user_id" };
  }

  const now = input.now ?? new Date();
  const { profileUpdate, recomputed } = input;
  const wroteTargets = recomputed != null;

  // Step 1 — backfill past-day snapshots from the OLD profile, ONLY when
  // the calorie target is about to move. Best-effort; never blocks.
  if (wroteTargets) {
    try {
      const { data: oldProfile } = await supabase
        .from("profiles")
        .select(
          "target_calories, target_protein, target_carbs, target_fat, target_fiber_g, activity_level, plan_pace, goal, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, sex, weight_kg, height_cm, age",
        )
        .eq("id", userId)
        .maybeSingle();
      if (oldProfile) {
        await backfillDailyTargetsFromProfile(supabase, userId, oldProfile, {
          now,
        });
      }
    } catch {
      // Backfill never blocks the user's goal edit.
    }
  }

  // Step 2 — build the write payload. `maintenanceTdee` is a derived
  // convenience field on RecomputedTargets, NOT a DB column — strip it.
  const update: Record<string, unknown> = { ...profileUpdate };
  if (recomputed) {
    const { maintenanceTdee: _maintenance, ...writeableTargets } = recomputed;
    Object.assign(update, writeableTargets);
    update.target_calories_source = input.source ?? "recompute";
    update.target_calories_set_at = now.toISOString();

    // Lossless continuous pace alongside the snapped `plan_pace` preset
    // (target-recompute unification, 2026-05-26). Only on a target move —
    // a goal-weight-only edit (recomputed === null) skips this branch.
    // DEFENSIVE: `pace_kg_per_week` may not exist yet on an env where the
    // migration hasn't been pushed. PostgREST drops unknown columns from
    // the write payload when the schema cache permits, so this degrades
    // gracefully; if the column IS known but the write otherwise fails,
    // the existing error path below surfaces it. We never let an unknown
    // column break the goal edit.
    const continuousPace = resolveContinuousPace(profileUpdate, input.paceKgPerWeek);
    if (continuousPace !== undefined) {
      update.pace_kg_per_week = continuousPace;
    }
  }

  // Step 3 — write the profile row.
  let { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", userId);

  // DEFENSIVE retry: if the ONLY problem is that `pace_kg_per_week`
  // doesn't exist on this env (migration 20260526100000 not pushed yet),
  // strip it and write the rest. PostgREST surfaces an unknown column as
  // a schema-cache error (PGRST204) naming the column. We never let the
  // new column block a goal edit on an un-migrated env. Any OTHER error
  // (or a failure after stripping) falls through to the error return.
  if (
    error &&
    "pace_kg_per_week" in update &&
    typeof error.message === "string" &&
    error.message.includes("pace_kg_per_week")
  ) {
    // Observability (data-integrity nit 2026-05-26): a misordered deploy
    // (code shipped before migration pushed) would otherwise silently fall
    // back to preset-only. Warn so it's visible rather than invisible.
    console.warn(
      "[persistRecomputedTargets] pace_kg_per_week column absent — stripped + retried (apply migration 20260526100000)",
    );
    const { pace_kg_per_week: _dropped, ...withoutPace } = update;
    const retry = await supabase
      .from("profiles")
      .update(withoutPace)
      .eq("id", userId);
    error = retry.error;
  }

  if (error) {
    return {
      ok: false,
      wroteTargets,
      error: error.message ?? "profile_update_failed",
    };
  }

  // Step 4 — record goal_history (today-and-forward) when targets moved.
  // A goal-weight-only edit changes no goal-shape field, so there's
  // nothing meaningful to seal — skip it (recordGoalHistory would
  // dedupe it as no_change anyway, but skipping avoids the round-trip).
  if (recomputed) {
    void recordGoalHistory(
      supabase,
      userId,
      {
        goal:
          typeof profileUpdate.goal === "string" ? profileUpdate.goal : null,
        plan_pace:
          typeof profileUpdate.plan_pace === "string"
            ? profileUpdate.plan_pace
            : null,
        activity_level:
          typeof profileUpdate.activity_level === "string"
            ? profileUpdate.activity_level
            : null,
        target_calories: recomputed.target_calories,
        target_protein_g: recomputed.target_protein,
        target_carbs_g: recomputed.target_carbs,
        target_fat_g: recomputed.target_fat,
        target_fiber_g: recomputed.target_fiber_g,
        maintenance_tdee: recomputed.maintenanceTdee,
      },
      input.historySource ?? "goal_retune",
      { now },
    );
  }

  return { ok: true, wroteTargets, error: null };
}
