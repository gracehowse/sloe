/**
 * milestone30Day — gating + content build for the 30-day logging
 * milestone moment.
 *
 * Lifesum + MacroFactor light up at 30 / 90 days; Suppr was silent.
 * This module owns the "you've been here 30 days, here's your story"
 * surface — a single trust moment, no paywall, no upsell, fires once
 * per user and never again.
 *
 * Counting rule: **30 distinct days with ≥1 logged meal**, not 30
 * consecutive days. A single missed day must not cost the badge — the
 * point is to celebrate sustained engagement, not punish a slip. This
 * is the explicit decision in the audit spec.
 *
 * Pure module — no React, no I/O. Mobile re-exports from
 * `apps/mobile/lib/milestone30Day.ts`.
 */

import type { LoggedMeal } from "../../types/recipe";
import { computeLoggingStreak } from "./trackerStats";

/** Distinct days threshold to fire the moment. Pinned by tests. */
export const MILESTONE_30_DAY_THRESHOLD = 30;

/** Maximum number of "top foods" to surface in the modal. */
export const MILESTONE_TOP_FOODS_COUNT = 3;

export type Milestone30DayGateInput = {
  /** Map of YYYY-MM-DD → list of logged meals on that day. */
  nutritionByDay: Record<string, LoggedMeal[]>;
  /** ISO timestamp the milestone was previously shown. `null` = never
   *  shown. Once set, the gate refuses to fire again. */
  shownAt: string | null;
};

/**
 * Decide whether to show the 30-day milestone modal.
 *
 * Returns `false` when:
 *   - the user has already seen it (`shownAt` is non-null), OR
 *   - the user has fewer than 30 distinct logged days.
 */
export function shouldShowMilestone30Day(
  input: Milestone30DayGateInput,
): boolean {
  if (input.shownAt) return false;
  const distinctLoggedDays = countDistinctLoggedDays(input.nutritionByDay);
  return distinctLoggedDays >= MILESTONE_30_DAY_THRESHOLD;
}

/**
 * Count distinct days with ≥1 logged meal. Days with only an empty
 * array (or only zero-calorie placeholder rows) don't count — the
 * point is sustained logging activity, not just calendar presence.
 */
export function countDistinctLoggedDays(
  nutritionByDay: Record<string, LoggedMeal[]>,
): number {
  let count = 0;
  for (const meals of Object.values(nutritionByDay)) {
    if (!Array.isArray(meals)) continue;
    if (meals.length === 0) continue;
    // A day "counts" if at least one row has positive calories.
    // This filters out null-row artefacts from older imports while
    // still being generous (zero-cal beverages still count if logged
    // alongside food).
    const hasFood = meals.some((m) => Math.max(0, m.calories) > 0);
    if (hasFood) count++;
  }
  return count;
}

export type Milestone30DayContentInput = {
  nutritionByDay: Record<string, LoggedMeal[]>;
  /** Map of YYYY-MM-DD → weight kg, for the total weight delta line.
   *  Pass `{}` when the user has no weigh-ins on file — the line is
   *  suppressed rather than rendered as "+0.0 kg". */
  weightKgByDay: Record<string, number>;
  now?: Date;
};

export type Milestone30DayContent = {
  /** "30 days of logging" — the headline that anchors the surface. */
  headline: string;
  /** Number of distinct days logged at the moment of the snapshot.
   *  Always ≥ 30 for callers that pass the gate; tests cover the
   *  "exactly 30" boundary. */
  daysLogged: number;
  /** Average daily kcal across days-with-food (over the lifetime
   *  window passed in — caller controls the window via the byDay
   *  shape). Rounded to nearest integer. */
  avgDailyKcal: number;
  /** Top N most-logged food names (`recipeTitle`). Tied counts
   *  break alphabetically so the surface is deterministic across
   *  re-mounts. Empty array allowed when the user logged generic /
   *  unnamed entries only. */
  topFoods: { name: string; count: number }[];
  /** Longest consecutive logging streak ever achieved in the byDay
   *  window. Distinct from "current streak" — this is the all-time
   *  high. */
  longestStreak: number;
  /** Total weight delta in kg, rounded to 0.1, from the *first*
   *  weigh-in to the *last* weigh-in inside the window. `null`
   *  when fewer than 2 weigh-ins on file. */
  totalWeightDeltaKg: number | null;
};

/**
 * Build the milestone modal content. Caller is responsible for:
 *   - running `shouldShowMilestone30Day` first,
 *   - persisting `milestone_30_shown_at` after the modal renders.
 */
export function buildMilestone30DayContent(
  input: Milestone30DayContentInput,
): Milestone30DayContent {
  const { nutritionByDay, weightKgByDay } = input;
  const daysLogged = countDistinctLoggedDays(nutritionByDay);

  // Average daily kcal across days-with-food only. Empty days are
  // excluded from the denominator so the figure reflects real
  // intake on logged days, not a calendar average.
  let totalKcal = 0;
  let dayCountWithFood = 0;
  for (const meals of Object.values(nutritionByDay)) {
    if (!Array.isArray(meals) || meals.length === 0) continue;
    const dayKcal = meals.reduce((acc, m) => acc + Math.max(0, m.calories), 0);
    if (dayKcal <= 0) continue;
    totalKcal += dayKcal;
    dayCountWithFood++;
  }
  const avgDailyKcal = dayCountWithFood > 0 ? Math.round(totalKcal / dayCountWithFood) : 0;

  // Top foods by raw log count of `recipeTitle`. Empty / unknown
  // titles fall through to `name`; if both are missing the row is
  // skipped (we don't want to crown an unnamed entry).
  const counts = new Map<string, number>();
  for (const meals of Object.values(nutritionByDay)) {
    if (!Array.isArray(meals)) continue;
    for (const m of meals) {
      const title = (m.recipeTitle || m.name || "").trim();
      if (!title) continue;
      counts.set(title, (counts.get(title) ?? 0) + 1);
    }
  }
  const topFoods = Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, MILESTONE_TOP_FOODS_COUNT)
    .map(([name, count]) => ({ name, count }));

  // Longest streak — scan the sorted day keys looking for the
  // largest consecutive run of days with food. We do NOT use
  // `computeLoggingStreak` here because that returns the *current*
  // streak ending today/yesterday; the milestone wants the all-time
  // high.
  const longestStreak = computeLongestStreak(nutritionByDay);

  // Total weight delta — first vs last weigh-in. Null when fewer
  // than 2 weigh-ins (we never fabricate "+0.0 kg").
  const totalWeightDeltaKg = computeFirstToLastWeightDelta(weightKgByDay);

  return {
    headline: "30 days of logging",
    daysLogged,
    avgDailyKcal,
    topFoods,
    longestStreak,
    totalWeightDeltaKg,
  };
}

function computeLongestStreak(
  nutritionByDay: Record<string, LoggedMeal[]>,
): number {
  const sortedKeys = Object.keys(nutritionByDay).sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of sortedKeys) {
    const meals = nutritionByDay[key];
    if (!Array.isArray(meals) || meals.length === 0) continue;
    const hasFood = meals.some((m) => Math.max(0, m.calories) > 0);
    if (!hasFood) {
      run = 0;
      prev = null;
      continue;
    }
    const cur = parseDateKey(key);
    if (prev != null) {
      const dayDelta = Math.round((cur.getTime() - prev.getTime()) / 86400_000);
      if (dayDelta === 1) {
        run += 1;
      } else {
        run = 1;
      }
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = cur;
  }
  return longest;
}

function parseDateKey(key: string): Date {
  // YYYY-MM-DD — anchor at noon UTC to avoid timezone DST seam edge
  // cases when computing day deltas.
  const [y, m, d] = key.split("-").map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
}

function computeFirstToLastWeightDelta(
  weightKgByDay: Record<string, number>,
): number | null {
  const entries = Object.entries(weightKgByDay)
    .filter(([, v]) => typeof v === "number" && Number.isFinite(v) && v > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length < 2) return null;
  const first = entries[0][1];
  const last = entries[entries.length - 1][1];
  return Math.round((last - first) * 10) / 10;
}
