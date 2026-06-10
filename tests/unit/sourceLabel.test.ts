/**
 * formatNutritionSourceLabel — raw source ids must never reach the UI
 * (e2e walk 2026-06-10: "published by apple_health" shipped to users).
 */
import { describe, expect, it } from "vitest";
import { formatNutritionSourceLabel } from "../../src/lib/nutrition/sourceLabel";

describe("formatNutritionSourceLabel", () => {
  it("maps known source ids to display names", () => {
    expect(formatNutritionSourceLabel("apple_health")).toBe("Apple Health");
    expect(formatNutritionSourceLabel("fatsecret")).toBe("FatSecret");
    expect(formatNutritionSourceLabel("open_food_facts")).toBe("Open Food Facts");
    expect(formatNutritionSourceLabel("ai")).toBe("AI estimate");
    expect(formatNutritionSourceLabel("photo_correction")).toBe("photo log");
  });

  it("is case/whitespace tolerant (ids come from mixed writers)", () => {
    expect(formatNutritionSourceLabel(" Apple_Health ")).toBe("Apple Health");
    expect(formatNutritionSourceLabel("FatSecret")).toBe("FatSecret");
  });

  it("de-snakes and title-cases unknown ids so raw identifiers never render", () => {
    expect(formatNutritionSourceLabel("some_new_source")).toBe("Some New Source");
    expect(formatNutritionSourceLabel("weird-id")).toBe("Weird Id");
  });

  it("returns null for empty input so callers keep their own fallbacks", () => {
    expect(formatNutritionSourceLabel(null)).toBeNull();
    expect(formatNutritionSourceLabel(undefined)).toBeNull();
    expect(formatNutritionSourceLabel("  ")).toBeNull();
  });
});
