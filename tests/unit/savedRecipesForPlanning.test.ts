import { describe, expect, it } from "vitest";
import { savedRecipesForPlanning } from "@/lib/planning/savedRecipesForPlanning";
import type { RecipeCard } from "@/types/recipe";

function card(id: string, title: string): RecipeCard {
  return {
    id,
    title,
    creatorName: "Test",
    creatorImage: "",
    image: "",
    servings: 1,
    calories: 400,
    protein: 30,
    carbs: 40,
    fat: 12,
    savedCount: 0,
    isSaved: true,
  };
}

describe("savedRecipesForPlanning", () => {
  it("resolves user-authored library recipes not in community feed", () => {
    const mine = card("lib-1", "My pasta");
    const pool = savedRecipesForPlanning({
      savedRecipeIds: ["lib-1"],
      myLibraryRecipes: [mine],
      uploadedRecipes: [],
    });
    expect(pool).toHaveLength(1);
    expect(pool[0]!.id).toBe("lib-1");
  });

  it("resolves community uploads by id", () => {
    const community = card("comm-1", "Community bowl");
    const pool = savedRecipesForPlanning({
      savedRecipeIds: ["comm-1"],
      myLibraryRecipes: [],
      uploadedRecipes: [community],
    });
    expect(pool[0]!.title).toBe("Community bowl");
  });

  it("prefers authored row when id exists in both pools", () => {
    const authored = card("dup", "Authored version");
    const community = { ...card("dup", "Community version"), calories: 100 };
    const pool = savedRecipesForPlanning({
      savedRecipeIds: ["dup"],
      myLibraryRecipes: [authored],
      uploadedRecipes: [community],
    });
    expect(pool[0]!.calories).toBe(400);
  });
});
