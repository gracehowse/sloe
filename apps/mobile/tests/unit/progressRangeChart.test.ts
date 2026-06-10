import { describe, expect, it } from "vitest";

import {
  progressRangeKeyToWeightRange,
  weightDeltaTone,
  type ProgressRangeKey,
} from "@suppr/shared/progress/progressRangeChart";

/**
 * Premium-audit P0-1 (2026-06-10): the Progress weight card hardcoded the
 * chart at "1m" while the top range picker drove every other stat. This
 * helper makes the picker key the chart range too — pin the mapping and
 * the toward/away-from-goal delta tone so a regression fails the suite.
 */

describe("progressRangeKeyToWeightRange", () => {
  it("maps each picker key to the canonical WeightChart range", () => {
    expect(progressRangeKeyToWeightRange("7d")).toBe("1w");
    expect(progressRangeKeyToWeightRange("30d")).toBe("1m");
    expect(progressRangeKeyToWeightRange("90d")).toBe("3m");
    expect(progressRangeKeyToWeightRange("all")).toBe("all");
  });

  it("covers every ProgressRangeKey (exhaustive — no key falls through)", () => {
    const keys: ProgressRangeKey[] = ["7d", "30d", "90d", "all"];
    for (const k of keys) {
      // A missing case would return undefined; assert each yields a
      // non-empty WeightRange string.
      const r = progressRangeKeyToWeightRange(k);
      expect(typeof r).toBe("string");
      expect(r.length).toBeGreaterThan(0);
    }
  });
});

describe("weightDeltaTone", () => {
  // Loss goal (goal below baseline): losing reads as progress, gaining as regress.
  it("loss goal — losing weight is progress (toward goal)", () => {
    // baseline 80, lost 0.6 → delta −0.6, goal 75 (below baseline)
    expect(weightDeltaTone(-0.6, 80, 75)).toBe("progress");
  });

  it("loss goal — gaining weight is regress (away from goal)", () => {
    expect(weightDeltaTone(0.6, 80, 75)).toBe("regress");
  });

  // Gain goal (goal above baseline): gaining reads as progress.
  it("gain goal — gaining weight is progress (toward goal)", () => {
    expect(weightDeltaTone(0.6, 70, 78)).toBe("progress");
  });

  it("gain goal — losing weight is regress (away from goal)", () => {
    expect(weightDeltaTone(-0.6, 70, 78)).toBe("regress");
  });

  it("no goal set → neutral", () => {
    expect(weightDeltaTone(-0.6, 80, null)).toBe("neutral");
  });

  it("sub-50g movement → neutral regardless of goal direction", () => {
    expect(weightDeltaTone(0.04, 80, 75)).toBe("neutral");
    expect(weightDeltaTone(-0.04, 80, 75)).toBe("neutral");
  });

  it("goal already at baseline (no direction to move) → neutral", () => {
    expect(weightDeltaTone(-0.6, 75, 75)).toBe("neutral");
  });

  it("non-finite inputs → neutral (defensive)", () => {
    expect(weightDeltaTone(Number.NaN, 80, 75)).toBe("neutral");
    expect(weightDeltaTone(-0.6, Number.NaN, 75)).toBe("neutral");
  });

  it("the arrow stays factual — tone is independent of sign, keyed on goal", () => {
    // Same downward movement is progress under a loss goal but regress
    // under a gain goal: the tone encodes goal-relative meaning, not the
    // raw direction (the arrow icon carries direction separately).
    expect(weightDeltaTone(-0.5, 80, 75)).toBe("progress");
    expect(weightDeltaTone(-0.5, 80, 85)).toBe("regress");
  });
});
