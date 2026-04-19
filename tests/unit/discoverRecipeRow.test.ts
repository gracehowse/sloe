/**
 * Unit tests for the Discover-feed seed helper.
 *
 * Pinned invariants:
 *  - When the source page's JSON-LD has no per-serving calories, the
 *    helper returns null. The seed script must NEVER write a recipe
 *    with fabricated nutrition (CLAUDE.md project rule).
 *  - When nutrition is present, the row carries published=true,
 *    is_verified=true, the source URL + name, and author/creator ids
 *    so the discover query and follow button both work.
 */
import { describe, it, expect } from "vitest";
import {
  recipeRowFromDraft,
  SOURCE_NAME_DOWNSHIFTOLOGY,
} from "@/lib/seed/discoverRecipeRow";
import type { ParsedRecipeDraft } from "@/lib/recipe-import/parseRecipeFromHtml";

const baseDraft: ParsedRecipeDraft = {
  title: "Overnight Oats",
  description: "Five-minute prep, no cook.",
  ingredients: ["1/2 cup rolled oats", "1/2 cup milk", "1 tbsp chia seeds"],
  instructions: ["Combine all ingredients.", "Refrigerate overnight."],
  servings: 1,
  prepTimeMin: 5,
  cookTimeMin: null,
  imageUrl: "https://example.com/oats.jpg",
  sourceName: "Lisa Bryan",
  siteNutrition: {
    calories: 320,
    protein: 14,
    carbs: 42,
    fat: 9,
    fiberG: 7,
    sugarG: 8,
    saturatedFatG: 2,
    sodiumMg: 80,
  },
};

describe("recipeRowFromDraft", () => {
  it("returns null when JSON-LD has no nutrition block", () => {
    const row = recipeRowFromDraft({
      draft: { ...baseDraft, siteNutrition: null },
      url: "https://downshiftology.com/recipes/overnight-oats/",
      authorId: "author-uuid",
      creatorId: "creator-uuid",
      sourceName: SOURCE_NAME_DOWNSHIFTOLOGY,
    });
    expect(row).toBeNull();
  });

  it("returns null when the nutrition block is missing calories", () => {
    const row = recipeRowFromDraft({
      draft: {
        ...baseDraft,
        siteNutrition: { ...baseDraft.siteNutrition!, calories: null },
      },
      url: "https://downshiftology.com/recipes/overnight-oats/",
      authorId: "author-uuid",
      creatorId: "creator-uuid",
      sourceName: SOURCE_NAME_DOWNSHIFTOLOGY,
    });
    expect(row).toBeNull();
  });

  it("builds a published, verified row with full attribution when nutrition is present", () => {
    const row = recipeRowFromDraft({
      draft: baseDraft,
      url: "https://downshiftology.com/recipes/overnight-oats/",
      authorId: "author-uuid",
      creatorId: "creator-uuid",
      sourceName: SOURCE_NAME_DOWNSHIFTOLOGY,
    });
    expect(row).not.toBeNull();
    expect(row).toMatchObject({
      author_id: "author-uuid",
      creator_id: "creator-uuid",
      title: "Overnight Oats",
      published: true,
      is_verified: true,
      source_url: "https://downshiftology.com/recipes/overnight-oats/",
      source_name: SOURCE_NAME_DOWNSHIFTOLOGY,
      calories: 320,
      protein: 14,
      carbs: 42,
      fat: 9,
      fiber_g: 7,
      sugar_g: 8,
      sodium_mg: 80,
      servings: 1,
      prep_time_min: 5,
    });
    // Audit metadata columns intentionally omitted (see comment in
    // discoverRecipeRow.ts) so the insert works on hosted projects
    // where migration 20260408143000 hasn't been applied yet.
    expect(row).not.toHaveProperty("verified_at");
    expect(row).not.toHaveProperty("verified_source");
    expect(row).not.toHaveProperty("verified_confidence");
    // instructions are joined with double newline so the recipe
    // detail screen renders them as separated paragraphs.
    expect(row?.instructions).toContain("Refrigerate overnight.");
    expect(row?.instructions).toMatch(/\n\n/);
  });

  it("rounds macros so we never write fractional integers into integer columns", () => {
    const row = recipeRowFromDraft({
      draft: {
        ...baseDraft,
        siteNutrition: {
          calories: 320.6,
          protein: 14.4,
          carbs: 42.5,
          fat: 9.49,
          fiberG: 7,
          sugarG: 8,
          saturatedFatG: 2,
          sodiumMg: 80,
        },
      },
      url: "https://downshiftology.com/recipes/overnight-oats/",
      authorId: "a",
      creatorId: "c",
      sourceName: SOURCE_NAME_DOWNSHIFTOLOGY,
    });
    expect(row?.calories).toBe(321);
    expect(row?.protein).toBe(14);
    expect(row?.carbs).toBe(43);
    expect(row?.fat).toBe(9);
  });
});
