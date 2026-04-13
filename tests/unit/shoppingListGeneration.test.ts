import { describe, it, expect } from "vitest";
import { guessGroceryCategory } from "@/lib/planning/category";
import { normalizeIngredientNameKey } from "@/lib/planning/ingredientNameKey";

describe("guessGroceryCategory", () => {
  it("classifies chicken as Protein", () => {
    expect(guessGroceryCategory("chicken breast")).toBe("Protein");
  });

  it("classifies olive oil as Oils", () => {
    expect(guessGroceryCategory("olive oil")).toBe("Oils");
  });

  it("classifies spinach as Vegetables", () => {
    expect(guessGroceryCategory("baby spinach")).toBe("Vegetables");
  });

  it("classifies rice as Grains", () => {
    expect(guessGroceryCategory("basmati rice")).toBe("Grains");
  });

  it("classifies milk as Dairy", () => {
    expect(guessGroceryCategory("whole milk")).toBe("Dairy");
  });

  it("returns Other for unknown items", () => {
    expect(guessGroceryCategory("xyzunknownfood")).toBe("Other");
  });
});

describe("normalizeIngredientNameKey", () => {
  it("normalizes case", () => {
    expect(normalizeIngredientNameKey("Chicken Breast")).toBe(normalizeIngredientNameKey("chicken breast"));
  });

  it("strips parentheticals", () => {
    const key = normalizeIngredientNameKey("tomatoes (canned)");
    expect(key).not.toContain("canned");
  });

  it("takes text before comma", () => {
    const key = normalizeIngredientNameKey("garlic, minced");
    expect(key).toBe(normalizeIngredientNameKey("garlic"));
  });

  it("trims whitespace", () => {
    expect(normalizeIngredientNameKey("  onion  ")).toBe(normalizeIngredientNameKey("onion"));
  });
});
