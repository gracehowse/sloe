/**
 * @vitest-environment node
 *
 * ENG-1276 — matched_alias_key persistence on the import insert paths.
 *
 * Both the plan-import (`persistImportRecipe`) and social/HTML import
 * (`saveImportedRecipe`) paths must write `recipe_ingredients.matched_alias_key`
 * = matchedAliasKey(...) when the match is trusted (confidence ≥ 0.85 with
 * source + fatsecret_food_id present), and null otherwise. They must also
 * forward `fatsecret_food_id`, and degrade gracefully when the staged column
 * is missing (legacy DB) by retrying the insert without it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { persistImportRecipe } from "@/lib/planning/planImport/persistImportRecipe";
import type { PlanImportVerifiedRecipe } from "@/lib/planning/planImport/types";
import { saveImportedRecipe } from "@/lib/recipes/persistImportedRecipe";
import type { ApiImportedRecipe } from "@/lib/recipes/persistImportedRecipe";

type IngredientRowPayload = {
  name: string;
  fatsecret_food_id: string | null;
  matched_alias_key: string | null;
};

/** Captures the recipe_ingredients insert payloads. `ingredientInsert`
 *  configures the first-attempt result; a second attempt (legacy-DB retry)
 *  always succeeds so we can assert the retry payload. */
function makeSupabase(config: {
  ingredientFirstError?: { code?: string; message?: string } | null;
} = {}) {
  const ingredientInserts: IngredientRowPayload[][] = [];
  let ingredientAttempt = 0;
  const from = vi.fn((table: string) => {
    if (table === "recipes") {
      const single = vi.fn().mockResolvedValue({ data: { id: "recipe-1" }, error: null });
      const select = vi.fn(() => ({ single }));
      const insert = vi.fn(() => ({ select }));
      const eq = vi.fn().mockResolvedValue({ error: null });
      const del = vi.fn(() => ({ eq }));
      const maybeSingle = vi.fn().mockResolvedValue({ data: null });
      const limit = vi.fn(() => ({ maybeSingle }));
      const eqChain = vi.fn(() => ({ eq: eqChain, limit, maybeSingle }));
      const selectForRead = vi.fn(() => ({ eq: eqChain }));
      return { insert, select: selectForRead, single, delete: del, eq };
    }
    if (table === "recipe_ingredients") {
      const insert = vi.fn((rows: IngredientRowPayload[]) => {
        ingredientAttempt += 1;
        ingredientInserts.push(rows);
        if (ingredientAttempt === 1 && config.ingredientFirstError) {
          return Promise.resolve({ error: config.ingredientFirstError });
        }
        return Promise.resolve({ error: null });
      });
      const eq = vi.fn().mockResolvedValue({ error: null });
      const del = vi.fn(() => ({ eq }));
      return { insert, delete: del };
    }
    if (table === "saves") {
      const insert = vi.fn().mockResolvedValue({ error: null });
      const upsert = vi.fn().mockResolvedValue({ error: null });
      return { insert, upsert };
    }
    return { insert: vi.fn().mockResolvedValue({ error: null }) };
  });
  return { supabase: { from } as unknown as SupabaseClient, ingredientInserts };
}

describe("ENG-1276 — plan-import persistImportRecipe writes matched_alias_key", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

  const recipe: PlanImportVerifiedRecipe = {
    key: "bowl",
    title: "Power Bowl",
    serves: 2,
    ingredients: ["100 g rice", "150 g chicken"],
    method: "Mix.",
    authorNutrition: null,
    supprNutrition: { calories: 400, protein: 30, carbs: 38, fat: 11, fiberG: 3 },
    confidence: "high",
    confidenceTier: "high",
    ingredientCount: 2,
    ingredientMacros: [
      // trusted match → alias key expected
      { name: "rice", amount: "100", unit: "g", calories: 130, protein: 3, carbs: 28, fat: 0, source: "USDA", confidence: 0.95, fatsecretFoodId: "111" },
      // weak match → null alias key
      { name: "chicken", amount: "150", unit: "g", calories: 270, protein: 27, carbs: 0, fat: 11, source: "FatSecret", confidence: 0.4, fatsecretFoodId: "222" },
    ],
  };

  it("writes the alias key for the trusted row and null for the weak row", async () => {
    const { supabase, ingredientInserts } = makeSupabase();
    const res = await persistImportRecipe(supabase, "u1", "Week 1", recipe, "match");
    expect(res).toEqual({ recipeId: "recipe-1" });

    const rows = ingredientInserts[0]!;
    const rice = rows.find((r) => r.name === "100 g rice")!;
    const chicken = rows.find((r) => r.name === "150 g chicken")!;
    expect(rice.matched_alias_key).toBe("usda:111");
    expect(rice.fatsecret_food_id).toBe("111");
    expect(chicken.matched_alias_key).toBeNull();
    expect(chicken.fatsecret_food_id).toBe("222");
  });

  it("retries without the alias column on a not-yet-migrated DB (42703)", async () => {
    const { supabase, ingredientInserts } = makeSupabase({
      ingredientFirstError: { code: "42703", message: 'column "matched_alias_key" does not exist' },
    });
    const res = await persistImportRecipe(supabase, "u1", "Week 1", recipe, "match");
    expect(res).toEqual({ recipeId: "recipe-1" });
    // First attempt carried the column; the retry stripped it.
    expect("matched_alias_key" in ingredientInserts[0]![0]!).toBe(true);
    expect("matched_alias_key" in ingredientInserts[1]![0]!).toBe(false);
  });
});

describe("ENG-1276 — saveImportedRecipe writes matched_alias_key", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

  const recipe: ApiImportedRecipe = {
    title: "Bowl",
    ingredients: ["100 g rice", "1 egg"],
    instructions: "Mix.",
    servings: 1,
    ingredientMacros: [
      { name: "rice", amount: "100", unit: "g", calories: 130, protein: 3, carbs: 28, fat: 0, source: "USDA", confidence: 0.9, fatsecretFoodId: "111" },
      { name: "egg", amount: "1", unit: "", calories: 70, protein: 6, carbs: 0, fat: 5, source: "Unverified", confidence: null, fatsecretFoodId: null },
    ],
  };

  it("writes the alias key for the trusted row and null for the unverified row", async () => {
    const { supabase, ingredientInserts } = makeSupabase();
    const res = await saveImportedRecipe(supabase, "u1", recipe);
    expect(res).toEqual({ recipeId: "recipe-1" });

    const rows = ingredientInserts[0]!;
    const rice = rows.find((r) => r.name === "100 g rice")!;
    const egg = rows.find((r) => r.name === "1 egg")!;
    expect(rice.matched_alias_key).toBe("usda:111");
    expect(rice.fatsecret_food_id).toBe("111");
    expect(egg.matched_alias_key).toBeNull();
    expect(egg.fatsecret_food_id).toBeNull();
  });
});
