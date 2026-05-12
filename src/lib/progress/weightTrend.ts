/**
 * Weight trend computation — shared by WeightChart and the stat tile.
 * Pure functions; no React, no platform APIs.
 *
 * Web parity: this file lives under apps/mobile/lib/progress/ but its
 * logic is re-exported from src/lib/progress/weightTrend.ts so the web
 * WeightTracker can use the same domain/MA/since-label calculations.
 *
 * 2026-05-06 rewrite — TestFlight feedback that the chart is hard to
 * read once the range covers >3 months (every raw weigh-in renders, no
 * smoothing, dots smudge). Adopts MFP-style bucket aggregation:
 *   - 1W / 1M  → daily points (one weigh-in per day)
 *   - 3M       → weekly bucket (Mon-anchored mean)
 *   - 1Y / All → monthly bucket (calendar-month mean)
 * The MA is also calendar-day-aware now (was index-based, so a sparse
 * weigh-in cadence made a "7-day MA" span 7+ weeks).
 */

export type WeightRange = "1w" | "1m" | "3m" | "1y" | "all";

export type WeightPoint = {
  dateISO: string;
  kg: number;
  source?: "healthkit" | "manual" | "unknown";
};

export type WeightTrendResult = {
  /**
   * Points within the selected range, sorted oldest→newest.
   *
   * 2026-05-06: now bucketed for ranges where raw daily renders smudge
   * (3M = weekly mean, 1Y / All = monthly mean). Each bucketed point's
   * `dateISO` is the bucket anchor (start-of-week / start-of-month);
   * `kg` is the unweighted mean of weigh-ins in that bucket.
   */
  points: WeightPoint[];
  /**
   * Calendar-day moving average aligned to `points`. Window length is
   * 7 days for 1W / 1M / 3M, 28 days for 1Y / All. Null when the
   * trailing window has < 3 entries.
   */
  movingAvg: (number | null)[];
  /** Y-axis domain: [yMin, yMax]. Always spans at least 0.8 kg (data + 0.4 kg padding each side). */
  yDomain: [number, number];
  /** "Down 0.4 kg" / "Up 0.3 kg" / "Holding steady" */
  trendCopy: string;
  /** True when MA endpoint > MA start (trending away from lower goal) or vice versa. */
  trendDirection: "improving" | "worsening" | "neutral";
  /**
   * 2026-05-11 (Grace TF feedback — Withings-style chart header).
   * Signed delta in kg between the first and last MA endpoints over
   * the selected range. Negative = down, positive = up. Null when
   * there aren't enough points for a moving average (matches the
   * "Not enough data yet" branch of `trendCopy`).
   */
  trendDeltaKg: number | null;
  /**
   * Discrete status the header renders. `stable` mirrors the
   * `|delta| < 0.2` threshold used by `trendCopy`. Independent of
   * `trendDirection` (which is improving/worsening relative to a goal).
   */
  trendStatus: "stable" | "down" | "up" | "no_data";
  /** "Last 7 days" / "Last 30 days" / "Last 3 months" / "Since 12 Jan" */
  sinceLabel: string;
  /**
   * 2026-05-11: real start-end date label like "12 Apr – 6 May 2026"
   * for the chart header (Withings parity). Null when there are no
   * points. Distinct from `sinceLabel` which is fuzzy ("Last 30 days").
   */
  periodRangeLabel: string | null;
  /** Days since the most recent weigh-in. Null if no data. */
  daysSinceLatest: number | null;
  /**
   * 2026-05-06: which bucketing strategy was applied.
   * `daily` → one point per day, raw dots safe to render.
   * `weekly` / `monthly` → bucketed mean, raw dots should be hidden
   * because each point is an aggregate, not an individual weigh-in.
   */
  bucket: "daily" | "weekly" | "monthly";
};

const RANGE_DAYS: Record<WeightRange, number> = {
  "1w": 7,
  "1m": 30,
  "3m": 90,
  "1y": 365,
  all: Infinity,
};

const RANGE_LABELS: Record<WeightRange, string> = {
  "1w": "Last 7 days",
  "1m": "Last 30 days",
  "3m": "Last 3 months",
  "1y": "Last 12 months",
  all: "",
};

/** Bucketing strategy per range — matches MFP's behaviour for similar UX. */
function bucketFor(range: WeightRange): "daily" | "weekly" | "monthly" {
  if (range === "1w" || range === "1m") return "daily";
  if (range === "3m") return "weekly";
  return "monthly";
}

/** MA window in calendar days. Wider on long ranges so it actually smooths. */
function maWindowDaysFor(range: WeightRange): number {
  if (range === "1y" || range === "all") return 28;
  return 7;
}

function isoToDate(iso: string): Date {
  // Treat as local noon to avoid timezone-day-shift issues
  return new Date(iso + "T12:00:00");
}

function dateKeyFromISO(iso: string): string {
  return iso.slice(0, 10);
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Calendar-day-aware moving average — for each point, average all
 * points whose date falls within the trailing `windowDays` calendar
 * days of the current point's date (inclusive of both ends). Returns
 * null when fewer than 3 points fall in the window.
 *
 * 2026-05-06: previously index-based — `points.slice(i-6, i+1)` —
 * which silently broke under sparse weigh-ins (1/wk → "7-day MA"
 * spanned 7 weeks).
 */
function computeMovingAvg(
  points: WeightPoint[],
  windowDays: number,
): (number | null)[] {
  return points.map((p, i) => {
    const cutoff = isoToDate(p.dateISO).getTime() - (windowDays - 1) * 86400000;
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0; j--) {
      if (isoToDate(points[j]!.dateISO).getTime() < cutoff) break;
      sum += points[j]!.kg;
      n++;
    }
    if (n < 3) return null;
    return Math.round((sum / n) * 100) / 100;
  });
}

/**
 * 2026-05-06: iterative min/max — `Math.min(...allValues)` rest-spread
 * has a stack-overflow risk on long histories (~10k+ entries) and is
 * generally slower than a single pass.
 */
function minMax(values: number[]): [number, number] {
  let mn = Infinity;
  let mx = -Infinity;
  for (const v of values) {
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  if (!Number.isFinite(mn) || !Number.isFinite(mx)) return [0, 0];
  return [mn, mx];
}

/**
 * Compute the Y domain: [min(data,goal) - padding, max(data,goal) +
 * padding] where padding = max(0.8, 8% of range). Never includes 0.
 *
 * F-133 (`AFlB4oMfwQGIFx-w0DxOofE`, 2026-05-08): Grace's "graph is
 * broken" — when goal is far from the data (e.g. current 54.6 kg,
 * goal 50 kg with a 1-month range that's only ±1 kg of data), the
 * goal-inclusion stretches the y-axis so the data line collapses to
 * a thin sliver near the top of the plot. Now the goal is included
 * only when it's within a reasonable distance of the data envelope
 * (max(2 kg, 50% of data range) on either side). Beyond that, the
 * data uses the full plot height and the WeightChart renders an
 * off-chart "Goal X.X kg ↓" chip at the appropriate edge so the
 * goal stays visible in spirit if not in the plot.
 */
function computeYDomain(
  points: WeightPoint[],
  goalKg: number | null,
): [number, number] {
  const kgs = points.map((p) => p.kg);
  const [dataMin, dataMax] = minMax(kgs);
  const dataRange = dataMax - dataMin;
  const goalThreshold = Math.max(2, dataRange * 0.5);
  const includeGoal =
    goalKg != null &&
    goalKg >= dataMin - goalThreshold &&
    goalKg <= dataMax + goalThreshold;
  const allValues = includeGoal && goalKg != null ? [...kgs, goalKg] : kgs;
  const [rawMin, rawMax] = minMax(allValues);
  const rawRange = rawMax - rawMin;
  // 2026-05-11 (Grace TF feedback — "looking squished on phone"):
  // padding minimum dropped 0.8→0.4 kg per side. With a ~1.3 kg data
  // range the chart was wasting ~46% of vertical space; now the data
  // fills ~75%. The 0.4 minimum still keeps a tiny 0.2 kg daily
  // fluctuation from looking like a vertical spike.
  const padding = Math.max(0.4, rawRange * 0.08);
  return [
    Math.round((rawMin - padding) * 10) / 10,
    Math.round((rawMax + padding) * 10) / 10,
  ];
}

function computeTrendCopy(
  movingAvg: (number | null)[],
  points: WeightPoint[],
  goalKg: number | null,
): {
  copy: string;
  direction: "improving" | "worsening" | "neutral";
  deltaKg: number | null;
  status: "stable" | "down" | "up" | "no_data";
} {
  // 2026-05-11 (Grace TF feedback — "only show no data where there is
  // none at all"): prefer the MA-based trend (smoother, less noisy)
  // but fall back to a raw first-vs-last point delta when MA can't
  // compute (sparse weigh-ins / short window with <3 points in the
  // trailing MA window). Previously the chart rendered raw dots while
  // the header said "No data" — a contradiction the user could see.
  const validMA = movingAvg.filter((v): v is number => v !== null);
  let first: number | undefined;
  let last: number | undefined;
  if (validMA.length >= 2) {
    first = validMA[0];
    last = validMA[validMA.length - 1];
  } else if (points.length >= 2) {
    first = points[0]!.kg;
    last = points[points.length - 1]!.kg;
  }

  if (first === undefined || last === undefined) {
    // Truly nothing to summarise. Still keep `stable` (not `no_data`)
    // when there's a SINGLE entry — the user has logged once and is
    // staring at one dot; calling that "no data" reads wrong.
    if (points.length === 1) {
      return { copy: "First entry — keep going.", direction: "neutral", deltaKg: null, status: "stable" };
    }
    return { copy: "Not enough data yet.", direction: "neutral", deltaKg: null, status: "no_data" };
  }

  const delta = last - first;
  const absDelta = Math.abs(delta);

  if (absDelta < 0.2) {
    return { copy: "Holding steady.", direction: "neutral", deltaKg: delta, status: "stable" };
  }

  const sign = delta < 0 ? "Down" : "Up";
  const copy = `${sign} ${absDelta.toFixed(1)} kg on average.`;

  let direction: "improving" | "worsening" | "neutral" = "neutral";
  if (goalKg != null) {
    const goalIsLower = goalKg < last;
    direction = (goalIsLower && delta < 0) || (!goalIsLower && delta > 0) ? "improving" : "worsening";
  }

  return { copy, direction, deltaKg: delta, status: delta < 0 ? "down" : "up" };
}

function computeSinceLabel(points: WeightPoint[], range: WeightRange): string {
  if (range !== "all") return RANGE_LABELS[range];
  if (points.length === 0) return "All time";
  const earliest = isoToDate(points[0]!.dateISO);
  return `Since ${formatShortDate(earliest)}`;
}

/**
 * 2026-05-11 (Grace TF feedback — Withings parity): real start-end
 * date label like "12 Apr – 6 May 2026". Replaces the fuzzy "Last 30
 * days" string for the chart-card header so it matches the x-axis
 * tick labels and what Withings shows above their chart.
 *
 * Format rules:
 *   - daily / weekly buckets    → "12 Apr – 6 May 2026" (day + month, year on end-side)
 *   - monthly bucket (1Y/All)   → "May 2025 – May 2026" (month + year only) so the
 *                                 label doesn't overflow on long spans
 *   - identical-year spans      → drop the year on the start side
 *   - empty                     → null (callers should hide the slot)
 */
function computePeriodRangeLabel(
  points: WeightPoint[],
  bucket: "daily" | "weekly" | "monthly",
): string | null {
  if (points.length === 0) return null;
  const startISO = points[0]!.dateISO;
  const endISO = points[points.length - 1]!.dateISO;
  const startD = isoToDate(startISO);
  const endD = isoToDate(endISO);
  const startYear = startD.getFullYear();
  const endYear = endD.getFullYear();
  const sameYear = startYear === endYear;
  const fmtDay = (d: Date, withYear: boolean): string =>
    d.toLocaleDateString("en-GB", withYear ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" });
  const fmtMonth = (d: Date): string =>
    d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  if (bucket === "monthly") {
    if (sameYear) return `${startD.toLocaleDateString("en-GB", { month: "short" })} – ${fmtMonth(endD)}`;
    return `${fmtMonth(startD)} – ${fmtMonth(endD)}`;
  }
  return `${fmtDay(startD, !sameYear)} – ${fmtDay(endD, true)}`;
}

/**
 * Dedupe per-day weigh-ins. If the user logged twice on the same day
 * (e.g. HealthKit auto-sync + manual entry), keep the mean — that's
 * MFP's behaviour and matches user intent ("today's weight" rather
 * than "every weigh-in stamped today").
 *
 * 2026-05-06: previously not deduped at all — same-day entries
 * stacked on the same x-coord and the MA double-counted them.
 */
function dedupeByDay(points: WeightPoint[]): WeightPoint[] {
  const byDay = new Map<string, { sum: number; n: number; source?: WeightPoint["source"] }>();
  for (const p of points) {
    const key = dateKeyFromISO(p.dateISO);
    const existing = byDay.get(key);
    if (existing) {
      existing.sum += p.kg;
      existing.n += 1;
    } else {
      byDay.set(key, { sum: p.kg, n: 1, source: p.source });
    }
  }
  const out: WeightPoint[] = [];
  for (const [dateISO, agg] of byDay.entries()) {
    out.push({ dateISO, kg: Math.round((agg.sum / agg.n) * 100) / 100, source: agg.source });
  }
  out.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  return out;
}

/** ISO date key for the Monday of `dateISO`'s week. */
function weekAnchor(dateISO: string): string {
  const d = isoToDate(dateISO);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const diff = day === 0 ? 6 : day - 1; // shift Sun→6 so Monday is the anchor
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

/** ISO date key for the first day of `dateISO`'s month. */
function monthAnchor(dateISO: string): string {
  return `${dateISO.slice(0, 7)}-01`;
}

/**
 * Bucket per-day points into weekly or monthly aggregates. Each
 * bucket's kg is the unweighted mean across the days that fell into
 * it. Anchor date is the start-of-week (Monday) or start-of-month so
 * the chart x-axis aligns with calendar boundaries.
 */
function bucketPoints(
  points: WeightPoint[],
  bucket: "daily" | "weekly" | "monthly",
): WeightPoint[] {
  if (bucket === "daily") return points;
  const anchorOf = bucket === "weekly" ? weekAnchor : monthAnchor;
  const buckets = new Map<string, { sum: number; n: number; source?: WeightPoint["source"] }>();
  for (const p of points) {
    const key = anchorOf(p.dateISO);
    const existing = buckets.get(key);
    if (existing) {
      existing.sum += p.kg;
      existing.n += 1;
    } else {
      buckets.set(key, { sum: p.kg, n: 1, source: p.source });
    }
  }
  const out: WeightPoint[] = [];
  for (const [dateISO, agg] of buckets.entries()) {
    out.push({ dateISO, kg: Math.round((agg.sum / agg.n) * 100) / 100, source: agg.source });
  }
  out.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  return out;
}

/**
 * Main entry point. Pass all available weight records; this function
 * filters to the selected range, dedupes same-day entries, buckets
 * per the range's strategy, then computes MA / domain / trend copy /
 * since-label.
 */
export function computeWeightTrend(
  allPoints: WeightPoint[],
  range: WeightRange,
  goalKg: number | null,
  nowISO?: string,
): WeightTrendResult {
  const now = nowISO ? new Date(nowISO + "T12:00:00") : new Date();
  const nowDay = now.getTime();
  const cutoffDays = RANGE_DAYS[range];

  const sorted = [...allPoints]
    .map((p) => ({ ...p, dateISO: dateKeyFromISO(p.dateISO) }))
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  // 2026-05-06: dedupe same-day weigh-ins BEFORE range filter so the
  // boundary day (e.g. exactly 30 days ago for 1M) is treated as one
  // point, not several.
  const deduped = dedupeByDay(sorted);

  const filtered =
    cutoffDays === Infinity
      ? deduped
      : deduped.filter((p) => {
          const daysDiff = (nowDay - isoToDate(p.dateISO).getTime()) / 86400000;
          return daysDiff <= cutoffDays;
        });

  // Bucket according to range — keeps the chart readable on long
  // ranges by collapsing daily weigh-ins into weekly / monthly means.
  //
  // 2026-05-06: with smart fallback. If the selected bucket would
  // collapse the data more aggressively than is useful (e.g. user
  // picked "1Y" but only has 30 days of weigh-ins → 1 monthly
  // bucket), step down through monthly → weekly → daily until the
  // bucketed count matches min(3, raw count). This preserves the
  // user's range *intent* (a 1Y x-axis showing 30 days of recent
  // data is still useful) while avoiding the "not enough data"
  // empty-state trap.
  let bucket: "daily" | "weekly" | "monthly" = bucketFor(range);
  let bucketed = bucket === "daily" ? filtered : bucketPoints(filtered, bucket);
  const targetCount = Math.min(3, filtered.length);
  while (bucketed.length < targetCount && bucket !== "daily") {
    bucket = bucket === "monthly" ? "weekly" : "daily";
    bucketed = bucket === "daily" ? filtered : bucketPoints(filtered, bucket);
  }

  const movingAvg = computeMovingAvg(bucketed, maWindowDaysFor(range));
  const yDomain =
    bucketed.length > 0
      ? computeYDomain(bucketed, goalKg)
      : ([60, 80] as [number, number]);
  const { copy: trendCopy, direction: trendDirection, deltaKg: trendDeltaKg, status: trendStatus } = computeTrendCopy(
    movingAvg,
    bucketed,
    goalKg,
  );
  const sinceLabel = computeSinceLabel(bucketed, range);
  const periodRangeLabel = computePeriodRangeLabel(bucketed, bucket);

  const daysSinceLatest =
    filtered.length > 0
      ? Math.round(
          (nowDay - isoToDate(filtered[filtered.length - 1]!.dateISO).getTime()) /
            86400000,
        )
      : null;

  return {
    points: bucketed,
    movingAvg,
    yDomain,
    trendCopy,
    trendDirection,
    trendDeltaKg,
    trendStatus,
    sinceLabel,
    periodRangeLabel,
    daysSinceLatest,
    bucket,
  };
}

/** Convert a weightKgByDay record to WeightPoint[]. */
export function weightKgByDayToPoints(
  byDay: Record<string, number>,
  source: WeightPoint["source"] = "unknown",
): WeightPoint[] {
  return Object.entries(byDay)
    .filter(([, kg]) => typeof kg === "number" && Number.isFinite(kg) && kg > 0)
    .map(([dateISO, kg]) => ({ dateISO, kg, source }));
}
