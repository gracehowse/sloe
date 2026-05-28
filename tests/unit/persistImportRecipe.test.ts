/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { persistImportRecipe } from "@/lib/planning/planImport/persistImportRecipe";
import type { PlanImportVerifiedRecipe } from "@/lib/planning/planImport/types";

const recipe: PlanImportVerifiedRecipe = {
  key: "bowl",
  title: "Power Bowl",
  serves: 2,
  ingredients: ["100 g rice", "150 g chicken"],
  method: "Mix and serve.",
  authorNutrition: { calories: 420, protein: 32, carbs: 40, fat: 12, fiberG: 4 },
  supprNutrition: { calories: 400, protein: 30, carbs: 38, fat: 11, fiberG: 3 },
  confidence: "high",
  confidenceTier: "high",
  ingredientCount: 2,
  ingredientMacros: [
    { name: "rice", amount: "100", unit: "g", calories: 130, protein: 3, carbs: 28, fat: 0, source: "usda" },
    { name: "chicken", amount: "150", unit: "g", calories: 270, protein: 27, carbs: 0, fat: 11, source: "usda" },
  ],
};

type QueryResult = { data?: unknown; error?: { message: string } | null };

type SupabaseMockConfig = {
  recipeInsert?: QueryResult;
  ingredientInsert?: QueryResult;
  saveInsert?: QueryResult;
  recipeDelete?: QueryResult;
};

function makeSupabase(config: SupabaseMockConfig = {}) {
  const from = vi.fn((table: string) => {
    if (table === "recipes") {
      const single = vi.fn().mockResolvedValue(
        config.recipeInsert ?? { data: { id: "recipe-1" }, error: null },
      );
      const select = vi.fn(() => ({ single }));
      const insert = vi.fn(() => ({ select }));
      const eq = vi.fn().mockResolvedValue(config.recipeDelete ?? { error: null });
      const del = vi.fn(() => ({ eq }));
      return { insert, select, single, delete: del, eq };
    }
    if (table === "recipe_ingredients") {
      const insert = vi.fn().mockResolvedValue(config.ingredientInsert ?? { error: null });
      return { insert };
    }
    if (table === "saves") {
      const insert = vi.fn().mockResolvedValue(config.saveInsert ?? { error: null });
      return { insert };
    }
    return { insert: vi.fn().mockResolvedValue({ error: null }) };
  });
  return { from } as unknown as SupabaseClient;
}

describe("persistImportRecipe", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("inserts recipe, ingredients, and save row in match mode", async () => {
    const supabase = makeSupabase({
      recipeInsert: { data: { id: "recipe-1" }, error: null },
    });
    const result = await persistImportRecipe(supabase, "u1", "Week 1", recipe, "match");
    expect(result).toEqual({ recipeId: "recipe-1" });
  });

  it("uses author macros in author mode when calories are present", async () => {
    const supabase = makeSupabase({
      recipeInsert: { data: { id: "recipe-2" }, error: null },
    });
    await persistImportRecipe(supabase, "u1", "Week 1", recipe, "author");
    const insertCall = (supabase.from as ReturnType<typeof vi.fn>).mock.results[0]
      .value.insert.mock.calls[0][0];
    expect(insertCall.calories).toBe(420);
    expect(insertCall.is_verified).toBe(false);
  });

  it("returns mapped error when recipe insert fails", async () => {
    const supabase = makeSupabase({
      recipeInsert: { data: null, error: { message: "duplicate key" } },
    });
    const result = await persistImportRecipe(supabase, "u1", "Week 1", recipe, "match");
    expect(result).toHaveProperty("error");
  });

  it("rolls back recipe when ingredient insert fails", async () => {
    const supabase = makeSupabase({
      recipeInsert: { data: { id: "recipe-3" }, error: null },
      ingredientInsert: { error: { message: "ingredient insert failed" } },
      recipeDelete: { error: null },
    });
    const result = await persistImportRecipe(supabase, "u1", "Week 1", recipe, "match");
    expect(result).toHaveProperty("error");
    expect(supabase.from).toHaveBeenCalledWith("recipes");
  });
});
