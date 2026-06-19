import { describe, expect, it } from "vitest";
import {
  computeMeasuredTDEE,
  MIN_COMPLETE_WEAR_DAYS,
  MEASURED_TDEE_WINDOW_DAYS,
  HIGH_CONFIDENCE_WEAR_DAYS,
} from "@/lib/nutrition/measuredTdee";

function dayKeys(n: number, start = "2026-05-01"): string[] {
  const [y, m, d] = start.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  return Array.from({ length: n }, (_, i) => {
    const dt = new Date(base);
    dt.setUTCDate(base.getUTCDate() + i);
    return dt.toISOString().slice(0, 10);
  });
}

describe("computeMeasuredTDEE (ENG-1111)", () => {
  it("returns null when fewer than MIN_COMPLETE_WEAR_DAYS complete-wear days", () => {
    const keys = dayKeys(10);
    const restingByDay: Record<string, number> = {};
    const activeByDay: Record<string, number> = {};
    for (const k of keys) {
      restingByDay[k] = 1500;
      activeByDay[k] = 400;
    }
    expect(computeMeasuredTDEE({ restingByDay, activeByDay, bmrKcal: 1400 })).toBeNull();
    expect(MIN_COMPLETE_WEAR_DAYS).toBe(14);
  });

  it("median daily total burn over complete-wear days at medium confidence", () => {
    const keys = dayKeys(16);
    const restingByDay: Record<string, number> = {};
    const activeByDay: Record<string, number> = {};
    for (const k of keys) {
      restingByDay[k] = 1500;
      activeByDay[k] = 400;
    }
    const result = computeMeasuredTDEE({ restingByDay, activeByDay, bmrKcal: 1400 });
    expect(result).not.toBeNull();
    expect(result!.tdee).toBe(1900);
    expect(result!.confidence).toBe("medium");
    expect(result!.wearDays).toBeGreaterThanOrEqual(MIN_COMPLETE_WEAR_DAYS);
  });

  it("high confidence when ≥21 complete-wear days in window", () => {
    const keys = dayKeys(21);
    const restingByDay: Record<string, number> = {};
    const activeByDay: Record<string, number> = {};
    for (const k of keys) {
      restingByDay[k] = 1550;
      activeByDay[k] = 450;
    }
    const result = computeMeasuredTDEE({ restingByDay, activeByDay, bmrKcal: 1400 });
    expect(result!.confidence).toBe("high");
    expect(result!.tdee).toBe(2000);
  });

  it("excludes incomplete-wear days (resting below median floor)", () => {
    const keys = dayKeys(MEASURED_TDEE_WINDOW_DAYS);
    const restingByDay: Record<string, number> = {};
    const activeByDay: Record<string, number> = {};
    for (const k of keys) {
      restingByDay[k] = 1500;
      activeByDay[k] = 400;
    }
    // Half the window missing watch — resting too low vs median
    for (let i = 0; i < 14; i++) {
      restingByDay[keys[i]] = 400;
    }
    const result = computeMeasuredTDEE({ restingByDay, activeByDay, bmrKcal: 1400 });
    expect(result).not.toBeNull();
    expect(result!.wearDays).toBeLessThan(MEASURED_TDEE_WINDOW_DAYS);
  });

  it("per-day TDEE is resting + active, and the result is the MEDIAN (robust to a workout spike)", () => {
    const keys = dayKeys(15);
    const restingByDay: Record<string, number> = {};
    const activeByDay: Record<string, number> = {};
    // 14 ordinary days at resting 1500 + active 300 = 1800/day, plus one
    // outlier marathon day at 1500 + 2500 = 4000. A MEAN would be pulled up
    // (~1947); the MEDIAN must stay anchored to the typical day (1800).
    for (const k of keys) {
      restingByDay[k] = 1500;
      activeByDay[k] = 300;
    }
    activeByDay[keys[7]] = 2500; // single workout outlier
    const result = computeMeasuredTDEE({ restingByDay, activeByDay, bmrKcal: 1400 });
    expect(result).not.toBeNull();
    // Median of [1800 ×14, 4000 ×1] = 1800 — the outlier does not move it.
    expect(result!.tdee).toBe(1800);
    // wearDays counts every complete-wear day, including the outlier.
    expect(result!.wearDays).toBe(15);
  });

  it("HIGH_CONFIDENCE_WEAR_DAYS is the medium→high promotion threshold", () => {
    expect(HIGH_CONFIDENCE_WEAR_DAYS).toBe(21);
    const mediumKeys = dayKeys(HIGH_CONFIDENCE_WEAR_DAYS - 1);
    const highKeys = dayKeys(HIGH_CONFIDENCE_WEAR_DAYS);
    const build = (keys: string[]) => {
      const restingByDay: Record<string, number> = {};
      const activeByDay: Record<string, number> = {};
      for (const k of keys) {
        restingByDay[k] = 1500;
        activeByDay[k] = 400;
      }
      return computeMeasuredTDEE({ restingByDay, activeByDay, bmrKcal: 1400 });
    };
    expect(build(mediumKeys)!.confidence).toBe("medium");
    expect(build(highKeys)!.confidence).toBe("high");
  });

  it("drops a day with active energy but no resting reading (incomplete wear)", () => {
    const keys = dayKeys(20);
    const restingByDay: Record<string, number> = {};
    const activeByDay: Record<string, number> = {};
    for (const k of keys) {
      restingByDay[k] = 1500;
      activeByDay[k] = 400;
    }
    // Five days: watch logged active energy but no resting energy — the watch
    // wasn't worn for the resting window, so the day is not complete wear and
    // its (otherwise plausible) active energy must NOT inflate the estimate.
    for (let i = 0; i < 5; i++) {
      delete restingByDay[keys[i]];
      activeByDay[keys[i]] = 900;
    }
    const result = computeMeasuredTDEE({ restingByDay, activeByDay, bmrKcal: 1400 });
    expect(result).not.toBeNull();
    expect(result!.wearDays).toBe(15);
    expect(result!.tdee).toBe(1900); // resting 1500 + active 400 on kept days
  });

  it("returns null when BMR floor (0.7 × BMR) drops the window below the minimum", () => {
    // Resting clusters at 1000 but BMR is high (1800 → 0.7× = 1260 floor), so
    // every day fails the absolute physiological floor even though it clears
    // the relative median floor. No trustworthy estimate → null.
    const keys = dayKeys(20);
    const restingByDay: Record<string, number> = {};
    const activeByDay: Record<string, number> = {};
    for (const k of keys) {
      restingByDay[k] = 1000;
      activeByDay[k] = 300;
    }
    expect(computeMeasuredTDEE({ restingByDay, activeByDay, bmrKcal: 1800 })).toBeNull();
  });

  it("Grace case — measured ~1900 vs under-logged adaptive ~1329", () => {
    const keys = dayKeys(20);
    const restingByDay: Record<string, number> = {};
    const activeByDay: Record<string, number> = {};
    for (const k of keys) {
      restingByDay[k] = 1450;
      activeByDay[k] = 450;
    }
    const measured = computeMeasuredTDEE({ restingByDay, activeByDay, bmrKcal: 1350 });
    expect(measured).not.toBeNull();
    expect(measured!.tdee).toBeGreaterThanOrEqual(1850);
    expect(measured!.tdee).toBeLessThanOrEqual(1950);
    // Under-logged adaptive would sit near intake — measured must be higher
    expect(measured!.tdee).toBeGreaterThan(1329);
  });
});
