import { describe, expect, it } from "vitest";
import { splitPastedIngredientLines } from "../../src/lib/recipe-ingredients/splitPastedIngredientLines";

describe("splitPastedIngredientLines", () => {
  it("splits lines and strips bullets and numeric prefixes", () => {
    const raw = "  - 2 cups flour  \n* 1 egg\n3. milk\n";
    expect(splitPastedIngredientLines(raw)).toEqual(["2 cups flour", "1 egg", "milk"]);
  });
});
