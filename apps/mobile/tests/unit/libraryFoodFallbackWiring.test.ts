/**
 * ENG-1015 — Library recipe cards use painterly FoodFallbackThumb.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../../components/library/RecipeCardImage.tsx"),
  "utf8",
);

describe("Library RecipeCardImage — FoodFallbackThumb (ENG-1015)", () => {
  it("imports and renders FoodFallbackThumb for id/title fallbacks", () => {
    expect(SRC).toMatch(/import \{ FoodFallbackThumb \}/);
    expect(SRC).toMatch(/<FoodFallbackThumb/);
    expect(SRC).not.toMatch(/RecipeHeroFallback/);
  });
});
