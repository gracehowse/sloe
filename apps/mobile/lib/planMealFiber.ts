export type PlanMealFiberInput = {
  recipeTitle: string;
  calories: number;
  fiberG?: number;
  portionMultiplier?: number;
  recipeId?: string;
};

export type RecipeFiberRef = {
  id: string;
  title: string;
  calories: number;
  fiberG?: number | null;
  fiber_g?: number | null;
  fiber_per_serving?: number | null;
  fiber?: number | null;
};

function snapDisplayMultiplier(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const stepped = Math.round(raw * 2) / 2;
  return Math.min(2, Math.max(0.5, stepped));
}

export function resolveRecipeFiberG(ref: {
  fiberG?: number | null;
  fiber_g?: number | null;
  fiber_per_serving?: number | null;
  fiber?: number | null;
}): number {
  for (const v of [ref.fiberG, ref.fiber_g, ref.fiber_per_serving, ref.fiber]) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  }
  return 0;
}

/** Fibre for a plan row — stored `fiberG` or scaled from the linked recipe. */
export function planMealFiberG(meal: PlanMealFiberInput, pool: RecipeFiberRef[]): number {
  if (typeof meal.fiberG === "number" && Number.isFinite(meal.fiberG) && meal.fiberG > 0) {
    return meal.fiberG;
  }
  const ref =
    (meal.recipeId ? pool.find((r) => r.id === meal.recipeId) : undefined) ??
    pool.find((r) => r.title.trim() === meal.recipeTitle.trim());
  if (!ref) return 0;
  const base = resolveRecipeFiberG(ref);
  const pm = meal.portionMultiplier;
  if (typeof pm === "number" && Number.isFinite(pm) && pm > 0) {
    return Math.round(base * pm * 10) / 10;
  }
  const rc = Number(ref.calories) || 0;
  if (rc > 0 && meal.calories > 0) {
    const ratio = meal.calories / rc;
    if (Math.abs(ratio - 1) > 0.02) {
      return Math.round(base * snapDisplayMultiplier(ratio) * 10) / 10;
    }
  }
  return Math.round(base * 10) / 10;
}

export function enrichPlanMealsFiber<T extends PlanMealFiberInput>(meals: T[], pool: RecipeFiberRef[]): T[] {
  if (pool.length === 0) return meals;
  return meals.map((m) => {
    const fiberG = planMealFiberG(m, pool);
    return fiberG > 0 || m.fiberG != null ? { ...m, fiberG } : m;
  });
}
