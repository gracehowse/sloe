/**
 * Distributes a daily calorie budget across meal slots.
 * Ratios roughly follow standard dietitian guidance.
 *
 * ENG-1177 — the meal-slot preset model (classic / four_meals / six_meals via
 * `meal_slot_config`) lets a day run 5 or 6 numbered slots ("Meal 1" … "Meal 6").
 * Those numbered slots are absent from {@link MEAL_SLOT_CALORIE_RATIOS}, so
 * before this change a 6-meal config gave ratio 0 / 0 kcal for the extra slots
 * (the named-slot ratios only cover Breakfast/Lunch/Dinner/Snacks). Each function
 * now accepts the configured slot list (from `enabledMealSlotLabels(config)`); a
 * slot with no named dietitian ratio falls back to an even 1/N share via
 * {@link evenSlotCalorieRatio}. The list defaults to the classic four named slots
 * so every existing caller (which passes none) keeps its prior behaviour.
 */
import { evenSlotCalorieRatio } from "./userMealSlotConfig";

/** Standard slot shares — used by meal planning and Today coach copy. */
export const MEAL_SLOT_CALORIE_RATIOS: Record<string, number> = {
  Breakfast: 0.25,
  Lunch: 0.30,
  Dinner: 0.30,
  Snacks: 0.15,
};

const SLOT_RATIOS = MEAL_SLOT_CALORIE_RATIOS;

/** Default slot list — the classic four named slots. Used when a caller passes
 *  no configured list, preserving the pre-ENG-1177 behaviour. */
const MEAL_SLOT_ORDER = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

/** Resolve the configured slot list, defaulting to the classic four. */
function resolveSlots(slots?: readonly string[]): readonly string[] {
  return slots && slots.length > 0 ? slots : MEAL_SLOT_ORDER;
}

/**
 * Per-slot calorie share within a configured slot list.
 *
 * Named dietitian slots (Breakfast/Lunch/Dinner/Snacks) keep their standard
 * ratio; any other slot (e.g. the numbered "Meal 5" / "Meal 6" of a six-meal
 * config) falls back to an even 1/N share. To guarantee the shares never sum
 * above 1 — the invariant Today/Plan rely on so a partial-day redistribution
 * can't over-allocate — the raw shares are normalised down when their total
 * would exceed 1 (e.g. a slot list that mixes named ratios with even-split
 * fill-ins). For an all-named list (classic, or a named subset) or an
 * all-numbered list (four_meals / six_meals) the raw shares already sum to ≤ 1,
 * so normalisation is a no-op there.
 */
function slotRatioMap(slots: readonly string[]): Map<string, number> {
  const raw = new Map<string, number>();
  let total = 0;
  for (const slot of slots) {
    const ratio = SLOT_RATIOS[slot] ?? evenSlotCalorieRatio(slot, slots);
    raw.set(slot, ratio);
    total += ratio;
  }
  if (total > 1) {
    for (const [slot, ratio] of raw) raw.set(slot, ratio / total);
  }
  return raw;
}

function normalisedLoggedSlots(loggedSlots: Iterable<string>): Set<string> {
  const logged = new Set<string>();
  for (const s of loggedSlots) {
    const t = s.trim().toLowerCase();
    if (t) logged.add(t);
  }
  return logged;
}

/** How many meal slots still have no logged food today.
 *  `slots` defaults to the classic four named slots. */
export function unloggedMealSlotCount(
  loggedSlots: Iterable<string>,
  slots?: readonly string[],
): number {
  const logged = normalisedLoggedSlots(loggedSlots);
  return resolveSlots(slots).filter((slot) => !logged.has(slot.toLowerCase())).length;
}

/** Suggested kcal for the *next* meal slot — redistributes remaining budget
 *  across unlogged slots using the configured slot shares ({@link slotRatioMap}).
 *  `slots` defaults to the classic four named slots. */
export function coachSlotAimKcal(
  remainingKcal: number,
  nextSlot: string,
  loggedSlots: Iterable<string>,
  slots?: readonly string[],
): number {
  const resolved = resolveSlots(slots);
  const ratios = slotRatioMap(resolved);
  const logged = normalisedLoggedSlots(loggedSlots);
  const unlogged = resolved.filter((slot) => !logged.has(slot.toLowerCase()));
  const ratioSum = unlogged.reduce((sum, slot) => sum + (ratios.get(slot) ?? 0), 0);
  // Configured share for the next slot; if it isn't in the list, fall back to an
  // even split (or the classic 0.25 when the list is empty).
  const nextRatio =
    ratios.get(nextSlot) ?? (evenSlotCalorieRatio(nextSlot, resolved) || 0.25);
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
 * @param slots          Configured slot list (from `enabledMealSlotLabels`).
 *                       Defaults to the classic four named slots.
 */
export function distributeMealBudget(
  totalCalories: number,
  totalFiber: number,
  consumed: Record<string, number>,
  slots?: readonly string[],
): MealBudget[] {
  const resolved = resolveSlots(slots);
  const ratios = slotRatioMap(resolved);
  const totalConsumed = Object.values(consumed).reduce((a, b) => a + b, 0);
  const caloriesLeft = Math.max(0, totalCalories - totalConsumed);

  const emptySlots = resolved.filter((s) => !consumed[s] || consumed[s] === 0);
  const emptyRatioSum = emptySlots.reduce((sum, s) => sum + (ratios.get(s) ?? 0), 0);

  return resolved.map((slot) => {
    if (consumed[slot] && consumed[slot] > 0) {
      return { slot, calories: 0, fiber: 0 };
    }

    const ratio = emptyRatioSum > 0 ? (ratios.get(slot) ?? 0) / emptyRatioSum : 0;
    return {
      slot,
      calories: Math.round(caloriesLeft * ratio),
      fiber: Math.round(totalFiber * (ratios.get(slot) ?? 0)),
    };
  });
}
