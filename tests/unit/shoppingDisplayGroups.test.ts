import { describe, expect, it } from "vitest";
import type { ShoppingItem } from "../../src/types/recipe.ts";
import {
  formatMixedShoppingAmounts,
  groupShoppingItemsByIngredientName,
  isShoppingGroupFullyChecked,
  mergeShoppingFromFields,
} from "../../src/lib/planning/shoppingDisplayGroups.ts";

function item(partial: Partial<ShoppingItem> & Pick<ShoppingItem, "id" | "name" | "amount" | "unit" | "category" | "from">): ShoppingItem {
  return {
    checked: false,
    ...partial,
  };
}

describe("groupShoppingItemsByIngredientName", () => {
  it("merges rows that share a normalized ingredient name", () => {
    const items: ShoppingItem[] = [
      item({
        id: "a|g",
        name: "Chicken breast, skinless",
        amount: "200",
        unit: "g",
        category: "Meat",
        from: "Bowl A",
      }),
      item({
        id: "a|ct",
        name: "chicken breast",
        amount: "2",
        unit: "breast",
        category: "Meat",
        from: "Salad B",
      }),
    ];
    const groups = groupShoppingItemsByIngredientName(items);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.items).toHaveLength(2);
    expect(groups[0]!.displayName.length).toBeGreaterThan(0);
  });

  it("keeps different ingredients separate", () => {
    const items: ShoppingItem[] = [
      item({ id: "1", name: "Rolled oats", amount: "50", unit: "g", category: "Pantry", from: "A" }),
      item({ id: "2", name: "Olive oil", amount: "5", unit: "ml", category: "Pantry", from: "B" }),
    ];
    const groups = groupShoppingItemsByIngredientName(items);
    expect(groups).toHaveLength(2);
  });
});

describe("formatMixedShoppingAmounts", () => {
  it("joins amounts with plus without summing", () => {
    const items: ShoppingItem[] = [
      item({ id: "1", name: "x", amount: "200", unit: "g", category: "M", from: "A" }),
      item({ id: "2", name: "x", amount: "2", unit: "breast", category: "M", from: "B" }),
    ];
    expect(formatMixedShoppingAmounts(items)).toBe("200 g + 2 breast");
  });
});

describe("mergeShoppingFromFields", () => {
  it("dedupes recipe titles across lines", () => {
    const items: ShoppingItem[] = [
      item({ id: "1", name: "a", amount: "1", unit: "g", category: "M", from: "R1, R2" }),
      item({ id: "2", name: "a", amount: "2", unit: "ml", category: "M", from: "R2, R3" }),
    ];
    const merged = mergeShoppingFromFields(items);
    const parts = merged.split(", ").sort();
    expect(parts).toEqual(["R1", "R2", "R3"]);
  });
});

describe("isShoppingGroupFullyChecked", () => {
  it("is true only when every underlying row is checked", () => {
    const g = groupShoppingItemsByIngredientName([
      item({ id: "1", name: "x", amount: "1", unit: "g", category: "M", from: "A", checked: true }),
      item({ id: "2", name: "x", amount: "2", unit: "g", category: "M", from: "B", checked: false }),
    ])[0]!;
    expect(isShoppingGroupFullyChecked(g)).toBe(false);
    g.items[1]!.checked = true;
    expect(isShoppingGroupFullyChecked(g)).toBe(true);
  });
});
