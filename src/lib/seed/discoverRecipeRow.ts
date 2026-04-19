/**
 * Pure helpers for the Discover-feed seed script
 * (scripts/seed-discover-recipes.ts). Kept under `src/lib` so they
 * are unit-testable and reusable by future seed sources without
 * duplicating logic in every script.
 */

import { classifyMealType } from "@/lib/recipe-import/classifyMealType";
import type { ParsedRecipeDraft } from "@/lib/recipe-import/parseRecipeFromHtml";

export const SOURCE_NAME_DOWNSHIFTOLOGY = "Downshiftology";

export type DiscoverSeedRecipeRow = {
  author_id: string;
  creator_id: string;
  title: string;
  description: string | null;
  instructions: string;
  image_url: string | null;
  servings: number;
  prep_time_min: number | null;
  cook_time_min: number | null;
  meal_type: string[] | null;
  published: true;
  is_verified: true;
  source_url: string;
  source_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
};

/**
 * Convert a parsed schema.org draft into a row payload for `recipes`.
 *
 * Returns `null` when per-serving calories are missing — by project
 * rule (CLAUDE.md "If nutrition / ingredient matching is uncertain,
 * do not guess") we refuse to seed a recipe with fabricated macros.
 * The script logs the URL as `skipped-no-nutrition` and continues.
 */
export function recipeRowFromDraft(args: {
  draft: ParsedRecipeDraft;
  url: string;
  authorId: string;
  creatorId: string;
  sourceName: string;
}): DiscoverSeedRecipeRow | null {
  const { draft, url, authorId, creatorId, sourceName } = args;
  const n = draft.siteNutrition;
  if (!n || n.calories == null) return null;

  return {
    author_id: authorId,
    creator_id: creatorId,
    title: draft.title,
    description: draft.description,
    instructions: draft.instructions.join("\n\n"),
    image_url: draft.imageUrl,
    servings: draft.servings ?? 1,
    prep_time_min: draft.prepTimeMin,
    cook_time_min: draft.cookTimeMin,
    meal_type: classifyMealType({
      title: draft.title,
      ingredients: draft.ingredients,
      caloriesPerServing: n.calories,
    }),
    published: true,
    is_verified: true,
    source_url: url,
    source_name: sourceName,
    calories: Math.round(n.calories),
    protein: Math.round(n.protein ?? 0),
    carbs: Math.round(n.carbs ?? 0),
    fat: Math.round(n.fat ?? 0),
    fiber_g: n.fiberG ?? 0,
    sugar_g: n.sugarG ?? 0,
    sodium_mg: n.sodiumMg ?? 0,
    // Intentionally omitting verified_source / verified_at /
    // verified_confidence: they're audit metadata, not user-facing,
    // and were only added by migration 20260408143000 which has
    // historically drifted on hosted projects. is_verified=true is
    // what drives the badge in the UI.
  };
}
