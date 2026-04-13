export type UserTier = "free" | "base" | "pro";

/** How a recipe ended up in your library (local + synced metadata). */
export type LibraryEntryKind = "saved" | "created" | "imported";

/** Planner meal slots (order matches UI: breakfast → lunch → snack → dinner). */
export const PLANNER_MEAL_SLOT_LABELS = ["Breakfast", "Lunch", "Snack", "Dinner"] as const;
export type PlannerMealSlot = (typeof PLANNER_MEAL_SLOT_LABELS)[number];

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
  /** Whether this recipe is publicly visible. Undefined for catalog / legacy objects. */
  isPublished?: boolean;
  /** ISO timestamp for feed ordering (uploaded recipes). Catalog demos omit this. */
  feedCreatedAt?: string;
  /** `community` = published by a creator; `catalog` = curated picks (not a live creator post). */
  feedSource?: "community" | "catalog";
  /** Recipe author id when loaded from the community feed — used for follows / Following feed. */
  authorId?: string | null;
  /** Optional legacy `creators` row linked from recipes.creator_id. */
  creatorId?: string | null;
  /**
   * Which planner slots this recipe is intended for. Used when generating plans and Swap.
   * Omit for legacy data — treated as fitting any slot.
   */
  mealSlots?: readonly PlannerMealSlot[];
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
  source: string;
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
  /** Optional provenance for confidence badges (USDA, Open Food Facts, AI photo, etc.). */
  source?: string | null;
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
