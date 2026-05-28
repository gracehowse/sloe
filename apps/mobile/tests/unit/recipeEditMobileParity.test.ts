import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) =>
  readFileSync(resolve(__dirname, rel), "utf8");

describe("ENG-759 — Recipe edit on mobile", () => {
  it("recipe detail opens RecipeEditSheet for owners", () => {
    const src = read("../../app/recipe/[id].tsx");
    expect(src).toMatch(/RecipeEditSheet/);
    expect(src).toMatch(/recipeEditOpen/);
    expect(src).toMatch(/Edit recipe/);
    expect(src).toMatch(/canEditRecipe/);
  });

  it("RecipeEditSheet uses shared recipeEdit helpers", () => {
    const src = read("../../components/recipe/RecipeEditSheet.tsx");
    expect(src).toMatch(/@suppr\/shared\/recipes\/recipeEdit/);
    expect(src).toMatch(/buildRecipeMetadataUpdate/);
    expect(src).toMatch(/recomputeRecipeAggregate/);
    expect(src).toMatch(/buildManualIngredientInsert/);
  });

  it("IngredientEditRow is used for inline ingredient CRUD", () => {
    const sheet = read("../../components/recipe/RecipeEditSheet.tsx");
    expect(sheet).toMatch(/IngredientEditRow/);
    const row = read("../../components/recipe/IngredientEditRow.tsx");
    expect(row).toMatch(/Ingredient name/);
  });
});
