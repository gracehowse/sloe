import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

describe("ENG-759 — Recipe edit on web", () => {
  it("RecipeEditDialog uses shared recipeEdit helpers", () => {
    const src = read("../../src/app/components/suppr/recipe-edit-dialog.tsx");
    expect(src).toMatch(/buildRecipeMetadataUpdate/);
    expect(src).toMatch(/recomputeRecipeAggregate/);
    expect(src).toMatch(/recipe-edit-dialog/);
  });

  it("RecipeDetail opens RecipeEditDialog instead of create-flow redirect", () => {
    const src = read("../../src/app/components/RecipeDetail.tsx");
    expect(src).toMatch(/RecipeEditDialog/);
    expect(src).toMatch(/setRecipeEditOpen\(true\)/);
    expect(src).not.toMatch(/editRecipe: recipe\.id/);
  });
});
