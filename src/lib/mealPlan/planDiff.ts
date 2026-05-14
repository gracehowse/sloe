/**
 * Plan diff utilities — Group E Card 4 (premium-bar audit 2026-05-14).
 *
 * When the user taps Regenerate on the Plan tab, the mobile surface
 * shows a soft toast that names how many meals changed between the
 * pre-regenerate and post-regenerate plans ("Plan updated — 12 meals
 * changed"). The toast is calmer than an Alert and signals that the
 * engine actually picked new recipes vs. just shuffling.
 *
 * Identity rule: `recipeId` first, falling back to `recipeTitle` for
 * any meal that never resolved to a saved recipe (placeholder slots,
 * legacy plans written before recipeId was tracked). Empty slots
 * (`null` on both sides) count as unchanged.
 *
 * Pure + platform-agnostic so the same helper can drive the mobile
 * toast and the web planner's eventual equivalent. Lives under
 * `src/lib/mealPlan/` alongside the other plan-shaped utilities.
 */

/**
 * Minimal shape needed to compute the diff. The Plan tab's full
 * meal type carries macros, portion, etc.; we only need an identity
 * pair here. Both fields optional — empty slots resolve to `null`
 * on both keys and count as unchanged.
 */
export interface PlanDiffMealLike {
  recipeId?: string | null;
  recipeTitle?: string | null;
}

/**
 * Minimal day-plan shape: just the `meals` array. The full DayPlan
 * type lives in `apps/mobile/app/(tabs)/planner.tsx` (and the web
 * equivalent in `src/app/components/MealPlanner.tsx`) — both carry
 * additional totals, day labels, etc. that this helper doesn't read.
 */
export interface PlanDiffDayLike {
  meals: ReadonlyArray<PlanDiffMealLike>;
}

/**
 * Resolve the identity key for a single meal slot. Prefers
 * `recipeId` (stable across rename / cloud sync) and falls back to
 * `recipeTitle` (best-effort for placeholder slots that never
 * resolved to a recipe). `null` for entirely empty slots.
 */
function mealIdentity(meal: PlanDiffMealLike | undefined): string | null {
  if (!meal) return null;
  if (meal.recipeId) return `id:${meal.recipeId}`;
  if (meal.recipeTitle) return `title:${meal.recipeTitle}`;
  return null;
}

/**
 * Count how many meal slots differ between `prev` and `next`. Pads
 * the shorter plan with empty slots so a length change (e.g. user
 * toggled the snack slot off) counts as a real diff rather than
 * silently truncating.
 *
 * Returns 0 when:
 *   - both plans are empty
 *   - both plans match slot-for-slot
 *   - one side is empty and we want a "first generation" no-op
 *     (the toast caller is expected to suppress the toast in that
 *     case — the helper just reports the count, it doesn't decide
 *     when to render)
 */
export function countChangedMealsInPlan(
  prev: ReadonlyArray<PlanDiffDayLike> | null,
  next: ReadonlyArray<PlanDiffDayLike> | null,
): number {
  if (!prev || !next) return 0;
  let changed = 0;
  const maxDays = Math.max(prev.length, next.length);
  for (let d = 0; d < maxDays; d++) {
    const prevMeals = prev[d]?.meals ?? [];
    const nextMeals = next[d]?.meals ?? [];
    const maxSlots = Math.max(prevMeals.length, nextMeals.length);
    for (let s = 0; s < maxSlots; s++) {
      const pKey = mealIdentity(prevMeals[s]);
      const nKey = mealIdentity(nextMeals[s]);
      if (pKey !== nKey) changed += 1;
    }
  }
  return changed;
}
