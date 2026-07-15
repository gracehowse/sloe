import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  BODY_COMP_TREND_WINDOW_DAYS,
  buildBodyCompositionTrendCopy,
} from "../../src/lib/progress/bodyCompositionTrends";
import { dateKeyFromDate } from "../../src/lib/datetime/dateKey";

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

describe("buildBodyCompositionTrendCopy — local day keys (ENG-1562)", () => {
  // The app writes bodyFatPctByDay / weightKgByDay with LOCAL calendar keys
  // (dateKeyFromDate). This module previously synthesised the latest-point key
  // and the window baseline with `toISOString().slice(0,10)` (UTC), so near
  // UTC midnight those keys landed on a different day than the series they
  // joined/compared against. Force a zone behind UTC so local ≠ UTC diverge.
  const ORIGINAL_TZ = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "America/Los_Angeles";
  });
  afterAll(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it("keys the synthesised latest point on the LOCAL day so it joins the local-keyed weight series", () => {
    // 2026-07-15T04:30Z = 2026-07-14 21:30 PDT → local day 07-14, UTC day 07-15.
    const now = Date.parse("2026-07-15T04:30:00.000Z");
    const localToday = dateKeyFromDate(new Date(now));
    const utcToday = new Date(now).toISOString().slice(0, 10);
    // Precondition — this fixture only guards the regression when the env TZ
    // actually makes local and UTC diverge. Fails loudly if TZ didn't apply.
    expect(localToday).not.toBe(utcToday);

    const copy = buildBodyCompositionTrendCopy({
      bodyFatPctByDay: {},
      weightKgByDay: { [localToday]: 80 },
      bodyFatPctLatest: 22,
      now,
    });

    expect(copy.bodyFat.current).toBe(22);
    // Lean mass derives only when the body-fat point shares a key with a weight
    // reading. The old UTC key (07-15) missed the local weight (07-14) → null.
    expect(copy.leanMass.current).toBe(62.4); // 80 × (1 − 0.22)
  });
});
