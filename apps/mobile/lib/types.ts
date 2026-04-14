/** Shared types for the mobile app — mirrors web src/types/recipe.ts */

export type UserTier = "free" | "base" | "pro";

export type LibraryEntryKind = "saved" | "created" | "imported";

export type PlannerMealSlot = "Breakfast" | "Lunch" | "Dinner" | "Snack";

export const PLANNER_MEAL_SLOT_LABELS: readonly PlannerMealSlot[] = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
] as const;

export interface RecipeCard {
  id: string;
  title: string;
  image: string;
  creatorName: string;
  creatorImage: string;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  isVerified: boolean;
  savedCount: number;
  isSaved: boolean;
  isPublished?: boolean;
  authorId?: string | null;
  creatorId?: string | null;
  creatorCalories?: number;
  feedCreatedAt?: string;
  sourceUrl?: string | null;
  mealSlots?: readonly PlannerMealSlot[] | string[];
  feedSource?: "catalog" | "community";
  /** Human-readable prep time (e.g. "15 min"). */
  prepTime?: string;
  /** Human-readable cook time (e.g. "30 min"). */
  cookTime?: string;
}

export interface IngredientRow {
  name: string;
  amount: string;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugarG?: number;
  sodiumMg?: number;
  isVerified: boolean;
  source: string;
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
  portionMultiplier?: number;
  fiberG?: number;
  waterMl?: number;
}

export interface DayPlanMeal {
  name: string;
  recipeTitle: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portionMultiplier?: number;
  isPlaceholder?: boolean;
  recipeId?: string;
}

export interface DayPlan {
  day: number;
  meals: DayPlanMeal[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
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

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  waterMl: number;
}
