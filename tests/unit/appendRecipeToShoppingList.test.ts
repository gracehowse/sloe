import { describe, it, expect } from "vitest";
import {
  appendRecipeToShoppingList,
  buildingYourListMessage,
} from "@/lib/planning/appendRecipeToShoppingList";
import type { ShoppingItem } from "@/types/recipe";

function item(partial: Partial<ShoppingItem> & { name: string }): ShoppingItem {
  return {
    id: partial.id ?? partial.name,
    name: partial.name,
    amount: partial.amount ?? "",
    unit: partial.unit ?? "",
    category: partial.category ?? "Other",
    checked: partial.checked ?? false,
    from: partial.from ?? "",
  };
}

describe("appendRecipeToShoppingList — aggregation onto an existing list", () => {
  it("adds brand-new ingredients as new rows and aisle-tags them", () => {
    const res = appendRecipeToShoppingList({
      existing: [],
      recipeTitle: "Chicken Soup",
      ingredients: [
        { name: "chicken breast", amount: "300", unit: "g" },
        { name: "rice", amount: "200", unit: "g" },
      ],
    });
    expect(res.addedCount).toBe(2);
    expect(res.mergedCount).toBe(0);
    const chicken = res.items.find((i) => i.name.toLowerCase().includes("chicken"));
    const rice = res.items.find((i) => i.name.toLowerCase().includes("rice"));
    expect(chicken?.amount).toBe("300");
    expect(chicken?.category).toBe("Protein");
    expect(rice?.category).toBe("Grains");
    expect(chicken?.from).toBe("Chicken Soup");
  });

  it("merges same ingredient + same unit into the existing row (sums + appends source)", () => {
    const existing = [item({ name: "rice", amount: "200", unit: "g", from: "Plan" })];
    const res = appendRecipeToShoppingList({
      existing,
      recipeTitle: "Pilaf",
      ingredients: [{ name: "rice", amount: "150", unit: "g" }],
    });
    expect(res.addedCount).toBe(0);
    expect(res.mergedCount).toBe(1);
    const rice = res.items.find((i) => i.name.toLowerCase().includes("rice"));
    expect(rice?.amount).toBe("350");
    expect(rice?.from).toContain("Plan");
    expect(rice?.from).toContain("Pilaf");
    // The list did not grow — the row merged in place.
    expect(res.items).toHaveLength(1);
  });

  it("scales numeric amounts by the servings multiplier", () => {
    const res = appendRecipeToShoppingList({
      existing: [],
      recipeTitle: "Big Batch",
      ingredients: [{ name: "rice", amount: "100", unit: "g" }],
      multiplier: 2.5,
    });
    expect(res.items[0]?.amount).toBe("250");
  });

  it("dedupes ingredient-name variants via the normalized name key", () => {
    const existing = [item({ name: "Chicken breast, skinless", amount: "200", unit: "g" })];
    const res = appendRecipeToShoppingList({
      existing,
      recipeTitle: "Stir Fry",
      ingredients: [{ name: "chicken breast", amount: "100", unit: "g" }],
    });
    expect(res.mergedCount).toBe(1);
    expect(res.items).toHaveLength(1);
    expect(res.items[0]?.amount).toBe("300");
  });

  it("keeps a non-numeric existing amount stable when a numeric line merges in", () => {
    const existing = [item({ name: "salt", amount: "to taste", unit: "" })];
    const res = appendRecipeToShoppingList({
      existing,
      recipeTitle: "Stew",
      ingredients: [{ name: "salt", amount: "1", unit: "tsp" }],
    });
    // Different unit ("" vs tsp) — added as its own row, existing untouched.
    expect(res.items.some((i) => i.amount === "to taste")).toBe(true);
  });
});

describe("appendRecipeToShoppingList — count-to-weight normalisation", () => {
  it("folds a HIGH-confidence count into an existing grams row (chicken breast)", () => {
    // "chicken breast" has a food-specific per-piece weight (200 g raw).
    const existing = [item({ name: "chicken breast", amount: "200", unit: "g", from: "Plan" })];
    const res = appendRecipeToShoppingList({
      existing,
      recipeTitle: "Roast",
      ingredients: [{ name: "chicken breast", amount: "2", unit: "" }],
    });
    expect(res.mergedCount).toBe(1);
    expect(res.items).toHaveLength(1);
    // 200 g + 2 × 200 g = 600 g.
    expect(res.items[0]?.amount).toBe("600");
    expect(res.items[0]?.unit).toBe("g");
    expect(res.items[0]?.from).toContain("Roast");
  });

  it("does NOT guess: a LOW-confidence bare count stays a separate row", () => {
    // "widget" has no food-specific weight → generic 80 g guess → low confidence.
    const existing = [item({ name: "widget", amount: "100", unit: "g" })];
    const res = appendRecipeToShoppingList({
      existing,
      recipeTitle: "Mystery",
      ingredients: [{ name: "widget", amount: "2", unit: "" }],
    });
    expect(res.addedCount).toBe(1);
    expect(res.mergedCount).toBe(0);
    expect(res.items).toHaveLength(2);
    // The original grams row is untouched.
    expect(res.items.find((i) => i.unit === "g")?.amount).toBe("100");
  });

  it("does NOT fold a defaulted-density cup into a grams row (low confidence)", () => {
    const existing = [item({ name: "flour", amount: "200", unit: "g" })];
    const res = appendRecipeToShoppingList({
      existing,
      recipeTitle: "Bread",
      ingredients: [{ name: "flour", amount: "1", unit: "cup" }],
    });
    // Cup density defaults → low confidence → separate row, no guessed grams.
    expect(res.items).toHaveLength(2);
    expect(res.items.find((i) => i.unit === "g")?.amount).toBe("200");
  });

  it("folds eggs (well-characterised) into a grams row", () => {
    const existing = [item({ name: "eggs", amount: "100", unit: "g" })];
    const res = appendRecipeToShoppingList({
      existing,
      recipeTitle: "Omelette",
      ingredients: [{ name: "eggs", amount: "2", unit: "" }],
    });
    expect(res.mergedCount).toBe(1);
    // 100 g + 2 × 50 g = 200 g.
    expect(res.items[0]?.amount).toBe("200");
  });
});

describe("buildingYourListMessage — calm framing", () => {
  it("frames a pure add", () => {
    const msg = buildingYourListMessage({ items: [], ingredientCount: 3, addedCount: 3, mergedCount: 0 });
    expect(msg).toBe("Added 3 ingredients to your shopping list.");
  });
  it("frames a single add", () => {
    const msg = buildingYourListMessage({ items: [], ingredientCount: 1, addedCount: 1, mergedCount: 0 });
    expect(msg).toBe("Added 1 ingredient to your shopping list.");
  });
  it("frames an add + merge", () => {
    const msg = buildingYourListMessage({ items: [], ingredientCount: 4, addedCount: 2, mergedCount: 2 });
    expect(msg).toBe("Added 2 ingredients — merged 2 you already had.");
  });
  it("frames an all-merged top-up", () => {
    const msg = buildingYourListMessage({ items: [], ingredientCount: 3, addedCount: 0, mergedCount: 3 });
    expect(msg).toBe("Already on your list — we topped up 3 ingredients.");
  });
  it("frames an empty recipe", () => {
    const msg = buildingYourListMessage({ items: [], ingredientCount: 0, addedCount: 0, mergedCount: 0 });
    expect(msg).toContain("Nothing to add");
  });
});
