import { describe, expect, it, vi } from "vitest";

import {
  fetchCanonicalRecipeTitle,
  resolvePlannedMealLogTitles,
} from "../../src/lib/nutrition/resolveRecipeLogTitles";

describe("resolvePlannedMealLogTitles", () => {
  it("prefers a freshly fetched DB title over a stale list label", () => {
    expect(
      resolvePlannedMealLogTitles({
        slotName: "Lunch",
        recipeTitle: "Untitled recipe",
        fetchedTitle: "Chicken salad",
      }),
    ).toEqual({ name: "Lunch", recipeTitle: "Chicken salad" });
  });

  it("falls back to Untitled recipe when both titles are empty", () => {
    expect(
      resolvePlannedMealLogTitles({
        slotName: "Breakfast",
        recipeTitle: "",
        fetchedTitle: null,
      }),
    ).toEqual({ name: "Breakfast", recipeTitle: "Untitled recipe" });
  });
});

describe("fetchCanonicalRecipeTitle", () => {
  it("returns normalized title from recipes row", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { title: "  MY SOUP  " },
      error: null,
    });
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle }),
        }),
      }),
    };
    await expect(
      fetchCanonicalRecipeTitle(supabase as never, "recipe-1"),
    ).resolves.toBe("My Soup");
  });

  it("returns null when recipe id is missing", async () => {
    const supabase = { from: vi.fn() };
    await expect(fetchCanonicalRecipeTitle(supabase as never, null)).resolves.toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
