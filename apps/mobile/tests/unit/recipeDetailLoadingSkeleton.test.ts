import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DETAIL_SRC = readFileSync(resolve(__dirname, "../../app/recipe/[id].tsx"), "utf8");
const SKELETON_SRC = readFileSync(
  resolve(__dirname, "../../components/recipe/RecipeDetailLoadingSkeleton.tsx"),
  "utf8",
);

describe("Recipe detail cold-load skeleton (ENG-1343)", () => {
  it("the loading branch renders RecipeDetailLoadingSkeleton, not a bare ActivityIndicator", () => {
    expect(DETAIL_SRC).toContain("RecipeDetailLoadingSkeleton");
    expect(DETAIL_SRC).toContain("topInset={insets.top}");
    // The `if (loading)` return no longer mounts a centred ActivityIndicator that
    // hard-cut to the full layout when the recipe resolved.
    expect(DETAIL_SRC).not.toMatch(/if \(loading\)[\s\S]{0,220}ActivityIndicator/);
  });

  it("silhouettes the real layout: full-bleed hero at RECIPE_HERO_HEIGHT + control chips + title + ingredient rows", () => {
    expect(SKELETON_SRC).toContain('testID="recipe-detail-loading-skeleton"');
    expect(SKELETON_SRC).toMatch(/accessibilityRole="progressbar"/);
    // Reuses the real hero height so the placeholder occupies the exact footprint.
    expect(SKELETON_SRC).toContain("RECIPE_HERO_HEIGHT");
    // Reuses the shared Shimmer pulse (not a bespoke animation).
    expect(SKELETON_SRC).toMatch(/from "@\/components\/ui\/SkeletonRow"/);
    expect(SKELETON_SRC).toMatch(/heroControls/);
    expect(SKELETON_SRC).toMatch(/ingredientRow/);
    // A loading state invents no copy or numbers.
    expect(SKELETON_SRC).not.toMatch(/<Text/);
  });
});
