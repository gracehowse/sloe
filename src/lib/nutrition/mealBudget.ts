/**
 * Distributes a daily calorie budget across meal slots.
 * Ratios roughly follow standard dietitian guidance.
 */

/** Standard slot shares — used by meal planning and Today coach copy. */
export const MEAL_SLOT_CALORIE_RATIOS: Record<string, number> = {
  Breakfast: 0.25,
  Lunch: 0.30,
  Dinner: 0.30,
  Snacks: 0.15,
};

const SLOT_RATIOS = MEAL_SLOT_CALORIE_RATIOS;

const MEAL_SLOT_ORDER = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

function normalisedLoggedSlots(loggedSlots: Iterable<string>): Set<string> {
  const logged = new Set<string>();
  for (const s of loggedSlots) {
    const t = s.trim().toLowerCase();
    if (t) logged.add(t);
  }
  return logged;
}

/** How many meal slots still have no logged food today. */
export function unloggedMealSlotCount(loggedSlots: Iterable<string>): number {
  const logged = normalisedLoggedSlots(loggedSlots);
  return MEAL_SLOT_ORDER.filter((slot) => !logged.has(slot.toLowerCase())).length;
}

/** Suggested kcal for the *next* meal slot — redistributes remaining budget
 *  across unlogged slots using {@link MEAL_SLOT_CALORIE_RATIOS}. */
export function coachSlotAimKcal(
  remainingKcal: number,
  nextSlot: string,
  loggedSlots: Iterable<string>,
): number {
  const logged = normalisedLoggedSlots(loggedSlots);
  const unlogged = MEAL_SLOT_ORDER.filter((slot) => !logged.has(slot.toLowerCase()));
  const ratioSum = unlogged.reduce((sum, slot) => sum + (SLOT_RATIOS[slot] ?? 0), 0);
  const nextRatio = SLOT_RATIOS[nextSlot] ?? 0.25;
  if (ratioSum <= 0) return Math.round(remainingKcal);
  return Math.round(remainingKcal * (nextRatio / ratioSum));
}

export type MealBudget = {
  slot: string;
  calories: number;
  fiber: number;
};

/**
 * Calculate per-slot calorie budget, redistributing what's already been consumed.
 *
 * @param totalCalories  Daily calorie goal
 * @param totalFiber     Daily fiber goal
 * @param consumed       Map of slot name → calories already logged
 */
export function distributeMealBudget(
  totalCalories: number,
  totalFiber: number,
  consumed: Record<string, number>,
): MealBudget[] {
  const slots = Object.keys(SLOT_RATIOS);
  const totalConsumed = Object.values(consumed).reduce((a, b) => a + b, 0);
  const caloriesLeft = Math.max(0, totalCalories - totalConsumed);

  const emptySlots = slots.filter((s) => !consumed[s] || consumed[s] === 0);
  const emptyRatioSum = emptySlots.reduce(
    (sum, s) => sum + (SLOT_RATIOS[s] ?? 0),
    0,
  );

  return slots.map((slot) => {
    if (consumed[slot] && consumed[slot] > 0) {
      return { slot, calories: 0, fiber: 0 };
    }

    const ratio = emptyRatioSum > 0 ? (SLOT_RATIOS[slot] ?? 0) / emptyRatioSum : 0;
    return {
      slot,
      calories: Math.round(caloriesLeft * ratio),
      fiber: Math.round(totalFiber * (SLOT_RATIOS[slot] ?? 0)),
    };
  });
}
