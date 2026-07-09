import { dayPlanTotalsFromMeals } from "../nutrition/portionMultiplier";
import { coerceMacrosWhenCaloriesButNoGrams } from "../nutrition/coerceRecipeMacrosForPlanning";
import {
  DEFAULT_PLANNER_BANDS as SHARED_DEFAULT_PLANNER_BANDS,
  MEAL_PLAN_RECENCY_RESET_DAYS,
  buildIndependentSlotDayGeneric,
  findBestMealSetGeneric,
  fitDayToTargets,
  refitDayMealsToTargets,
  mulberry32,
  regenerateUnlockedMeals,
  scaleMacros,
} from "../nutrition/mealPlanAlgo";
import type {
  DayPlan,
  DayPlanMeal,
  PlannerMealSlot,
  RecipeCard,
} from "../../types/recipe";
import { PLANNER_MEAL_SLOT_LABELS } from "../../types/recipe";

/**
 * P2-28 (2026-04-25): full meal-plan algorithm deduplication.
 *
 * Pre-fix this file shipped its own `mulberry32`, `scaleMacros`,
 * `scoreMealSet`, `findBestSmartMealSet`, and `buildIndependentSlotDay`
 * — ~700 lines of mostly-identical-but-subtly-divergent algorithm
 * code that mirrored `mealPlanAlgo.ts` with platform-typed wrappers.
 * The two algorithms drifted in three observable ways (recency penalty
 * 100/40, reset window 5d/3d, calorie band 5/12) which P1-9 closed at
 * the constant level — but the algorithm bodies still shipped twice
 * with subtler structural differences (mobile pre-sorted by slot
 * calorie target + 60% top-half bias; web picked uniformly random.
 * Mobile hard-rejected within-day duplicates; web soft-penalised at
 * +80. Mobile's calorie out-of-band penalty was asymmetric (×3 over,
 * ×1.5 under); web was flat ×2).
 *
 * P2-28 deletes the duplicate body. Both web and mobile now run the
 * same `findBestMealSetGeneric<R extends MealPlanRecipe>` from
 * `mealPlanAlgo.ts`; the only platform-specific code left in this file
 * is the `RecipeCard`-shaped slot-fit predicate and the
 * pool-construction filter (the "exclude zero-macro recipes" guard
 * from P1-23). All scoring, scaling, and sampling logic lives in one
 * file. Future scoring changes are now a one-file edit instead of a
 * two-file lockstep.
 *
 * Behavioural change for web users vs the previous (drifted) shape:
 * mobile's stricter scoring is canonical (asymmetric calorie penalty,
 * hard-reject duplicates, slot-target pre-sort + 60% top-half bias).
 * Better aligned with Suppr's "precision over breadth" positioning;
 * over-target is penalised harder for cutting users; in-day duplicates
 * are a guarantee, not a soft preference.
 *
 * Pinned by `tests/unit/mealPlanWebMobileParity.test.ts` —
 * tightened from "same constants" to behavioural assertions in the
 * same PR.
 */

// F-15 re-export so the planner UI can pull the single shared clamp.
export { PORTION_MULTIPLIER_CLAMP } from "../nutrition/mealPlanAlgo";

/** Daily macro targets + optional tolerance bands for the optimizer. */
export interface PlannerTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Daily fibre target (g). Pass 0 to skip fibre in scoring / joint-fit. */
  fiber: number;
  /** ±% around calorie goal (e.g. 12 → 88%–112% of calories). */
  calorieBandPct: number;
  /** ±% around carb, fat, and fibre day targets. */
  carbFatBandPct: number;
  /** ENG-1254 — minimum daily kcal floor from Adjust constraints. */
  calorieFloorMin?: number;
}

/**
 * P1-9 (2026-04-25): re-exported from `mealPlanAlgo.ts` so web + mobile
 * share a single source of truth.
 */
export const DEFAULT_PLANNER_BANDS = SHARED_DEFAULT_PLANNER_BANDS;

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

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Generate a macro-aware meal plan from saved recipes. Web wrapper
 * around `findBestMealSetGeneric<RecipeCard>` from `mealPlanAlgo.ts`.
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
  const pool = savedRecipes
    .map((r) => ({
      ...r,
      ...coerceMacrosWhenCaloriesButNoGrams({
        calories: r.calories,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
        fiberG: r.fiberG,
      }),
    }))
    // P1-23 — exclude recipes that still have 0 calories AND 0 macros
    // after the planning coercion helper above. The joint-fit scaler
    // can produce nonsense multipliers when handed a recipe with no
    // nutritional signal.
    .filter(
      (r) =>
        (Number.isFinite(r.calories) && r.calories > 0) ||
        (Number.isFinite(r.protein) && r.protein > 0) ||
        (Number.isFinite(r.carbs) && r.carbs > 0) ||
        (Number.isFinite(r.fat) && r.fat > 0),
    );
  const daysCount = clamp(Math.floor(input.days), 1, 7);
  const slots = input.slots ?? PLAN_MEAL_SLOTS.slice();
  const baseSeed = input.seed ?? Date.now();

  // P2-28: slot-fit adapter — generic takes `slot: string`; web's
  // `recipeFitsMealSlot` was typed against `PlannerMealSlot`. Cast
  // here so the algorithm doesn't need to know about the typed
  // enum.
  const slotFitPredicate = (recipe: RecipeCard, slot: string) =>
    recipeFitsMealSlot(recipe, slot as PlannerMealSlot);

  const recentIds = new Set<string>();
  const plans: DayPlan[] = [];

  for (let d = 1; d <= daysCount; d++) {
    // P1-9: shared 5-day reset.
    if (d > 1 && (d - 1) % MEAL_PLAN_RECENCY_RESET_DAYS === 0) recentIds.clear();

    const rand = mulberry32(baseSeed + d * 7919 + pool.length * 31);
    const joint = findBestMealSetGeneric(pool, slots, targets, recentIds, rand, slotFitPredicate);
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
          recipeId: r.id,
          calories: scaled.calories,
          protein: scaled.protein,
          carbs: scaled.carbs,
          fat: scaled.fat,
          fiberG: scaled.fiberG,
          // P1-19: thread coercion flag through to the planner row chip.
          ...((r as { isCoerced?: boolean }).isCoerced ? { macrosAreEstimated: true as const } : {}),
          // ENG-1417 — thread the source recipe's trust signal through.
          isVerified: r.isVerified,
          // portionMultiplier not set: fit mult is baked into calories already.
        };
      });
      residualProteinGap = joint.residualProteinGap;
    } else {
      // Polish (2026-04-25 visual-qa): independent fallback gets a
      // re-sample loop. Tester feedback: "when meal plans are generated,
      // they are way out from calorie and macronutrient goals". When the
      // joint sampler can't satisfy bands, the fallback used to accept
      // the very first independent build no matter how badly it drifted
      // (often >25% off the calorie target). Now we sample up to 4
      // candidates with offset RNG seeds and keep the one closest to
      // calorie target — small, bounded cost, dramatically better fit
      // on small pools where the joint sampler gives up.
      const FALLBACK_RETRIES = 3; // primary build + 3 retries = 4 candidates
      let bestFallback = buildIndependentSlotDayGeneric(
        pool,
        slots,
        targets,
        rand,
        slotFitPredicate,
      );
      const calOf = (f: typeof bestFallback) =>
        f.picks.reduce(
          (a, { pick }, j) => a + scaleMacros(pick, f.multipliers[j]!).calories,
          0,
        );
      let bestDrift = Math.abs(calOf(bestFallback) - targets.calories);
      for (let retry = 1; retry <= FALLBACK_RETRIES; retry++) {
        const retryRand = mulberry32(baseSeed + d * 7919 + retry * 13337 + pool.length * 31);
        const candidate = buildIndependentSlotDayGeneric(
          pool,
          slots,
          targets,
          retryRand,
          slotFitPredicate,
        );
        const candidateDrift = Math.abs(calOf(candidate) - targets.calories);
        if (candidateDrift < bestDrift) {
          bestFallback = candidate;
          bestDrift = candidateDrift;
        }
      }
      const fallback = bestFallback;
      residualProteinGap = fallback.residualProteinGap;
      meals = fallback.picks.map(({ pick, name }, j) => {
        const mult = fallback.multipliers[j]!;
        const scaled = scaleMacros(pick, mult);
        return {
          name,
          recipeTitle: pick.title,
          recipeId: pick.id,
          calories: scaled.calories,
          protein: scaled.protein,
          carbs: scaled.carbs,
          fat: scaled.fat,
          fiberG: scaled.fiberG,
          ...((pick as { isCoerced?: boolean }).isCoerced ? { macrosAreEstimated: true as const } : {}),
          // ENG-1417 — thread the source recipe's trust signal through.
          isVerified: pick.isVerified,
        };
      });
      for (const id of fallback.pickedIds) recentIds.add(id);
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

/**
 * ENG-956 — "Refresh the rest". Re-roll only the UNLOCKED meals of an existing
 * plan, keeping each `isLocked` meal byte-identical and rebalancing the
 * remaining macro budget (daily target − locked meals) across the unlocked
 * slots. Web wrapper around `regenerateUnlockedMeals<RecipeCard>`.
 *
 * Per day: locked meals are preserved (same reference), unlocked slots are
 * re-sampled against `target − locked`. Day totals are recomputed from the
 * stitched meal list. The `isLocked` flag is preserved on locked meals so the
 * UI keeps showing the lock; replacement meals come back unlocked.
 *
 * Used by the planner's Regenerate button when the `plan_meal_lock_v1` flag is
 * on AND ≥1 meal is locked; otherwise the caller falls back to the full
 * `generatePlanFromLibrary` path (legacy all-or-nothing regenerate).
 */
export function regeneratePlanKeepingLocked(input: {
  existingPlan: DayPlan[];
  savedRecipes: RecipeCard[];
  targets: PlannerTargets;
  /** Which slots are in play — defaults to all 4. */
  slots?: string[];
  /** RNG seed — defaults to Date.now(). */
  seed?: number;
}): DayPlan[] {
  const { existingPlan, savedRecipes, targets } = input;
  const pool = savedRecipes
    .map((r) => ({
      ...r,
      ...coerceMacrosWhenCaloriesButNoGrams({
        calories: r.calories,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
        fiberG: r.fiberG,
      }),
    }))
    .filter(
      (r) =>
        (Number.isFinite(r.calories) && r.calories > 0) ||
        (Number.isFinite(r.protein) && r.protein > 0) ||
        (Number.isFinite(r.carbs) && r.carbs > 0) ||
        (Number.isFinite(r.fat) && r.fat > 0),
    );
  const baseSeed = input.seed ?? Date.now();
  const slotFitPredicate = (recipe: RecipeCard, slot: string) =>
    recipeFitsMealSlot(recipe, slot as PlannerMealSlot);

  const recentIds = new Set<string>();
  return existingPlan.map((dp, dayIdx) => {
    // Each day's unlocked slots are read from the meals' own `name`, so a
    // day with a non-default slot set still maps correctly.
    const daySlots = input.slots ?? dp.meals.map((m) => m.name);
    const rand = mulberry32(baseSeed + (dp.day || dayIdx + 1) * 7919 + pool.length * 31);
    const { meals, residualProteinGap } = regenerateUnlockedMeals({
      meals: dp.meals,
      pool,
      slots: daySlots,
      targets,
      recentIds,
      rand,
      slotFitPredicate,
    });
    // Feed every recipe used this day (locked + re-rolled) into the recency
    // set so multi-day plans keep variety across days.
    for (const m of meals) {
      if (m.recipeId) recentIds.add(m.recipeId);
    }
    const totals = dayPlanTotalsFromMeals(meals as DayPlanMeal[]);
    return {
      ...dp,
      meals: meals as DayPlanMeal[],
      totals,
      ...(residualProteinGap < 0 ? { residualProteinGap } : {}),
    };
  });
}

// fitDayToTargets is exported by mealPlanAlgo.ts; re-exported here for
// any web-side caller that imported it through this file historically.
export { fitDayToTargets, refitDayMealsToTargets };
