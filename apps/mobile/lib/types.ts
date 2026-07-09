/** Shared types for the mobile app — mirrors web src/types/recipe.ts */

export type UserTier = "free" | "base" | "pro";

export type LibraryEntryKind = "saved" | "created" | "imported";

export type PlannerMealSlot = "Breakfast" | "Lunch" | "Dinner" | "Snacks";

export const PLANNER_MEAL_SLOT_LABELS: readonly PlannerMealSlot[] = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snacks",
] as const;

export interface RecipeCard {
  id: string;
  title: string;
  /**
   * Hero image URL, or `null` when the recipe has no real image
   * (ENG-1287 — never substitute a stock photo; card surfaces render
   * the deterministic `RecipeHeroFallback` instead).
   */
  image: string | null;
  imageSource?: string | null;
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
  /** Explicit two-plane origin for private imports vs owned/claimed public recipes. */
  contentOrigin?: "first_party" | "imported_stub" | "claimed";
  /** Plan import / URL attribution label (e.g. Imported · Week 1). */
  sourceName?: string | null;
  mealSlots?: readonly PlannerMealSlot[] | string[];
  feedSource?: "catalog" | "community";
  /** Human-readable prep time (e.g. "15 min"). */
  prepTime?: string;
  /** Human-readable cook time (e.g. "30 min"). */
  cookTime?: string;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  /** Source platform label for discover feed (e.g. "TikTok"). */
  source?: string;
  /** Number of saves. */
  saves?: number;
  /** Number of times made. */
  made?: number;
  /**
   * Optional regulated-allergen slugs inferred at import / verify
   * time. Same canonical list as web (`src/constants/regulatedAllergens.ts`).
   * Used by the Library Vegetarian filter as a fish/shellfish signal.
   */
  allergens?: readonly string[];
  /**
   * GW-02 (2026-04-28) — dietary preset tags from `recipes.dietary_flags`
   * (jsonb). Values include `"vegan" | "vegetarian" | "gluten-free" |
   * "dairy-free" | "high-protein" | "keto" | "paleo" | "low-fodmap"`.
   * Mirrors web `RecipeCard.dietaryFlags`.
   */
  dietaryFlags?: readonly string[];
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
  /** ENG-956 — per-meal lock ("keep this meal"); mirrors web `DayPlanMeal`. */
  isLocked?: boolean;
  /**
   * ENG-1417 — verified nutrition lookup vs unverified estimate
   * (`RecipeCard.isVerified`). Absent/undefined → the render layer treats
   * it as unverified (safe default). Mirrors web `DayPlanMeal.isVerified`.
   */
  isVerified?: boolean;
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
