import { describe, expect, it } from "vitest";

import { formatPlannedMealKcalMacrosLine } from "../../src/lib/nutrition/plannedMealDisplay";

describe("formatPlannedMealKcalMacrosLine", () => {
  it("shows rounded grams when values are large enough", () => {
    expect(formatPlannedMealKcalMacrosLine(500, 30, 40, 20)).toBe("500 kcal · P 30g · C 40g · F 20g");
  });

  it("uses <1 or one decimal when kcal is meaningful but grams round to 0", () => {
    const line = formatPlannedMealKcalMacrosLine(400, 0.3, 0.2, 0.15);
    expect(line).toContain("400 kcal");
    expect(line).not.toMatch(/P 0g · C 0g · F 0g/);
  });
});
