/**
 * Motion foundation — pure odometer math (web + shared) — ENG-812.
 *
 * `src/lib/motion.ts` is the single source of truth for the product's one
 * motion personality. The spring numbers and the odometer tween curve live
 * here and are imported by mobile via `@suppr/shared/motion`, so these tests
 * pin the maths that BOTH platforms share. If a future edit changes the curve
 * or the spring constants, this test (and its mobile twin) breaks.
 *
 * Mobile twin: `apps/mobile/tests/unit/motion.test.ts` — same assertions,
 * imported through the shared alias, so web ↔ mobile cannot drift.
 */
import { describe, it, expect } from "vitest";

import {
  ODOMETER_MS,
  SHEET_MORPH_SCALE,
  SPRING_DEFAULT,
  SPRING_SNAPPY,
  odometerProgress,
  odometerValue,
} from "@/lib/motion";

describe("odometerValue (shared count-up curve)", () => {
  it("returns the rounded start value at t = 0", () => {
    expect(odometerValue(1200, 1850, 0)).toBe(1200);
    expect(odometerValue(1200.6, 1850, 0)).toBe(1201); // start is rounded
  });

  it("lands EXACTLY on target at t = 1 (no rounding drift)", () => {
    expect(odometerValue(0, 1847, 1)).toBe(1847);
    // Even with an awkward target the end frame is exact, not rounded-from-eased.
    expect(odometerValue(123, 1846.4, 1)).toBe(1846.4);
  });

  it("clamps out-of-range t to the endpoints", () => {
    expect(odometerValue(100, 900, -0.5)).toBe(100);
    expect(odometerValue(100, 900, 1.5)).toBe(900);
  });

  it("is monotonic non-decreasing while counting UP", () => {
    let prev = -Infinity;
    for (let i = 0; i <= 20; i++) {
      const v = odometerValue(0, 2000, i / 20);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("is monotonic non-increasing while counting DOWN", () => {
    let prev = Infinity;
    for (let i = 0; i <= 20; i++) {
      const v = odometerValue(2000, 0, i / 20);
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
  });

  it("uses cubic-out easing (front-loaded — past the midpoint by t = 0.5)", () => {
    // cubic-out covers 1 - (1-0.5)^3 = 0.875 of the distance at the halfway
    // point in time, so the displayed value is well past the linear midpoint.
    const mid = odometerValue(0, 1000, 0.5);
    expect(mid).toBe(875);
    expect(mid).toBeGreaterThan(500);
  });

  it("rounds intermediate frames to whole numbers", () => {
    const v = odometerValue(0, 333, 0.31);
    expect(Number.isInteger(v)).toBe(true);
  });
});

describe("odometerProgress (RAF clock math)", () => {
  it("is 0 at the start instant", () => {
    expect(odometerProgress(1_000, 1_000, 900)).toBe(0);
  });

  it("is 1 once the duration has elapsed", () => {
    expect(odometerProgress(1_000, 1_900, 900)).toBe(1);
    expect(odometerProgress(1_000, 5_000, 900)).toBe(1); // clamped
  });

  it("is the linear fraction mid-tween", () => {
    expect(odometerProgress(1_000, 1_450, 900)).toBeCloseTo(0.5, 5);
  });

  it("never returns negative for a clock that hasn't started", () => {
    expect(odometerProgress(2_000, 1_000, 900)).toBe(0);
  });

  it("defaults to the shared ODOMETER_MS duration", () => {
    // Half of the default duration → 0.5 progress.
    expect(odometerProgress(0, ODOMETER_MS / 2)).toBeCloseTo(0.5, 5);
  });

  it("treats a zero/negative duration as instantly complete", () => {
    expect(odometerProgress(0, 0, 0)).toBe(1);
  });
});

describe("spring personality constants (the single tuned vocabulary)", () => {
  it("DEFAULT is the calm spring, SNAPPY is the quick spring", () => {
    expect(SPRING_DEFAULT).toEqual({ damping: 18, stiffness: 200, mass: 0.7 });
    expect(SPRING_SNAPPY).toEqual({ damping: 22, stiffness: 280, mass: 0.5 });
  });

  it("SNAPPY is stiffer and lighter than DEFAULT (quicker settle)", () => {
    expect(SPRING_SNAPPY.stiffness).toBeGreaterThan(SPRING_DEFAULT.stiffness);
    expect(SPRING_SNAPPY.mass).toBeLessThan(SPRING_DEFAULT.mass);
  });

  it("odometer duration matches the ~900ms design brief", () => {
    expect(ODOMETER_MS).toBe(900);
  });

  it("sheet morph scales the trigger down by ~4%", () => {
    expect(SHEET_MORPH_SCALE).toBe(0.96);
  });
});
