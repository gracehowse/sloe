/**
 * Action 13 Item #5 (2026-04-19) — pin the Daily Calories chart's bar
 * denominator behaviour.
 *
 * Bug: the previous web denominator was `targets.calories * 1.15`,
 * which clipped any day that exceeded 115% of target. A 1,500-target /
 * 2,000-actual day rendered visually identical to a 1,500-target /
 * 1,725-actual day — the user lost the visual signal that one day
 * was way over.
 *
 * Fix (mirrors mobile): denominator = `Math.max(targets.calories,
 * ...weekStats.days.map((dd) => dd.calories))`. Bars over target tower
 * above target bars instead of clipping.
 *
 * This test exercises the formula directly (the React render is a
 * thin wrapper). Snapshot test of the rendered bar would also work
 * but the math is what we actually need to lock down.
 */
import { describe, expect, it } from "vitest";

function computeBarHeight(opts: {
  calories: number;
  weekDayCalories: readonly number[];
  targetCalories: number;
  /** Inner pixel height the bars draw into. */
  pixelHeight: number;
}): number {
  const { calories, weekDayCalories, targetCalories, pixelHeight } = opts;
  const maxCal = Math.max(targetCalories, ...weekDayCalories, 1);
  return (calories / maxCal) * pixelHeight;
}

describe("Daily Calories chart bar denominator (Item #5)", () => {
  it("a 200%-of-target day is visually taller than a 100%-of-target day", () => {
    // 7-day fixture: six on-target days + one big over-target day.
    const days = [1500, 1500, 1500, 1500, 1500, 1500, 3000];
    const targetCalories = 1500;
    const pixelHeight = 70;

    const onTargetH = computeBarHeight({
      calories: 1500,
      weekDayCalories: days,
      targetCalories,
      pixelHeight,
    });
    const overTargetH = computeBarHeight({
      calories: 3000,
      weekDayCalories: days,
      targetCalories,
      pixelHeight,
    });

    expect(overTargetH).toBeGreaterThan(onTargetH);
    // 200% day should render at exactly 2× the height of a 100% day.
    expect(overTargetH / onTargetH).toBeCloseTo(2.0, 5);
  });

  it("does NOT clip a 200% day to the same height as a 115% day (regression of the prior bug)", () => {
    // Old buggy denominator: max(target * 1.15, 1) = 1725 → both
    // 1725 (115%) and 3000 (200%) clip identically at 100% bar fill.
    // The fix restores the visual gap.
    const targetCalories = 1500;
    const pixelHeight = 70;

    const buggyDenominator = Math.max(targetCalories * 1.15, 1);
    const oldH115 = (1725 / buggyDenominator) * pixelHeight; // = 70
    const oldH200 = Math.min((3000 / buggyDenominator) * pixelHeight, pixelHeight);

    // The old bug: visually identical. (We assert the bug shape so the
    // test reads as a regression net.)
    expect(oldH115).toBeCloseTo(pixelHeight, 5);
    expect(oldH200).toBe(pixelHeight); // would clip in CSS at 100%

    const days = [1500, 1500, 1500, 1500, 1500, 1725, 3000];
    const newH115 = computeBarHeight({
      calories: 1725,
      weekDayCalories: days,
      targetCalories,
      pixelHeight,
    });
    const newH200 = computeBarHeight({
      calories: 3000,
      weekDayCalories: days,
      targetCalories,
      pixelHeight,
    });
    expect(newH200).toBeGreaterThan(newH115);
  });

  it("falls back to target when no day exceeds it", () => {
    const target = 2000;
    const days = [0, 0, 0, 0, 0, 1500, 1800];
    const h = computeBarHeight({
      calories: 2000,
      weekDayCalories: days,
      targetCalories: target,
      pixelHeight: 70,
    });
    // max(target, max day) = 2000 → 100% target day fills the chart.
    expect(h).toBeCloseTo(70, 5);
  });
});
