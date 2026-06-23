/**
 * deriveLibraryShelves (ENG-1225 Block 5) — the shared Cookbook editorial-shelf
 * derivation. Pins the three thresholds (≤600 kcal / ≤30 min / ≥27 g), the
 * 6-card cap, empty-shelf removal, and the fixed order.
 */
import { describe, expect, it } from "vitest";
import {
  deriveLibraryShelves,
  type LibraryShelfRecipe,
} from "../../src/lib/recipes/libraryShelves";

const r = (
  id: string,
  o: Partial<LibraryShelfRecipe> = {},
): LibraryShelfRecipe & { id: string } => ({
  id,
  title: id,
  calories: 500,
  protein: 30,
  prepTimeMin: 10,
  cookTimeMin: 15,
  ...o,
});

describe("deriveLibraryShelves", () => {
  it("splits recipes into the three shelves by threshold", () => {
    const shelves = deriveLibraryShelves([
      r("fits-only", { calories: 450, protein: 10, prepTimeMin: 40, cookTimeMin: 40 }),
      r("quick-only", { calories: 900, protein: 10, prepTimeMin: 5, cookTimeMin: 10 }),
      r("protein-only", { calories: 900, protein: 35, prepTimeMin: 40, cookTimeMin: 40 }),
    ]);
    const byKey = Object.fromEntries(shelves.map((s) => [s.key, s.recipes.map((x) => x.id)]));
    expect(byKey.fits).toEqual(["fits-only"]);
    expect(byKey.quick).toEqual(["quick-only"]);
    expect(byKey["high-protein"]).toEqual(["protein-only"]);
  });

  it("keeps shelf order Fits → Quick → High protein", () => {
    const shelves = deriveLibraryShelves([r("a")]); // a qualifies for all three
    expect(shelves.map((s) => s.key)).toEqual(["fits", "quick", "high-protein"]);
  });

  it("drops empty shelves", () => {
    // All recipes are high-cal, slow, low-protein → no shelf qualifies.
    const shelves = deriveLibraryShelves([
      r("x", { calories: 1200, protein: 5, prepTimeMin: 60, cookTimeMin: 30 }),
    ]);
    expect(shelves).toHaveLength(0);
  });

  it("caps each shelf at 6", () => {
    const many = Array.from({ length: 10 }, (_, i) => r(`m${i}`, { calories: 400 }));
    const fits = deriveLibraryShelves(many).find((s) => s.key === "fits");
    expect(fits?.recipes).toHaveLength(6);
  });

  it("excludes the boundary just over each threshold", () => {
    const shelves = deriveLibraryShelves([
      r("over-cal", { calories: 601, protein: 10, prepTimeMin: 40, cookTimeMin: 40 }),
      r("under-protein", { calories: 900, protein: 26, prepTimeMin: 40, cookTimeMin: 40 }),
      r("over-time", { calories: 900, protein: 10, prepTimeMin: 20, cookTimeMin: 11 }),
    ]);
    expect(shelves).toHaveLength(0);
  });
});
