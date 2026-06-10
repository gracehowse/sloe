/**
 * Mobile ingredient-grid tile — Sloe image system conformance pins
 * (2026-06-08, docs/decisions/2026-06-08-recipe-ingredient-image-system.md).
 *
 * `apps/mobile/components/recipe/RecipeIngredientGrid.tsx` is a pure RN
 * component wired to theme + the shared display helpers. Following the
 * `recipeDetailV3SourcePins.test.ts` idiom (these RN cells aren't worth a
 * mock sandbox to mount), we pin the structural contract of the ingredient
 * tile via source-string assertions so a silent regression — the loud
 * gradient glyph creeping back, the calm placeholder being dropped, or the
 * label reverting to the raw name — breaks the suite.
 *
 * Web parity: the same contract is pinned for `RecipeDetail.tsx` in
 * `tests/unit/recipeDetailFigmaReskin.test.ts` (web in-app detail).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const GRID = resolve(__dirname, "../../components/recipe/RecipeIngredientGrid.tsx");
const SRC = readFileSync(GRID, "utf8");

describe("RecipeIngredientGrid — Sloe ingredient image tile", () => {
  it("renders the ready Template-B photo when present (not the gradient glyph)", () => {
    // The on-brand `ingredient_images` photo is shown via <Image> when the
    // hydrated map has a ready URL for the ingredient's name_key.
    expect(SRC).toContain("resolveIngredientTileImage");
    expect(SRC).toContain("recipe-ingredient-image-");
    // The loud per-recipe gradient glyph is NO LONGER used in the tile.
    expect(SRC).not.toContain("RecipeHeroFallback");
  });

  it("falls back to a calm cream placeholder with the sage initial", () => {
    // No photo → a cream tile with the ingredient's initial in sage
    // (`getIngredientTilePlaceholder`), never an empty box.
    expect(SRC).toContain("getIngredientTilePlaceholder");
    expect(SRC).toContain("recipe-ingredient-placeholder-");
    expect(SRC).toContain("tilePlaceholder.bg");
    expect(SRC).toContain("tilePlaceholder.initial");
  });

  it("labels the tile with the cleaned display name", () => {
    // Brand/quantity noise is dropped from the visible label (display-only).
    expect(SRC).toContain("cleanIngredientDisplayName");
    expect(SRC).toContain("{displayName}");
  });

  it("accepts a hydrated imageMap prop from the parent screen", () => {
    // The screen owns the async fetch; the grid stays a pure presentational
    // component that resolves per-tile against the passed map.
    expect(SRC).toContain("imageMap");
    expect(SRC).toMatch(/imageMap\?:\s*ReadonlyMap<string, string>/);
  });
});
