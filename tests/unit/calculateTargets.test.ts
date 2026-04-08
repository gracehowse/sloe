import { describe, expect, it } from "vitest";
import { calculateMacroTargets } from "@/lib/macros/calculateTargets";

describe("calculateMacroTargets", () => {
  it("returns consistent macro targets for a typical profile", () => {
    const targets = calculateMacroTargets({
      age: 30,
      sex: "female",
      heightCm: 165,
      weightKg: 65,
      activityLevel: "moderate",
      goal: "maintain",
    });

    expect(targets.calories).toBeGreaterThan(1200);
    expect(targets.protein).toBeGreaterThan(0);
    expect(targets.carbs).toBeGreaterThan(0);
    expect(targets.fat).toBeGreaterThan(0);
    expect(targets.fiber).toBeGreaterThan(0);
    expect(targets.waterMl).toBeGreaterThan(0);
  });
});

