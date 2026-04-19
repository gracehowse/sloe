import { dateKeyFromDate } from "./trackerStats";

export type WeekDayTotals = {
  key: string;
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /**
   * F-2 (2026-04-19) — per-day target resolved against a snapshot when
   * one exists, else the current profile target. `isSnapshot` is `true`
   * only when a row from `daily_targets` was found for this day.
   *
   * Callers that render "% of goal" for a past day MUST divide by these
   * numbers rather than the top-level `targets` passed into
   * `buildWeekStats`. Otherwise a profile-level plan edit retroactively
   * moves every past-day percentage (the AEyOuUJrB4l bug).
   */
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  isSnapshot: boolean;
};

export type WeekStatsBundle = {
  days: WeekDayTotals[];
  avgCalories: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  proteinOnTarget: number;
  daysWithFood: number;
  proteinAdherence: number;
  carbsAdherence: number;
  fatAdherence: number;
};

/**
 * Minimal shape required for week-report math. Both web `LoggedMeal` and
 * mobile `JournalMeal` satisfy this, so callers on either platform can use
 * this module directly without duplication.
 */
export type MealMacros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type ByDayOf<M extends MealMacros> = Record<string, M[]>;

function sumDay<M extends MealMacros>(meals: M[]) {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + Math.max(0, m.calories),
      protein: acc.protein + Math.max(0, m.protein),
      carbs: acc.carbs + Math.max(0, m.carbs),
      fat: acc.fat + Math.max(0, m.fat),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/**
 * F-2 (2026-04-19) — optional per-day target overrides. When the UI has
 * fetched `daily_targets` snapshots, it passes them here so each day's
 * returned `target*` fields reflect the frozen value for that date.
 * When no snapshot exists for a day, we fall back to the top-level
 * `targets` (current profile value) with `isSnapshot = false`, and the
 * UI visually marks the percentage as approximate.
 */
export type DayTargetOverride = {
  targetCalories: number | null;
  targetProtein: number | null;
  targetCarbs: number | null;
  targetFat: number | null;
};

/** Current calendar week (based on profile week start) with per-day macro totals. */
export function buildWeekStats<M extends MealMacros>(
  byDay: ByDayOf<M>,
  targets: { calories: number; protein: number; carbs: number; fat: number },
  weekStartDay: "monday" | "sunday",
  now: Date = new Date(),
  targetsByDay?: Record<string, DayTargetOverride | null | undefined>,
): WeekStatsBundle {
  const days: WeekDayTotals[] = [];
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dow = now.getDay();
  const startOffset = weekStartDay === "monday" ? (dow === 0 ? -6 : 1 - dow) : -dow;
  const weekFirst = new Date(now);
  weekFirst.setDate(now.getDate() + startOffset);

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekFirst);
    d.setDate(weekFirst.getDate() + i);
    const key = dateKeyFromDate(d);
    const totals = sumDay<M>(byDay[key] ?? []);
    const snap = targetsByDay?.[key] ?? null;
    // A snapshot counts only when the row actually exists AND its
    // `target_calories` column is populated. A snapshot with a null
    // calorie field falls back to the current target — identical
    // behaviour to "no snapshot", so `isSnapshot = false`.
    const hasSnapshot = !!snap && snap.targetCalories != null;
    days.push({
      key,
      label: dayLabels[d.getDay()]!,
      ...totals,
      targetCalories: snap?.targetCalories ?? targets.calories,
      targetProtein: snap?.targetProtein ?? targets.protein,
      targetCarbs: snap?.targetCarbs ?? targets.carbs,
      targetFat: snap?.targetFat ?? targets.fat,
      isSnapshot: hasSnapshot,
    });
  }

  const daysWithFoodCount = days.filter((d) => d.calories > 0).length || 1;
  const avgCalories = Math.round(days.reduce((s, d) => s + d.calories, 0) / daysWithFoodCount);
  const avgProtein = Math.round(days.reduce((s, d) => s + d.protein, 0) / daysWithFoodCount);
  const avgCarbs = Math.round(days.reduce((s, d) => s + d.carbs, 0) / daysWithFoodCount);
  const avgFat = Math.round(days.reduce((s, d) => s + d.fat, 0) / daysWithFoodCount);

  // Guard against zero targets — otherwise adherence becomes Infinity and
  // `proteinOnTarget` becomes "every day with ≥0 protein" (i.e. all 7).
  const safePro = targets.protein > 0 ? targets.protein : 0;
  const safeCarb = targets.carbs > 0 ? targets.carbs : 0;
  const safeFat = targets.fat > 0 ? targets.fat : 0;
  // F-2 — use each day's own target when judging "on target". A past
  // day hit its snapshot goal, not the current one.
  const proteinOnTarget = safePro > 0
    ? days.filter((d) => {
        const dayTarget = d.targetProtein > 0 ? d.targetProtein : safePro;
        return d.protein >= dayTarget * 0.9;
      }).length
    : 0;
  const proteinAdherence = safePro > 0 && daysWithFoodCount > 0
    ? Math.round((avgProtein / safePro) * 100)
    : 0;
  const carbsAdherence = safeCarb > 0 && daysWithFoodCount > 0
    ? Math.round((avgCarbs / safeCarb) * 100)
    : 0;
  const fatAdherence = safeFat > 0 && daysWithFoodCount > 0
    ? Math.round((avgFat / safeFat) * 100)
    : 0;

  return {
    days,
    avgCalories,
    avgProtein,
    avgCarbs,
    avgFat,
    proteinOnTarget,
    daysWithFood: days.filter((d) => d.calories > 0).length,
    proteinAdherence,
    carbsAdherence,
    fatAdherence,
  };
}

/** Same rule as `computeLoggingStreak`: consecutive days ending today or yesterday with ≥1 meal. */
export function getStreakContributingDays<M extends MealMacros>(
  byDay: ByDayOf<M>,
  now: Date = new Date(),
): Array<{ key: string; mealCount: number; calories: number }> {
  const out: Array<{ key: string; mealCount: number; calories: number }> = [];
  const d = new Date(now);
  const todayKey = dateKeyFromDate(d);
  if ((byDay[todayKey] ?? []).length === 0) {
    d.setDate(d.getDate() - 1);
  }
  for (;;) {
    const key = dateKeyFromDate(d);
    const meals = byDay[key] ?? [];
    if (meals.length === 0) break;
    const calories = meals.reduce((s, m) => s + Math.max(0, m.calories), 0);
    out.push({ key, mealCount: meals.length, calories });
    d.setDate(d.getDate() - 1);
  }
  return out;
}
