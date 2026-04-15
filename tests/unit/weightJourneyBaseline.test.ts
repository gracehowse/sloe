import { describe, expect, it, vi, afterEach } from "vitest";
import {
  tukeyRobustMaxKg,
  tukeyRobustMinKg,
  weightJourneyBaselineKg,
  weightJourneyProgress,
  weightsInLookbackKg,
  WEIGHT_JOURNEY_LOOKBACK_DAYS,
} from "../../apps/mobile/lib/weightProjection.ts";

describe("weight journey baseline", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("tukeyRobustMaxKg ignores a single extreme high spike among several readings", () => {
    expect(tukeyRobustMaxKg([70, 71, 72, 400])).toBeLessThanOrEqual(75);
    expect(tukeyRobustMaxKg([70, 71, 72, 400])).toBeGreaterThanOrEqual(72);
  });

  it("weightJourneyBaselineKg does not treat one bogus max as the whole journey when losing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00"));

    const baseline = weightJourneyBaselineKg({
      goalKg: 68,
      latestKg: 74,
      weightKgByDay: {
        "2025-05-01": 76,
        "2025-05-10": 75,
        "2025-06-01": 400,
        "2025-06-14": 74,
      },
    });
    expect(baseline).not.toBeNull();
    expect(baseline!).toBeLessThan(120);
    const jp = weightJourneyProgress({
      goalKg: 68,
      latestKg: 74,
      weightKgByDay: {
        "2025-05-01": 76,
        "2025-05-10": 75,
        "2025-06-01": 400,
        "2025-06-14": 74,
      },
    });
    expect(jp).not.toBeNull();
    expect(jp!.lostKg).toBeLessThan(10);
    expect(jp!.lostKg).toBeGreaterThanOrEqual(0);
  });

  it("weightsInLookbackKg excludes days older than lookback", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00"));
    const w = weightsInLookbackKg({ "2020-01-01": 999, "2025-06-01": 72 }, WEIGHT_JOURNEY_LOOKBACK_DAYS);
    expect(w).toEqual([72]);
  });
});
