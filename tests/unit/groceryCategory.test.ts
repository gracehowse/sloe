/**
 * ENG-1133 — expanded grocery categoriser lexicon + aisle-order hygiene.
 */
import { describe, expect, it } from "vitest";

import {
  guessGroceryCategory,
  groceryCategoryRulesForTests,
} from "@/lib/planning/category";
import { SHOPPING_AISLE_ORDER } from "@/lib/planning/shoppingAisleOrder";

describe("ENG-1133 — guessGroceryCategory", () => {
  it("every rule label is a member of SHOPPING_AISLE_ORDER", () => {
    const allowed = new Set<string>(SHOPPING_AISLE_ORDER);
    for (const { label } of groceryCategoryRulesForTests()) {
      expect(allowed.has(label)).toBe(true);
    }
  });

  it("classifies ticket-named items that previously fell through to Other", () => {
    expect(guessGroceryCategory("black beans")).toBe("Protein");
    expect(guessGroceryCategory("red lentils")).toBe("Protein");
    expect(guessGroceryCategory("firm tofu")).toBe("Protein");
    expect(guessGroceryCategory("fresh basil")).toBe("Produce");
    expect(guessGroceryCategory("ground cumin")).toBe("Spices");
    expect(guessGroceryCategory("soy sauce")).toBe("Condiments");
  });

  it("keeps legacy mappings stable", () => {
    expect(guessGroceryCategory("chicken breast")).toBe("Protein");
    expect(guessGroceryCategory("Greek yogurt")).toBe("Dairy");
    expect(guessGroceryCategory("basmati rice")).toBe("Grains");
    expect(guessGroceryCategory("baby spinach")).toBe("Vegetables");
    expect(guessGroceryCategory("mixed berries")).toBe("Fruit");
    expect(guessGroceryCategory("olive oil")).toBe("Oils");
    expect(guessGroceryCategory("chia seeds")).toBe("Pantry");
  });

  it("returns Other for unknown ingredients", () => {
    expect(guessGroceryCategory("mystery widget")).toBe("Other");
    expect(guessGroceryCategory("")).toBe("Other");
  });

  it("uses word boundaries — peppercorn is not Vegetables", () => {
    expect(guessGroceryCategory("black peppercorn")).not.toBe("Vegetables");
  });
});
