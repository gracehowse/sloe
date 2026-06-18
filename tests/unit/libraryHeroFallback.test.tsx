/**
 * Recipe-wave (2026-05-10) — Library cards now render the deterministic
 * `RecipeHeroFallback` when a recipe has no `image`. Pre-fix the
 * `<img>` tag was emitted with a falsy `src`, producing the broken
 * placeholder Grace flagged in "Library inconsistency: some recipes
 * have images, some don't".
 *
 * This is a structural test — we read the source and assert the
 * fallback is wired on both the desktop grid and the mobile-web card
 * branches. (Render-tree tests for Library are heavier; the fallback
 * itself is already covered by its own component test.)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const LIBRARY_PATH = resolve(__dirname, "../../src/app/components/Library.tsx");
const RECIPE_DETAIL_PATH = resolve(__dirname, "../../src/app/components/RecipeDetail.tsx");

const LIBRARY_SRC = readFileSync(LIBRARY_PATH, "utf8");
const RECIPE_DETAIL_SRC = readFileSync(RECIPE_DETAIL_PATH, "utf8");

describe("Library cards render RecipeHeroFallback when image is missing", () => {
  it("imports the shared RecipeHeroFallback component", () => {
    expect(LIBRARY_SRC).toMatch(/import\s+\{\s*RecipeHeroFallback\s*\}\s+from\s+"\.\/suppr\/RecipeHeroFallback"/);
  });

  it("renders the fallback (not a broken <img>) when recipe.image is falsy on the unified card grid", () => {
    // ENG-896 retired the dual desktop/mobile-web card paths — one
    // `library-recipe-grid` now gates the hero behind `recipe.image ?`
    // and renders <RecipeHeroFallback> in the false branch. The shared
    // `RecipeCardImage` helper also swaps to fallback on load error.
    const imageTernaries = LIBRARY_SRC.match(/recipe\.image \?[\s\S]*?<RecipeHeroFallback/g);
    expect(imageTernaries).not.toBeNull();
    expect(imageTernaries!.length).toBeGreaterThanOrEqual(1);
    expect(LIBRARY_SRC).toMatch(/function RecipeCardImage[\s\S]*?broken[\s\S]*?<RecipeHeroFallback/);
  });

  it("preserves the view-transition-name on the fallback wrapper so the morph still anchors", () => {
    // The fallback `<div>` carries `viewTransitionName: \`recipe-${recipe.id}-image\``
    // so the card → detail morph keeps a continuous geometry anchor
    // (Phase 5 / B5 spec §1.1).
    expect(LIBRARY_SRC).toMatch(/viewTransitionName:\s*`recipe-\$\{recipe\.id\}-image`/);
  });
});

describe("RecipeDetail renders RecipeHeroFallback when no real image + ladder yield URL", () => {
  it("imports the shared RecipeHeroFallback component", () => {
    expect(RECIPE_DETAIL_SRC).toMatch(/import\s+\{\s*RecipeHeroFallback\s*\}\s+from\s+"\.\/suppr\/RecipeHeroFallback"/);
  });

  it("renders the fallback when heroSrc is null (no image + no ladder hit)", () => {
    expect(RECIPE_DETAIL_SRC).toMatch(/heroSrc \?[\s\S]*?<RecipeHeroFallback/);
  });

  it("derives heroSrc from the ladder OR the recipe image (not raw recipe.image as a fallback)", () => {
    // Pre-fix: `const heroSrc = ladderSrc ?? recipe.image` could be
    // a non-string when recipe.image was null/undefined — `<img>`
    // then rendered broken. Post-fix: heroSrc resolves to a string
    // OR null, with the null branch rendering <RecipeHeroFallback>.
    expect(RECIPE_DETAIL_SRC).toMatch(/heroSrc = ladderSrc \?\? \(hasRealImage \? recipe\.image : null\)/);
  });
});
