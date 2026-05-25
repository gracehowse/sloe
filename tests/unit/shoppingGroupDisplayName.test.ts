import { describe, expect, it } from "vitest";
import { groupShoppingItemsByIngredientName } from "@/lib/planning/shoppingDisplayGroups";
import type { ShoppingItem } from "@/types/recipe";

describe("pickGroupDisplayName via grouping", () => {
  it("strips amount prefixes when choosing the headline", () => {
    const items: ShoppingItem[] = [
      {
        id: "a",
        name: "1 medium onion (diced)",
        amount: "1",
        unit: "",
        category: "Fruit & Veg",
        checked: false,
        from: "A",
      },
      {
        id: "b",
        name: "medium onion (diced)",
        amount: "1",
        unit: "",
        category: "Fruit & Veg",
        checked: false,
        from: "B",
      },
    ];
    const [group] = groupShoppingItemsByIngredientName(items);
    expect(group!.displayName).toBe("medium onion (diced)");
  });
});
