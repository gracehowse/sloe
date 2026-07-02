import { describe, it, expect } from "vitest";
import { isOffDataStale, OFF_STALE_THRESHOLD_MS } from "../../src/lib/openFoodFacts/offStaleness";

describe("isOffDataStale (ENG-1305)", () => {
  const now = new Date("2026-07-02T00:00:00Z").getTime();

  it("flags a product last edited well past the threshold", () => {
    const fourYearsAgoSec = (now - 4 * 365 * 24 * 60 * 60 * 1000) / 1000;
    expect(isOffDataStale(fourYearsAgoSec, now)).toBe(true);
  });

  it("does not flag a recently-edited product", () => {
    const oneMonthAgoSec = (now - 30 * 24 * 60 * 60 * 1000) / 1000;
    expect(isOffDataStale(oneMonthAgoSec, now)).toBe(false);
  });

  it("straddles the threshold correctly", () => {
    const justUnderSec = (now - (OFF_STALE_THRESHOLD_MS - 1000)) / 1000;
    const justOverSec = (now - (OFF_STALE_THRESHOLD_MS + 1000)) / 1000;
    expect(isOffDataStale(justUnderSec, now)).toBe(false);
    expect(isOffDataStale(justOverSec, now)).toBe(true);
  });

  it("does not penalize a row OFF simply didn't publish a timestamp for", () => {
    expect(isOffDataStale(null, now)).toBe(false);
    expect(isOffDataStale(undefined, now)).toBe(false);
    expect(isOffDataStale(0, now)).toBe(false);
    expect(isOffDataStale(Number.NaN, now)).toBe(false);
  });
});
