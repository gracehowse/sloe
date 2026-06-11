/**
 * ENG-1046 — both food-search commit hosts must call the shared helper.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../..");

describe("foodSelectionToMeal wiring (ENG-1046)", () => {
  it("mobile Today handleFoodSearchSelect uses foodSelectionToMealMacros", () => {
    const src = readFileSync(
      join(ROOT, "apps/mobile/app/(tabs)/index.tsx"),
      "utf8",
    );
    expect(src).toMatch(/foodSelectionToMealMacros/);
    expect(src).not.toMatch(/const isPerServingOnly = isPerServingPortion/);
  });

  it("web NutritionTracker commitFoodSearchSelection uses foodSelectionToMealMacros", () => {
    const src = readFileSync(
      join(ROOT, "src/app/components/NutritionTracker.tsx"),
      "utf8",
    );
    expect(src).toMatch(/foodSelectionToMealMacros/);
    expect(src).toMatch(/foodSelectionSourceLabel/);
    expect(src).toMatch(/foodSelectionAnalyticsSource/);
    expect(src).not.toMatch(/const isPerServingOnly = isPerServingPortion/);
  });
});
