/**
 * adaptiveDataProgress — honest "how close to adaptive maintenance?" gate.
 *
 * ENG-1189. The Progress Maintenance card used to render `Weigh-ins X/7` +
 * `Logging days X/21` against LIFETIME any-entry day counts, while the engine
 * engages adaptive at MEDIUM confidence over GATED full days in the trailing
 * window. A persona saw 10/7 + 21/21 ("full") yet "Formula estimate · will
 * activate once enough data accumulates." This suite pins the new contract:
 *
 *   - the displayed targets are the medium-confidence engage thresholds;
 *   - the displayed counts use the engine's gate (full days + in-window);
 *   - `ready` flips iff `computeAdaptiveTDEE` would publish a medium/high value;
 *   - the message names the real missing requirement, never the old lie.
 */

import { describe, expect, it } from "vitest";
import {
  computeAdaptiveDataProgress,
  computeAdaptiveDataProgressFromMeals,
} from "../../src/lib/nutrition/adaptiveDataProgress";
import {
  computeAdaptiveTDEE,
  MEDIUM_CONFIDENCE_LOGGING_DAYS,
  MEDIUM_CONFIDENCE_WEIGH_INS,
} from "../../src/lib/nutrition/adaptiveTdee";

function recentDays(count: number, endOffset = 0): string[] {
  const days: string[] = [];
  for (let i = count - 1 + endOffset; i >= endOffset; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${day}`);
  }
  return days;
}

describe("computeAdaptiveDataProgress — targets are the engage thresholds", () => {
  it("exposes the medium-confidence thresholds as the displayed targets, not /7 + /21", () => {
    const p = computeAdaptiveDataProgress({ intakeByDay: {}, weightByDay: {} });
    expect(p.loggingDaysTarget).toBe(MEDIUM_CONFIDENCE_LOGGING_DAYS); // 14, not 21
    expect(p.weighInsTarget).toBe(MEDIUM_CONFIDENCE_WEIGH_INS); // 5, not 7
  });

  it("with zero data: not ready, names both requirements", () => {
    const p = computeAdaptiveDataProgress({ intakeByDay: {}, weightByDay: {} });
    expect(p.ready).toBe(false);
    expect(p.loggingDays).toBe(0);
    expect(p.weighIns).toBe(0);
    expect(p.message).toMatch(/weigh-ins/);
    expect(p.message).toMatch(/full logging days/);
    // The old contradictory copy must be gone.
    expect(p.message).not.toMatch(/once enough data accumulates/i);
  });
});

describe("computeAdaptiveDataProgress — counts mirror the engine gate", () => {
  it("only counts GATED full days, not partial-log days", () => {
    const days = recentDays(20);
    const intakeByDay: Record<string, number> = {};
    const entryCountByDay: Record<string, number> = {};
    // 8 full days (well over the 1000 floor, 2+ entries), 12 snack-only days.
    days.forEach((d, idx) => {
      if (idx < 8) {
        intakeByDay[d] = 2000;
        entryCountByDay[d] = 3;
      } else {
        intakeByDay[d] = 250; // a single snack — partial
        entryCountByDay[d] = 1;
      }
    });
    const weightByDay: Record<string, number> = {};
    recentDays(5).forEach((d) => (weightByDay[d] = 80));

    const p = computeAdaptiveDataProgress({
      intakeByDay,
      weightByDay,
      entryCountByDay,
    });
    // 8 gated days < 14 target; 20 lifetime any-entry days would have read "full".
    expect(p.loggingDays).toBe(8);
    expect(p.excludedPartialDays).toBe(12);
    expect(p.ready).toBe(false);
    // The partial-day reason is surfaced so the user knows snacks don't count.
    expect(p.message).toMatch(/partial days don't count/i);
  });

  it("does not count days outside the trailing window", () => {
    const inWindow = recentDays(10); // days 0..9 ago
    const outOfWindow = recentDays(10, 40); // days 40..49 ago — beyond 28d
    const intakeByDay: Record<string, number> = {};
    const entryCountByDay: Record<string, number> = {};
    [...inWindow, ...outOfWindow].forEach((d) => {
      intakeByDay[d] = 2000;
      entryCountByDay[d] = 3;
    });
    const weightByDay: Record<string, number> = {};
    recentDays(6).forEach((d) => (weightByDay[d] = 80));

    const p = computeAdaptiveDataProgress({
      intakeByDay,
      weightByDay,
      entryCountByDay,
    });
    expect(p.loggingDays).toBe(10); // only in-window full days
    expect(p.weighIns).toBe(6);
  });
});

describe("computeAdaptiveDataProgress — ready iff the engine would publish", () => {
  it("ready === true exactly when computeAdaptiveTDEE publishes medium/high", () => {
    const days = recentDays(14);
    const intakeByDay: Record<string, number> = {};
    const entryCountByDay: Record<string, number> = {};
    days.forEach((d) => {
      intakeByDay[d] = 2100;
      entryCountByDay[d] = 3;
    });
    const weightByDay: Record<string, number> = {};
    recentDays(5).forEach((d) => (weightByDay[d] = 80));

    const p = computeAdaptiveDataProgress({
      intakeByDay,
      weightByDay,
      entryCountByDay,
    });
    expect(p.loggingDays).toBe(14);
    expect(p.weighIns).toBe(5);
    expect(p.ready).toBe(true);
    expect(p.message).toMatch(/enough data/i);
    expect(p.message).toMatch(/recompute/i);

    const engine = computeAdaptiveTDEE({
      intakeByDay,
      weightByDay,
      entryCountByDay,
    });
    expect(engine).not.toBeNull();
    expect(engine!.confidence === "medium" || engine!.confidence === "high").toBe(true);
  });

  it("NOT ready when weigh-ins alone are short, names the weigh-in gap", () => {
    const days = recentDays(14);
    const intakeByDay: Record<string, number> = {};
    const entryCountByDay: Record<string, number> = {};
    days.forEach((d) => {
      intakeByDay[d] = 2100;
      entryCountByDay[d] = 3;
    });
    const weightByDay: Record<string, number> = {};
    recentDays(3).forEach((d) => (weightByDay[d] = 80)); // 3 < 5 target

    const p = computeAdaptiveDataProgress({
      intakeByDay,
      weightByDay,
      entryCountByDay,
    });
    expect(p.loggingDays).toBe(14);
    expect(p.weighIns).toBe(3);
    expect(p.ready).toBe(false);
    expect(p.message).toMatch(/2 more weigh-ins/);
    expect(p.message).not.toMatch(/full logging days/);
  });

  it("the bug scenario: lots of LIFETIME days but few in-window full days stays NOT ready", () => {
    // Mirrors the persona: a big lifetime any-entry count would have shown
    // "21/21" full, but the trailing-window gated count is small.
    const recentFull = recentDays(6); // 6 in-window full days
    const oldFull = recentDays(30, 30); // 30 days, all beyond the 28d window
    const intakeByDay: Record<string, number> = {};
    const entryCountByDay: Record<string, number> = {};
    [...recentFull, ...oldFull].forEach((d) => {
      intakeByDay[d] = 2000;
      entryCountByDay[d] = 3;
    });
    const weightByDay: Record<string, number> = {};
    recentDays(10).forEach((d) => (weightByDay[d] = 80)); // 10 weigh-ins, but...

    const p = computeAdaptiveDataProgress({
      intakeByDay,
      weightByDay,
      entryCountByDay,
    });
    // Lifetime full days = 36; in-window = 6. Honest count is 6/14 → still gated.
    expect(p.loggingDays).toBe(6);
    expect(p.ready).toBe(false);
    expect(p.message).toMatch(/full logging days/);
  });
});

describe("computeAdaptiveDataProgressFromMeals — adapter", () => {
  it("derives intake + entry counts from a meals-by-day map and gates correctly", () => {
    const days = recentDays(14);
    const mealsByDay: Record<string, { calories: number }[]> = {};
    days.forEach((d) => {
      mealsByDay[d] = [{ calories: 700 }, { calories: 700 }, { calories: 700 }];
    });
    const weightByDay: Record<string, number> = {};
    recentDays(5).forEach((d) => (weightByDay[d] = 80));

    const p = computeAdaptiveDataProgressFromMeals({
      mealsByDay,
      weightByDay,
      sex: "female",
      weightKg: 60,
      heightCm: 165,
      age: 30,
    });
    expect(p.loggingDays).toBe(14);
    expect(p.weighIns).toBe(5);
    expect(p.ready).toBe(true);
  });

  it("a single big-calorie entry per day is NOT a full day (entry-count gate)", () => {
    const days = recentDays(14);
    const mealsByDay: Record<string, { calories: number }[]> = {};
    days.forEach((d) => {
      mealsByDay[d] = [{ calories: 2200 }]; // one entry — below the ≥2 floor
    });
    const weightByDay: Record<string, number> = {};
    recentDays(5).forEach((d) => (weightByDay[d] = 80));

    const p = computeAdaptiveDataProgressFromMeals({
      mealsByDay,
      weightByDay,
      sex: "female",
      weightKg: 60,
      heightCm: 165,
      age: 30,
    });
    expect(p.loggingDays).toBe(0);
    expect(p.excludedPartialDays).toBe(14);
    expect(p.ready).toBe(false);
  });

  it("ignores empty day arrays", () => {
    const mealsByDay: Record<string, { calories: number }[]> = {};
    recentDays(5).forEach((d) => (mealsByDay[d] = []));
    const p = computeAdaptiveDataProgressFromMeals({
      mealsByDay,
      weightByDay: {},
    });
    expect(p.loggingDays).toBe(0);
    expect(p.weighIns).toBe(0);
  });
});
