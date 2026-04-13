/**
 * Distributes a daily calorie budget across meal slots.
 * Ratios roughly follow standard dietitian guidance.
 */

const SLOT_RATIOS: Record<string, number> = {
  Breakfast: 0.25,
  Lunch: 0.30,
  Dinner: 0.30,
  Snack: 0.15,
};

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
