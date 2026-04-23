/**
 * Weight trend computation — shared by WeightChart and the stat tile.
 * Pure functions; no React, no platform APIs.
 *
 * Web parity: this file lives under apps/mobile/lib/progress/ but its
 * logic is re-exported from src/lib/progress/weightTrend.ts so the web
 * WeightTracker can use the same domain/MA/since-label calculations.
 */

export type WeightRange = "1w" | "1m" | "3m" | "1y" | "all";

export type WeightPoint = {
  dateISO: string;
  kg: number;
  source?: "healthkit" | "manual" | "unknown";
};

export type WeightTrendResult = {
  /** Points within the selected range, sorted oldest→newest. */
  points: WeightPoint[];
  /** 7-day moving average aligned to `points`. Null when < 3 points in window. */
  movingAvg: (number | null)[];
  /** Y-axis domain: [yMin, yMax]. Always spans at least 0.8 kg. */
  yDomain: [number, number];
  /** "Down 0.4 kg" / "Up 0.3 kg" / "Holding steady" */
  trendCopy: string;
  /** True when MA endpoint > MA start (trending away from lower goal) or vice versa. */
  trendDirection: "improving" | "worsening" | "neutral";
  /** "Last 7 days" / "Last 30 days" / "Last 3 months" / "Since 12 Jan" */
  sinceLabel: string;
  /** Days since the most recent weigh-in. Null if no data. */
  daysSinceLatest: number | null;
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

/** 7-day trailing moving average. Returns null for positions with < 3 values in the 7-day window. */
function computeMovingAvg(points: WeightPoint[]): (number | null)[] {
  return points.map((_, i) => {
    const windowStart = Math.max(0, i - 6);
    const window = points.slice(windowStart, i + 1);
    if (window.length < 3) return null;
    const sum = window.reduce((acc, p) => acc + p.kg, 0);
    return Math.round((sum / window.length) * 100) / 100;
  });
}

/** Compute the Y domain per the brief: [min(data,goal) - padding, max(data,goal) + padding]
 *  where padding = max(0.8, 8% of range). Never includes 0. */
function computeYDomain(
  points: WeightPoint[],
  goalKg: number | null,
): [number, number] {
  const kgs = points.map((p) => p.kg);
  const allValues = goalKg != null ? [...kgs, goalKg] : kgs;
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const rawRange = rawMax - rawMin;
  const padding = Math.max(0.8, rawRange * 0.08);
  return [
    Math.round((rawMin - padding) * 10) / 10,
    Math.round((rawMax + padding) * 10) / 10,
  ];
}

function computeTrendCopy(
  movingAvg: (number | null)[],
  goalKg: number | null,
): { copy: string; direction: "improving" | "worsening" | "neutral" } {
  const validMA = movingAvg.filter((v): v is number => v !== null);
  if (validMA.length < 2) {
    return { copy: "Not enough data yet.", direction: "neutral" };
  }
  const first = validMA[0]!;
  const last = validMA[validMA.length - 1]!;
  const delta = last - first;
  const absDelta = Math.abs(delta);

  if (absDelta < 0.2) {
    return { copy: "Holding steady.", direction: "neutral" };
  }

  const sign = delta < 0 ? "Down" : "Up";
  const copy = `${sign} ${absDelta.toFixed(1)} kg on average.`;

  let direction: "improving" | "worsening" | "neutral" = "neutral";
  if (goalKg != null) {
    const goalIsLower = goalKg < last;
    direction = (goalIsLower && delta < 0) || (!goalIsLower && delta > 0) ? "improving" : "worsening";
  }

  return { copy, direction };
}

function computeSinceLabel(points: WeightPoint[], range: WeightRange): string {
  if (range !== "all") return RANGE_LABELS[range];
  if (points.length === 0) return "All time";
  const earliest = isoToDate(points[0]!.dateISO);
  return `Since ${formatShortDate(earliest)}`;
}

/**
 * Main entry point. Pass all available weight records; this function
 * filters to the selected range, computes MA, domain, trend copy, and
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

  const filtered =
    cutoffDays === Infinity
      ? sorted
      : sorted.filter((p) => {
          const daysDiff = (nowDay - isoToDate(p.dateISO).getTime()) / 86400000;
          return daysDiff <= cutoffDays;
        });

  const movingAvg = computeMovingAvg(filtered);
  const yDomain = filtered.length > 0 ? computeYDomain(filtered, goalKg) : [60, 80] as [number, number];
  const { copy: trendCopy, direction: trendDirection } = computeTrendCopy(movingAvg, goalKg);
  const sinceLabel = computeSinceLabel(filtered, range);

  const daysSinceLatest =
    filtered.length > 0
      ? Math.round((nowDay - isoToDate(filtered[filtered.length - 1]!.dateISO).getTime()) / 86400000)
      : null;

  return {
    points: filtered,
    movingAvg,
    yDomain,
    trendCopy,
    trendDirection,
    sinceLabel,
    daysSinceLatest,
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
