import type { DayPlan, DayPlanMeal, RecipeCard } from "../../types/recipe.ts";

function scoreRecipe(
  recipe: RecipeCard,
  targets: { calories: number; protein: number },
  pickedIds: Set<string>,
): number {
  // Penalize repeats to encourage variety.
  const repeatPenalty = pickedIds.has(recipe.id) ? 50 : 0;

  // Prefer recipes with decent protein density and reasonable calories.
  const proteinPerCal = recipe.calories > 0 ? recipe.protein / recipe.calories : 0;
  const proteinScore = proteinPerCal * 1000;

  // Prefer closer to target calories/3 for each meal.
  const idealMealCalories = targets.calories / 3;
  const calDiff = Math.abs(recipe.calories - idealMealCalories);

  return proteinScore - calDiff / 5 - repeatPenalty;
}

function pickBest(
  recipes: RecipeCard[],
  targets: { calories: number; protein: number },
  pickedIds: Set<string>,
): RecipeCard | null {
  if (recipes.length === 0) return null;
  let best: RecipeCard | null = null;
  let bestScore = -Infinity;
  for (const r of recipes) {
    const s = scoreRecipe(r, targets, pickedIds);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  return best;
}

function buildMealsForDay(input: {
  savedRecipes: RecipeCard[];
  targets: { calories: number; protein: number };
  pickedIds: Set<string>;
}): DayPlanMeal[] {
  const { savedRecipes, targets, pickedIds } = input;
  const pool = savedRecipes.length ? savedRecipes : [];

  // If user has too few saved recipes, we'll reuse, but still choose best fits.
  const breakfast = pickBest(pool, targets, pickedIds);
  if (breakfast) pickedIds.add(breakfast.id);
  const lunch = pickBest(pool, targets, pickedIds);
  if (lunch) pickedIds.add(lunch.id);
  const dinner = pickBest(pool, targets, pickedIds);
  if (dinner) pickedIds.add(dinner.id);

  return [
    breakfast
      ? {
          name: "Breakfast",
          recipeTitle: breakfast.title,
          calories: breakfast.calories,
          protein: breakfast.protein,
          carbs: breakfast.carbs,
          fat: breakfast.fat,
        }
      : {
          name: "Breakfast",
          recipeTitle: "Add more recipes to your Library",
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        },
    lunch
      ? {
          name: "Lunch",
          recipeTitle: lunch.title,
          calories: lunch.calories,
          protein: lunch.protein,
          carbs: lunch.carbs,
          fat: lunch.fat,
        }
      : {
          name: "Lunch",
          recipeTitle: "Add more recipes to your Library",
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        },
    dinner
      ? {
          name: "Dinner",
          recipeTitle: dinner.title,
          calories: dinner.calories,
          protein: dinner.protein,
          carbs: dinner.carbs,
          fat: dinner.fat,
        }
      : {
          name: "Dinner",
          recipeTitle: "Add more recipes to your Library",
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        },
  ];
}

export function generatePlanFromLibrary(input: {
  savedRecipes: RecipeCard[];
  targets: { calories: number; protein: number };
  days: number;
}): DayPlan[] {
  const { savedRecipes, targets } = input;
  const daysCount = Math.max(1, Math.min(7, Math.floor(input.days)));

  // Track picks across the whole plan to encourage variety across days.
  const pickedIds = new Set<string>();

  const plans: DayPlan[] = [];
  for (let d = 1; d <= daysCount; d++) {
    const meals = buildMealsForDay({ savedRecipes, targets, pickedIds });
    const totals = meals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        carbs: acc.carbs + m.carbs,
        fat: acc.fat + m.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    plans.push({ day: d, meals, totals });
  }

  return plans;
}

