import { describe, it, expect } from "vitest";
import {
  isOffDataStale,
  offStalenessConfidencePenalty,
  OFF_STALENESS_MAX_PENALTY,
  OFF_STALENESS_PENALTY_FULL_MS,
  OFF_STALENESS_PENALTY_START_MS,
  OFF_STALE_THRESHOLD_MS,
} from "../../src/lib/openFoodFacts/offStaleness";

describe("offStalenessConfidencePenalty (ENG-1326)", () => {
  const now = new Date("2026-07-03T00:00:00Z").getTime();
  const day = 24 * 60 * 60 * 1000;

  it("returns 0 for a fresh product below the corpus P75 knee", () => {
    const thirtyDaysAgoSec = (now - 30 * day) / 1000;
    expect(offStalenessConfidencePenalty(thirtyDaysAgoSec, now)).toBe(0);
    expect(isOffDataStale(thirtyDaysAgoSec, now)).toBe(false);
  });

  it("ramps linearly between P75 and P95 ages", () => {
    const midAgeMs = OFF_STALENESS_PENALTY_START_MS + (OFF_STALENESS_PENALTY_FULL_MS - OFF_STALENESS_PENALTY_START_MS) / 2;
    const midSec = (now - midAgeMs) / 1000;
    const penalty = offStalenessConfidencePenalty(midSec, now);
    expect(penalty).toBeGreaterThan(0);
    expect(penalty).toBeLessThan(OFF_STALENESS_MAX_PENALTY);
    expect(penalty).toBeCloseTo(OFF_STALENESS_MAX_PENALTY / 2, 5);
  });

  it("caps at maxPenalty for very old products", () => {
    const fiveYearsAgoSec = (now - 5 * 365 * day) / 1000;
    expect(offStalenessConfidencePenalty(fiveYearsAgoSec, now)).toBe(OFF_STALENESS_MAX_PENALTY);
    expect(isOffDataStale(fiveYearsAgoSec, now)).toBe(true);
  });

  it("does not penalize missing timestamps", () => {
    expect(offStalenessConfidencePenalty(null, now)).toBe(0);
    expect(offStalenessConfidencePenalty(undefined, now)).toBe(0);
    expect(offStalenessConfidencePenalty(0, now)).toBe(0);
    expect(offStalenessConfidencePenalty(Number.NaN, now)).toBe(0);
  });

  it("keeps OFF_STALE_THRESHOLD_MS aligned with penalty full knee", () => {
    expect(OFF_STALE_THRESHOLD_MS).toBe(OFF_STALENESS_PENALTY_FULL_MS);
  });
});
