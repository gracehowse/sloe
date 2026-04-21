/**
 * Range-window stats for the Progress dashboard cards — 2026-04-20
 * prototype port (Phase 2 WEIGHT + Calories cards).
 *
 * Shared helper so the mobile (`apps/mobile/app/(tabs)/progress.tsx`)
 * and web (`src/app/components/ProgressDashboard.tsx`) versions of the
 * cards compute identical numbers. The range picker above the cards
 * feeds the `rangeKey` argument: `7d | 30d | 90d | all`.
 *
 * Every return value is honest about its data — zero-length inputs
 * return `null` avg + `[]` series rather than inventing a zero.
 *
 * Unit-tested via `tests/unit/progressRangeStats.test.ts`.
 */

/** Minimal shape — enough to sum calories per day without coupling to
 *  the mobile vs web `LoggedMeal` type (they carry different optional
 *  fields but both guarantee a numeric `calories`). */
export interface RangeStatsMeal {
  calories: number;
}
export type ByDayForRangeStats = Record<string, RangeStatsMeal[]>;

export type RangeKey = "7d" | "30d" | "90d" | "all";

export interface WeightRangeStats {
  /** Ordered oldest-first `{ dateKey, kg }` within the range. */
  series: { dateKey: string; kg: number }[];
  /** Latest weight in the range (kg). Null if empty. */
  latestKg: number | null;
  /** Signed delta latest − earliest (kg). Null if < 2 points. */
  deltaKg: number | null;
  /** 7-day rolling change for the most-recent 7 days within the range (kg). */
  weekDeltaKg: number | null;
}

export interface CaloriesRangeStats {
  /** Ordered oldest-first `{ dateKey, calories }` within the range (all food days). */
  series: { dateKey: string; calories: number }[];
  /** Average per-day kcal across days with logged food. Null if empty. */
  avgCaloriesPerDay: number | null;
  /** Number of days in the range that had at least one logged meal. */
  daysLogged: number;
  /** Signed delta avg − target, e.g. `-294`. Null if no target. */
  deltaVsTargetKcal: number | null;
  /** `avg / target` as a whole integer percent. Null if no target or zero avg. */
  adherencePct: number | null;
}

/** ISO "YYYY-MM-DD" for a Date in local time. */
function keyFor(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rangeCutoffKey(rangeKey: RangeKey, now: Date = new Date()): string | null {
  if (rangeKey === "all") return null;
  const days = rangeKey === "7d" ? 7 : rangeKey === "30d" ? 30 : 90;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return keyFor(d);
}

/**
 * Filter the entries of a map keyed by `YYYY-MM-DD` to a time window.
 * `all` returns every entry. Sort order is applied by the caller.
 */
function filterByRange<T>(
  map: Record<string, T>,
  rangeKey: RangeKey,
  now: Date = new Date(),
): [string, T][] {
  const cutoff = rangeCutoffKey(rangeKey, now);
  const entries = Object.entries(map);
  if (cutoff == null) return entries;
  return entries.filter(([k]) => k >= cutoff);
}

export function buildWeightRangeStats(
  weightKgByDay: Record<string, number>,
  rangeKey: RangeKey,
  now: Date = new Date(),
): WeightRangeStats {
  const series = filterByRange(weightKgByDay, rangeKey, now)
    .filter(([, v]) => Number.isFinite(v))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, kg]) => ({ dateKey, kg: Math.round(kg * 10) / 10 }));

  if (series.length === 0) {
    return { series, latestKg: null, deltaKg: null, weekDeltaKg: null };
  }
  const latestKg = series[series.length - 1].kg;
  const deltaKg =
    series.length >= 2
      ? Math.round((series[series.length - 1].kg - series[0].kg) * 10) / 10
      : null;

  // Week delta — earliest weight from the most-recent 7 days within
  // the filtered range. When the range itself is < 7 days, this is
  // equivalent to deltaKg.
  const weekCutoff = new Date(now);
  weekCutoff.setHours(0, 0, 0, 0);
  weekCutoff.setDate(weekCutoff.getDate() - 6);
  const weekCutoffStr = keyFor(weekCutoff);
  const weekPoints = series.filter((p) => p.dateKey >= weekCutoffStr);
  const weekDeltaKg =
    weekPoints.length >= 2
      ? Math.round((weekPoints[weekPoints.length - 1].kg - weekPoints[0].kg) * 10) / 10
      : null;

  return { series, latestKg, deltaKg, weekDeltaKg };
}

export function buildCaloriesRangeStats(
  byDay: ByDayForRangeStats,
  targetCalories: number | null,
  rangeKey: RangeKey,
  now: Date = new Date(),
): CaloriesRangeStats {
  const entries = filterByRange(byDay, rangeKey, now);
  const daySums: { dateKey: string; calories: number }[] = [];
  for (const [dateKey, meals] of entries) {
    const arr = Array.isArray(meals) ? meals : [];
    if (arr.length === 0) continue;
    const kcal = arr.reduce(
      (s, m) => s + Math.max(0, Number.isFinite(m.calories) ? m.calories : 0),
      0,
    );
    if (kcal > 0) daySums.push({ dateKey, calories: Math.round(kcal) });
  }
  daySums.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  const daysLogged = daySums.length;
  const avgCaloriesPerDay =
    daysLogged > 0
      ? Math.round(daySums.reduce((s, p) => s + p.calories, 0) / daysLogged)
      : null;

  let deltaVsTargetKcal: number | null = null;
  let adherencePct: number | null = null;
  if (avgCaloriesPerDay != null && targetCalories != null && targetCalories > 0) {
    deltaVsTargetKcal = avgCaloriesPerDay - targetCalories;
    adherencePct = Math.round((avgCaloriesPerDay / targetCalories) * 100);
  }

  return {
    series: daySums,
    avgCaloriesPerDay,
    daysLogged,
    deltaVsTargetKcal,
    adherencePct,
  };
}

/**
 * Localised label for the range, matching the header overline used by
 * `ProgressDashboard` + mobile progress screen.
 */
export function rangeLabel(rangeKey: RangeKey): string {
  return rangeKey === "7d"
    ? "LAST 7 DAYS"
    : rangeKey === "30d"
      ? "LAST 30 DAYS"
      : rangeKey === "90d"
        ? "LAST 90 DAYS"
        : "ALL TIME";
}
