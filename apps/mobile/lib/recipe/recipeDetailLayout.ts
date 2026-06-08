/**
 * Mobile re-export of the shared recipe-detail layout helpers.
 * Source of truth lives at `src/lib/recipe/recipeDetailLayout.ts` so
 * web and mobile can never drift on subtitle composition / time-stats
 * gating / fits-your-day verdict logic.
 */
export {
  shouldRenderTimeStats,
  composeSubtitleParts,
  computeFitsYourDayVerdict,
  fitsYourDayChipStyle,
  composeRecipeMetaParts,
  recipeDifficultyFromSteps,
} from "@suppr/shared/recipe/recipeDetailLayout";
export type {
  FitsYourDayTone,
  FitsYourDayVerdict,
  FitsYourDayChipStyle,
  RecipeMetaPartKey,
} from "@suppr/shared/recipe/recipeDetailLayout";
