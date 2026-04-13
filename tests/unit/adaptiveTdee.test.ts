import { describe, it, expect } from "vitest";
import { computeAdaptiveTDEE } from "@/lib/nutrition/adaptiveTdee";

function generateDays(count: number, startDate: Date = new Date()): string[] {
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(startDate);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${day}`);
  }
  return days;
}

describe("computeAdaptiveTDEE", () => {
  it("returns null when insufficient logging days", () => {
    const days = generateDays(5);
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    days.forEach((d) => { intakeByDay[d] = 2000; weightByDay[d] = 80; });

    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay });
    expect(result).toBeNull();
  });

  it("returns null when insufficient weigh-ins", () => {
    const days = generateDays(14);
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    days.forEach((d) => { intakeByDay[d] = 2000; });
    weightByDay[days[0]] = 80;
    weightByDay[days[13]] = 79.5;

    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay });
    expect(result).toBeNull();
  });

  it("calculates TDEE for weight maintenance (stable weight)", () => {
    const days = generateDays(14);
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    days.forEach((d) => { intakeByDay[d] = 2200; weightByDay[d] = 80; });

    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay });
    expect(result).not.toBeNull();
    // Stable weight => TDEE should be close to avg intake
    expect(result!.tdee).toBeGreaterThanOrEqual(2100);
    expect(result!.tdee).toBeLessThanOrEqual(2300);
    expect(result!.avgDailyIntake).toBe(2200);
    expect(result!.confidence).toBe("medium");
  });

  it("estimates higher TDEE when losing weight", () => {
    const days = generateDays(14);
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    days.forEach((d, i) => {
      intakeByDay[d] = 1800;
      // Losing ~0.5kg/week = ~0.07kg/day over 14 days
      weightByDay[d] = 80 - i * 0.07;
    });

    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay });
    expect(result).not.toBeNull();
    // Losing weight while eating 1800 => TDEE must be > 1800
    expect(result!.tdee).toBeGreaterThan(1800);
    expect(result!.avgDailyIntake).toBe(1800);
  });

  it("estimates lower TDEE when gaining weight", () => {
    const days = generateDays(14);
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    days.forEach((d, i) => {
      intakeByDay[d] = 2500;
      // Gaining ~0.5kg/week
      weightByDay[d] = 80 + i * 0.07;
    });

    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay });
    expect(result).not.toBeNull();
    // Gaining weight while eating 2500 => TDEE must be < 2500
    expect(result!.tdee).toBeLessThan(2500);
  });

  it("confidence is high with 21+ logging days and 7+ weigh-ins", () => {
    const days = generateDays(21);
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    days.forEach((d) => { intakeByDay[d] = 2000; weightByDay[d] = 80; });

    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay });
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe("high");
  });

  it("respects custom window days", () => {
    const days = generateDays(10);
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    days.forEach((d) => { intakeByDay[d] = 2000; weightByDay[d] = 80; });

    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay, windowDays: 10 });
    expect(result).not.toBeNull();
    expect(result!.windowDays).toBe(10);
  });

  it("never returns TDEE below 800", () => {
    const days = generateDays(14);
    const intakeByDay: Record<string, number> = {};
    const weightByDay: Record<string, number> = {};
    days.forEach((d, i) => {
      intakeByDay[d] = 500;
      weightByDay[d] = 80 + i * 0.3; // Rapid weight gain on very low intake
    });

    const result = computeAdaptiveTDEE({ intakeByDay, weightByDay });
    expect(result).not.toBeNull();
    expect(result!.tdee).toBeGreaterThanOrEqual(800);
  });
});
