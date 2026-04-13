/**
 * Smart meal planning algorithm.
 * Configurable slots, macro-aware scoring, portion scaling, and day variety.
 */

export type SimpleRecipe = {
  id: string;
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealType?: string | string[] | null;
};

export type PlannerTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  calorieBandPct: number;
  carbFatBandPct: number;
};

export type PlannerSlotConfig = {
  /** Which meal slots to include, e.g. ["Breakfast", "Lunch", "Dinner"] */
  slots: string[];
};

export type PlanMeal = {
  name: string;
  recipeTitle: string;
  recipeId?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portionMultiplier?: number;
  isPlaceholder?: boolean;
};

export type DayPlan = {
  day: number;
  meals: PlanMeal[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
};

export const ALL_MEAL_SLOTS = ["Breakfast", "Lunch", "Snack", "Dinner"] as const;

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function recipeFitsSlot(recipe: SimpleRecipe, slot: string): boolean {
  const raw = recipe.mealType;
  const tags: string[] = Array.isArray(raw)
    ? raw.map((t) => t.toLowerCase().trim())
    : raw
      ? [raw.toLowerCase().trim()]
      : [];
  if (tags.length === 0) return true;
  return tags.includes(slot.toLowerCase());
}

type Macros = { calories: number; protein: number; carbs: number; fat: number };

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

  // Calorie scoring — tighter band
  const calDiff = sum.calories - targets.calories;
  const calBand = targets.calories * (targets.calorieBandPct / 100);
  if (Math.abs(calDiff) <= calBand) {
    e += Math.abs(calDiff) * 0.05;
  } else {
    e += Math.abs(calDiff) * 2;
  }

  // Protein scoring — highest priority
  const proDiff = sum.protein - targets.protein;
  if (Math.abs(proDiff) <= targets.protein * 0.15) {
    e += Math.abs(proDiff) * 0.1;
  } else {
    e += Math.abs(proDiff) * 4;
  }

  // Carbs
  const carbDiff = sum.carbs - targets.carbs;
  if (Math.abs(carbDiff) <= targets.carbs * 0.2) {
    e += Math.abs(carbDiff) * 0.05;
  } else {
    e += Math.abs(carbDiff) * 0.8;
  }

  // Fat
  const fatDiff = sum.fat - targets.fat;
  if (Math.abs(fatDiff) <= targets.fat * 0.2) {
    e += Math.abs(fatDiff) * 0.05;
  } else {
    e += Math.abs(fatDiff) * 0.8;
  }

  // Duplicate penalty — same recipe in multiple slots within a day
  const uniq = new Set(recipeIds);
  if (uniq.size < recipeIds.length) e += (recipeIds.length - uniq.size) * 80;

  // Recency penalty — strongly discourage recipes from previous days
  for (const id of recipeIds) {
    if (recentIds.has(id)) e += 40;
  }

  return e;
}

function findBestMealSet(
  pool: SimpleRecipe[],
  slots: string[],
  targets: PlannerTargets,
  recentIds: Set<string>,
  rand: () => number,
): { recipes: SimpleRecipe[]; multipliers: number[] } | null {
  if (pool.length === 0) return null;

  const perSlot = slots.map((slot) => {
    const fits = pool.filter((r) => recipeFitsSlot(r, slot));
    return fits.length > 0 ? fits : pool;
  });

  // Target calories per slot (rough split for scaling)
  const slotWeights: Record<string, number> = {
    breakfast: 0.25,
    lunch: 0.3,
    dinner: 0.35,
    snack: 0.1,
  };
  const totalWeight = slots.reduce((a, s) => a + (slotWeights[s.toLowerCase()] ?? 0.25), 0);
  const slotCalTargets = slots.map((s) => {
    const w = (slotWeights[s.toLowerCase()] ?? 0.25) / totalWeight;
    return targets.calories * w;
  });

  let best: { recipes: SimpleRecipe[]; multipliers: number[]; score: number } | null = null;

  const samples = Math.min(20_000, perSlot.reduce((a, p) => a * p.length, 1));

  for (let i = 0; i < samples; i++) {
    const picks = perSlot.map((p) => p[Math.floor(rand() * p.length)]!);
    const ids = picks.map((r) => r.id);

    // Compute portion multipliers to roughly hit slot calorie targets
    const multipliers = picks.map((r, j) => {
      if (r.calories <= 0) return 1;
      const ideal = slotCalTargets[j] / r.calories;
      // Clamp between 0.5x and 2x — don't suggest absurd portions
      return Math.max(0.5, Math.min(2, Math.round(ideal * 4) / 4));
    });

    const scaledMeals = picks.map((r, j) => scaleMacros(r, multipliers[j]));
    const s = scoreMealSet(scaledMeals, targets, ids, recentIds);

    if (!best || s < best.score) {
      best = { recipes: picks, multipliers, score: s };
    }
  }

  return best;
}

export function generateSmartPlan(input: {
  recipes: SimpleRecipe[];
  targets: PlannerTargets;
  days: number;
  slotConfig?: PlannerSlotConfig;
  /** Seed for reproducibility — defaults to Date.now() for fresh plans */
  seed?: number;
}): DayPlan[] {
  const { recipes, targets } = input;
  const daysCount = Math.min(7, Math.max(1, Math.floor(input.days)));
  const slots = input.slotConfig?.slots ?? ["Breakfast", "Lunch", "Snack", "Dinner"];
  const baseSeed = input.seed ?? Date.now();

  const recentIds = new Set<string>();
  const plans: DayPlan[] = [];

  for (let d = 1; d <= daysCount; d++) {
    // Clear recency every 3 days to allow repeats in longer plans
    if (d > 1 && (d - 1) % 3 === 0) recentIds.clear();

    // Unique seed per day
    const rand = mulberry32(baseSeed + d * 7919 + recipes.length * 31);

    const result = findBestMealSet(recipes, slots, targets, recentIds, rand);
    if (!result) {
      plans.push({
        day: d,
        meals: slots.map((name) => ({
          name,
          recipeTitle: "Save more recipes for better plans",
          calories: 0, protein: 0, carbs: 0, fat: 0,
          isPlaceholder: true,
        })),
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      });
      continue;
    }

    for (const r of result.recipes) recentIds.add(r.id);

    const meals: PlanMeal[] = slots.map((name, i) => {
      const r = result.recipes[i]!;
      const mult = result.multipliers[i];
      const scaled = scaleMacros(r, mult);
      return {
        name,
        recipeTitle: r.title,
        recipeId: r.id,
        ...scaled,
        portionMultiplier: mult !== 1 ? mult : undefined,
      };
    });

    const totals = meals.reduce(
      (a, m) => ({
        calories: a.calories + m.calories,
        protein: a.protein + m.protein,
        carbs: a.carbs + m.carbs,
        fat: a.fat + m.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

    plans.push({ day: d, meals, totals });
  }

  return plans;
}
