/**
 * ENG-983 — imported / multi-recipe plans must merge duplicate ingredients
 * and emit aisle-ordered rows from the shared generator.
 */
import { describe, expect, it } from "vitest";
import { generateShoppingListFromRecipeEntries } from "@/lib/planning/generateShoppingList";

const titleToId = (title: string) => {
  if (title === "Tacos") return "tacos";
  if (title === "Taco Bowl") return "bowl";
  return null;
};

describe("ENG-983 — shopping list dedupe + aisle sort at generation", () => {
  it("merges duplicate onions across two planned recipes (Recime wedge)", () => {
    const ingredientsByRecipeId = new Map([
      ["tacos", [{ name: "onion", amount: "1", unit: "" }]],
      ["bowl", [{ name: "onion", amount: "1", unit: "" }]],
    ]);

    const list = generateShoppingListFromRecipeEntries({
      entries: [
        { title: "Tacos", multiplier: 1 },
        { title: "Taco Bowl", multiplier: 1 },
      ],
      recipeTitleToId: titleToId,
      ingredientsByRecipeId,
    });

    const onions = list.filter((i) => i.name.toLowerCase().includes("onion"));
    expect(onions).toHaveLength(1);
    expect(onions[0]?.amount).toBe("2");
    expect(onions[0]?.from).toContain("Tacos");
    expect(onions[0]?.from).toContain("Taco Bowl");
  });

  it("merges prep-state label variants via normalized ingredient key", () => {
    const ingredientsByRecipeId = new Map([
      [
        "tacos",
        [
          { name: "onion, diced", amount: "1", unit: "" },
          { name: "garlic, minced", amount: "2", unit: "clove" },
        ],
      ],
      [
        "bowl",
        [
          { name: "onion", amount: "1", unit: "" },
          { name: "garlic", amount: "1", unit: "clove" },
        ],
      ],
    ]);

    const list = generateShoppingListFromRecipeEntries({
      entries: [
        { title: "Tacos", multiplier: 1 },
        { title: "Taco Bowl", multiplier: 1 },
      ],
      recipeTitleToId: titleToId,
      ingredientsByRecipeId,
    });

    const onion = list.find((i) => normalizeNameKey(i.name) === "onion");
    const garlic = list.find((i) => normalizeNameKey(i.name) === "garlic");
    expect(onion?.amount).toBe("2");
    expect(garlic?.amount).toBe("3");
  });

  it("orders categories in supermarket walk order (produce before pantry)", () => {
    const ingredientsByRecipeId = new Map([
      [
        "tacos",
        [
          { name: "rice", amount: "200", unit: "g" },
          { name: "spinach", amount: "100", unit: "g" },
        ],
      ],
    ]);

    const list = generateShoppingListFromRecipeEntries({
      entries: [{ title: "Tacos", multiplier: 1 }],
      recipeTitleToId: titleToId,
      ingredientsByRecipeId,
    });

    const categories = list.map((i) => i.category);
    const spinachIdx = categories.indexOf("Vegetables");
    const grainsIdx = categories.indexOf("Grains");
    expect(spinachIdx).toBeGreaterThanOrEqual(0);
    expect(grainsIdx).toBeGreaterThanOrEqual(0);
    expect(spinachIdx).toBeLessThan(grainsIdx);
  });
});

function normalizeNameKey(name: string): string {
  return name
    .toLowerCase()
    .split(",")[0]!
    .trim();
}
