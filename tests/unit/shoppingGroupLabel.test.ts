import { describe, expect, it } from "vitest";
import {
  formatMixedShoppingAmounts,
  formatShoppingGroupLabel,
  groupShoppingItemsByIngredientName,
} from "@/lib/planning/shoppingDisplayGroups";
import type { ShoppingItem } from "@/types/recipe";

function item(partial: Partial<ShoppingItem> & Pick<ShoppingItem, "id" | "name">): ShoppingItem {
  return {
    amount: "1",
    unit: "",
    category: "Fruit & Veg",
    checked: false,
    from: "Plan A",
    ...partial,
  };
}

describe("formatShoppingGroupLabel", () => {
  it("collapses three identical qty lines into one premium row", () => {
    const items = [
      item({ id: "a", name: "medium onion (diced)", amount: "1", from: "A" }),
      item({ id: "b", name: "medium onion (diced)", amount: "1", from: "B" }),
      item({ id: "c", name: "medium onion (diced)", amount: "1", from: "C" }),
    ];
    const [group] = groupShoppingItemsByIngredientName(items);
    expect(formatMixedShoppingAmounts(items)).toBe("3");
    expect(group!.displayName).toBe("medium onion (diced)");
    expect(formatShoppingGroupLabel(group!)).toBe("3 medium onion (diced)");
  });

  it("drops unit duplicated in headline (jar jar chickpeas)", () => {
    const items = [
      item({ id: "a", name: "jar chickpeas, drained", amount: "1", unit: "jar", from: "A" }),
      item({ id: "b", name: "jar chickpeas, drained", amount: "1", unit: "jar", from: "B" }),
      item({ id: "c", name: "jar chickpeas, drained", amount: "1", unit: "jar", from: "C" }),
      item({ id: "d", name: "jar chickpeas, drained", amount: "1", unit: "jar", from: "D" }),
      item({ id: "e", name: "jar chickpeas, drained", amount: "1", unit: "jar", from: "E" }),
      item({ id: "f", name: "jar chickpeas, drained", amount: "1", unit: "jar", from: "F" }),
    ];
    const [group] = groupShoppingItemsByIngredientName(items);
    expect(formatShoppingGroupLabel(group!)).toBe("6 jar chickpeas, drained");
  });

  it("renders a single line without parentheses", () => {
    const items = [item({ id: "a", name: "2 eggs", amount: "2", unit: "" })];
    const [group] = groupShoppingItemsByIngredientName(items);
    expect(formatShoppingGroupLabel(group!)).toBe("2 eggs");
  });
});
