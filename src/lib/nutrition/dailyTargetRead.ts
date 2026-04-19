/**
 * F-2 · Daily target snapshot read helper.
 *
 * Pairs with `dailyTargetSnapshot.ts`. Given a list of date keys, returns
 * a map of `{ [dateKey]: DailyTarget | null }`. Null means "no snapshot
 * for that day" — callers are expected to fall back to the current
 * profile target and visually mark the percentage as approximate (see
 * Progress screens).
 *
 * The helper never fabricates a target. Pre-migration days always
 * return `null` — we deliberately do not reconstruct what the user's
 * target "probably was" on that day, because that's exactly the bug
 * this feature is fixing.
 */

export type DailyTarget = {
  dateKey: string;
  targetCalories: number | null;
  targetProteinG: number | null;
  targetCarbsG: number | null;
  targetFatG: number | null;
  targetFiberG: number | null;
  activityLevel: string | null;
  planPace: string | null;
  goal: string | null;
  maintenanceTdee: number | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DailyTargetReadClient = any;

/**
 * Fetch snapshots for a set of dates. The result map always contains
 * every requested `dateKey` — days without a snapshot map to `null`.
 *
 * The caller passes the dates it cares about (typically the 7 day keys
 * of the current week, or the last 90 days for trend charts). We do
 * NOT query the whole table — the index on `(user_id, date_key desc)`
 * makes `.in('date_key', [...])` cheap for any reasonable window.
 */
export async function getDailyTargets(
  supabase: DailyTargetReadClient,
  userId: string | null | undefined,
  dateKeys: string[],
): Promise<Record<string, DailyTarget | null>> {
  const out: Record<string, DailyTarget | null> = {};
  for (const k of dateKeys) out[k] = null;

  if (!userId || dateKeys.length === 0) return out;

  const { data, error } = await supabase
    .from("daily_targets")
    .select(
      "date_key, target_calories, target_protein_g, target_carbs_g, target_fat_g, target_fiber_g, activity_level, plan_pace, goal, maintenance_tdee",
    )
    .eq("user_id", userId)
    .in("date_key", dateKeys);

  if (error) {
    // Missing table (migration not applied yet) → log once and let
    // every key stay null. Every UI call site has a current-target
    // fallback chip so this renders gracefully.
    // eslint-disable-next-line no-console
    console.warn(
      "[dailyTargetRead] select failed (probably migration pending) — using fallback targets",
      error.message ?? "",
    );
    return out;
  }

  for (const row of data ?? []) {
    const dateKey = typeof row.date_key === "string" ? row.date_key : null;
    if (!dateKey) continue;
    out[dateKey] = {
      dateKey,
      targetCalories: toInt(row.target_calories),
      targetProteinG: toInt(row.target_protein_g),
      targetCarbsG: toInt(row.target_carbs_g),
      targetFatG: toInt(row.target_fat_g),
      targetFiberG: toInt(row.target_fiber_g),
      activityLevel: typeof row.activity_level === "string" ? row.activity_level : null,
      planPace: typeof row.plan_pace === "string" ? row.plan_pace : null,
      goal: typeof row.goal === "string" ? row.goal : null,
      maintenanceTdee: toInt(row.maintenance_tdee),
    };
  }

  return out;
}

/**
 * Given a snapshot (possibly null) and the user's *current* profile
 * target, pick the right value to display for a past day. The fallback
 * path is intentional — pre-migration days have no snapshot and we
 * show the current target flagged as approximate rather than hiding
 * the bar entirely.
 */
export function resolveDisplayTarget(
  snapshot: DailyTarget | null,
  currentTargets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiberG?: number;
  },
): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  isSnapshot: boolean;
} {
  if (!snapshot) {
    return {
      calories: currentTargets.calories,
      protein: currentTargets.protein,
      carbs: currentTargets.carbs,
      fat: currentTargets.fat,
      fiberG: currentTargets.fiberG ?? 0,
      isSnapshot: false,
    };
  }
  return {
    calories: snapshot.targetCalories ?? currentTargets.calories,
    protein: snapshot.targetProteinG ?? currentTargets.protein,
    carbs: snapshot.targetCarbsG ?? currentTargets.carbs,
    fat: snapshot.targetFatG ?? currentTargets.fat,
    fiberG: snapshot.targetFiberG ?? currentTargets.fiberG ?? 0,
    isSnapshot: true,
  };
}

function toInt(raw: unknown): number | null {
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}
