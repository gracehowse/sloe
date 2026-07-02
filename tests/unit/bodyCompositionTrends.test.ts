import { describe, expect, it } from "vitest";

import {
  BODY_COMP_TREND_WINDOW_DAYS,
  buildBodyCompositionTrendCopy,
} from "../../src/lib/progress/bodyCompositionTrends";

describe("buildBodyCompositionTrendCopy (ENG-1237)", () => {
  const now = Date.parse("2026-07-01T12:00:00.000Z");

  it("computes body-fat and lean-mass deltas over 90 days", () => {
    const copy = buildBodyCompositionTrendCopy({
      bodyFatPctByDay: {
        "2026-04-01": 25.4,
        "2026-07-01": 24.1,
      },
      weightKgByDay: {
        "2026-04-01": 72,
        "2026-07-01": 70,
      },
      bodyFatPctLatest: 24.1,
      now,
    });

    expect(copy.hasReadableData).toBe(true);
    expect(copy.bodyFat.current).toBe(24.1);
    expect(copy.bodyFat.delta).toBe(-1.3);
    expect(copy.bodyFat.deltaLabel).toBe(`−1.3% / ${BODY_COMP_TREND_WINDOW_DAYS}d`);
    // 70kg @ 24.1% → 53.13 lean; 72kg @ 25.4% → 53.71 lean
    expect(copy.leanMass.current).toBe(53.1);
    expect(copy.leanMass.unit).toBe("kg");
  });

  it("falls back to latest scalar when by-day map is empty", () => {
    const copy = buildBodyCompositionTrendCopy({
      bodyFatPctByDay: {},
      weightKgByDay: {},
      bodyFatPctLatest: 22.5,
      now,
    });
    expect(copy.bodyFat.current).toBe(22.5);
    expect(copy.leanMass.current).toBeNull();
  });

  it("does not fabricate lean mass without paired weight", () => {
    const copy = buildBodyCompositionTrendCopy({
      bodyFatPctByDay: { "2026-07-01": 20 },
      weightKgByDay: {},
      bodyFatPctLatest: 20,
      now,
    });
    expect(copy.bodyFat.current).toBe(20);
    expect(copy.leanMass.current).toBeNull();
  });

  it("does not derive lean mass from a non-same-day weight", () => {
    const copy = buildBodyCompositionTrendCopy({
      bodyFatPctByDay: { "2026-07-01": 20 },
      weightKgByDay: { "2026-06-30": 70 },
      bodyFatPctLatest: 20,
      now,
    });

    expect(copy.bodyFat.current).toBe(20);
    expect(copy.leanMass.current).toBeNull();
  });
});
