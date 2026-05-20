import { describe, it, expect } from "vitest";
import { generateShoppingListFromRecipeEntries } from "@/lib/planning/generateShoppingList";

describe("generateShoppingListFromRecipeEntries", () => {
  it("merges ingredients across meals and scales by portion multiplier", () => {
    const ingredientsByRecipeId = new Map([
      [
        "r1",
        [
          { name: "onion", amount: "1", unit: "each" },
          { name: "rice", amount: "200", unit: "g" },
        ],
      ],
      ["r2", [{ name: "onion", amount: "2", unit: "each" }]],
    ]);

    const list = generateShoppingListFromRecipeEntries({
      entries: [
        { title: "Soup", multiplier: 2 },
        { title: "Salad", multiplier: 1 },
      ],
      recipeTitleToId: (title) => (title === "Soup" ? "r1" : title === "Salad" ? "r2" : null),
      ingredientsByRecipeId,
    });

    const onion = list.find((i) => i.name === "onion");
    expect(onion?.amount).toBe("4");
    expect(onion?.from).toContain("Soup");
    expect(onion?.from).toContain("Salad");

    const rice = list.find((i) => i.name === "rice");
    expect(rice?.amount).toBe("400");
  });
});
