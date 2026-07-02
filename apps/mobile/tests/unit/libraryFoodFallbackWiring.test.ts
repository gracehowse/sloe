/**
 * ENG-1287 — honest imagery: Library recipe cards fall back to the
 * deterministic RecipeHeroFallback (cuisine-tinted gradient + glyph),
 * matching Discover / coach / NorthStar and the web Library grid.
 *
 * (Supersedes the ENG-1015 painterly-card wiring: FoodFallbackThumb's
 * illustration samples stay on food ROWS — LogSheet + onboarding — but
 * card surfaces must render one shared treatment on both platforms.)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../../components/library/RecipeCardImage.tsx"),
  "utf8",
);

describe("Library RecipeCardImage — RecipeHeroFallback (ENG-1287)", () => {
  it("imports and renders RecipeHeroFallback for the no-image / error fallback", () => {
    expect(SRC).toMatch(/import \{ RecipeHeroFallback \}/);
    expect(SRC).toMatch(/<RecipeHeroFallback/);
    expect(SRC).not.toMatch(/FoodFallbackThumb/);
    // Never a substituted stock photo: the only Image rendered is the
    // caller-supplied uri via SmartImage.
    expect(SRC).not.toMatch(/images\.unsplash\.com/);
  });
});
