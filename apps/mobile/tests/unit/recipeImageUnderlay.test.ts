/**
 * ENG-1374 PR 2 — never-white recipe-image underlay, mobile surface pins.
 *
 * The structural guarantee: EVERY recipe-image container paints an opaque
 * §11.4 cuisine tint (`recipeUnderlayColor`, or `CARD_CREAM` where the
 * container has no recipe identity) on the WRAPPER itself, so no child
 * failure — 404, SVG mount failure, slow network, style clobber (the
 * ENG-1382 class) — can expose page white. Reference implementation:
 * `components/library/RecipeCardImage.tsx`. Behavioural coverage of that
 * component (including the flag-off photo path): `libraryRecipeCardImage.test.tsx`.
 * Web twin: `tests/unit/recipeImageUnderlay.test.ts`; tint opacity pins:
 * `tests/unit/recipeHeroFallback.test.ts` (shared module).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");

describe("mobile recipe-image containers — opaque wrapper underlay (ENG-1374 PR 2)", () => {
  it("RecipeCardImage computes the underlay internally — the overridable fallbackBg prop is retired (was fed #FFFFFF)", () => {
    const src = read("components/library/RecipeCardImage.tsx");
    expect(src).toMatch(/recipeUnderlayColor\(\{ id: recipeId, title: recipeTitle \}\)/);
    expect(src).not.toMatch(/fallbackBg[:?]/); // no prop, no type member — comment mentions only
    // photo branch carries the tint on the image element too (flag-off RN Image path)
    expect(src).toContain("style={[cardImageStyle, { backgroundColor: underlay }]}");
  });

  it("no RecipeCardImage consumer passes a ground colour any more", () => {
    for (const p of [
      "app/(tabs)/library.tsx",
      "components/library/FeaturedHero.tsx",
      "components/library/RecipeCardWide.tsx",
      "components/profile/EditorialProfileBlock.tsx",
    ]) {
      expect(read(p)).not.toContain("fallbackBg");
    }
  });

  it("RecipeDetailHero wrapper is the recipe's cuisine tint (was the brand plum)", () => {
    const src = read("components/recipe/RecipeDetailHero.tsx");
    expect(src).toMatch(/backgroundColor: recipeUnderlayColor\(\{ id: recipeId, title, tags \}\)/);
    expect(src).not.toContain("backgroundColor: Accent.primary }");
  });

  it("NorthStar thumbs (block + Figma hero) are tinted", () => {
    for (const p of [
      "components/today/NorthStarBlock.tsx",
      "components/today/NorthStarFigmaHero.tsx",
    ]) {
      expect(read(p)).toMatch(
        /backgroundColor: recipeUnderlayColor\(\{ id: suggestion\.recipeId, title: suggestion\.title \}\)/,
      );
    }
  });

  it("coach candidate rows: one tinted wrapper hosts both the photo and the fallback", () => {
    const src = read("components/coach/CoachScreenView.tsx");
    expect(src).toMatch(
      /backgroundColor: recipeUnderlayColor\(\{ id: candidate\.recipeId, title: candidate\.title \}\)/,
    );
  });

  it("Discover cluster cards compute the tint per recipe — the white colors.card placeholder prop is retired", () => {
    const src = read("components/discover/DiscoverClusterCarousels.tsx");
    expect(src).toMatch(/const underlay = recipeUnderlayColor\(\{ id: recipe\.id, title: recipe\.title \}\)/);
    expect(src).not.toContain("placeholderColor={colors.card}");
    expect(src).toContain("backgroundColor: underlay");
  });

  it("Discover 'More ideas' row thumbs: tinted wrapper hosts both branches (colors.card ground gone)", () => {
    const src = read("components/discover/DiscoverMoreIdeaRow.tsx");
    expect(src).toMatch(/backgroundColor: recipeUnderlayColor\(\{ id: item\.id, title: item\.title \}\)/);
    expect(src).not.toContain("backgroundColor: colors.card");
  });

  it("Discover hero media wrapper is tinted", () => {
    const src = read("app/(tabs)/discover.tsx");
    expect(src).toMatch(/backgroundColor: recipeUnderlayColor\(\{ id: item\.id, title: item\.title \}\)/);
  });

  it("FollowingFeed recipe media wrapper is tinted — the transparent ground is gone", () => {
    const src = read("components/discover/FollowingFeed.tsx");
    expect(src).toMatch(/backgroundColor: recipeUnderlayColor\(\{ id: recipe\.id, title: recipe\.title \}\)/);
    expect(src).not.toContain('backgroundColor: "transparent"');
  });

  it("planner meal-row thumbs: photo + fallback grounds are the OPAQUE cuisine tint (the translucent slot wash is off the photo path)", () => {
    const src = read("app/(tabs)/planner.tsx");
    expect(src.match(/backgroundColor: recipeUnderlayColor\(/g)?.length).toBe(2);
    // the translucent slot wash survives ONLY on the empty-slot icon box (no image ever renders there)
    expect(src.match(/backgroundColor: tint \+ "22"/g)?.length).toBe(1);
  });

  it("create-recipe + wizard photo grounds are CARD_CREAM (no recipe identity yet — never white colors.card)", () => {
    const createSrc = read("app/create-recipe.tsx");
    expect(createSrc.match(/backgroundColor: CARD_CREAM/g)?.length).toBe(2);
    const wizardSrc = read("components/recipe/CreateRecipeWizard.tsx");
    expect(wizardSrc.match(/backgroundColor: CARD_CREAM/g)?.length).toBe(2);
  });

  it("paywall hero keeps its deliberate opaque underlay (Accent.primaryDeep, tonally matched to the bundled photo) — verified, not swept", () => {
    const src = read("components/paywall/PaywallHero.tsx");
    expect(src).toContain("backgroundColor: Accent.primaryDeep");
  });
});
