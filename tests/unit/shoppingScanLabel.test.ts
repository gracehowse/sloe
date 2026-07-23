import { describe, expect, it } from "vitest";
import {
  formatShopSensibleQuantity,
  formatShoppingRecipeCountCaption,
  shoppingRecipeTitlesFromItems,
  stripShoppingPrepFromName,
} from "../../src/lib/planning/shoppingScanLabel.ts";
import {
  formatShoppingGroupLabel,
  formatShoppingGroupParts,
  groupShoppingItemsByIngredientName,
} from "../../src/lib/planning/shoppingDisplayGroups.ts";
import type { ShoppingItem } from "../../src/types/recipe.ts";

describe("stripShoppingPrepFromName", () => {
  it("strips trailing prep suffixes", () => {
    expect(stripShoppingPrepFromName("mint leaves, roughly chopped")).toBe("mint leaves");
    expect(stripShoppingPrepFromName("brown onion, finely diced")).toBe("brown onion");
    expect(stripShoppingPrepFromName("broccoli, cut into florets")).toBe("broccoli");
  });

  it("strips parenthetical prep", () => {
    expect(stripShoppingPrepFromName("onion (diced)")).toBe("onion");
  });
});

describe("formatShopSensibleQuantity", () => {
  it("rounds fake-precision grams", () => {
    expect(formatShopSensibleQuantity(266.66, "g")).toBe("267 g");
  });
});

describe("formatShoppingRecipeCountCaption", () => {
  it("hides single-recipe noise", () => {
    expect(formatShoppingRecipeCountCaption(1)).toBeNull();
    expect(formatShoppingRecipeCountCaption(4)).toBe("4 recipes");
  });
});

describe("shoppingRecipeTitlesFromItems", () => {
  it("dedupes titles", () => {
    expect(
      shoppingRecipeTitlesFromItems([{ from: "A, B" }, { from: "B" }]).sort(),
    ).toEqual(["A", "B"]);
  });
});

describe("formatShoppingGroupLabel forShoppingScan", () => {
  it("strips prep from the primary line", () => {
    const items: ShoppingItem[] = [
      {
        id: "a",
        name: "600 g spinach, chopped",
        amount: "",
        unit: "",
        category: "Fruit & Veg",
        checked: false,
        from: "A",
      },
      {
        id: "b",
        name: "100g spinach, chopped",
        amount: "",
        unit: "",
        category: "Fruit & Veg",
        checked: false,
        from: "B",
      },
    ];
    const [group] = groupShoppingItemsByIngredientName(items);
    expect(formatShoppingGroupLabel(group!, { forShoppingScan: true })).toBe("700 g spinach");
    expect(formatShoppingGroupParts(group!, { forShoppingScan: true })).toEqual({
      quantity: "700 g",
      name: "spinach",
    });
  });
});
