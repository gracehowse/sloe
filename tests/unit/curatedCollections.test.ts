/**
 * curatedCollections (ENG-1225 Block 6) — the shared Discover collection tiles.
 * Pins the two tiles, their category-pill mapping, and the live count helper.
 */
import { describe, expect, it } from "vitest";
import {
  CURATED_COLLECTIONS,
  collectionRecipeCount,
} from "../../src/lib/discover/curatedCollections";
import type { RecipeCategoryRecipe } from "../../src/lib/recipes/recipeCategoryFilters";

const r = (o: Partial<RecipeCategoryRecipe>): RecipeCategoryRecipe =>
  ({ title: "x", protein: 10, prepTimeMin: 10, cookTimeMin: 10, ...o }) as RecipeCategoryRecipe;

describe("CURATED_COLLECTIONS", () => {
  it("ships exactly the two pill-mapped tiles", () => {
    expect(CURATED_COLLECTIONS.map((c) => c.id)).toEqual(["high-protein", "under-30"]);
    expect(CURATED_COLLECTIONS.map((c) => c.categoryId)).toEqual(["high-protein", "quick"]);
  });

  it("each tile has a 2-stop gradient", () => {
    for (const c of CURATED_COLLECTIONS) {
      expect(c.gradient).toHaveLength(2);
      expect(c.label.length).toBeGreaterThan(0);
    }
  });
});

describe("collectionRecipeCount", () => {
  const high = CURATED_COLLECTIONS[0]; // high-protein (>=25g)
  const quick = CURATED_COLLECTIONS[1]; // quick (<=30 min)

  it("counts high-protein recipes for the high-protein tile", () => {
    const recipes = [r({ protein: 40 }), r({ protein: 10 }), r({ protein: 30 })];
    expect(collectionRecipeCount(high, recipes)).toBe(2);
  });

  it("counts quick recipes for the under-30 tile", () => {
    const recipes = [
      r({ prepTimeMin: 5, cookTimeMin: 10 }),
      r({ prepTimeMin: 30, cookTimeMin: 40 }),
    ];
    expect(collectionRecipeCount(quick, recipes)).toBe(1);
  });
});
