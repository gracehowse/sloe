/**
 * RecipeDetail v3 hero overlay — web parity (ENG-1247, flag recipe_detail_v3).
 * Web twin of mobile RecipeDetailHero: the title block overlays the hero photo
 * (kicker overline + serif h1 + meta row over a veil) instead of below it.
 * Source-grep guard (mirrors the mobile recipeDetailHeroOverlayV3 test) — and
 * pins that exactly ONE <h1> renders per flag state (no duplicate page heading).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = fs.readFileSync(
  path.join(process.cwd(), "src/app/components/RecipeDetail.tsx"),
  "utf8",
);

describe("RecipeDetail v3 hero overlay (web)", () => {
  it("reads the recipe_detail_v3 flag", () => {
    expect(SRC).toMatch(/const recipeDetailV3 = isFeatureEnabled\("recipe_detail_v3"\)/);
  });

  it("renders the flag-gated overlay (veil + kicker + serif h1 + meta icons)", () => {
    expect(SRC).toMatch(/recipeDetailV3 \? \(/); // overlay branch
    expect(SRC).toMatch(/bg-gradient-to-t from-black/); // bottom veil
    expect(SRC).toMatch(/data-testid="recipe-hero-title"/); // overlay serif h1
    expect(SRC).toMatch(/from your cookbook/i); // kicker copy
    expect(SRC).toMatch(/<Clock |<Flame |<Utensils /); // meta icons
  });

  it("hides the below-hero title + suppresses the below-hero meta row on v3", () => {
    // the below-hero <h1 data-testid="recipe-body-title"> is gated off
    expect(SRC).toMatch(/recipeDetailV3 \? null : \(\s*\n?\s*<h1/);
    // the meta row IIFE early-returns null on v3
    expect(SRC).toMatch(/if \(recipeDetailV3\) return null;\s*\n\s*if \(metaStats\.length === 0\)/);
  });

  it("exactly one <h1> per flag state (no duplicate page heading)", () => {
    // Two h1s exist in source (hero overlay + below-hero), but each is gated to
    // the opposite flag value, so only one ever renders. Pin both anchors.
    expect(SRC).toMatch(/data-testid="recipe-hero-title"/); // shows when v3
    expect(SRC).toMatch(/data-testid="recipe-body-title"/); // shows when !v3
  });
});
