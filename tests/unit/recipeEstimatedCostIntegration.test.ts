/**
 * ENG-1274 — source pins for recipe grocery cost estimate integration.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("ENG-1274 — recipe estimated cost (web)", () => {
  const DETAIL = read("src/app/components/RecipeDetail.tsx");
  const META = read("src/app/components/recipe/RecipeHeroMetaRow.tsx");
  const COST = read("src/app/components/recipe/RecipeHeroCostEstimate.tsx");
  const HOOK = read("src/lib/recipe/useRecipeCostEstimate.ts");

  it("registers recipe_estimated_cost_v1 as default-OFF", () => {
    const block = read("src/lib/analytics/track.ts");
    expect(block).toContain('"recipe_estimated_cost_v1"');
    expect(block).toMatch(/KNOWN_DEFAULT_OFF_FLAGS[\s\S]*recipe_estimated_cost_v1/);
  });

  it("wires the hero meta row into recipe detail", () => {
    expect(DETAIL).toContain("RecipeHeroMetaRow");
    expect(META).toContain("RecipeHeroCostEstimate");
  });

  it("computes cost from scaled ingredients via the shared builder", () => {
    expect(HOOK).toContain("buildScaledRecipeCostEstimate");
    expect(HOOK).toContain('isFeatureEnabled("recipe_estimated_cost_v1")');
  });

  it("renders Pro estimate or locked upsell", () => {
    expect(COST).toContain('data-testid="recipe-cost-estimate"');
    expect(COST).toContain('data-testid="recipe-cost-estimate-locked"');
    expect(COST).toContain("formatRecipeCostServingLabel(estimate)");
  });
});

describe("ENG-1274 — recipe estimated cost (mobile)", () => {
  const SCREEN = read("apps/mobile/app/recipe/[id].tsx");
  const HERO = read("apps/mobile/components/recipe/RecipeDetailHero.tsx");
  const HOOK = read("apps/mobile/hooks/useRecipeCostEstimate.ts");
  const OVERLAY = read("apps/mobile/hooks/useRecipeHeroOverlay.ts");

  it("registers recipe_estimated_cost_v1 on mobile", () => {
    const block = read("apps/mobile/lib/analytics.ts");
    expect(block).toContain('"recipe_estimated_cost_v1"');
  });

  it("passes cost fields through the hero overlay", () => {
    expect(SCREEN).toContain("useRecipeHeroOverlay");
    expect(SCREEN).toContain('from=recipe_cost');
    expect(OVERLAY).toContain("useRecipeCostEstimate");
    expect(HOOK).toContain('isFeatureEnabled("recipe_estimated_cost_v1")');
    expect(HOOK).toContain("formatRecipeCostServingLabel");
    expect(HERO).toContain("costLabel");
    expect(HERO).toContain("costLocked");
    expect(HERO).toContain('testID="recipe-cost-estimate"');
  });
});
