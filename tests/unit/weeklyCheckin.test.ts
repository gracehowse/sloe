import { describe, it, expect } from "vitest";
import {
  buildWeeklyCheckinContent,
  shouldShowWeeklyCheckin,
  MIN_DAYS_LOGGED_FOR_CHECKIN,
  type WeeklyCheckinGateInput,
} from "@/lib/nutrition/weeklyCheckin";

const NOW = new Date("2026-05-03T10:00:00Z");

function gate(overrides: Partial<WeeklyCheckinGateInput> = {}): WeeklyCheckinGateInput {
  return {
    adaptiveTdeeConfidence: "medium",
    adaptiveTdee: 2100,
    daysLoggedThisWeek: MIN_DAYS_LOGGED_FOR_CHECKIN,
    lastShownAt: null,
    now: NOW,
    ...overrides,
  };
}

describe("shouldShowWeeklyCheckin", () => {
  it("fires for medium-confidence with 5+ days logged and no prior show", () => {
    expect(shouldShowWeeklyCheckin(gate())).toBe(true);
  });

  it("fires for high-confidence", () => {
    expect(shouldShowWeeklyCheckin(gate({ adaptiveTdeeConfidence: "high" }))).toBe(true);
  });

  it("does not fire when confidence is low", () => {
    expect(shouldShowWeeklyCheckin(gate({ adaptiveTdeeConfidence: "low" }))).toBe(false);
  });

  it("does not fire when confidence is null (math hasn't resolved)", () => {
    expect(shouldShowWeeklyCheckin(gate({ adaptiveTdeeConfidence: null }))).toBe(false);
  });

  it("does not fire when adaptive TDEE is null / non-finite / non-positive", () => {
    expect(shouldShowWeeklyCheckin(gate({ adaptiveTdee: null }))).toBe(false);
    expect(shouldShowWeeklyCheckin(gate({ adaptiveTdee: NaN }))).toBe(false);
    expect(shouldShowWeeklyCheckin(gate({ adaptiveTdee: 0 }))).toBe(false);
    expect(shouldShowWeeklyCheckin(gate({ adaptiveTdee: -100 }))).toBe(false);
  });

  it("does not fire when fewer than 5 days logged", () => {
    expect(shouldShowWeeklyCheckin(gate({ daysLoggedThisWeek: 4 }))).toBe(false);
    expect(shouldShowWeeklyCheckin(gate({ daysLoggedThisWeek: 0 }))).toBe(false);
  });

  it("fires when 6 or 7 days logged", () => {
    expect(shouldShowWeeklyCheckin(gate({ daysLoggedThisWeek: 6 }))).toBe(true);
    expect(shouldShowWeeklyCheckin(gate({ daysLoggedThisWeek: 7 }))).toBe(true);
  });

  it("does not fire when shown within the last 6 days", () => {
    const fiveDaysAgo = new Date(NOW.getTime() - 5 * 86400_000).toISOString();
    expect(shouldShowWeeklyCheckin(gate({ lastShownAt: fiveDaysAgo }))).toBe(false);
  });

  it("fires when last shown was 6+ days ago", () => {
    const sevenDaysAgo = new Date(NOW.getTime() - 7 * 86400_000).toISOString();
    expect(shouldShowWeeklyCheckin(gate({ lastShownAt: sevenDaysAgo }))).toBe(true);
  });

  it("treats invalid lastShownAt as 'never shown'", () => {
    expect(shouldShowWeeklyCheckin(gate({ lastShownAt: "not-a-date" }))).toBe(true);
  });
});

describe("buildWeeklyCheckinContent", () => {
  it("computes positive delta + suggests higher target preserving deficit", () => {
    const content = buildWeeklyCheckinContent({
      adaptiveTdee: 2300,
      priorTdee: 2100,
      currentTargetKcal: 1800, // 300 kcal deficit
      avgCaloriesThisWeek: 1750,
      weightDeltaKg: -0.4,
    });
    expect(content.tdeeDeltaKcal).toBe(200);
    // Suggested = 1800 + 200 = 2000 (deficit preserved at 300)
    expect(content.suggestedTargetKcal).toBe(2000);
    expect(content.whyLine).toMatch(/higher than the formula/);
    expect(content.whyLine).toContain("+200 kcal");
  });

  it("computes negative delta + suggests lower target", () => {
    const content = buildWeeklyCheckinContent({
      adaptiveTdee: 1900,
      priorTdee: 2100,
      currentTargetKcal: 1800,
      avgCaloriesThisWeek: 1850,
      weightDeltaKg: 0.2,
    });
    expect(content.tdeeDeltaKcal).toBe(-200);
    expect(content.suggestedTargetKcal).toBe(1600);
    expect(content.whyLine).toMatch(/lower than the formula/);
    // Unicode minus, not ASCII
    expect(content.whyLine).toContain("−200 kcal");
  });

  it("never suggests below the 1200 kcal floor", () => {
    const content = buildWeeklyCheckinContent({
      adaptiveTdee: 1300,
      priorTdee: 2200,
      currentTargetKcal: 1500,
      avgCaloriesThisWeek: 1450,
      weightDeltaKg: null,
    });
    // Raw would be 1500 + (1300-2200) = 600 → clamped to 1200
    expect(content.suggestedTargetKcal).toBe(1200);
  });

  it("suppresses weight delta label when null (never fabricates +0.0 kg)", () => {
    const content = buildWeeklyCheckinContent({
      adaptiveTdee: 2100,
      priorTdee: 2100,
      currentTargetKcal: 1800,
      avgCaloriesThisWeek: 1820,
      weightDeltaKg: null,
    });
    expect(content.weightDeltaLabel).toBeNull();
    expect(content.tdeeDeltaKcal).toBe(0);
    expect(content.whyLine).toMatch(/held steady/);
  });

  it("renders weight delta with unicode minus + tabular-friendly formatting", () => {
    const negative = buildWeeklyCheckinContent({
      adaptiveTdee: 2100,
      priorTdee: 2050,
      currentTargetKcal: 1800,
      avgCaloriesThisWeek: 1750,
      weightDeltaKg: -0.6,
    });
    expect(negative.weightDeltaLabel).toBe("−0.6 kg");
    const positive = buildWeeklyCheckinContent({
      adaptiveTdee: 2100,
      priorTdee: 2050,
      currentTargetKcal: 1800,
      avgCaloriesThisWeek: 1750,
      weightDeltaKg: 0.3,
    });
    expect(positive.weightDeltaLabel).toBe("+0.3 kg");
  });

  it("falls back to current target when prior TDEE is missing", () => {
    const content = buildWeeklyCheckinContent({
      adaptiveTdee: 2100,
      priorTdee: null,
      currentTargetKcal: 1800,
      avgCaloriesThisWeek: 1820,
      weightDeltaKg: null,
    });
    expect(content.tdeeDeltaKcal).toBeNull();
    // No delta = keep target as-is.
    expect(content.suggestedTargetKcal).toBe(1800);
    expect(content.whyLine).toMatch(/Your real burn this week is 2,100 kcal a day\./);
  });

  it("avg this week label uses tabular-friendly group separator (en-GB)", () => {
    const content = buildWeeklyCheckinContent({
      adaptiveTdee: 2300,
      priorTdee: 2100,
      currentTargetKcal: 1800,
      avgCaloriesThisWeek: 1750,
      weightDeltaKg: null,
    });
    expect(content.avgThisWeekLabel).toBe("1,750 kcal/day");
  });

  it("never uses exclamation marks or performance adjectives in copy", () => {
    const content = buildWeeklyCheckinContent({
      adaptiveTdee: 2300,
      priorTdee: 2100,
      currentTargetKcal: 1800,
      avgCaloriesThisWeek: 1750,
      weightDeltaKg: 0.0,
    });
    const allText = `${content.headline} ${content.whyLine}`;
    expect(allText).not.toContain("!");
    expect(allText.toLowerCase()).not.toMatch(/great|amazing|crushing|killing it|nailed it/);
  });
});
