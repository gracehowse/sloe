import type { DayPlan, DayPlanMeal, RecipeCard } from "../../types/recipe.ts";

/** Daily macro targets + optional tolerance bands for the optimizer. */
export interface PlannerTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** ±% around calorie goal (e.g. 12 → 88%–112% of calories). */
  calorieBandPct: number;
  /** ±% around carb and fat day targets. */
  carbFatBandPct: number;
}

export const DEFAULT_PLANNER_BANDS = {
  calorieBandPct: 12,
  carbFatBandPct: 18,
} as const;

/** Meal slot labels (order matters for display). */
export const PLAN_MEAL_SLOTS = ["Breakfast", "Lunch", "Snack", "Dinner"] as const;

const MEALS_PER_DAY = PLAN_MEAL_SLOTS.length;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Lower score = better fit to daily targets (calories, protein, carbs, fat within bands).
 */
function scoreMealSet(
  recipes: RecipeCard[],
  targets: PlannerTargets,
  recentRecipeIds: Set<string>,
): number {
  const sumCal = recipes.reduce((a, r) => a + r.calories, 0);
  const sumPro = recipes.reduce((a, r) => a + r.protein, 0);
  const sumCarbs = recipes.reduce((a, r) => a + r.carbs, 0);
  const sumFat = recipes.reduce((a, r) => a + r.fat, 0);

  const calBand = targets.calorieBandPct / 100;
  const calLo = targets.calories * (1 - calBand);
  const calHi = targets.calories * (1 + calBand);
  let e = 0;
  if (sumCal < calLo) {
    e += (calLo - sumCal) * 1.85;
  } else if (sumCal > calHi) {
    e += (sumCal - calHi) * 1.25;
  } else {
    e += Math.abs(sumCal - targets.calories) * 0.04;
  }

  const proMin = targets.protein * 0.88;
  const proMax = targets.protein * 1.22;
  if (sumPro < proMin) {
    e += (proMin - sumPro) * 4.2;
  } else if (sumPro > proMax) {
    e += (sumPro - proMax) * 0.75;
  } else {
    e += Math.abs(sumPro - targets.protein) * 0.12;
  }

  const mBand = targets.carbFatBandPct / 100;
  const cBase = Math.max(1, targets.carbs);
  const fBase = Math.max(1, targets.fat);
  const cLo = cBase * (1 - mBand);
  const cHi = cBase * (1 + mBand);
  const fLo = fBase * (1 - mBand);
  const fHi = fBase * (1 + mBand);
  if (sumCarbs < cLo) e += (cLo - sumCarbs) * 0.55;
  else if (sumCarbs > cHi) e += (sumCarbs - cHi) * 0.45;
  else e += Math.abs(sumCarbs - cBase) * 0.06;

  if (sumFat < fLo) e += (fLo - sumFat) * 0.55;
  else if (sumFat > fHi) e += (sumFat - fHi) * 0.45;
  else e += Math.abs(sumFat - fBase) * 0.06;

  const ids = recipes.map((r) => r.id);
  const uniq = new Set(ids);
  if (uniq.size < recipes.length) {
    e += (recipes.length + 1 - uniq.size) * 7;
  }

  for (const id of ids) {
    if (recentRecipeIds.has(id)) {
      e += 5.5;
    }
  }

  return e;
}

function findBestMealSet(
  pool: RecipeCard[],
  targets: PlannerTargets,
  recentRecipeIds: Set<string>,
): RecipeCard[] | null {
  if (pool.length === 0) return null;

  const n = pool.length;
  const totalCombos = n ** MEALS_PER_DAY;
  const maxFull = 24_000;
  let best: RecipeCard[] | null = null;
  let bestScore = Infinity;

  const scoreAndUpdate = (recipes: RecipeCard[]) => {
    const s = scoreMealSet(recipes, targets, recentRecipeIds);
    if (s < bestScore) {
      bestScore = s;
      best = recipes;
    }
  };

  if (totalCombos <= maxFull) {
    for (const m0 of pool) {
      for (const m1 of pool) {
        for (const m2 of pool) {
          for (const m3 of pool) {
            scoreAndUpdate([m0, m1, m2, m3]);
          }
        }
      }
    }
  } else {
    const rand = mulberry32(0xfeed + n * 997 + Math.floor(targets.calories));
    const samples = Math.min(12_000, totalCombos);
    for (let i = 0; i < samples; i++) {
      const recipes: RecipeCard[] = [];
      for (let k = 0; k < MEALS_PER_DAY; k++) {
        recipes.push(pool[Math.floor(rand() * n)]!);
      }
      scoreAndUpdate(recipes);
    }
  }

  return best;
}

function mealFromRecipe(name: string, recipe: RecipeCard): DayPlanMeal {
  return {
    name,
    recipeTitle: recipe.title,
    calories: recipe.calories,
    protein: recipe.protein,
    carbs: recipe.carbs,
    fat: recipe.fat,
  };
}

function placeholderMeal(name: string): DayPlanMeal {
  return {
    name,
    recipeTitle: "Save recipes to build a macro-aware plan",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    isPlaceholder: true,
  };
}

function buildMealsForDay(input: {
  savedRecipes: RecipeCard[];
  targets: PlannerTargets;
  recentRecipeIds: Set<string>;
}): DayPlanMeal[] {
  const { savedRecipes, targets, recentRecipeIds } = input;
  const pool = savedRecipes.length ? savedRecipes : [];

  if (pool.length === 0) {
    return PLAN_MEAL_SLOTS.map((name) => placeholderMeal(name));
  }

  const picked = findBestMealSet(pool, targets, recentRecipeIds);
  if (!picked || picked.length !== MEALS_PER_DAY) {
    return PLAN_MEAL_SLOTS.map((name) => placeholderMeal(name));
  }

  for (const r of picked) {
    recentRecipeIds.add(r.id);
  }

  return PLAN_MEAL_SLOTS.map((name, i) => mealFromRecipe(name, picked[i]!));
}

export function generatePlanFromLibrary(input: {
  savedRecipes: RecipeCard[];
  targets: PlannerTargets;
  days: number;
}): DayPlan[] {
  const { savedRecipes, targets } = input;
  const daysCount = clamp(Math.floor(input.days), 1, 7);

  const recentRecipeIds = new Set<string>();

  const plans: DayPlan[] = [];
  for (let d = 1; d <= daysCount; d++) {
    if (d > 1 && (d - 1) % 3 === 0) {
      recentRecipeIds.clear();
    }
    const meals = buildMealsForDay({ savedRecipes, targets, recentRecipeIds });
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
