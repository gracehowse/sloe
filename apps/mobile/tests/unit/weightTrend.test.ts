import { describe, it, expect } from "vitest";
import {
  computeWeightTrend,
  weightKgByDayToPoints,
  type WeightRange,
  type WeightPoint,
} from "../../lib/progress/weightTrend";

const BASE_ISO = "2026-04-22";

function makePoints(days: number, startKg = 75, dailyDelta = -0.05): WeightPoint[] {
  const pts: WeightPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(BASE_ISO + "T12:00:00");
    d.setDate(d.getDate() - (days - 1 - i));
    pts.push({ dateISO: d.toISOString().slice(0, 10), kg: startKg + i * dailyDelta });
  }
  return pts;
}

describe("computeWeightTrend", () => {
  it("returns empty points for empty input", () => {
    const r = computeWeightTrend([], "1m", null, BASE_ISO);
    expect(r.points).toHaveLength(0);
    expect(r.daysSinceLatest).toBeNull();
  });

  it("filters points to the selected range", () => {
    const pts = makePoints(60);
    const r = computeWeightTrend(pts, "1m", null, BASE_ISO);
    // ≤31 because the filter is `daysDiff <= 30` (today=0 through 30 days ago=inclusive)
    expect(r.points.length).toBeLessThanOrEqual(31);
    expect(r.points.length).toBeGreaterThan(0);
  });

  // 2026-05-06: 'all' range now buckets to monthly means (MFP-style)
  // so 120 days of daily weigh-ins collapse to 4-5 monthly points,
  // not 120 raw points. The bucket strategy is exposed on the result
  // so callers (WeightChart) can hide raw dots and render only the
  // smoothed line. Pin the new behaviour.
  it("all range buckets daily points into monthly means", () => {
    const pts = makePoints(120);
    const r = computeWeightTrend(pts, "all", null, BASE_ISO);
    expect(r.bucket).toBe("monthly");
    // 120 days starting Dec 2025 → Dec, Jan, Feb, Mar, Apr (5 months).
    expect(r.points.length).toBeGreaterThanOrEqual(4);
    expect(r.points.length).toBeLessThanOrEqual(6);
    // Anchor dates are start-of-month.
    for (const p of r.points) {
      expect(p.dateISO.endsWith("-01")).toBe(true);
    }
  });

  it("3m range buckets daily points into weekly means (Monday-anchored)", () => {
    const pts = makePoints(60);
    const r = computeWeightTrend(pts, "3m", null, BASE_ISO);
    expect(r.bucket).toBe("weekly");
    // 60 days → ~9 weekly buckets.
    expect(r.points.length).toBeGreaterThanOrEqual(8);
    expect(r.points.length).toBeLessThanOrEqual(10);
    // Each anchor must be a Monday.
    for (const p of r.points) {
      const day = new Date(p.dateISO + "T12:00:00").getDay();
      expect(day).toBe(1);
    }
  });

  it("1w / 1m ranges keep daily granularity (no bucketing)", () => {
    const pts = makePoints(30);
    const wkly = computeWeightTrend(pts, "1w", null, BASE_ISO);
    const monthly = computeWeightTrend(pts, "1m", null, BASE_ISO);
    expect(wkly.bucket).toBe("daily");
    expect(monthly.bucket).toBe("daily");
  });

  it("yDomain always spans at least 0.8 kg", () => {
    const pts = [
      { dateISO: "2026-04-21", kg: 72.0 },
      { dateISO: "2026-04-22", kg: 72.1 },
    ];
    const r = computeWeightTrend(pts, "1m", null, BASE_ISO);
    const [yMin, yMax] = r.yDomain;
    expect(yMax - yMin).toBeGreaterThanOrEqual(0.8);
  });

  it("yDomain includes goal line when goal is near the data", () => {
    // Data span 75 → 74.55 (range 0.45); goal 74 is 0.55 below data
    // min — within threshold = max(2, 0.5×range) = max(2, 0.23) = 2.
    const pts = makePoints(10, 75);
    const r = computeWeightTrend(pts, "1m", 74, BASE_ISO);
    const [yMin] = r.yDomain;
    expect(yMin).toBeLessThanOrEqual(74);
  });

  it("F-133 — yDomain EXCLUDES goal when goal is far from data", () => {
    // Data span 75 → 74.55 (range 0.45); goal 70 is ~4.5 below data
    // min — outside threshold (max(2, 0.23) = 2). Pre-fix this
    // included 70 in the domain → axis stretched to ~69-76, data
    // line collapsed to a thin sliver near the top (Grace's "graph
    // is broken" complaint, `AFlB4oMfwQGIFx-w0DxOofE`). Post-fix
    // the data uses the full plot height; off-chart edge chip on
    // WeightChart shows the goal direction.
    const pts = makePoints(10, 75);
    const r = computeWeightTrend(pts, "1m", 70, BASE_ISO);
    const [yMin] = r.yDomain;
    // yMin should be near data-min (74.55), not pulled down to ~69.
    expect(yMin).toBeGreaterThan(72);
  });

  it("movingAvg produces nulls when < 3 points in window", () => {
    const pts = makePoints(2);
    const r = computeWeightTrend(pts, "1m", null, BASE_ISO);
    expect(r.movingAvg.every((v) => v === null)).toBe(true);
  });

  it("movingAvg produces non-null values once window has 3+ points", () => {
    const pts = makePoints(10);
    const r = computeWeightTrend(pts, "1m", null, BASE_ISO);
    const nonNull = r.movingAvg.filter((v) => v !== null);
    expect(nonNull.length).toBeGreaterThan(0);
  });

  it("trendCopy says 'Holding steady' when delta < 0.2 kg", () => {
    const pts = makePoints(10, 72.0, 0.01);
    const r = computeWeightTrend(pts, "1m", null, BASE_ISO);
    expect(r.trendCopy).toContain("Holding steady");
  });

  it("trendCopy says 'Down' when trending downward", () => {
    const pts = makePoints(15, 75, -0.1);
    const r = computeWeightTrend(pts, "1m", null, BASE_ISO);
    expect(r.trendCopy).toContain("Down");
  });

  it("sinceLabel matches range label for non-all ranges", () => {
    const pts = makePoints(30);
    expect(computeWeightTrend(pts, "1w", null, BASE_ISO).sinceLabel).toBe("Last 7 days");
    expect(computeWeightTrend(pts, "1m", null, BASE_ISO).sinceLabel).toBe("Last 30 days");
    expect(computeWeightTrend(pts, "3m", null, BASE_ISO).sinceLabel).toBe("Last 3 months");
  });

  it("sinceLabel for 'all' includes the earliest date", () => {
    const pts = makePoints(10, 72);
    const r = computeWeightTrend(pts, "all", null, BASE_ISO);
    expect(r.sinceLabel).toMatch(/Since/);
  });

  it("daysSinceLatest is 0 for today's entry", () => {
    const pts = [{ dateISO: BASE_ISO, kg: 72 }];
    const r = computeWeightTrend(pts, "1m", null, BASE_ISO);
    expect(r.daysSinceLatest).toBe(0);
  });

  it("trendDirection is improving when losing toward lower goal", () => {
    const pts = makePoints(15, 75, -0.15);
    const r = computeWeightTrend(pts, "1m", 70, BASE_ISO);
    expect(r.trendDirection).toBe("improving");
  });

  it("trendDirection is worsening when gaining toward lower goal", () => {
    const pts = makePoints(15, 70, 0.15);
    const r = computeWeightTrend(pts, "1m", 68, BASE_ISO);
    expect(r.trendDirection).toBe("worsening");
  });

  // 2026-05-06 pins for the rewrite:

  it("dedupes same-day weigh-ins into a single point (mean)", () => {
    // User logs at 7am (HealthKit) AND at 7pm (manual) on the same
    // day. Should collapse into one point at the mean — was previously
    // not deduped, so the point appeared twice with double-counted MA.
    const pts: WeightPoint[] = [
      { dateISO: "2026-04-22", kg: 75.0, source: "healthkit" },
      { dateISO: "2026-04-22", kg: 75.4, source: "manual" },
    ];
    const r = computeWeightTrend(pts, "1m", null, BASE_ISO);
    expect(r.points).toHaveLength(1);
    expect(r.points[0]!.kg).toBeCloseTo(75.2, 1);
  });

  it("MA window is calendar-day-based (7 days for short ranges, 28 for long)", () => {
    // 5 weigh-ins, one every 14 days — under the old index-based
    // "last 7 points" rule, the MA at point 5 would average all 5
    // points (~70 days span). Under the new calendar-day rule, only
    // points within the trailing 7 (or 28) calendar days count, so
    // the MA at point 5 is just point 5 alone — fewer than 3 in
    // window → null. Pin both behaviours.
    const pts: WeightPoint[] = [
      { dateISO: "2026-02-01", kg: 75.0 },
      { dateISO: "2026-02-15", kg: 74.7 },
      { dateISO: "2026-03-01", kg: 74.4 },
      { dateISO: "2026-03-15", kg: 74.1 },
      { dateISO: "2026-04-01", kg: 73.8 },
    ];
    // 1m → 7-day window. Each point is 14 days apart → window of 1
    // point → null MA throughout.
    const r1m = computeWeightTrend(pts, "1m", null, "2026-04-22");
    expect(r1m.movingAvg.every((v) => v === null)).toBe(true);
    // all → 28-day window. Each point picks up the previous point in
    // the window when they're 14 days apart, but that's only 2 → still
    // < 3 needed → null. Demonstrates the calendar-day floor.
    const rAll = computeWeightTrend(pts, "all", null, "2026-04-22");
    expect(rAll.movingAvg.every((v) => v === null)).toBe(true);
  });

  it("MA produces non-null when 3+ entries fall within the window calendar days", () => {
    // 5 daily points, MA window = 7 days → from point 3 onward each
    // window has 3+ entries.
    const pts = makePoints(7);
    const r = computeWeightTrend(pts, "1m", null, BASE_ISO);
    // Last MA value should be a real number.
    const last = r.movingAvg[r.movingAvg.length - 1];
    expect(typeof last).toBe("number");
  });

  // 2026-05-06: smart bucket fallback. If the selected range would
  // bucket data into <3 points (e.g. "1Y" range with only 30 days
  // of weigh-ins → 1 monthly bucket), step down to a finer bucket
  // (monthly → weekly → daily) so the chart still renders.
  it("falls back from monthly to weekly when 1Y range has too few months of data", () => {
    // 30 days of daily entries → 1 monthly bucket but ~5 weekly
    // buckets, so weekly is the right fallback.
    const pts = makePoints(30);
    const r = computeWeightTrend(pts, "1y", null, BASE_ISO);
    expect(r.bucket).toBe("weekly");
    expect(r.points.length).toBeGreaterThanOrEqual(3);
  });

  it("falls back further to daily when even weekly is too sparse", () => {
    // 10 days of daily entries → 1-2 weekly buckets, so must drop
    // to daily for the chart to render.
    const pts = makePoints(10);
    const r = computeWeightTrend(pts, "1y", null, BASE_ISO);
    expect(r.bucket).toBe("daily");
    expect(r.points.length).toBeGreaterThanOrEqual(3);
  });

  it("does not fall back when raw data is also <3 points (sparse-state path)", () => {
    // 2 entries total — even daily can't reach 3 points. Caller
    // uses the bucket value to decide layout, so it shouldn't
    // synthesise extra points.
    const pts = makePoints(2);
    const r = computeWeightTrend(pts, "1y", null, BASE_ISO);
    expect(r.points.length).toBe(2);
  });

  it("exposes trendDeltaKg + trendStatus alongside trendCopy (2026-05-11 Withings header)", () => {
    // Steady -0.05 kg/day downward over 30 days → ~-1.5 kg delta.
    const pts = makePoints(30, 75, -0.05);
    const r = computeWeightTrend(pts, "1m", null, BASE_ISO);
    expect(r.trendStatus).toBe("down");
    expect(r.trendDeltaKg).toBeLessThan(0);
    expect(r.trendDeltaKg).toBeGreaterThan(-2);
    // Matches the legacy trendCopy direction.
    expect(r.trendCopy).toMatch(/down/i);
  });

  it("trendStatus for a single entry is 'stable' (not 'no_data') — chart still has a dot to show", () => {
    // 2026-05-11 (Grace TF feedback — "only show no data where there
    // is none at all"): a single weigh-in renders a single point on
    // the chart, so calling the header "No data" reads wrong. The
    // status falls back to "stable" (with copy "First entry — keep
    // going") and trendDeltaKg stays null (no second point to delta
    // against). "no_data" is reserved for truly empty histories.
    const r = computeWeightTrend([{ dateISO: BASE_ISO, kg: 70 }], "1m", null, BASE_ISO);
    expect(r.trendStatus).toBe("stable");
    expect(r.trendDeltaKg).toBeNull();
    expect(r.trendCopy).toMatch(/first entry/i);
  });

  it("trendStatus is 'no_data' only for fully empty histories", () => {
    const r = computeWeightTrend([], "1m", null, BASE_ISO);
    expect(r.trendStatus).toBe("no_data");
    expect(r.trendDeltaKg).toBeNull();
  });

  it("periodRangeLabel formats as real start–end date (2026-05-11 Withings header)", () => {
    // Daily bucket → "X Mon – Y Mon YYYY" shape with en-dash separator.
    const pts = makePoints(30);
    const r = computeWeightTrend(pts, "1m", null, BASE_ISO);
    expect(r.periodRangeLabel).toMatch(/–/);
    expect(r.periodRangeLabel).toMatch(/\d{4}/);
  });

  it("periodRangeLabel uses month+year only for monthly buckets (1Y / All)", () => {
    // 120 days → monthly bucket. Output is "Mon – Mon YYYY" (same
    // year) or "Mon YYYY – Mon YYYY" (cross-year); no day numbers.
    const pts = makePoints(120, 75);
    const r = computeWeightTrend(pts, "all", null, BASE_ISO);
    expect(r.periodRangeLabel).toMatch(/–/);
    expect(r.periodRangeLabel).not.toMatch(
      /\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/,
    );
  });

  it("periodRangeLabel is null for empty histories", () => {
    const r = computeWeightTrend([], "1m", null, BASE_ISO);
    expect(r.periodRangeLabel).toBeNull();
  });

  it("falls back to raw point delta when MA can't compute (sparse 1W view)", () => {
    // Two weigh-ins, 4 days apart — within the 1W window but MA needs
    // 3+ points in its trailing 7-day window, so MA returns null at
    // both indices. The fallback path uses the raw first-vs-last
    // delta so the header doesn't say "No data" while the chart shows
    // two dots. This is the exact bug Grace flagged 2026-05-11.
    const r = computeWeightTrend(
      [
        { dateISO: "2026-04-18", kg: 75.0 },
        { dateISO: "2026-04-22", kg: 74.0 },
      ],
      "1w",
      null,
      BASE_ISO,
    );
    expect(r.trendStatus).toBe("down");
    expect(r.trendDeltaKg).toBeCloseTo(-1, 1);
  });

  it("trendStatus is 'stable' for sub-0.2-kg movements", () => {
    // Flat history with tiny noise — delta should fall under the 0.2 kg
    // threshold the trendCopy already uses.
    const pts = makePoints(14, 75, 0.005);
    const r = computeWeightTrend(pts, "1m", null, BASE_ISO);
    expect(r.trendStatus).toBe("stable");
    expect(Math.abs(r.trendDeltaKg ?? 999)).toBeLessThan(0.2);
  });

  it("yDomain handles a 10000-point history without stack overflow (iterative min/max)", () => {
    // Math.min(...arr) rest-spread crashes on >~7000 args; the
    // iterative implementation must handle large histories cleanly.
    const pts: WeightPoint[] = [];
    const start = new Date("2010-01-01T12:00:00").getTime();
    for (let i = 0; i < 10000; i++) {
      const d = new Date(start + i * 86400000).toISOString().slice(0, 10);
      pts.push({ dateISO: d, kg: 70 + Math.sin(i / 100) });
    }
    expect(() => computeWeightTrend(pts, "all", null, "2026-04-22")).not.toThrow();
  });
});

// ENG-954 — confirm the plateau insight reaches mobile through the
// `@suppr/shared/progress/weightTrend` re-export (mobile consumes the SAME
// function as web, so a genuine plateau reframes identically on both surfaces).
describe("computeWeightTrend — plateauInsight via mobile re-export (ENG-954)", () => {
  function genuinePlateauPoints(): WeightPoint[] {
    const pts: WeightPoint[] = [];
    for (let i = 0; i < 20; i++) {
      const d = new Date(BASE_ISO + "T12:00:00");
      d.setDate(d.getDate() - (19 - i));
      const kg = i < 9 ? 80.0 - i * 0.25 : 78.0 + (i % 2 === 0 ? 0.05 : -0.05);
      pts.push({ dateISO: d.toISOString().slice(0, 10), kg: Math.round(kg * 100) / 100 });
    }
    return pts;
  }

  it("fires on a genuine plateau (flat recent stretch + long trend still toward goal)", () => {
    const r = computeWeightTrend(genuinePlateauPoints(), "1m", 72, BASE_ISO);
    expect(r.plateauInsight).not.toBeNull();
    expect(r.plateauInsight!.longTrendTowardGoal).toBe(true);
    expect(r.plateauInsight!.line).toMatch(/held flat for \d+ days/);
  });

  it("returns null when the long trend is also flat", () => {
    const pts: WeightPoint[] = [];
    for (let i = 0; i < 20; i++) {
      const d = new Date(BASE_ISO + "T12:00:00");
      d.setDate(d.getDate() - (19 - i));
      pts.push({ dateISO: d.toISOString().slice(0, 10), kg: 78.0 + (i % 2 === 0 ? 0.05 : -0.05) });
    }
    expect(computeWeightTrend(pts, "1m", 72, BASE_ISO).plateauInsight).toBeNull();
  });

  it("stays silent for a flat stretch shorter than the 7-day floor (no overstated span)", () => {
    // Mobile parity for the web regression pin: a long downtrend then only a
    // 2-CALENDAR-DAY flat blip must NOT fire (the genuine span is below the
    // PLATEAU_MIN_FLAT_DAYS floor) — and never render a false "held flat for 7
    // days" claim. Both surfaces share `computeWeightTrend`, so they suppress
    // the short blip identically.
    const pts: WeightPoint[] = [];
    for (let i = 0; i < 9; i++) {
      const d = new Date(BASE_ISO + "T12:00:00");
      d.setDate(d.getDate() - (13 - i));
      pts.push({ dateISO: d.toISOString().slice(0, 10), kg: Math.round((80 - i * 0.25) * 100) / 100 });
    }
    for (let i = 0; i < 3; i++) {
      const d = new Date(BASE_ISO + "T12:00:00");
      d.setDate(d.getDate() - (2 - i));
      pts.push({ dateISO: d.toISOString().slice(0, 10), kg: 78.0 + (i % 2 === 0 ? 0.05 : -0.05) });
    }
    expect(computeWeightTrend(pts, "1m", 72, BASE_ISO).plateauInsight).toBeNull();
  });

  it("reports the real flat-day span consistently in the copy", () => {
    const ins = computeWeightTrend(genuinePlateauPoints(), "1m", 72, BASE_ISO).plateauInsight!;
    expect(ins.flatDays).toBeGreaterThanOrEqual(7);
    expect(ins.line).toContain(`held flat for ${ins.flatDays} days`);
  });
});

describe("weightKgByDayToPoints", () => {
  it("converts record to sorted WeightPoint array", () => {
    const record = { "2026-04-20": 72.0, "2026-04-22": 72.4, "2026-04-21": 72.2 };
    const pts = weightKgByDayToPoints(record);
    expect(pts).toHaveLength(3);
    expect(pts[0]!.kg).toBe(72.0);
  });

  it("filters out non-positive values", () => {
    const record = { "2026-04-20": 0, "2026-04-21": -1, "2026-04-22": 72 };
    const pts = weightKgByDayToPoints(record);
    expect(pts).toHaveLength(1);
    expect(pts[0]!.kg).toBe(72);
  });
});
