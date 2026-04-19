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

/**
 * Action 5 Item 3 (2026-04-19) — single-source label for the "Avg Calories"
 * tile on the Progress dashboard.
 *
 * Bug: the tile read "Avg Calories" with the headline number computed as
 * `sum / daysWithFood`. For a user who logged 2 of 7 days the headline
 * shows their two-day average but the label reads as if it's an
 * average-per-day-this-week — misleading on partial weeks.
 *
 * Fix: surface the denominator on partial weeks. Full-week → "Avg
 * Calories" (unchanged). Partial week → "Avg on logged days (X/7)" so
 * the user understands the headline is averaged across the days they
 * actually logged.
 *
 * Extracted as a pure helper so web (`ProgressDashboard.tsx`) and mobile
 * (`app/(tabs)/progress.tsx`) cannot drift in copy. Parity pinned by
 * `tests/unit/avgCaloriesLabel.test.ts`.
 */
export function formatAvgCaloriesLabel(daysWithFood: number): string {
  // Defensive clamp: `daysWithFood` is derived from a 7-day window so it
  // should already sit in [0, 7], but guard against future schema drift.
  const clamped = Math.max(0, Math.min(7, Math.trunc(daysWithFood)));
  if (clamped >= 7) return "Avg Calories";
  return `Avg on logged days (${clamped}/7)`;
}

/**
 * Action 13 Item #4 (2026-04-19) — single source of truth for the
 * Macro Adherence bar's fill % AND its label.
 *
 * Bug history: web (`ProgressDashboard.tsx`) rendered the raw
 * `adherencePct` straight into the bar width with no cap, while mobile
 * (`app/(tabs)/progress.tsx`) clamped to 150%. A user at 200% protein
 * saw a label-shaped bar on web and a clipped 150% bar on mobile —
 * pure parity drift.
 *
 * Decision (Action 13): cap **both** at 150%. The bar height visually
 * stops at 150%; the label preserves the actual figure with an
 * "(capped at 150)" suffix when over the cap so the user still sees
 * the real number.
 *
 * Behaviour matrix:
 *   - 0   → barFillPct = 0,   label = "0%"
 *   - 80  → barFillPct = 80,  label = "80%"
 *   - 100 → barFillPct = 100, label = "100%"
 *   - 175 → barFillPct = 150, label = "175% (capped at 150)"
 *   - 200 → barFillPct = 150, label = "200% (capped at 150)"
 *
 * Also defends against negative / non-finite input by clamping to
 * `[0, MACRO_ADHERENCE_BAR_CAP_PCT]`. Returns the rounded %s so the
 * UI never shows "99.999%".
 *
 * Pinned by `tests/unit/macroAdherenceBar.test.ts`.
 */
export const MACRO_ADHERENCE_BAR_CAP_PCT = 150;

export type MacroAdherenceBar = {
  /** Bar width as a 0-150 integer; clamped from `adherencePct`. */
  barFillPct: number;
  /** User-facing label. Includes the cap suffix when over the cap. */
  label: string;
};

export function formatMacroAdherenceBar(opts: {
  adherencePct: number | null | undefined;
}): MacroAdherenceBar {
  const raw = typeof opts.adherencePct === "number" && Number.isFinite(opts.adherencePct)
    ? opts.adherencePct
    : 0;
  const safe = Math.max(0, Math.round(raw));
  const barFillPct = Math.min(MACRO_ADHERENCE_BAR_CAP_PCT, safe);
  const label =
    safe > MACRO_ADHERENCE_BAR_CAP_PCT
      ? `${safe}% (capped at ${MACRO_ADHERENCE_BAR_CAP_PCT})`
      : `${safe}%`;
  return { barFillPct, label };
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
