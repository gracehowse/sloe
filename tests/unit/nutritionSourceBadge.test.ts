/**
 * Tests for nutrition source classification used in the NutritionSourceBadge component.
 */
import { describe, it, expect } from "vitest";
import { classifySource } from "@/components/NutritionSourceBadge";

describe("classifySource", () => {
  it("classifies USDA sources as verified", () => {
    expect(classifySource("USDA FoodData Central")).toBe("verified");
    expect(classifySource("USDA")).toBe("verified");
    expect(classifySource("FDC")).toBe("verified");
  });

  it("classifies Open Food Facts as verified", () => {
    expect(classifySource("Open Food Facts")).toBe("verified");
    expect(classifySource("openfoodfacts")).toBe("verified");
    expect(classifySource("off")).toBe("verified");
  });

  it("classifies FatSecret as verified", () => {
    expect(classifySource("FatSecret")).toBe("verified");
    expect(classifySource("fatsecret")).toBe("verified");
  });

  it("classifies Edamam as verified", () => {
    // Edamam is a paid nutrition API — its rows are as authoritative as the
    // other database sources. Previously misclassified as manual which
    // broke the Edamam attribution path at point of use.
    expect(classifySource("Edamam")).toBe("verified");
    expect(classifySource("edamam")).toBe("verified");
  });

  it("classifies AI/photo sources as estimated", () => {
    expect(classifySource("AI photo")).toBe("estimated");
    expect(classifySource("voice")).toBe("estimated");
    expect(classifySource("Recipe import")).toBe("estimated");
    expect(classifySource("OpenAI")).toBe("estimated");
  });

  it("classifies manual entries", () => {
    expect(classifySource("Meal plan")).toBe("manual");
    expect(classifySource("Manual entry")).toBe("manual");
    expect(classifySource("")).toBe("manual");
    expect(classifySource(null)).toBe("manual");
    expect(classifySource(undefined)).toBe("manual");
  });
});
