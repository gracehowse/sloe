/**
 * F-149 (2026-05-11) — write helper for the `goal_history` append log.
 *
 * Pairs with migration `20260515100000_goal_history.sql`. Records the
 * user's current goal-shape fields with an `effective_from` date so the
 * read path can answer "what goal was in force on day D?" without
 * falling back to live-profile values.
 *
 * Contract:
 *   - Only inserts when the goal-shape actually CHANGED relative to
 *     the most-recent row. Saves on Settings that don't touch a
 *     goal field are no-ops (the helper still runs, but writes
 *     nothing).
 *   - `effective_from` defaults to today (local). Onboarding can pass
 *     the account-creation date as `effective_from` so a brand-new
 *     user's history is correctly seeded.
 *   - Fire-and-forget: failures are logged + swallowed. The user's
 *     profile UPDATE must not roll back because history could not write.
 *   - Caller passes the EXISTING (about-to-be-old) profile values
 *     — the helper records THOSE so past-day reads return what was
 *     true before this save. The new values are captured by the next
 *     save (or read live as fallback).
 *
 *   Wait — that's wrong. We record the CURRENT (new) values with
 *   today's effective_from. Past days look up the row with effective_from
 *   <= D — so day D before today maps to the PREVIOUS row, which was
 *   recorded with the previous values. Days from today onwards see the
 *   new row.
 *
 *   So: pass the NEW profile values (the ones about to be written, or
 *   already just-written). The previous row stays put and covers the
 *   past. Today and forward use the new row.
 *
 * Cross-platform: same loose typing as `dailyTargetSnapshot.ts` so
 * both web (`SupabaseClient<Database>`) and mobile (`@/lib/supabase`)
 * clients satisfy it without `as any` at the call site.
 */

import { dateKeyFromDate } from "./trackerStats";


export type GoalHistoryClient = any;

export type GoalHistorySource =
  | "settings_save"
  | "goal_retune"
  | "onboarding"
  | "admin";

/**
 * Goal-shape fields recorded by this helper. All optional because
 * different code paths populate different subsets (e.g. onboarding
 * has macros + targets, a settings-only goal change might only have
 * goal/plan_pace).
 */
export type GoalShape = {
  goal?: string | null;
  plan_pace?: string | null;
  activity_level?: string | null;
  target_calories?: number | null;
  target_protein_g?: number | null;
  target_carbs_g?: number | null;
  target_fat_g?: number | null;
  target_fiber_g?: number | null;
  maintenance_tdee?: number | null;
};

/**
 * Record a new goal_history row IF the goal-shape differs from the
 * most-recent existing row. No-op when the values are unchanged or
 * when no userId is supplied.
 *
 * Returns:
 *   `{ inserted: true }`  — a fresh row was written
 *   `{ inserted: false, reason }` — write was skipped or failed
 *
 * The return shape exists for tests + structured logs only. Production
 * callers throw the promise away.
 */
export async function recordGoalHistory(
  supabase: GoalHistoryClient,
  userId: string | null | undefined,
  newValues: GoalShape,
  source: GoalHistorySource,
  options: { now?: Date; effectiveFrom?: string } = {},
): Promise<{ inserted: boolean; reason?: string }> {
  if (!userId) return { inserted: false, reason: "no_user_id" };

  const effectiveFrom =
    options.effectiveFrom ?? dateKeyFromDate(options.now ?? new Date());

  // Read the most-recent row to dedupe identical saves. If history is
  // empty (new user, no prior writes), the comparison short-circuits
  // and we always insert. Wrap in try/catch so test stubs that don't
  // implement the full chain don't reject the fire-and-forget caller.
  let existing: Record<string, unknown> | null = null;
  let readErr: { message?: string } | null = null;
  try {
    const res = await supabase
      .from("goal_history")
      .select(
        "goal, plan_pace, activity_level, target_calories, target_protein_g, target_carbs_g, target_fat_g, target_fiber_g, maintenance_tdee",
      )
      .eq("user_id", userId)
      .order("effective_from", { ascending: false })
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    existing = (res?.data as Record<string, unknown> | null) ?? null;
    readErr = (res?.error as { message?: string } | null) ?? null;
  } catch (err) {
    return {
      inserted: false,
      reason: `read_threw:${(err as Error)?.message ?? "unknown"}`,
    };
  }

  if (readErr) {
    // Missing table (migration not applied) → silent no-op. The band-aid
    // backfill in `dailyTargetSnapshot.ts` still covers the common case.
    console.warn(
      "[goalHistory] read failed — skipping",
      readErr.message ?? "",
    );
    return { inserted: false, reason: "read_failed" };
  }

  if (existing && goalShapeMatches(existing, newValues)) {
    return { inserted: false, reason: "no_change" };
  }

  const row = {
    user_id: userId,
    effective_from: effectiveFrom,
    goal: toStr(newValues.goal),
    plan_pace: toStr(newValues.plan_pace),
    activity_level: toStr(newValues.activity_level),
    target_calories: toInt(newValues.target_calories),
    target_protein_g: toInt(newValues.target_protein_g),
    target_carbs_g: toInt(newValues.target_carbs_g),
    target_fat_g: toInt(newValues.target_fat_g),
    target_fiber_g: toInt(newValues.target_fiber_g),
    maintenance_tdee: toInt(newValues.maintenance_tdee),
    source,
  };

  let insertErr: { message?: string } | null = null;
  try {
    const res = await supabase.from("goal_history").insert(row);
    insertErr = (res?.error as { message?: string } | null) ?? null;
  } catch (err) {
    return {
      inserted: false,
      reason: `insert_threw:${(err as Error)?.message ?? "unknown"}`,
    };
  }

  if (insertErr) {
    console.warn(
      "[goalHistory] insert failed — skipping",
      insertErr.message ?? "",
    );
    return { inserted: false, reason: "insert_failed" };
  }

  return { inserted: true };
}

function goalShapeMatches(a: GoalShape, b: GoalShape): boolean {
  return (
    toStr(a.goal) === toStr(b.goal) &&
    toStr(a.plan_pace) === toStr(b.plan_pace) &&
    toStr(a.activity_level) === toStr(b.activity_level) &&
    toInt(a.target_calories) === toInt(b.target_calories) &&
    toInt(a.target_protein_g) === toInt(b.target_protein_g) &&
    toInt(a.target_carbs_g) === toInt(b.target_carbs_g) &&
    toInt(a.target_fat_g) === toInt(b.target_fat_g) &&
    toInt(a.target_fiber_g) === toInt(b.target_fiber_g) &&
    toInt(a.maintenance_tdee) === toInt(b.maintenance_tdee)
  );
}

function toStr(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length === 0 ? null : t;
}

function toInt(raw: unknown): number | null {
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

/**
 * Read the goal-shape that was effective on `dateKey` for the user.
 * Returns `null` when no history row covers that date.
 *
 * Used by `getDailyTargets` (in `dailyTargetRead.ts`) as the
 * middle-tier fallback: daily_targets snapshot → goal_history →
 * current profile.
 */
export async function getGoalEffectiveOnDate(
  supabase: GoalHistoryClient,
  userId: string,
  dateKey: string,
): Promise<GoalShape | null> {
  const { data, error } = await supabase
    .from("goal_history")
    .select(
      "goal, plan_pace, activity_level, target_calories, target_protein_g, target_carbs_g, target_fat_g, target_fiber_g, maintenance_tdee, effective_from",
    )
    .eq("user_id", userId)
    .lte("effective_from", dateKey)
    .order("effective_from", { ascending: false })
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    goal: typeof data.goal === "string" ? data.goal : null,
    plan_pace: typeof data.plan_pace === "string" ? data.plan_pace : null,
    activity_level:
      typeof data.activity_level === "string" ? data.activity_level : null,
    target_calories: toInt(data.target_calories),
    target_protein_g: toInt(data.target_protein_g),
    target_carbs_g: toInt(data.target_carbs_g),
    target_fat_g: toInt(data.target_fat_g),
    target_fiber_g: toInt(data.target_fiber_g),
    maintenance_tdee: toInt(data.maintenance_tdee),
  };
}

/**
 * Bulk variant for the dailyTargetRead path: given a set of dateKeys,
 * read every relevant goal_history row in one query and resolve each
 * dateKey to its effective shape. Much cheaper than N separate
 * `getGoalEffectiveOnDate` calls when reading a week's worth.
 */
export async function getGoalEffectiveForDates(
  supabase: GoalHistoryClient,
  userId: string,
  dateKeys: string[],
): Promise<Record<string, GoalShape | null>> {
  const out: Record<string, GoalShape | null> = {};
  for (const k of dateKeys) out[k] = null;
  if (!userId || dateKeys.length === 0) return out;

  // Read the earliest dateKey's history + everything before it. The
  // row with the largest `effective_from` <= a given dateKey is the
  // effective one for that date.
  const earliest = dateKeys.slice().sort()[0];
  let data: Array<Record<string, unknown>> = [];
  try {
    const res = await supabase
      .from("goal_history")
      .select(
        "goal, plan_pace, activity_level, target_calories, target_protein_g, target_carbs_g, target_fat_g, target_fiber_g, maintenance_tdee, effective_from, recorded_at",
      )
      .eq("user_id", userId)
      .lte("effective_from", dateKeys.slice().sort().reverse()[0])
      .order("effective_from", { ascending: true })
      .order("recorded_at", { ascending: true });
    if (res?.error) return out;
    data = (res?.data as Array<Record<string, unknown>>) ?? [];
  } catch {
    return out;
  }
  if (data.length === 0) return out;

  // Sweep dates in ascending order, advancing the history pointer.
  const sortedDates = dateKeys.slice().sort();
  let ptr = 0;
  let current: Record<string, unknown> | null = null;
  for (const date of sortedDates) {
    while (ptr < data.length) {
      const eff = data[ptr]?.effective_from;
      if (typeof eff !== "string" || eff > date) break;
      current = data[ptr];
      ptr += 1;
    }
    if (current) {
      out[date] = {
        goal: typeof current.goal === "string" ? current.goal : null,
        plan_pace:
          typeof current.plan_pace === "string" ? current.plan_pace : null,
        activity_level:
          typeof current.activity_level === "string"
            ? current.activity_level
            : null,
        target_calories: toInt(current.target_calories),
        target_protein_g: toInt(current.target_protein_g),
        target_carbs_g: toInt(current.target_carbs_g),
        target_fat_g: toInt(current.target_fat_g),
        target_fiber_g: toInt(current.target_fiber_g),
        maintenance_tdee: toInt(current.maintenance_tdee),
      };
    }
  }
  // Reference `earliest` to keep the variable used (it documents the
  // scan-window lower bound even though the SQL filters by the upper
  // bound — the rows below `earliest` are still needed because the
  // sweep below `earliest` resolves to whatever row was effective
  // before the date range started).
  void earliest;

  return out;
}
