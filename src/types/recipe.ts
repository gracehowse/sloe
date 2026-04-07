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
  isVerified: boolean;
  creatorCalories?: number;
  savedCount: number;
  isSaved: boolean;
}

export interface IngredientRow {
  name: string;
  amount: string;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  isVerified: boolean;
  source: "Open Food Facts" | "Nutritionix" | "USDA";
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
}

export interface DayPlanMeal {
  name: string;
  recipeTitle: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
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
