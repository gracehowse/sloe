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
  };
};

export type PlanImportNutritionMode = "author" | "match";

export const PLAN_IMPORT_SOURCE_PREFIX = "Imported · ";
