/**
 * Targets view-model.
 *
 * 2026-04-20 prototype port (`docs/ux/claude-design-bundles/prototype/project/screens-web.jsx`
 * `WebTargets`). The dedicated Targets screen reads the profile
 * row once and composes:
 *
 *   - Daily calorie target (big number)
 *   - TDEE caption ("Estimated TDEE based on Mifflin-St Jeor ·
 *     moderate activity · 500 kcal deficit")
 *   - 2×2 macro tile grid (PROTEIN / CARBS / FAT / FIBER) with
 *     current / target and a remaining caption
 *   - Goal card ("Reach 72 kg · Currently 74.8 kg · could reach by
 *     ≈ 14 July · On track") with a status pill
 *
 * The view-model is a pure function so web + mobile can call it
 * from their respective platform screens with the same shape, and so
 * tests can pin the caption wording without having to reproduce UI
 * scaffolding.
 */

import { calcGoalTimeline } from "../weightProjection";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type Goal = "lose" | "maintain" | "gain" | string;

/**
 * Mapping from stored profile `activity_level` to the human caption
 * used in the Targets TDEE line. Keep in sync with the onboarding
 * strategy / profile dropdowns (`src/lib/nutrition/tdee.ts`).
 */
export function activityLevelCaption(level: ActivityLevel | string | null | undefined): string {
  switch (level) {
    case "sedentary":
      return "sedentary activity";
    case "light":
      return "light activity";
    case "active":
      return "active lifestyle";
    case "very_active":
      return "very active lifestyle";
    case "moderate":
    default:
      // Prototype default — used when the profile doesn't carry an
      // activity level yet (cold start / pre-onboarding). Matches the
      // spec caption word-for-word.
      return "moderate activity";
  }
}

/**
 * Caption fragment describing the deficit/surplus sitting on top of
 * the user's TDEE. For "lose" goals the prototype uses "500 kcal
 * deficit" — we keep the same numeric rounded by 50 so the caption
 * stays honest when a user has a custom pace (e.g. "300 kcal
 * deficit" for the Steady pace).
 */
export function deficitSurplusCaption(opts: {
  targetCalories: number | null | undefined;
  tdeeKcal: number | null | undefined;
  goal: Goal | null | undefined;
}): string | null {
  const { targetCalories, tdeeKcal, goal } = opts;
  if (
    typeof targetCalories !== "number" ||
    !Number.isFinite(targetCalories) ||
    typeof tdeeKcal !== "number" ||
    !Number.isFinite(tdeeKcal) ||
    tdeeKcal <= 0
  ) {
    return null;
  }
  const delta = targetCalories - tdeeKcal;
  // Round to nearest 50 so captions stop reading like TDEE math.
  const rounded = Math.round(delta / 50) * 50;
  if (Math.abs(rounded) < 50) return null;
  if (rounded < 0) return `${Math.abs(rounded)} kcal deficit`;
  if (goal === "gain") return `${rounded} kcal surplus`;
  return `${rounded} kcal surplus`;
}

export type MacroKey = "protein" | "carbs" | "fat" | "fiber";

export type MacroTileVM = {
  key: MacroKey;
  /** Uppercase label shown on the tile. */
  label: string;
  /** Current consumed grams today. */
  current: number;
  /** Daily target in grams. */
  target: number;
  /** Progress fraction [0, 1] — clamped. */
  pct: number;
  /**
   * Caption under the progress bar. Positive remaining reads
   * "{n}g remaining"; over-target reads "{n}g over".
   */
  remainingLabel: string;
};

function tile(label: string, key: MacroKey, current: number, target: number): MacroTileVM {
  const cur = Math.max(0, Math.round(current || 0));
  const tgt = Math.max(0, Math.round(target || 0));
  const pct = tgt > 0 ? Math.max(0, Math.min(1, cur / tgt)) : 0;
  const remaining = tgt - cur;
  const remainingLabel =
    remaining >= 0 ? `${remaining}g remaining` : `${Math.abs(remaining)}g over`;
  return { key, label, current: cur, target: tgt, pct, remainingLabel };
}

/**
 * Build the four macro tiles in prototype order. Callers pass
 * today's consumed totals (from `nutritionByDay[todayKey]` summed
 * or similar) and the daily targets.
 */
export function buildMacroTiles(opts: {
  targets: { protein: number; carbs: number; fat: number; fiber: number };
  consumed: { protein: number; carbs: number; fat: number; fiber: number };
}): readonly MacroTileVM[] {
  const { targets, consumed } = opts;
  return [
    tile("PROTEIN", "protein", consumed.protein, targets.protein),
    tile("CARBS", "carbs", consumed.carbs, targets.carbs),
    tile("FAT", "fat", consumed.fat, targets.fat),
    tile("FIBER", "fiber", consumed.fiber, targets.fiber),
  ] as const;
}

export type GoalStatus = "on_track" | "stalled" | "wrong_way" | "unknown";

export type GoalCardVM = {
  /** "Reach 72 kg" / null when no goal set. */
  title: string | null;
  /** "Currently 74.8 kg · could reach by ≈ 14 July" / null. */
  subtitle: string | null;
  /** "On track" / "Stalled" / "Off track". */
  statusLabel: string;
  status: GoalStatus;
};

/**
 * Format a Date as "14 July" (en-GB locale — month name long, no
 * comma). Matches the prototype caption shape.
 */
export function formatGoalDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

/**
 * Compose the Goal card. Reuses `calcGoalTimeline` from
 * `src/lib/weightProjection.ts` so the "could reach by" date stays
 * consistent with ProgressDashboard.
 */
export function buildGoalCard(opts: {
  currentWeightKg: number | null | undefined;
  goalWeightKg: number | null | undefined;
  weightKgByDay: Record<string, number>;
  /** `now()` injection for deterministic tests. */
  now?: Date;
}): GoalCardVM | null {
  const { currentWeightKg, goalWeightKg, weightKgByDay, now = new Date() } = opts;
  if (
    typeof goalWeightKg !== "number" ||
    !Number.isFinite(goalWeightKg) ||
    typeof currentWeightKg !== "number" ||
    !Number.isFinite(currentWeightKg)
  ) {
    return null;
  }

  const timeline = calcGoalTimeline({
    currentWeightKg,
    goalWeightKg,
    weightKgByDay,
  });

  // Round current weight to 1 decimal for display parity with
  // Progress / weight-tracker surfaces.
  const curDisplay = Math.round(currentWeightKg * 10) / 10;
  const goalDisplay = Math.round(goalWeightKg * 10) / 10;

  let dateFragment: string | null = null;
  if (typeof timeline.daysToGoal === "number" && timeline.daysToGoal > 0 && !timeline.cappedAtMaxDays) {
    const target = new Date(now.getTime() + timeline.daysToGoal * 86400000);
    dateFragment = `could reach by ≈ ${formatGoalDate(target)}`;
  } else if (timeline.cappedAtMaxDays) {
    dateFragment = "more than a year at current rate";
  }

  let status: GoalStatus;
  let statusLabel: string;
  const remaining = timeline.remainingKg;
  if (Math.abs(remaining) < 0.3) {
    status = "on_track";
    statusLabel = "At goal";
  } else if (timeline.trendDirection === "stalled") {
    status = "stalled";
    statusLabel = "Stalled";
  } else {
    const needsToLose = remaining > 0;
    const goingRightWay =
      (needsToLose && timeline.trendDirection === "losing") ||
      (!needsToLose && timeline.trendDirection === "gaining");
    if (goingRightWay) {
      status = "on_track";
      statusLabel = "On track";
    } else {
      status = "wrong_way";
      statusLabel = "Off track";
    }
  }

  const subtitle = dateFragment
    ? `Currently ${curDisplay} kg · ${dateFragment}`
    : `Currently ${curDisplay} kg`;

  return {
    title: `Reach ${goalDisplay} kg`,
    subtitle,
    statusLabel,
    status,
  };
}
