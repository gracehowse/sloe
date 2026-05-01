/**
 * Mobile re-export of the shared recipe-detail layout helpers.
 * Source of truth lives at `src/lib/recipe/recipeDetailLayout.ts` so
 * web and mobile can never drift on subtitle composition / time-stats
 * gating logic.
 */
export {
  shouldRenderTimeStats,
  composeSubtitleParts,
} from "../../../../src/lib/recipe/recipeDetailLayout";
