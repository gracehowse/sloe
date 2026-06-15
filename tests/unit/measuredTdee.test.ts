import { describe, expect, it } from "vitest";
import {
  computeMeasuredTDEE,
  MIN_COMPLETE_WEAR_DAYS,
  MEASURED_TDEE_WINDOW_DAYS,
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
