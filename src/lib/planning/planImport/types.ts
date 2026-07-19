/** Plan Import — shared types (paste / PDF / vision adaptors). */

export type PlanImportConfidence = "high" | "medium" | "low";

export type PlanImportAuthorNutrition = {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiberG?: number | null;
};

export type PlanImportParsedRecipe = {
  /** Stable slug from LLM — used to link schedule slots. */
  key: string;
  title: string;
  serves: number;
  ingredients: string[];
  method?: string | null;
  authorNutrition?: PlanImportAuthorNutrition | null;
};

export type PlanImportScheduleSlot = {
  slot: string;
  label: string;
  /** Recipe keys referenced by this slot (bowls may list several). */
  recipeKeys: string[];
  portionMultiplier?: number;
  claimedKcal?: number | null;
};

export type PlanImportScheduleDay = {
  dayLabel: string;
  dayIndex: number;
  slots: PlanImportScheduleSlot[];
};

/** Raw LLM output after JSON parse + light normalisation. */
export type PlanImportLlmPayload = {
  planName: string | null;
  recipes: PlanImportParsedRecipe[];
  schedule: PlanImportScheduleDay[];
};

export type PlanImportVerifiedRecipe = PlanImportParsedRecipe & {
  supprNutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiberG: number;
  };
  confidence: PlanImportConfidence;
  confidenceTier: PlanImportConfidence;
  ingredientCount: number;
  /**
   * ENG-1422 — count of ingredient lines dropped from `supprNutrition` because
   * their match fell below the accept floor (`VerifyResult.belowAcceptFloorCount`).
   * `confidenceTier` is already capped for this via
   * `recipeConfidenceTierWithExclusions`; the raw count is carried so the review
   * surfaces can tell the user how incomplete the totals are. Absent on paths
   * that never ran verification (0 in practice).
   */
  excludedLineCount?: number;
  ingredientMacros?: Array<{
    name: string;
    amount?: string;
    unit?: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiberG?: number;
    source?: string;
    confidence?: number;
    /**
     * ENG-1276 — matched food id (`VerifiedIngredient.fatSecretFoodId`).
     * Persisted to `recipe_ingredients.fatsecret_food_id` and folded into
     * `matched_alias_key` when the match is trusted (confidence ≥ 0.85).
     */
    fatsecretFoodId?: string | null;
  }>;
};

export type PlanImportLinkStatus = "linked" | "kcal_only" | "blocked";

export type PlanImportCompiledSlot = {
  dayIndex: number;
  dayLabel: string;
  slot: string;
  title: string;
  recipeKeys: string[];
  linkStatus: PlanImportLinkStatus;
  portionMultiplier: number;
  supprNutrition: PlanImportAuthorNutrition;
  authorNutrition: PlanImportAuthorNutrition | null;
  claimedKcal: number | null;
  confidence: PlanImportConfidence;
};

export type PlanImportParseResult = {
  planName: string;
  recipes: PlanImportVerifiedRecipe[];
  slots: PlanImportCompiledSlot[];
  stats: {
    recipeCount: number;
    slotCount: number;
    linkedCount: number;
    blockedCount: number;
    avgKcalPerDay: number;
    /**
     * ENG-1422 — total ingredient lines across the imported recipes that fell
     * below the accept floor and were left out of the Sloe-calc totals. Surfaced
     * on the review screen ("N low-confidence lines left out") so the user knows
     * the headline numbers are incomplete before importing.
     */
    excludedLineCount: number;
  };
};

export type PlanImportNutritionMode = "author" | "match";

export const PLAN_IMPORT_SOURCE_PREFIX = "Imported · ";
