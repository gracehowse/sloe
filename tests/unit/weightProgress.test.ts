import { describe, expect, it } from "vitest";
import {
  computeWeightJourneyProgressPct,
  formatWeightJourneyProgressCopy,
} from "@/lib/weightProjection";

/**
 * F-4a (TestFlight `AHEeeC9a4-lKIyW5n7HgJxs`, 2026-04-19) — the tester
 * saw "3% progress" when their current weight equalled their start
 * weight. The old mobile code hardcoded a `Math.max(3, …)` floor + a
 * looser formula. The canonical formula is now
 * `(start - current) / (start - goal)` clamped to [0, 1].
 */
describe("computeWeightJourneyProgressPct", () => {
  it("returns exactly 0 when start === current (lose journey)", () => {
    expect(
      computeWeightJourneyProgressPct({ startKg: 80, currentKg: 80, goalKg: 70 }),
    ).toBe(0);
  });

  it("returns exactly 1 when current === goal", () => {
    expect(
      computeWeightJourneyProgressPct({ startKg: 80, currentKg: 70, goalKg: 70 }),
    ).toBe(1);
  });

  it("returns the straight arithmetic fraction at half-way", () => {
    expect(
      computeWeightJourneyProgressPct({ startKg: 80, currentKg: 75, goalKg: 70 }),
    ).toBeCloseTo(0.5, 5);
  });

  it("clamps to 1 when the user overshoots their goal", () => {
    expect(
      computeWeightJourneyProgressPct({ startKg: 80, currentKg: 68, goalKg: 70 }),
    ).toBe(1);
  });

  it("clamps to 0 when the user moves away from their goal", () => {
    expect(
      computeWeightJourneyProgressPct({ startKg: 80, currentKg: 82, goalKg: 70 }),
    ).toBe(0);
  });

  it("handles a gain journey (start < goal) with the same formula", () => {
    // gaining from 60 → 70, currently 65 → half-way
    expect(
      computeWeightJourneyProgressPct({ startKg: 60, currentKg: 65, goalKg: 70 }),
    ).toBeCloseTo(0.5, 5);
    // gained past the goal → clamped to 1
    expect(
      computeWeightJourneyProgressPct({ startKg: 60, currentKg: 72, goalKg: 70 }),
    ).toBe(1);
    // regressed below start → clamped to 0
    expect(
      computeWeightJourneyProgressPct({ startKg: 60, currentKg: 58, goalKg: 70 }),
    ).toBe(0);
  });

  it("returns null when start and goal are within 0.1 kg of each other", () => {
    // No meaningful journey; avoids a divide-by-near-zero that previously
    // surfaced as "3%" in the UI.
    expect(
      computeWeightJourneyProgressPct({ startKg: 70, currentKg: 70, goalKg: 70 }),
    ).toBeNull();
    expect(
      computeWeightJourneyProgressPct({ startKg: 70.05, currentKg: 70, goalKg: 70 }),
    ).toBeNull();
  });

  it("returns null for non-finite inputs — no silent fabrication", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(
        computeWeightJourneyProgressPct({ startKg: bad, currentKg: 75, goalKg: 70 }),
      ).toBeNull();
      expect(
        computeWeightJourneyProgressPct({ startKg: 80, currentKg: bad, goalKg: 70 }),
      ).toBeNull();
      expect(
        computeWeightJourneyProgressPct({ startKg: 80, currentKg: 75, goalKg: bad }),
      ).toBeNull();
    }
  });
});

describe("formatWeightJourneyProgressCopy", () => {
  it("renders 'Just starting' at exactly 0%", () => {
    expect(formatWeightJourneyProgressCopy(0)).toBe("Just starting");
  });

  it("renders 'Goal reached' at 100%", () => {
    expect(formatWeightJourneyProgressCopy(1)).toBe("Goal reached");
  });

  it("renders '42% of the way there' for mid-range progress", () => {
    expect(formatWeightJourneyProgressCopy(0.42)).toBe("42% of the way there");
  });

  it("rounds to the nearest percent (no stray decimals)", () => {
    expect(formatWeightJourneyProgressCopy(0.123)).toBe("12% of the way there");
    expect(formatWeightJourneyProgressCopy(0.127)).toBe("13% of the way there");
  });

  it("returns an empty string when progress is null", () => {
    expect(formatWeightJourneyProgressCopy(null)).toBe("");
  });
});
