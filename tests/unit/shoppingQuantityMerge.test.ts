import { describe, expect, it } from "vitest";
import {
  formatMergedShoppingAmounts,
  normalizeShoppingUnit,
  parseShoppingItemQuantity,
  shoppingIngredientHeadline,
  stripHeadlineForMixedQuantity,
} from "@/lib/planning/shoppingQuantityMerge";
import type { ShoppingItem } from "@/types/recipe";

function item(partial: Partial<ShoppingItem> & Pick<ShoppingItem, "id" | "name">): ShoppingItem {
  return {
    amount: "1",
    unit: "",
    category: "Fruit & Veg",
    checked: false,
    from: "Plan",
    ...partial,
  };
}

describe("normalizeShoppingUnit", () => {
  it("maps gram aliases to g", () => {
    expect(normalizeShoppingUnit("grams")).toBe("g");
  });
});

describe("formatMergedShoppingAmounts", () => {
  it("sums compatible mass units", () => {
    expect(
      formatMergedShoppingAmounts([
        item({ id: "a", name: "spinach", amount: "600", unit: "g" }),
        item({ id: "b", name: "spinach", amount: "100", unit: "g" }),
      ]),
    ).toBe("700 g");
  });

  it("sums quantities embedded in ingredient names", () => {
    expect(
      formatMergedShoppingAmounts([
        item({ id: "a", name: "600 g spinach, chopped", amount: "", unit: "" }),
        item({ id: "b", name: "100g spinach, chopped", amount: "", unit: "" }),
      ]),
    ).toBe("700 g");
  });

  it("strips leading qty from headline helper", () => {
    expect(shoppingIngredientHeadline(item({ id: "a", name: "100g spinach, chopped", amount: "", unit: "" }))).toBe(
      "spinach, chopped",
    );
  });

  it("collapses duplicated count in stored name (1 1 breast)", () => {
    expect(
      shoppingIngredientHeadline(
        item({ id: "a", name: "1 1 breast Chicken breast, rotisserie", amount: "", unit: "" }),
      ),
    ).toBe("breast Chicken breast, rotisserie");
  });

  it("keeps incompatible units separate", () => {
    expect(
      formatMergedShoppingAmounts([
        item({ id: "a", name: "chicken", amount: "200", unit: "g" }),
        item({ id: "b", name: "chicken", amount: "2", unit: "breast" }),
      ]),
    ).toBe("200 g + 2 breast");
  });

  it("sums three identical count rows", () => {
    expect(
      formatMergedShoppingAmounts([
        item({ id: "a", name: "1 medium onion (diced)", amount: "1", unit: "" }),
        item({ id: "b", name: "1 medium onion (diced)", amount: "1", unit: "" }),
        item({ id: "c", name: "1 medium onion (diced)", amount: "1", unit: "" }),
      ]),
    ).toBe("3");
  });
});

describe("stripHeadlineForMixedQuantity", () => {
  it("removes jar prefix when mixed already has jar", () => {
    expect(stripHeadlineForMixedQuantity("jar chickpeas, drained", "6 jar")).toBe("chickpeas, drained");
  });

  it("removes leading tbsp when mixed total already uses tbsp", () => {
    expect(stripHeadlineForMixedQuantity("1/2 tbsp olive oil", "1.5 tbsp")).toBe("olive oil");
  });

  it("collapses duplicated count prefix (1 1 tsp)", () => {
    expect(stripHeadlineForMixedQuantity("1 1 tsp Fresh thyme leaves", "1")).toBe("tsp Fresh thyme leaves");
  });

  it("drops per-line count when merged total differs (2 + 1 breast)", () => {
    expect(stripHeadlineForMixedQuantity("1 breast Chicken breast, rotisserie", "2")).toBe(
      "breast Chicken breast, rotisserie",
    );
  });

  it("keeps embedded ml when merged count is higher (3 + 240 ml almond)", () => {
    expect(stripHeadlineForMixedQuantity("240 ml Almond milk", "3")).toBe("240 ml Almond milk");
  });
});

describe("parseShoppingItemQuantity", () => {
  it("parses deduped gram rows", () => {
    expect(
      parseShoppingItemQuantity(
        item({ id: "a", name: "60 g protein powder", amount: "60", unit: "g" }),
      ),
    ).toEqual({ value: 60, unit: "g" });
  });
});
