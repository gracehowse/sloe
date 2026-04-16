import { describe, expect, it } from "vitest";
import { computeProjectedBurn } from "../../src/app/components/BurnDetailPanel";

describe("BurnDetailPanel — computeProjectedBurn", () => {
  it("returns zero future burn when resting burn is zero", () => {
    const result = computeProjectedBurn(0);
    expect(result.futureBurn).toBe(0);
    expect(result.hourlyResting).toBe(0);
  });

  it("returns a non-negative future burn for positive resting burn", () => {
    // With any positive resting burn during the day, there should be a
    // non-negative projected future burn (could be 0 if called at 23:59).
    const result = computeProjectedBurn(1200);
    expect(result.futureBurn).toBeGreaterThanOrEqual(0);
    expect(result.hoursLeft).toBeGreaterThanOrEqual(0);
    expect(result.hoursLeft).toBeLessThanOrEqual(24);
  });

  it("hourly resting rate is proportional to resting burn", () => {
    const r1 = computeProjectedBurn(600);
    const r2 = computeProjectedBurn(1200);
    // Doubling resting burn should double the hourly rate
    if (r1.hourlyResting > 0) {
      expect(r2.hourlyResting / r1.hourlyResting).toBeCloseTo(2, 1);
    }
  });

  it("futureBurn is always rounded to an integer", () => {
    const result = computeProjectedBurn(1337);
    expect(Number.isInteger(result.futureBurn)).toBe(true);
  });
});
