import { describe, it, expect } from "vitest";
import type { ShoppingItem } from "@/types/recipe";
import {
  applyPlanEditToShoppingList,
  planShoppingSyncMessage,
} from "@/lib/planning/syncPlanEditToShoppingList";
import { removeRecipeFromShoppingList } from "@/lib/planning/removeRecipeFromShoppingList";
import { appendRecipeToShoppingList } from "@/lib/planning/appendRecipeToShoppingList";

function item(partial: Partial<ShoppingItem> & { name: string }): ShoppingItem {
  return {
    id: partial.id ?? `id:${partial.name}`,
    name: partial.name,
    amount: partial.amount ?? "",
    unit: partial.unit ?? "",
    category: partial.category ?? "Other",
    checked: partial.checked ?? false,
    from: partial.from ?? "",
    checkedBy: partial.checkedBy ?? null,
  };
}

describe("ENG-957 plan→shopping sync engine — ADD", () => {
  it("appends a recipe's ingredients and merges duplicates silently", () => {
    const existing = [item({ name: "onion", amount: "1", unit: "", from: "Curry" })];
    const res = applyPlanEditToShoppingList({
      existing,
      edit: {
        kind: "add",
        recipe: {
          title: "Stir fry",
          ingredients: [
            { name: "onion", amount: "1", unit: "" },
            { name: "soy sauce", amount: "2", unit: "tbsp" },
          ],
        },
      },
    });
    const onion = res.items.find((i) => i.name === "onion")!;
    // Silent duplicate aggregation across recipes (the Recime complaint).
    expect(onion.amount).toBe("2");
    expect(onion.from).toBe("Curry, Stir fry");
    expect(res.mergedCount).toBe(1);
    expect(res.addedCount).toBe(1); // soy sauce is new
  });

  it("preserves the `checked` state of a row it merges into", () => {
    const existing = [
      item({ name: "rice", amount: "200", unit: "g", from: "Curry", checked: true }),
    ];
    const res = applyPlanEditToShoppingList({
      existing,
      edit: {
        kind: "add",
        recipe: { title: "Bowl", ingredients: [{ name: "rice", amount: "100", unit: "g" }] },
      },
    });
    const rice = res.items.find((i) => i.name === "rice")!;
    expect(rice.amount).toBe("300");
    expect(rice.checked).toBe(true); // never un-checks on merge
  });
});

describe("ENG-957 plan→shopping sync engine — REMOVE", () => {
  it("decrements only the removed recipe's contribution, leaving other rows intact", () => {
    // rice sourced by both Curry (200) and Bowl (100) = 300 on the list.
    const existing = [
      item({ name: "rice", amount: "300", unit: "g", from: "Curry, Bowl" }),
      item({ name: "chicken", amount: "300", unit: "g", from: "Curry" }),
    ];
    const res = applyPlanEditToShoppingList({
      existing,
      edit: {
        kind: "remove",
        recipe: {
          title: "Curry",
          ingredients: [
            { name: "rice", amount: "200", unit: "g" },
            { name: "chicken", amount: "300", unit: "g" },
          ],
        },
      },
    });
    const rice = res.items.find((i) => i.name === "rice");
    const chicken = res.items.find((i) => i.name === "chicken");
    // rice still sourced by Bowl → decremented to 100, kept.
    expect(rice).toBeDefined();
    expect(rice!.amount).toBe("100");
    expect(rice!.from).toBe("Bowl");
    // chicken sourced ONLY by Curry → removed entirely.
    expect(chicken).toBeUndefined();
    expect(res.decrementedCount).toBe(1);
    expect(res.removedCount).toBe(1);
  });

  it("never touches a household-mate's manually-added row (no source match)", () => {
    const existing = [
      item({ name: "chicken", amount: "300", unit: "g", from: "Curry" }),
      item({ name: "birthday candles", amount: "1", unit: "", from: "" }), // manual add
    ];
    const res = applyPlanEditToShoppingList({
      existing,
      edit: {
        kind: "remove",
        recipe: { title: "Curry", ingredients: [{ name: "chicken", amount: "300", unit: "g" }] },
      },
    });
    expect(res.items.find((i) => i.name === "birthday candles")).toBeDefined();
    expect(res.items.find((i) => i.name === "chicken")).toBeUndefined();
  });

  it("deletes a checked row that drops to zero (user is no longer buying it)", () => {
    const existing = [
      item({ name: "chicken", amount: "300", unit: "g", from: "Curry", checked: true }),
    ];
    const res = removeRecipeFromShoppingList({
      existing,
      recipeTitle: "Curry",
      ingredients: [{ name: "chicken", amount: "300", unit: "g" }],
    });
    expect(res.items).toHaveLength(0);
    expect(res.removedCount).toBe(1);
  });
});

describe("ENG-957 plan→shopping sync engine — SWAP", () => {
  it("removes the outgoing recipe and appends the incoming one around one list", () => {
    const existing = [
      item({ name: "onion", amount: "2", unit: "", from: "Curry, Bowl" }),
      item({ name: "chicken", amount: "300", unit: "g", from: "Curry" }),
    ];
    const res = applyPlanEditToShoppingList({
      existing,
      edit: {
        kind: "swap",
        out: {
          title: "Curry",
          ingredients: [
            { name: "onion", amount: "1", unit: "" },
            { name: "chicken", amount: "300", unit: "g" },
          ],
        },
        in: {
          title: "Tacos",
          ingredients: [
            { name: "onion", amount: "1", unit: "" },
            { name: "beef", amount: "250", unit: "g" },
          ],
        },
      },
    });
    // onion: Curry (1) removed → 1, then Tacos (1) added → 2 again; net unchanged.
    const onion = res.items.find((i) => i.name === "onion")!;
    expect(onion.amount).toBe("2");
    expect(onion.from).toBe("Bowl, Tacos"); // Curry dropped, Tacos added
    // chicken (only Curry) gone; beef new.
    expect(res.items.find((i) => i.name === "chicken")).toBeUndefined();
    expect(res.items.find((i) => i.name === "beef")!.amount).toBe("250");
  });
});

describe("ENG-957 add/remove symmetry — round-trip", () => {
  it("remove(add(list)) restores the rows the recipe touched", () => {
    const base: ShoppingItem[] = [item({ name: "onion", amount: "1", unit: "", from: "Bowl" })];
    const recipe = {
      title: "Curry",
      ingredients: [
        { name: "onion", amount: "2", unit: "" },
        { name: "coconut milk", amount: "1", unit: "tin" },
      ],
    };
    const added = appendRecipeToShoppingList({
      existing: base,
      recipeTitle: recipe.title,
      ingredients: recipe.ingredients,
    });
    const back = removeRecipeFromShoppingList({
      existing: added.items,
      recipeTitle: recipe.title,
      ingredients: recipe.ingredients,
    });
    // onion decremented back to 1 sourced by Bowl; coconut milk gone.
    const onion = back.items.find((i) => i.name === "onion")!;
    expect(onion.amount).toBe("1");
    expect(onion.from).toBe("Bowl");
    expect(back.items.find((i) => i.name === "coconut milk")).toBeUndefined();
  });
});

describe("ENG-957 nutrition-trust — low-confidence conversions never guess", () => {
  it("keeps a count line separate from a grams row when conversion is low-confidence", () => {
    // A bare count of an unknown food would hit the generic-guess path → low
    // confidence → must stay its own row, never fold into the grams row.
    const existing = [item({ name: "widget", amount: "100", unit: "g", from: "A" })];
    const res = applyPlanEditToShoppingList({
      existing,
      edit: {
        kind: "add",
        recipe: { title: "B", ingredients: [{ name: "widget", amount: "2", unit: "" }] },
      },
    });
    const grams = res.items.find((i) => i.unit === "g")!;
    const count = res.items.find((i) => i.unit === "");
    expect(grams.amount).toBe("100"); // untouched — no guessed grams folded in
    expect(count).toBeDefined(); // kept as its own row
    expect(res.addedCount).toBe(1);
  });

  it("folds a HIGH-confidence count into a grams row on add, and back out on remove", () => {
    // eggs have a known per-piece weight → high confidence → folds into grams.
    const existing = [item({ name: "egg", amount: "100", unit: "g", from: "A" })];
    const added = applyPlanEditToShoppingList({
      existing,
      edit: {
        kind: "add",
        recipe: { title: "B", ingredients: [{ name: "egg", amount: "2", unit: "" }] },
      },
    });
    const grams = added.items.find((i) => i.name === "egg" && i.unit === "g")!;
    expect(Number(grams.amount)).toBeGreaterThan(100); // folded high-confidence grams
    const gramsAmount = Number(grams.amount);
    // Remove B → the same high-confidence grams subtract back out.
    const back = removeRecipeFromShoppingList({
      existing: added.items,
      recipeTitle: "B",
      ingredients: [{ name: "egg", amount: "2", unit: "" }],
    });
    const eggBack = back.items.find((i) => i.name === "egg")!;
    expect(Number(eggBack.amount)).toBeCloseTo(gramsAmount - (gramsAmount - 100), 5);
    expect(Number(eggBack.amount)).toBe(100);
    expect(eggBack.from).toBe("A");
  });
});

describe("ENG-957 servings multiplier", () => {
  it("scales the added amount and subtracts the same scaled amount on remove", () => {
    const added = appendRecipeToShoppingList({
      existing: [],
      recipeTitle: "Batch",
      ingredients: [{ name: "flour", amount: "100", unit: "g" }],
      multiplier: 2.5,
    });
    expect(added.items[0]!.amount).toBe("250");
    const back = removeRecipeFromShoppingList({
      existing: added.items,
      recipeTitle: "Batch",
      ingredients: [{ name: "flour", amount: "100", unit: "g" }],
      multiplier: 2.5,
    });
    expect(back.items).toHaveLength(0);
  });
});

describe("ENG-957 sync message (calm, no health claims)", () => {
  it("summarises add-only, remove-only, mixed, and no-op", () => {
    expect(
      planShoppingSyncMessage({
        items: [],
        addedCount: 2,
        mergedCount: 1,
        decrementedCount: 0,
        removedCount: 0,
      }),
    ).toBe("Shopping list updated — 3 ingredients added.");
    expect(
      planShoppingSyncMessage({
        items: [],
        addedCount: 0,
        mergedCount: 0,
        decrementedCount: 0,
        removedCount: 1,
      }),
    ).toBe("Shopping list updated — 1 ingredient removed.");
    expect(
      planShoppingSyncMessage({
        items: [],
        addedCount: 0,
        mergedCount: 0,
        decrementedCount: 0,
        removedCount: 0,
      }),
    ).toBe(""); // no-op → host stays silent
  });
});
