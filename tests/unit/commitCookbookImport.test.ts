/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/planning/planImport/persistImportRecipe", () => ({
  persistImportRecipe: vi.fn(),
}));

import { commitCookbookImport } from "@/lib/planning/planImport/commitCookbookImport";
import { persistImportRecipe } from "@/lib/planning/planImport/persistImportRecipe";
import type { PlanImportVerifiedRecipe } from "@/lib/planning/planImport/types";

const mockPersist = persistImportRecipe as ReturnType<typeof vi.fn>;

const recipe = (key: string): PlanImportVerifiedRecipe => ({
  key,
  title: key,
  serves: 1,
  ingredients: ["1 egg"],
  supprNutrition: { calories: 100, protein: 6, carbs: 1, fat: 7, fiberG: 0 },
  confidence: "high",
  confidenceTier: "high",
  ingredientCount: 1,
});

describe("commitCookbookImport", () => {
  const supabase = {} as SupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves all recipes and returns id map", async () => {
    mockPersist
      .mockResolvedValueOnce({ recipeId: "id-a" })
      .mockResolvedValueOnce({ recipeId: "id-b" });
    const result = await commitCookbookImport(supabase, {
      userId: "u1",
      bookName: "Fast 800",
      recipes: [recipe("a"), recipe("b")],
      nutritionMode: "match",
    });
    expect(result).toMatchObject({
      ok: true,
      savedCount: 2,
      recipeIdByKey: { a: "id-a", b: "id-b" },
      stoppedEarly: false,
    });
  });

  it("stops early when maxSaves cap is reached", async () => {
    mockPersist.mockResolvedValue({ recipeId: "id-1" });
    const result = await commitCookbookImport(
      supabase,
      {
        userId: "u1",
        bookName: "Fast 800",
        recipes: [recipe("a"), recipe("b"), recipe("c")],
        nutritionMode: "match",
      },
      { maxSaves: 1 },
    );
    expect(result).toMatchObject({
      ok: true,
      savedCount: 1,
      stoppedEarly: true,
      stopReason: "save_limit",
    });
    expect(mockPersist).toHaveBeenCalledTimes(1);
  });

  it("returns ok:false when first save fails", async () => {
    mockPersist.mockResolvedValue({ error: "Could not save recipe." });
    const result = await commitCookbookImport(supabase, {
      userId: "u1",
      bookName: "Fast 800",
      recipes: [recipe("a")],
      nutritionMode: "match",
    });
    expect(result).toMatchObject({ ok: false, savedCount: 0 });
  });

  it("returns partial success when a later save fails", async () => {
    mockPersist
      .mockResolvedValueOnce({ recipeId: "id-a" })
      .mockResolvedValueOnce({ error: "Network error" });
    const result = await commitCookbookImport(supabase, {
      userId: "u1",
      bookName: "Fast 800",
      recipes: [recipe("a"), recipe("b")],
      nutritionMode: "match",
    });
    expect(result).toMatchObject({
      ok: true,
      savedCount: 1,
      stoppedEarly: true,
      stopReason: "error",
    });
  });
});
