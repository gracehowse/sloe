import { describe, expect, it } from "vitest";

import {
  CANONICAL_NUTRITION_ENTRY_SOURCES,
  canonicalNutritionEntrySource,
} from "../../src/lib/nutrition/canonicalNutritionEntrySource";

describe("canonicalNutritionEntrySource", () => {
  it("passes through values already on the allow-list", () => {
    for (const s of CANONICAL_NUTRITION_ENTRY_SOURCES) {
      expect(canonicalNutritionEntrySource(s)).toBe(s);
    }
  });

  it("maps legacy UI labels used before ENG-674", () => {
    expect(canonicalNutritionEntrySource("Manual")).toBe("manual");
    expect(canonicalNutritionEntrySource("Meal plan")).toBe("Recipe");
    expect(canonicalNutritionEntrySource("Quick entry")).toBe("manual");
    expect(canonicalNutritionEntrySource("Custom food")).toBe("custom_food");
  });

  it("maps CSV import provenance tags", () => {
    expect(canonicalNutritionEntrySource("mfp_import")).toBe("manual");
    expect(canonicalNutritionEntrySource("lose-it_import")).toBe("manual");
    expect(canonicalNutritionEntrySource("cronometer_import")).toBe("manual");
  });

  it("maps planner and barcode aliases", () => {
    expect(canonicalNutritionEntrySource("plan_import")).toBe("Recipe");
    expect(canonicalNutritionEntrySource("Manual barcode entry")).toBe("barcode");
  });

  it("returns null for empty input", () => {
    expect(canonicalNutritionEntrySource(null)).toBeNull();
    expect(canonicalNutritionEntrySource("   ")).toBeNull();
  });
});
