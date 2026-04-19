import { dayPlanTotalsFromMeals } from "../nutrition/portionMultiplier.ts";
import {
  PORTION_MULTIPLIER_CLAMP,
  clampPlannerMultiplier,
  fitDayToTargets,
} from "../nutrition/mealPlanAlgo.ts";
import type {
  DayPlan,
  DayPlanMeal,
  PlannerMealSlot,
  RecipeCard,
} from "../../types/recipe.ts";
import { PLANNER_MEAL_SLOT_LABELS } from "../../types/recipe.ts";

// F-15 re-export so the planner UI can pull the single shared clamp from
// either of the two entry modules (web callers already import from here).
export { PORTION_MULTIPLIER_CLAMP } from "../nutrition/mealPlanAlgo.ts";

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
export const PLAN_MEAL_SLOTS = PLANNER_MEAL_SLOT_LABELS;

export type { PlannerMealSlot };

/** Map creator `meal_type` (recipe upload) to planner slots. Handles both single string and array. */
export function mealPlannerSlotsFromMealType(raw: string | string[] | null | undefined): PlannerMealSlot[] | undefined {
  const tags: string[] = Array.isArray(raw)
    ? raw.map((t) => t.toLowerCase().trim()).filter(Boolean)
    : raw
      ? [raw.toLowerCase().trim()]
      : [];
  if (tags.length === 0) return undefined;
  const slotMap: Record<string, PlannerMealSlot> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snacks",
  };
  const slots = new Set<PlannerMealSlot>();
  for (const t of tags) {
    const slot = slotMap[t];
    if (slot) slots.add(slot);
  }
  return slots.size > 0 ? Array.from(slots) : undefined;
}

/** Recipe fits a planner slot when tagged, or when untagged (legacy). */
export function recipeFitsMealSlot(recipe: RecipeCard, slot: PlannerMealSlot): boolean {
  const slots = recipe.mealSlots;
  if (!slots || slots.length === 0) return true;
  return slots.includes(slot);
}

// ---------------------------------------------------------------------------
// Unified smart meal planning algorithm.
// Shared by both web and mobile. Features:
// - Configurable slots (can exclude any meal slot)
// - Slot-weighted calorie targets (breakfast 25%, lunch 30%, dinner 35%, snack 10%)
// - Portion scaling 0.5x–2x to hit per-slot calorie targets
// - Strong recency penalty for day variety
// - Per-day unique seed for reproducible randomness
// ---------------------------------------------------------------------------

type Macros = { calories: number; protein: number; carbs: number; fat: number };

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

function scaleMacros(r: Macros, mult: number): Macros {
  return {
    calories: Math.round(r.calories * mult),
    protein: Math.round(r.protein * mult * 10) / 10,
    carbs: Math.round(r.carbs * mult * 10) / 10,
    fat: Math.round(r.fat * mult * 10) / 10,
  };
}

function scoreMealSet(
  meals: Macros[],
  targets: PlannerTargets,
  recipeIds: string[],
  recentIds: Set<string>,
): number {
  const sum = meals.reduce(
    (a, m) => ({ calories: a.calories + m.calories, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  let e = 0;

  // Calorie scoring
  const calDiff = sum.calories - targets.calories;
  const calBand = targets.calories * (targets.calorieBandPct / 100);
  if (Math.abs(calDiff) <= calBand) {
    e += Math.abs(calDiff) * 0.05;
  } else {
    e += Math.abs(calDiff) * 2;
  }

  // Protein — highest priority
  const proDiff = sum.protein - targets.protein;
  if (Math.abs(proDiff) <= targets.protein * 0.15) {
    e += Math.abs(proDiff) * 0.1;
  } else {
    e += Math.abs(proDiff) * 4;
  }

  // Carbs + fat
  for (const [diff, target] of [[sum.carbs - targets.carbs, targets.carbs], [sum.fat - targets.fat, targets.fat]] as const) {
    if (Math.abs(diff) <= target * 0.2) {
      e += Math.abs(diff) * 0.05;
    } else {
      e += Math.abs(diff) * 0.8;
    }
  }

  // Duplicate penalty
  const uniq = new Set(recipeIds);
  if (uniq.size < recipeIds.length) e += (recipeIds.length - uniq.size) * 80;

  // Recency penalty — strongly discourage recipes from previous days
  for (const id of recipeIds) {
    if (recentIds.has(id)) e += 40;
  }

  return e;
}

/** Calorie fraction per slot type (sums to 1 when all 4 slots are used). */
const SLOT_WEIGHTS: Record<string, number> = {
  breakfast: 0.25,
  lunch: 0.30,
  dinner: 0.35,
  snack: 0.10,
  snacks: 0.10,
};

function slotCalorieTargets(slots: string[], targets: PlannerTargets): number[] {
  const totalWeight = slots.reduce((a, s) => a + (SLOT_WEIGHTS[s.toLowerCase()] ?? 0.25), 0);
  return slots.map((s) => {
    const w = (SLOT_WEIGHTS[s.toLowerCase()] ?? 0.25) / totalWeight;
    return targets.calories * w;
  });
}

/** Only recipes tagged for the slot (or untagged). Never fills a slot from unrelated recipes. */
function findBestSmartMealSet(
  pool: RecipeCard[],
  slots: string[],
  targets: PlannerTargets,
  recentIds: Set<string>,
  rand: () => number,
): { recipes: RecipeCard[]; multipliers: number[]; residualProteinGap: number } | null {
  if (pool.length === 0) return null;

  const perSlot = slots.map((slot) =>
    pool.filter((r) => recipeFitsMealSlot(r, slot as PlannerMealSlot)),
  );
  if (perSlot.some((p) => p.length === 0)) return null;

  const slotCalTargets = slotCalorieTargets(slots, targets);

  let best:
    | { recipes: RecipeCard[]; multipliers: number[]; score: number; residualProteinGap: number }
    | null = null;
  const samples = Math.min(20_000, perSlot.reduce((a, p) => a * p.length, 1));

  for (let i = 0; i < samples; i++) {
    const picks = perSlot.map((p) => p[Math.floor(rand() * p.length)]!);
    const ids = picks.map((r) => r.id);

    // F-15 — initial multipliers hit per-slot calorie share (seed), then
    // `fitDayToTargets` pushes toward joint protein / calorie / carb+fat
    // bands within the shared `PORTION_MULTIPLIER_CLAMP` (0.2..2.5, 0.1).
    const initial = picks.map((r, j) => {
      if (r.calories <= 0) return 1;
      return clampPlannerMultiplier(slotCalTargets[j] / r.calories);
    });
    const fit = fitDayToTargets({ recipes: picks, multipliers: initial, targets });
    const multipliers = fit.multipliers;

    const scaledMeals = picks.map((r, j) => scaleMacros(r, multipliers[j]));
    const s = scoreMealSet(scaledMeals, targets, ids, recentIds);

    if (!best || s < best.score) {
      best = {
        recipes: picks,
        multipliers,
        score: s,
        residualProteinGap: fit.residualProteinGap,
      };
    }
  }

  return best;
}

/** One pick per slot that has ≥1 matching recipe; skips slots with no matches (partial day). */
function buildIndependentSlotDay(
  pool: RecipeCard[],
  slots: string[],
  targets: PlannerTargets,
  rand: () => number,
): { meals: DayPlanMeal[]; pickedIds: string[]; residualProteinGap: number } {
  const slotCalTargets = slotCalorieTargets(slots, targets);
  const picks: { pick: RecipeCard; name: string; slotIndex: number }[] = [];
  const pickedIds: string[] = [];
  for (let j = 0; j < slots.length; j++) {
    const name = slots[j]!;
    const fits = pool.filter((r) => recipeFitsMealSlot(r, name as PlannerMealSlot));
    if (fits.length === 0) continue;
    const pick = fits[Math.floor(rand() * fits.length)]!;
    pickedIds.push(pick.id);
    picks.push({ pick, name, slotIndex: j });
  }
  if (picks.length === 0) {
    return { meals: [], pickedIds, residualProteinGap: 0 };
  }
  const initial = picks.map(({ pick, slotIndex }) => {
    if (pick.calories <= 0) return 1;
    return clampPlannerMultiplier(slotCalTargets[slotIndex]! / pick.calories);
  });
  const fit = fitDayToTargets({
    recipes: picks.map((p) => p.pick),
    multipliers: initial,
    targets,
  });
  const meals: DayPlanMeal[] = picks.map(({ pick, name }, j) => {
    const mult = fit.multipliers[j]!;
    const scaled = scaleMacros(pick, mult);
    return {
      name,
      recipeTitle: pick.title,
      calories: scaled.calories,
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
      portionMultiplier: mult !== 1 ? mult : undefined,
    };
  });
  return { meals, pickedIds, residualProteinGap: fit.residualProteinGap };
}

/**
 * Generate a macro-aware meal plan from saved recipes.
 * Uses slot-weighted calorie targets and portion scaling (0.5x–2x).
 * Shared by web and mobile.
 */
export function generatePlanFromLibrary(input: {
  savedRecipes: RecipeCard[];
  targets: PlannerTargets;
  days: number;
  /** Which slots to include — defaults to all 4. */
  slots?: string[];
  /** RNG seed — defaults to Date.now(). */
  seed?: number;
}): DayPlan[] {
  const { savedRecipes, targets } = input;
  const daysCount = clamp(Math.floor(input.days), 1, 7);
  const slots = input.slots ?? PLAN_MEAL_SLOTS.slice();
  const baseSeed = input.seed ?? Date.now();

  const recentIds = new Set<string>();
  const plans: DayPlan[] = [];

  for (let d = 1; d <= daysCount; d++) {
    if (d > 1 && (d - 1) % 3 === 0) recentIds.clear();

    const rand = mulberry32(baseSeed + d * 7919 + savedRecipes.length * 31);
    const joint = findBestSmartMealSet(savedRecipes, slots, targets, recentIds, rand);
    let meals: DayPlanMeal[];
    let residualProteinGap = 0;
    if (joint) {
      for (const r of joint.recipes) recentIds.add(r.id);
      meals = slots.map((name, i) => {
        const r = joint.recipes[i]!;
        const mult = joint.multipliers[i]!;
        const scaled = scaleMacros(r, mult);
        return {
          name,
          recipeTitle: r.title,
          ...scaled,
          portionMultiplier: mult !== 1 ? mult : undefined,
        };
      });
      residualProteinGap = joint.residualProteinGap;
    } else {
      const { meals: indMeals, pickedIds, residualProteinGap: indGap } =
        buildIndependentSlotDay(savedRecipes, slots, targets, rand);
      meals = indMeals;
      residualProteinGap = indGap;
      for (const id of pickedIds) recentIds.add(id);
    }

    const totals = dayPlanTotalsFromMeals(meals);
    plans.push({
      day: d,
      meals,
      totals,
      ...(residualProteinGap < 0 ? { residualProteinGap } : {}),
    });
  }

  return plans;
}
