/**
 * ENG-1040 (audit 2026-06-11 P1-5) — mobile shopping list must scale by the
 * portion multiplier exactly like web.
 *
 * The bug: mobile had its own inline generator that counted plain recipe
 * occurrences and never read `portionMultiplier`, so a planned meal at 2×
 * bought 2× on web but 1× on iOS (the primary surface under-buying). The
 * fix routes mobile through the SAME shared
 * `generateShoppingListFromRecipeEntriesAsync` web uses.
 *
 * These tests pin the shared generator (the single code path both hosts
 * now invoke) on the two properties the audit calls out:
 *   - a 2× portion plan yields DOUBLED quantities
 *   - byte-identical rows (name / amount / unit / category / from) for the
 *     same plan, proving web ↔ mobile parity-by-construction
 *   - aisle categories come from the shared `guessGroceryCategory` (so the
 *     same egg lands in the same aisle on both platforms — §12 categories)
 */
import { describe, it, expect } from "vitest";

import {
  generateShoppingListFromRecipeEntries,
  generateShoppingListFromRecipeEntriesAsync,
  shoppingListIngredientMultiplier,
} from "@/lib/planning/generateShoppingList";
import { effectivePortionMultiplier } from "@/lib/nutrition/portionMultiplier";

const INGREDIENTS = new Map([
  [
    "r1",
    [
      { name: "chicken breast", amount: "200", unit: "g" },
      { name: "rice", amount: "150", unit: "g" },
      { name: "egg", amount: "2", unit: "each" },
    ],
  ],
]);
const titleToId = (t: string) => (t === "Chicken & Rice" ? "r1" : null);

describe("ENG-1040 — shopping list portion-multiplier parity", () => {
  it("a 2× portion meal yields DOUBLED quantities", async () => {
    const at1x = await generateShoppingListFromRecipeEntriesAsync({
      entries: [{ title: "Chicken & Rice", multiplier: 1 }],
      recipeTitleToId: titleToId,
      fetchDbIngredients: async (id) => INGREDIENTS.get(id) ?? [],
      fetchDbIngredientsBatch: async () => INGREDIENTS,
    });
    const at2x = await generateShoppingListFromRecipeEntriesAsync({
      entries: [{ title: "Chicken & Rice", multiplier: 2 }],
      recipeTitleToId: titleToId,
      fetchDbIngredients: async (id) => INGREDIENTS.get(id) ?? [],
      fetchDbIngredientsBatch: async () => INGREDIENTS,
    });

    const chicken1 = at1x.find((i) => i.name === "chicken breast");
    const chicken2 = at2x.find((i) => i.name === "chicken breast");
    expect(chicken1?.amount).toBe("200");
    expect(chicken2?.amount).toBe("400"); // doubled, not occurrence-counted

    const rice1 = at1x.find((i) => i.name === "rice");
    const rice2 = at2x.find((i) => i.name === "rice");
    expect(rice1?.amount).toBe("150");
    expect(rice2?.amount).toBe("300");

    const egg2 = at2x.find((i) => i.name === "egg");
    expect(egg2?.amount).toBe("4");
  });

  it("the portion multiplier is read off the plan meal exactly as web reads it", () => {
    // Mobile builds `entries` with `effectivePortionMultiplier(m.portionMultiplier)`
    // — the same helper web uses in AppDataContext. Undefined defaults to 1;
    // a 2 stays 2; pathological values clamp the same on both platforms.
    expect(effectivePortionMultiplier(undefined)).toBe(1);
    expect(effectivePortionMultiplier(2)).toBe(2);
  });

  it("produces byte-identical rows for the same plan (web ↔ mobile parity)", async () => {
    const entries = [
      { title: "Chicken & Rice", multiplier: 2 },
      { title: "Chicken & Rice", multiplier: 1 }, // same recipe, two slots
    ];

    // Web path: synchronous, pre-fetched map.
    const web = generateShoppingListFromRecipeEntries({
      entries,
      recipeTitleToId: titleToId,
      ingredientsByRecipeId: INGREDIENTS,
    });
    // Mobile path: async generator handed the same pre-built batch map.
    const mobile = await generateShoppingListFromRecipeEntriesAsync({
      entries,
      recipeTitleToId: titleToId,
      fetchDbIngredients: async (id) => INGREDIENTS.get(id) ?? [],
      fetchDbIngredientsBatch: async () => INGREDIENTS,
    });

    // Both must produce identical rows down to amount, unit, category, from.
    expect(mobile).toEqual(web);

    // And the two slots (2× + 1× = 3× total) sum correctly.
    const chicken = mobile.find((i) => i.name === "chicken breast");
    expect(chicken?.amount).toBe("600"); // 200 × (2 + 1)
  });

  it("eggs land in the shared 'Protein' aisle (consistent categories both platforms)", async () => {
    const list = await generateShoppingListFromRecipeEntriesAsync({
      entries: [{ title: "Chicken & Rice", multiplier: 1 }],
      recipeTitleToId: titleToId,
      fetchDbIngredients: async (id) => INGREDIENTS.get(id) ?? [],
      fetchDbIngredientsBatch: async () => INGREDIENTS,
    });
    const egg = list.find((i) => i.name === "egg");
    // Shared `guessGroceryCategory` maps egg → "Protein" (not the old mobile
    // "Dairy & Eggs"). Same aisle on web + mobile by construction.
    expect(egg?.category).toBe("Protein");
  });

  it("ENG-1134 — scales ingredient amounts by planned portion ÷ recipe servings", () => {
    const ingredientsByRecipeId = new Map([
      ["r1", [{ name: "chicken breast", amount: "400", unit: "g" }]],
    ]);

    const atOnePortionOfFour = generateShoppingListFromRecipeEntries({
      entries: [{ title: "Family Tray", multiplier: shoppingListIngredientMultiplier(1, 4) }],
      recipeTitleToId: (title) => (title === "Family Tray" ? "r1" : null),
      ingredientsByRecipeId,
    });
    const chicken = atOnePortionOfFour.find((i) => i.name === "chicken breast");
    expect(chicken?.amount).toBe("100");
  });

  it("ENG-1134 — parent + leftover slots sum to full recipe yield (4 portions of 4-serving recipe)", () => {
    const ingredientsByRecipeId = new Map([
      ["r1", [{ name: "chicken breast", amount: "400", unit: "g" }]],
    ]);
    const portion = shoppingListIngredientMultiplier(1, 4);
    const list = generateShoppingListFromRecipeEntries({
      entries: [
        { title: "Family Tray", multiplier: portion },
        { title: "Family Tray", multiplier: portion },
        { title: "Family Tray", multiplier: portion },
        { title: "Family Tray", multiplier: portion },
      ],
      recipeTitleToId: (title) => (title === "Family Tray" ? "r1" : null),
      ingredientsByRecipeId,
    });
    const chicken = list.find((i) => i.name === "chicken breast");
    expect(chicken?.amount).toBe("400");
  });
});
