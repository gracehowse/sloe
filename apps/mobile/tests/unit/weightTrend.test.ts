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

  it("all points pass through on 'all' range", () => {
    const pts = makePoints(120);
    const r = computeWeightTrend(pts, "all", null, BASE_ISO);
    expect(r.points).toHaveLength(120);
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

  it("yDomain includes goal line when provided", () => {
    const pts = makePoints(10, 75);
    const r = computeWeightTrend(pts, "1m", 70, BASE_ISO);
    const [yMin] = r.yDomain;
    expect(yMin).toBeLessThanOrEqual(70);
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
