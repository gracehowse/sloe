export type UserTier = "free" | "base" | "pro";

export interface RecipeCard {
  id: string;
  creatorName: string;
  creatorImage: string;
  title: string;
  image: string;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  isVerified: boolean;
  creatorCalories?: number;
  savedCount: number;
  isSaved: boolean;
  /** ISO timestamp for feed ordering (uploaded recipes). Catalog demos omit this. */
  feedCreatedAt?: string;
  /** `community` = published from Supabase; `catalog` = curated Platemate picks (not a live creator post). */
  feedSource?: "community" | "catalog";
  /** Recipe author (profiles.id) when loaded from Supabase — used for follows / Following feed. */
  authorId?: string | null;
  /** Optional legacy `creators` row linked from recipes.creator_id. */
  creatorId?: string | null;
}

export interface IngredientRow {
  name: string;
  amount: string;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  isVerified: boolean;
  source: "FatSecret" | "Open Food Facts" | "Nutritionix" | "USDA" | "Manual" | "Estimated";
}

export interface ShoppingItem {
  id: string;
  name: string;
  amount: string;
  unit: string;
  category: string;
  checked: boolean;
  from: string;
}

export interface LoggedMeal {
  id: string;
  name: string;
  recipeTitle: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /**
   * How many “plates” / people this log represents (1 = solo, 2 = shared dinner, etc.).
   * Macros on the row are already scaled; this is for display and analytics.
   */
  portionMultiplier?: number;
  /** Optional fiber logged with this entry (grams). */
  fiberG?: number;
  /** Optional water logged with this entry (ml). */
  waterMl?: number;
}

export interface DayPlanMeal {
  name: string;
  recipeTitle: string;
  /** Base recipe macros for one portion (multiplier 1). */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /**
   * Scale for this slot (1 = one serving as above, 2 = double / partner, etc.).
   * Day totals and shopping list use base macros × this value.
   */
  portionMultiplier?: number;
  /** True when no saved recipes exist for this slot (should not appear after macro-aware generation). */
  isPlaceholder?: boolean;
}

export interface DayPlan {
  day: number;
  meals: DayPlanMeal[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}
