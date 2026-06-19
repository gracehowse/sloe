import { describe, expect, it } from "vitest";
import {
  computeMeasuredTDEE,
  MIN_COMPLETE_WEAR_DAYS,
  MEASURED_TDEE_WINDOW_DAYS,
  HIGH_CONFIDENCE_WEAR_DAYS,
  RESTING_VS_MEDIAN_FLOOR,
  PLAUSIBILITY_LOWER_FRACTION,
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

  // ── ENG-1111 under-eating safety guards ──────────────────────────────────
  // basal_burn_by_day is the plain SUM of on-wrist basal samples (no full-day
  // extrapolation), so a partially-worn day stores a truncated (low) basal that
  // biases the median DOWN — toward recommending too little food. These tests
  // pin the UNDER-EATING direction: truncated/implausibly-low signals must be
  // EXCLUDED or REJECTED, never surfaced as a low maintenance.

  it("FIX 1 — RESTING_VS_MEDIAN_FLOOR is the 0.8 (≈80% wear) threshold", () => {
    expect(RESTING_VS_MEDIAN_FLOOR).toBe(0.8);
  });

  it("FIX 1 — a 70%-worn day (resting = 0.7 × median) is now EXCLUDED (was kept at 0.6)", () => {
    // 20 full-wear days at resting 1500 + active 400 = 1900/day. Then 6 days at
    // 70% wear: resting = 0.7 × 1500 = 1050 (truncated basal) + active 400.
    // Window median resting = 1500; 0.8 floor = 1200. 1050 < 1200 → EXCLUDED.
    // Under the OLD 0.6 floor (900) those 1050-resting days would have PASSED
    // and dragged the median total burn down toward 1450 — too little food.
    const keys = dayKeys(26);
    const restingByDay: Record<string, number> = {};
    const activeByDay: Record<string, number> = {};
    for (const k of keys) {
      restingByDay[k] = 1500;
      activeByDay[k] = 400;
    }
    // First 6 days: 70%-worn → truncated basal that the 0.8 floor must reject.
    for (let i = 0; i < 6; i++) {
      restingByDay[keys[i]] = 1050; // 0.7 × 1500, between the old 0.6 and new 0.8 floors
    }
    const result = computeMeasuredTDEE({ restingByDay, activeByDay, bmrKcal: 1400 });
    expect(result).not.toBeNull();
    // Only the 20 full-wear days count — the six 70%-worn days are gone.
    expect(result!.wearDays).toBe(20);
    // Median total burn stays anchored to the full days (1900), NOT dragged
    // down by the truncated days (which would have pulled it toward ~1450).
    expect(result!.tdee).toBe(1900);
    // The truncated-day total (1050 + 400 = 1450) must never be the answer.
    expect(result!.tdee).toBeGreaterThan(1450);
  });

  it("FIX 2 — REJECTS (null) a median below the resting-energy floor", () => {
    // 20 complete-wear days whose median total burn = 1500 + 200 = 1700, but the
    // HealthKit resting-energy floor is 1800. A maintenance below the user's own
    // resting energy is an under-eating-risk contradiction → reject, don't surface.
    const keys = dayKeys(20);
    const restingByDay: Record<string, number> = {};
    const activeByDay: Record<string, number> = {};
    for (const k of keys) {
      restingByDay[k] = 1500;
      activeByDay[k] = 200;
    }
    const rejected = computeMeasuredTDEE({
      restingByDay,
      activeByDay,
      bmrKcal: 1300,
      restingEnergyFloorKcal: 1800,
    });
    expect(rejected).toBeNull();
    // Same data WITHOUT the floor still produces the (now-known-low) estimate —
    // proves the null came from the floor, not from the wear gate.
    const withoutFloor = computeMeasuredTDEE({
      restingByDay,
      activeByDay,
      bmrKcal: 1300,
    });
    expect(withoutFloor).not.toBeNull();
    expect(withoutFloor!.tdee).toBe(1700);
  });

  it("FIX 2 — REJECTS (null) a median below 0.85 × sedentary plausibility bound", () => {
    // Median total burn = 1500 + 100 = 1600. Sedentary TDEE 2000 → 0.85× = 1700.
    // 1600 < 1700 → implausibly low maintenance → reject.
    const keys = dayKeys(20);
    const restingByDay: Record<string, number> = {};
    const activeByDay: Record<string, number> = {};
    for (const k of keys) {
      restingByDay[k] = 1500;
      activeByDay[k] = 100;
    }
    const sedentary = 2000;
    expect(1600).toBeLessThan(PLAUSIBILITY_LOWER_FRACTION * sedentary); // 1700
    const rejected = computeMeasuredTDEE({
      restingByDay,
      activeByDay,
      bmrKcal: 1300,
      sedentaryTdeeKcal: sedentary,
    });
    expect(rejected).toBeNull();
  });

  it("FIX 2 — a median AT/ABOVE the plausibility bound still surfaces (no over-rejection)", () => {
    // Median total burn = 1500 + 300 = 1800. Sedentary 2000 → 0.85× = 1700.
    // 1800 ≥ 1700 → plausible → surfaced (the floor must not over-reject).
    const keys = dayKeys(20);
    const restingByDay: Record<string, number> = {};
    const activeByDay: Record<string, number> = {};
    for (const k of keys) {
      restingByDay[k] = 1500;
      activeByDay[k] = 300;
    }
    const result = computeMeasuredTDEE({
      restingByDay,
      activeByDay,
      bmrKcal: 1300,
      sedentaryTdeeKcal: 2000,
      restingEnergyFloorKcal: 1400,
    });
    expect(result).not.toBeNull();
    expect(result!.tdee).toBe(1800);
  });
});
