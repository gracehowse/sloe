import { describe, expect, it } from "vitest";

import {
  buildWhyNumberResultSubtitle,
  formatWhyNumberHeroKcal,
  whyNumberV3Rows,
} from "../../src/lib/whyNumberV3";
import { buildWhyThisNumber } from "../../src/lib/nutrition/whyThisNumber";

describe("whyNumberV3 helpers", () => {
  const baseInput = {
    targetCalories: 1840,
    maintenanceTdee: 2110,
    confidence: "high" as const,
    loggingDays: 21,
    goal: "lose" as const,
    paceKgPerWeek: -0.5,
  };

  it("formats hero kcal with grouping", () => {
    expect(formatWhyNumberHeroKcal(1840)).toBe("1,840");
  });

  it("builds maintenance − deficit subtitle", () => {
    const result = buildWhyThisNumber(baseInput);
    expect(buildWhyNumberResultSubtitle(result.lines)).toContain("2,110");
    expect(buildWhyNumberResultSubtitle(result.lines)).toContain("deficit");
  });

  it("maps TDEE + goal rows for the set-ic breakdown", () => {
    const result = buildWhyThisNumber(baseInput);
    const rows = whyNumberV3Rows(result);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.key).toBe("tdee");
    expect(rows[0]?.highlight).toBe(true);
    expect(rows[1]?.key).toBe("goal");
    expect(rows[1]?.value).toMatch(/[−+]/);
  });
});
