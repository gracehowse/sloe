/**
 * Web coverage for the shared Progress weight-chart wiring helper
 * (`src/lib/progress/progressRangeChart.ts`). Parity with
 * `apps/mobile/tests/unit/progressRangeChart.test.ts` — keep both in sync.
 *
 * Premium-audit P0-1 (2026-06-10): the mobile Progress weight card
 * hardcoded the chart at "1m" while the top range picker drove every
 * other stat. The fix routes both platforms through this one mapping; the
 * delta tone (toward/away-from-goal) is shared too. Pin both contracts.
 */
import { describe, it, expect } from "vitest";
import {
  progressRangeKeyToWeightRange,
  weightDeltaTone,
  type ProgressRangeKey,
} from "@/lib/progress/progressRangeChart";

describe("progressRangeKeyToWeightRange (web)", () => {
  it("maps each picker key to the canonical WeightChart range", () => {
    expect(progressRangeKeyToWeightRange("7d")).toBe("1w");
    expect(progressRangeKeyToWeightRange("30d")).toBe("1m");
    expect(progressRangeKeyToWeightRange("90d")).toBe("3m");
    expect(progressRangeKeyToWeightRange("all")).toBe("all");
  });

  it("covers every ProgressRangeKey (no key falls through to undefined)", () => {
    const keys: ProgressRangeKey[] = ["7d", "30d", "90d", "all"];
    for (const k of keys) {
      const r = progressRangeKeyToWeightRange(k);
      expect(typeof r).toBe("string");
      expect(r.length).toBeGreaterThan(0);
    }
  });
});

describe("weightDeltaTone (web)", () => {
  it("loss goal — losing is progress, gaining is regress", () => {
    expect(weightDeltaTone(-0.6, 80, 75)).toBe("progress");
    expect(weightDeltaTone(0.6, 80, 75)).toBe("regress");
  });

  it("gain goal — gaining is progress, losing is regress", () => {
    expect(weightDeltaTone(0.6, 70, 78)).toBe("progress");
    expect(weightDeltaTone(-0.6, 70, 78)).toBe("regress");
  });

  it("no goal / sub-50g / goal-at-baseline / non-finite → neutral", () => {
    expect(weightDeltaTone(-0.6, 80, null)).toBe("neutral");
    expect(weightDeltaTone(0.04, 80, 75)).toBe("neutral");
    expect(weightDeltaTone(-0.6, 75, 75)).toBe("neutral");
    expect(weightDeltaTone(Number.NaN, 80, 75)).toBe("neutral");
  });
});
