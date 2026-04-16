/**
 * Smart meal planning algorithm.
 * Configurable slots, macro-aware scoring, portion scaling, and day variety.
 *
 * SYNC NOTE: The web uses an identical algorithm in src/lib/planning/generateMealPlan.ts.
 * Changes to scoring, weights, or multiplier logic must be applied to both files.
 * The two files use different recipe types (SimpleRecipe vs RecipeCard) but
 * identical algorithmic logic.
 */

export type SimpleRecipe = {
  id: string;
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  /** Slot tags from DB/UI; readonly tuples (e.g. mobile `PlannerMealSlot[]`) are accepted. */
  mealType?: string | readonly string[] | string[] | null;
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
  fiberG?: number;
  portionMultiplier?: number;
  isPlaceholder?: boolean;
};

export type DayPlan = {
  day: number;
  meals: PlanMeal[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
};

export const ALL_MEAL_SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

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
    ? raw.map((t) => String(t).toLowerCase().trim())
    : typeof raw === "string"
      ? [raw.toLowerCase().trim()]
      : [];
  // Untagged recipes fit any slot
  if (tags.length === 0) return true;
  const s = slot.toLowerCase();
  const slotTag = s === "snacks" ? "snack" : s;
  // Tagged recipes only fit their assigned slots
  return tags.includes(slotTag);
}

type Macros = { calories: number; protein: number; carbs: number; fat: number; fiberG?: number };

function scaleMacros(r: Macros, mult: number): Macros {
  return {
    calories: Math.round(r.calories * mult),
    protein: Math.round(r.protein * mult),
    carbs: Math.round(r.carbs * mult),
    fat: Math.round(r.fat * mult),
    fiberG: r.fiberG != null ? Math.round(r.fiberG * mult * 10) / 10 : undefined,
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

  // Calorie scoring — tighter band, overshooting penalised more than undershooting
  const calDiff = sum.calories - targets.calories;
  const calBand = targets.calories * (targets.calorieBandPct / 100);
  if (Math.abs(calDiff) <= calBand) {
    e += Math.abs(calDiff) * 0.05;
  } else if (calDiff > 0) {
    // Over target — penalise harder (user is likely cutting)
    e += calDiff * 3;
  } else {
    e += Math.abs(calDiff) * 1.5;
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

  // Hard reject — never the same recipe twice in one day
  const uniq = new Set(recipeIds);
  if (uniq.size < recipeIds.length) return Infinity;

  // Recency penalty — strongly discourage recipes from previous days
  for (const id of recipeIds) {
    if (recentIds.has(id)) e += 100;
  }

  return e;
}

const SLOT_WEIGHTS: Record<string, number> = {
  breakfast: 0.25,
  lunch: 0.3,
  dinner: 0.35,
  snack: 0.1,
  snacks: 0.1,
};

function slotCalorieTargets(slots: string[], targets: PlannerTargets): number[] {
  const totalWeight = slots.reduce((a, s) => a + (SLOT_WEIGHTS[s.toLowerCase()] ?? 0.25), 0);
  return slots.map((s) => {
    const w = (SLOT_WEIGHTS[s.toLowerCase()] ?? 0.25) / totalWeight;
    return targets.calories * w;
  });
}

function findBestMealSet(
  pool: SimpleRecipe[],
  slots: string[],
  targets: PlannerTargets,
  recentIds: Set<string>,
  rand: () => number,
): { recipes: SimpleRecipe[]; multipliers: number[] } | null {
  if (pool.length === 0) return null;

  const perSlot = slots.map((slot) => pool.filter((r) => recipeFitsSlot(r, slot)));
  if (perSlot.some((p) => p.length === 0)) return null;

  const slotCalTargets = slotCalorieTargets(slots, targets);

  let best: { recipes: SimpleRecipe[]; multipliers: number[]; score: number } | null = null;

  const samples = Math.min(20_000, perSlot.reduce((a, p) => a * p.length, 1));

  // Pre-sort each slot's pool by closeness to slot target (best-fit first)
  const sortedPerSlot = perSlot.map((pool, j) =>
    [...pool].sort((a, b) => Math.abs(a.calories - slotCalTargets[j]) - Math.abs(b.calories - slotCalTargets[j])),
  );

  for (let i = 0; i < samples; i++) {
    // Bias toward better-fitting recipes: 60% chance of picking from top half
    const picks = sortedPerSlot.map((p) => {
      const useTop = rand() < 0.6;
      const half = Math.max(1, Math.floor(p.length / 2));
      const pool = useTop ? p.slice(0, half) : p;
      return pool[Math.floor(rand() * pool.length)]!;
    });
    const ids = picks.map((r) => r.id);

    // Compute portion multipliers to hit slot calorie targets
    // Use 0.1x steps for precision at low calorie targets
    const multipliers = picks.map((r, j) => {
      if (r.calories <= 0) return 1;
      const ideal = slotCalTargets[j] / r.calories;
      return Math.max(0.2, Math.min(2.5, Math.round(ideal * 10) / 10));
    });

    const scaledMeals = picks.map((r, j) => scaleMacros(r, multipliers[j]));
    const s = scoreMealSet(scaledMeals, targets, ids, recentIds);

    if (!best || s < best.score) {
      best = { recipes: picks, multipliers, score: s };
    }
  }

  return best;
}

function buildIndependentSlotDay(
  pool: SimpleRecipe[],
  slots: string[],
  targets: PlannerTargets,
  rand: () => number,
): { meals: PlanMeal[]; pickedIds: string[] } {
  const slotCalTargets = slotCalorieTargets(slots, targets);
  const meals: PlanMeal[] = [];
  const pickedIds: string[] = [];
  for (let j = 0; j < slots.length; j++) {
    const name = slots[j]!;
    const fits = pool.filter((r) => recipeFitsSlot(r, name));
    if (fits.length === 0) continue;
    const pick = fits[Math.floor(rand() * fits.length)]!;
    pickedIds.push(pick.id);
    const ideal = pick.calories > 0 ? slotCalTargets[j] / pick.calories : 1;
    const mult = Math.max(0.2, Math.min(2.5, Math.round(ideal * 10) / 10));
    const scaled = scaleMacros(pick, mult);
    meals.push({
      name,
      recipeTitle: pick.title,
      recipeId: pick.id,
      calories: scaled.calories,
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
      fiberG: scaled.fiberG,
      portionMultiplier: mult !== 1 ? mult : undefined,
    });
  }
  return { meals, pickedIds };
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
  const slots = input.slotConfig?.slots ?? ["Breakfast", "Lunch", "Snacks", "Dinner"];
  const baseSeed = input.seed ?? Date.now();

  const recentIds = new Set<string>();
  const usedCombinations = new Set<string>();
  const plans: DayPlan[] = [];

  for (let d = 1; d <= daysCount; d++) {
    // Clear recency every 5 days to allow repeats in longer plans
    if (d > 1 && (d - 1) % 5 === 0) recentIds.clear();

    // Unique seed per day
    const rand = mulberry32(baseSeed + d * 7919 + recipes.length * 31);

    const joint = findBestMealSet(recipes, slots, targets, recentIds, rand);
    let meals: PlanMeal[];
    if (joint) {
      for (const r of joint.recipes) recentIds.add(r.id);
      meals = slots.map((name, i) => {
        const r = joint.recipes[i]!;
        const mult = joint.multipliers[i]!;
        const scaled = scaleMacros(r, mult);
        return {
          name,
          recipeTitle: r.title,
          recipeId: r.id,
          ...scaled,
          fiberG: scaled.fiberG,
          portionMultiplier: mult !== 1 ? mult : undefined,
        };
      });
    } else {
      const { meals: indMeals, pickedIds } = buildIndependentSlotDay(recipes, slots, targets, rand);
      meals = indMeals;
      for (const id of pickedIds) recentIds.add(id);
    }

    // Reject exact duplicate day combinations — retry with a different seed
    const combo = meals.map((m) => m.recipeId ?? m.recipeTitle).sort().join("|");
    if (usedCombinations.has(combo) && recipes.length > slots.length) {
      // Try up to 3 retries with offset seeds
      for (let retry = 1; retry <= 3; retry++) {
        const retryRand = mulberry32(baseSeed + d * 7919 + retry * 13337);
        const retryJoint = findBestMealSet(recipes, slots, targets, recentIds, retryRand);
        if (retryJoint) {
          const retryCombo = retryJoint.recipes.map((r) => r.id).sort().join("|");
          if (!usedCombinations.has(retryCombo)) {
            for (const r of retryJoint.recipes) recentIds.add(r.id);
            meals = slots.map((name, i) => {
              const r = retryJoint.recipes[i]!;
              const mult = retryJoint.multipliers[i]!;
              const scaled = scaleMacros(r, mult);
              return { name, recipeTitle: r.title, recipeId: r.id, ...scaled, portionMultiplier: mult !== 1 ? mult : undefined };
            });
            break;
          }
        }
      }
    }
    const finalCombo = meals.map((m) => m.recipeId ?? m.recipeTitle).sort().join("|");
    usedCombinations.add(finalCombo);

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
