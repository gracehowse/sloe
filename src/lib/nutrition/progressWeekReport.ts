import { dateKeyFromDate } from "./trackerStats";
import { computeActivityBonusKcal } from "./activityBonus";

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
  /**
   * ENG-787 (2026-05-30) — the calorie budget a day was actually judged
   * against: `targetCalories` + that day's earned activity bonus (when
   * `prefer_activity_adjusted_calories` is on). When no `activity` bundle
   * is passed to `buildWeekStats`, this equals `targetCalories` exactly,
   * so existing callers see no change.
   *
   * The Daily Calories chart MUST colour a bar over/under against THIS
   * value, not `targetCalories`. Otherwise a day where the user ate into
   * an earned activity bonus reads as "over budget" when it wasn't — the
   * exact bug Grace reported ("hasn't taken into account the fact i
   * earned bonus cals these days").
   */
  effectiveTargetCalories: number;
  isSnapshot: boolean;
};

/**
 * ENG-787 (2026-05-30) — optional per-day activity inputs so the week
 * report can resolve each day's *effective* calorie target (base + earned
 * activity bonus). Mirrors the per-day budget add-on that Today already
 * applies (`dayActivityBudgetAddon` mobile / `dayActivityBudgetAddonWeb`),
 * so the Progress chart reconciles exactly with the Today ring.
 *
 * All maps are keyed by `YYYY-MM-DD`. When `prefer` is false the bonus is
 * always 0 and `effectiveTargetCalories` collapses to `targetCalories`.
 */
export type WeekActivityAdjustment = {
  /** Profile flag `prefer_activity_adjusted_calories`. */
  prefer: boolean;
  /** Resting (basal) kcal burned, per day key. */
  restingByDay: Record<string, number | undefined>;
  /** Active kcal burned, per day key. */
  activeByDay: Record<string, number | undefined>;
  /** Logged workout kcal, per day key — fallback when no resting data. */
  workoutKcalByDay?: Record<string, number | undefined>;
  /** Per-day maintenance TDEE (from the `daily_targets` snapshot). */
  maintenanceByDay?: Record<string, number | undefined>;
  /** Maintenance to use on days without a snapshot value. */
  maintenanceFallback: number;
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
  activity?: WeekActivityAdjustment,
): WeekStatsBundle {
  const days: WeekDayTotals[] = [];
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dow = now.getDay();
  const startOffset = weekStartDay === "monday" ? (dow === 0 ? -6 : 1 - dow) : -dow;
  const weekFirst = new Date(now);
  weekFirst.setDate(now.getDate() + startOffset);
  const todayDateKey = dateKeyFromDate(now);

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
    const targetCalories = snap?.targetCalories ?? targets.calories;
    // ENG-787 — add the day's earned activity bonus to get the budget the
    // day was actually judged against. `computeActivityBonusKcal` returns
    // 0 when `prefer` is off or there was no active burn, so this collapses
    // to `targetCalories` whenever no `activity` bundle is supplied.
    const activityBonus = activity
      ? computeActivityBonusKcal({
          prefer: activity.prefer,
          dateKey: key,
          todayDateKey,
          restingKcal: activity.restingByDay[key] ?? 0,
          activeKcal: activity.activeByDay[key] ?? 0,
          maintenanceKcal: activity.maintenanceByDay?.[key] ?? activity.maintenanceFallback,
          workoutKcal: activity.workoutKcalByDay?.[key] ?? 0,
          now,
        })
      : 0;
    days.push({
      key,
      label: dayLabels[d.getDay()]!,
      ...totals,
      targetCalories,
      targetProtein: snap?.targetProtein ?? targets.protein,
      targetCarbs: snap?.targetCarbs ?? targets.carbs,
      targetFat: snap?.targetFat ?? targets.fat,
      effectiveTargetCalories: targetCalories + activityBonus,
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
 * F-117 v2 (Grace, 2026-05-07): "remove capped at 150 it ruins the
 * visual. needs to be clear that youre over with the bar." Drops the
 * "(capped at N)" suffix entirely and emits an `isOver` flag so the
 * UI can render a clear over-budget visual (destructive-coloured % +
 * full-track fill) instead of a parenthetical disclosure that fights
 * with the bar's pink fill.
 *
 * Behaviour matrix:
 *   - 0   → barFillPct = 0,   label = "0%",   isOver = false
 *   - 80  → barFillPct = 80,  label = "80%",  isOver = false
 *   - 100 → barFillPct = 100, label = "100%", isOver = false
 *   - 175 → barFillPct = 100, label = "175%", isOver = true
 *   - 200 → barFillPct = 100, label = "200%", isOver = true
 *
 * Bar fill is now clamped to 100 — the full track fill + the
 * destructive % text together communicate "over budget". Renderers
 * MUST flip the % colour to destructive (red) when `isOver`.
 *
 * Pinned by `tests/unit/macroAdherenceBar.test.ts`.
 */
export const MACRO_ADHERENCE_BAR_CAP_PCT = 150;

export type MacroAdherenceBar = {
  /** Bar width as a 0-100 integer (clamped). */
  barFillPct: number;
  /** User-facing label, e.g. "187%". No parenthetical disclosure. */
  label: string;
  /** True when adherencePct exceeds 100 — renderer should flip colour. */
  isOver: boolean;
};

export function formatMacroAdherenceBar(opts: {
  adherencePct: number | null | undefined;
}): MacroAdherenceBar {
  const raw = typeof opts.adherencePct === "number" && Number.isFinite(opts.adherencePct)
    ? opts.adherencePct
    : 0;
  const safe = Math.max(0, Math.round(raw));
  const barFillPct = Math.min(100, safe);
  return { barFillPct, label: `${safe}%`, isOver: safe > 100 };
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
