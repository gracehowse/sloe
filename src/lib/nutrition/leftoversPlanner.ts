/**
 * Leftovers-aware plan distribution (Batch 3.10).
 *
 * When a parent meal's recipe yields N servings and the user eats 1 per slot,
 * the remaining (N - 1) servings fill matching slots on following days as
 * "leftover of [recipe]". This runs as a post-processing pass on a generated
 * or manually-edited `DayPlan[]` — it does NOT mutate totals on the parent
 * meal itself; leftover slots carry identical scaled macros.
 *
 * Shared between web and mobile planners.
 */

import type { DayPlan, DayPlanMeal } from "../../types/recipe.ts";

/** A meal enriched with the optional leftover-of recipe pointer. */
export type LeftoverAwareMeal = DayPlanMeal & {
  recipeId?: string;
  /** When set, this slot is a leftover portion of the named parent recipe id. */
  leftoverOf?: string;
  /** Purely visual — macros already equal the parent; tests assert equality. */
  isLeftover?: boolean;
};

export interface LeftoverPlan {
  recipeId: string;
  totalServings: number;
  servingsConsumed: number;
  slotsCovered: Array<{ dayIndex: number; slot: string }>;
}

/** Which slots a leftover parent is allowed to fall into given its origin slot. */
function allowedLeftoverSlots(parentSlot: string): string[] {
  const s = (parentSlot ?? "").toLowerCase();
  // Dinners → next-day lunch or dinner (classic "lunchbox" pattern).
  if (s === "dinner") return ["Lunch", "Dinner"];
  // Lunches → lunch or dinner.
  if (s === "lunch") return ["Lunch", "Dinner"];
  // Breakfast yields don't generally move to dinner — breakfast or snacks only.
  if (s === "breakfast") return ["Breakfast", "Snacks"];
  // Snacks can land in another snack slot.
  return ["Snacks"];
}

function isPlaceholderOrEmptySlot(meal: DayPlanMeal | undefined): boolean {
  if (!meal) return true;
  if (meal.isPlaceholder) return true;
  const t = (meal.recipeTitle ?? "").trim();
  return !t;
}

function slotMatches(meal: DayPlanMeal, allowed: string[]): boolean {
  return allowed.some((s) => s.toLowerCase() === (meal.name ?? "").toLowerCase());
}

/**
 * For each parent meal that yields > 1 serving, fill matching subsequent
 * empty slots with a `{ ...parent, leftoverOf: recipeId, isLeftover: true }`
 * copy until the yield is exhausted. Existing (non-placeholder, non-leftover)
 * slots are left untouched.
 *
 * Algorithm:
 *  - Walk days in order.
 *  - For each meal with `recipeId` in `recipesByRef` (yields > 1):
 *      yield k means (k - 1) leftovers to distribute.
 *  - Walk the following days (same-day later slots excluded — real kitchens
 *    don't serve the same dinner twice on one day). For each candidate slot:
 *      if empty AND slot label is in the `allowedLeftoverSlots(parent)` set,
 *      clone the parent meal with `leftoverOf = parent.recipeId` and consume
 *      one leftover.
 *
 * Returns a new `DayPlan[]` — input is not mutated.
 *
 * Report: `{ parentCount, leftoverCount }` is emitted by the caller via
 * `plan_leftovers_generated` analytics.
 */
export function distributeLeftovers(
  plan: DayPlan[],
  recipesByRef: Record<string, { servings: number } | undefined>,
): { plan: DayPlan[]; parentCount: number; leftoverCount: number } {
  // Deep-ish clone — we rewrite per-day meal arrays.
  const working: DayPlan[] = plan.map((dp) => ({
    ...dp,
    meals: dp.meals.map((m) => ({ ...m })),
    totals: { ...dp.totals },
  }));

  let parentCount = 0;
  let leftoverCount = 0;

  for (let d = 0; d < working.length; d++) {
    const day = working[d]!;
    for (let i = 0; i < day.meals.length; i++) {
      const parent = day.meals[i] as LeftoverAwareMeal;
      const rid = parent.recipeId;
      if (!rid) continue;
      if (parent.leftoverOf) continue; // don't chain leftovers of leftovers
      if (parent.isPlaceholder) continue;

      const recipeMeta = recipesByRef[rid];
      const yieldServings = recipeMeta?.servings;
      if (!yieldServings || yieldServings < 2) continue;

      const remaining = Math.floor(yieldServings) - 1;
      if (remaining <= 0) continue;

      const allowed = allowedLeftoverSlots(parent.name);
      let placed = 0;

      // Search days AFTER this one. Same-day later slots are intentionally
      // excluded (we don't double up the same recipe within one day).
      outer: for (let dd = d + 1; dd < working.length && placed < remaining; dd++) {
        const targetDay = working[dd]!;
        for (let ii = 0; ii < targetDay.meals.length && placed < remaining; ii++) {
          const candidate = targetDay.meals[ii] as LeftoverAwareMeal;
          if (!isPlaceholderOrEmptySlot(candidate)) continue;
          if (!slotMatches(candidate, allowed)) continue;
          // Fill it — preserve the slot name from the candidate so the UI
          // displays the right meal type.
          const slotName = candidate.name;
          targetDay.meals[ii] = {
            name: slotName,
            recipeTitle: parent.recipeTitle,
            recipeId: parent.recipeId,
            calories: parent.calories,
            protein: parent.protein,
            carbs: parent.carbs,
            fat: parent.fat,
            fiberG: (parent as LeftoverAwareMeal).fiberG,
            portionMultiplier: parent.portionMultiplier,
            leftoverOf: rid,
            isLeftover: true,
            isPlaceholder: false,
          } as LeftoverAwareMeal;
          placed++;
          leftoverCount++;
          if (placed >= remaining) break outer;
        }
      }

      if (placed > 0) parentCount++;
    }
  }

  // Recompute day totals — leftovers contribute their macros.
  for (const day of working) {
    day.totals = day.meals.reduce(
      (acc, m) => ({
        calories: acc.calories + (m.calories ?? 0),
        protein: acc.protein + (m.protein ?? 0),
        carbs: acc.carbs + (m.carbs ?? 0),
        fat: acc.fat + (m.fat ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
  }

  return { plan: working, parentCount, leftoverCount };
}

/**
 * When a user swaps or unlocks a parent meal, its downstream leftovers must
 * go with it — they're copies, not independent records.
 *
 * Given a plan and a `(dayIndex, slot)` pointer to the parent that just
 * changed, returns a new plan with any leftover-of-that-recipe slots reset
 * to empty placeholders. If the parent recipe still appears in another slot
 * with a non-zero remaining yield, those leftovers would be re-distributed
 * on the next pass — callers that want that behaviour should re-run
 * `distributeLeftovers` after.
 *
 * Returns a `{ plan, removedCount }` tuple so the UI can say
 * "This removed 2 leftover meals."
 */
export function markLeftoversOnSwap(
  plan: DayPlan[],
  swappedSlot: { dayIndex: number; slot: string; previousRecipeId: string | undefined },
): { plan: DayPlan[]; removedCount: number } {
  const rid = swappedSlot.previousRecipeId;
  if (!rid) return { plan, removedCount: 0 };

  let removedCount = 0;
  const working: DayPlan[] = plan.map((dp) => ({
    ...dp,
    meals: dp.meals.map((m) => ({ ...m })),
    totals: { ...dp.totals },
  }));

  for (let d = 0; d < working.length; d++) {
    // Only touch days AFTER the swap — preserve any recorded copies from prior days.
    if (d <= swappedSlot.dayIndex) continue;
    const day = working[d]!;
    for (let i = 0; i < day.meals.length; i++) {
      const m = day.meals[i] as LeftoverAwareMeal;
      if (m.leftoverOf === rid) {
        // Clear the slot back to an empty placeholder.
        day.meals[i] = {
          name: m.name,
          recipeTitle: "",
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          isPlaceholder: true,
        };
        removedCount++;
      }
    }
  }

  // Recompute totals on changed days.
  for (const day of working) {
    day.totals = day.meals.reduce(
      (acc, m) => ({
        calories: acc.calories + (m.calories ?? 0),
        protein: acc.protein + (m.protein ?? 0),
        carbs: acc.carbs + (m.carbs ?? 0),
        fat: acc.fat + (m.fat ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
  }

  return { plan: working, removedCount };
}

/**
 * Count how many leftover slots belong to a given parent recipe id.
 * Used by the swap-prompt UI to say "This will remove N leftover meals."
 */
export function countLeftoversOfRecipe(plan: DayPlan[], recipeId: string): number {
  let n = 0;
  for (const day of plan) {
    for (const m of day.meals as LeftoverAwareMeal[]) {
      if (m.leftoverOf === recipeId) n++;
    }
  }
  return n;
}

/**
 * Move a meal from (fromDay, fromSlot) to (toDay, toSlot). Returns a new
 * plan (input is not mutated). The destination slot's current content is
 * swapped to the source — i.e. this is a two-way swap, not a destructive
 * overwrite. Placeholder / empty destinations are overwritten cleanly.
 *
 * Shared between web drag-drop and mobile long-press-drag. Day numbers
 * here match the existing plan convention (1-indexed).
 */
export function moveMealInPlan(
  plan: DayPlan[],
  from: { day: number; slotIndex: number },
  to: { day: number; slotIndex: number },
): DayPlan[] {
  if (from.day === to.day && from.slotIndex === to.slotIndex) return plan;

  const working: DayPlan[] = plan.map((dp) => ({
    ...dp,
    meals: dp.meals.map((m) => ({ ...m })),
    totals: { ...dp.totals },
  }));

  const fromDay = working.find((d) => d.day === from.day);
  const toDay = working.find((d) => d.day === to.day);
  if (!fromDay || !toDay) return plan;

  const fromMeal = fromDay.meals[from.slotIndex];
  const toMeal = toDay.meals[to.slotIndex];
  if (!fromMeal || !toMeal) return plan;

  // Preserve the slot labels of the destination positions (Breakfast stays
  // Breakfast), swap the recipe content + macros. If the destination was
  // empty / placeholder, the source slot becomes an empty placeholder.
  const sourceSlotName = fromMeal.name;
  const destSlotName = toMeal.name;

  const movedToDest: DayPlanMeal = { ...fromMeal, name: destSlotName };
  const movedToSource: DayPlanMeal = toMeal.isPlaceholder || !toMeal.recipeTitle
    ? { name: sourceSlotName, recipeTitle: "", calories: 0, protein: 0, carbs: 0, fat: 0, isPlaceholder: true }
    : { ...toMeal, name: sourceSlotName };

  toDay.meals[to.slotIndex] = movedToDest;
  fromDay.meals[from.slotIndex] = movedToSource;

  // Recompute totals on both days (even if same day — idempotent).
  for (const day of [fromDay, toDay]) {
    day.totals = day.meals.reduce(
      (acc, m) => ({
        calories: acc.calories + (m.calories ?? 0),
        protein: acc.protein + (m.protein ?? 0),
        carbs: acc.carbs + (m.carbs ?? 0),
        fat: acc.fat + (m.fat ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
  }

  return working;
}
