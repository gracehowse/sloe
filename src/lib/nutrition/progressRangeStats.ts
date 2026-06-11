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

/* ------------------------------------------------------------------ *
 * ENG-1030 — Apple Health range grammar (D/W/M/6M/Y) + period paging *
 *                                                                    *
 * The Progress tab moved off the relative `rangeKey` model onto a    *
 * calendar-anchored period model (see `progressPeriod.ts`). The      *
 * period resolves to an inclusive `[startKey, endKey]` window, which *
 * these `*ForWindow` variants consume directly. The legacy `rangeKey`*
 * builders above are kept so their pinned tests stay green, but the  *
 * Progress consumers now call the window variants.                   *
 * ------------------------------------------------------------------ */

/** Inclusive local-calendar window: keys are zero-padded ISO "YYYY-MM-DD". */
export interface DateWindow {
  startKey: string;
  endKey: string;
}

/** Filter a `YYYY-MM-DD`-keyed map to an inclusive `[startKey, endKey]` window. */
function filterByWindow<T>(map: Record<string, T>, window: DateWindow): [string, T][] {
  const { startKey, endKey } = window;
  return Object.entries(map).filter(([k]) => k >= startKey && k <= endKey);
}

export function buildWeightRangeStatsForWindow(
  weightKgByDay: Record<string, number>,
  window: DateWindow,
): WeightRangeStats {
  const series = filterByWindow(weightKgByDay, window)
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

  // Within-window "trend" delta: earliest → latest across the whole window.
  // (The old `weekDeltaKg` was a fixed trailing-7-day slice that only made
  // sense for the open-ended relative ranges; with a bounded calendar window
  // the window-wide delta is the honest signal. Kept under the same field
  // name so the `WeightRangeStats` shape — and its consumers — are unchanged.)
  const weekDeltaKg = deltaKg;

  return { series, latestKg, deltaKg, weekDeltaKg };
}

export function buildCaloriesRangeStatsForWindow(
  byDay: ByDayForRangeStats,
  targetCalories: number | null,
  window: DateWindow,
): CaloriesRangeStats {
  const entries = filterByWindow(byDay, window);
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

/** Meal shape carrying the four macros + optional fibre, for range macro
 *  adherence. Both web `LoggedMeal` and mobile `JournalMeal` satisfy it
 *  (they expose `fiberG`); absent fields count as 0 — never fabricated. */
export interface RangeMacroMeal {
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
}

export interface MacroAdherenceRangeStats {
  /** Average adherence % over the range's logged days, per macro. */
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  fiberPct: number;
  /** Days with ≥1 logged meal in the range (the averaging denominator). */
  daysLogged: number;
}

/**
 * Sloe Figma 492:2 — range-scoped macro adherence for the AVERAGE
 * ADHERENCE card. Mirrors `buildCaloriesRangeStats` so the card's four
 * macro bars describe the SAME window as the headline calorie adherence
 * (coherent with the time-range toggle), not just the current week.
 *
 * Each macro % is `(avg over logged days / target) * 100`, rounded.
 * `0` when the target is missing / no logged days. Shared so web + mobile
 * read identical figures.
 */
export function buildMacroAdherenceRangeStats(
  byDay: Record<string, RangeMacroMeal[]>,
  targets: { protein: number; carbs: number; fat: number; fiber?: number },
  rangeKey: RangeKey,
  now: Date = new Date(),
): MacroAdherenceRangeStats {
  const entries = filterByRange(byDay, rangeKey, now);
  let pSum = 0;
  let cSum = 0;
  let fSum = 0;
  let fibSum = 0;
  let daysLogged = 0;
  for (const [, meals] of entries) {
    const arr = Array.isArray(meals) ? meals : [];
    if (arr.length === 0) continue;
    let p = 0;
    let c = 0;
    let f = 0;
    let fib = 0;
    for (const m of arr) {
      p += Math.max(0, Number.isFinite(m.protein) ? m.protein : 0);
      c += Math.max(0, Number.isFinite(m.carbs) ? m.carbs : 0);
      f += Math.max(0, Number.isFinite(m.fat) ? m.fat : 0);
      fib += Math.max(0, typeof m.fiberG === "number" && Number.isFinite(m.fiberG) ? m.fiberG : 0);
    }
    // A day counts toward the average when it carried any logged macro
    // (calories-only rows still count — `arr.length > 0` is the gate).
    pSum += p;
    cSum += c;
    fSum += f;
    fibSum += fib;
    daysLogged += 1;
  }
  const pct = (sum: number, target: number | undefined) =>
    target != null && target > 0 && daysLogged > 0
      ? Math.round((sum / daysLogged / target) * 100)
      : 0;
  return {
    proteinPct: pct(pSum, targets.protein),
    carbsPct: pct(cSum, targets.carbs),
    fatPct: pct(fSum, targets.fat),
    fiberPct: pct(fibSum, targets.fiber),
    daysLogged,
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

/**
 * ENG-1030 — window variant of {@link buildMacroAdherenceRangeStats}. Scopes
 * the four macro bars to the selected period's `[startKey, endKey]` window so
 * the AVERAGE ADHERENCE card describes the SAME span as the headline calorie
 * adherence.
 */
export function buildMacroAdherenceRangeStatsForWindow(
  byDay: Record<string, RangeMacroMeal[]>,
  targets: { protein: number; carbs: number; fat: number; fiber?: number },
  window: DateWindow,
): MacroAdherenceRangeStats {
  const entries = filterByWindow(byDay, window);
  let pSum = 0;
  let cSum = 0;
  let fSum = 0;
  let fibSum = 0;
  let daysLogged = 0;
  for (const [, meals] of entries) {
    const arr = Array.isArray(meals) ? meals : [];
    if (arr.length === 0) continue;
    let p = 0;
    let c = 0;
    let f = 0;
    let fib = 0;
    for (const m of arr) {
      p += Math.max(0, Number.isFinite(m.protein) ? m.protein : 0);
      c += Math.max(0, Number.isFinite(m.carbs) ? m.carbs : 0);
      f += Math.max(0, Number.isFinite(m.fat) ? m.fat : 0);
      fib += Math.max(0, typeof m.fiberG === "number" && Number.isFinite(m.fiberG) ? m.fiberG : 0);
    }
    pSum += p;
    cSum += c;
    fSum += f;
    fibSum += fib;
    daysLogged += 1;
  }
  const pct = (sum: number, target: number | undefined) =>
    target != null && target > 0 && daysLogged > 0
      ? Math.round((sum / daysLogged / target) * 100)
      : 0;
  return {
    proteinPct: pct(pSum, targets.protein),
    carbsPct: pct(cSum, targets.carbs),
    fatPct: pct(fSum, targets.fat),
    fiberPct: pct(fibSum, targets.fiber),
    daysLogged,
  };
}
