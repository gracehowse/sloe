import { describe, expect, it } from "vitest";
import {
  formatShoppingGroupLabel,
  groupShoppingItemsByIngredientName,
} from "@/lib/planning/shoppingDisplayGroups";
import type { ShoppingItem } from "@/types/recipe";

describe("formatShoppingGroupLabel — merged grams", () => {
  it("reads 700 g spinach, chopped for embedded name quantities", () => {
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
    expect(formatShoppingGroupLabel(group!)).toBe("700 g spinach, chopped");
  });
});
