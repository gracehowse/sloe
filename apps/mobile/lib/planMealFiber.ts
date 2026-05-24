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
};

function snapDisplayMultiplier(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const stepped = Math.round(raw * 2) / 2;
  return Math.min(2, Math.max(0.5, stepped));
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
  const base =
    (typeof ref.fiberG === "number" && ref.fiberG > 0 ? ref.fiberG : 0) ||
    (typeof ref.fiber_g === "number" && ref.fiber_g > 0 ? ref.fiber_g : 0) ||
    (typeof ref.fiber_per_serving === "number" && ref.fiber_per_serving > 0 ? ref.fiber_per_serving : 0);
  if (base <= 0) return 0;
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
