import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(__dirname, "../../../..");

describe("ENG-946 ingredient checklist wiring", () => {
  it("mobile cook screen gates mise en place", () => {
    const src = readFileSync(join(REPO, "apps/mobile/app/cook.tsx"), "utf8");
    expect(src).toContain('isFeatureEnabled("cook_ingredient_checklist_v1")');
    expect(src).toContain("CookMiseEnPlace");
  });

  it("mobile recipe detail surfaces checklist on ingredients", () => {
    const src = readFileSync(join(REPO, "apps/mobile/app/recipe/[id].tsx"), "utf8");
    expect(src).toContain("CookIngredientChecklist");
    expect(src).toContain('surface="recipe_detail"');
  });

  it("web CookMode and RecipeDetail gate checklist", () => {
    const cook = readFileSync(join(REPO, "src/app/components/CookMode.tsx"), "utf8");
    const detail = readFileSync(join(REPO, "src/app/components/RecipeDetail.tsx"), "utf8");
    expect(cook).toContain('isFeatureEnabled("cook_ingredient_checklist_v1")');
    expect(cook).toContain("CookMiseEnPlace");
    expect(detail).toContain("CookIngredientChecklist");
  });
});
