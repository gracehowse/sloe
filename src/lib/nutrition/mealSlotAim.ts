/**
 * Empty meal-slot "Aim ~X kcal" target — ENG-1092 ("Purposeful empties").
 *
 * The single source of truth for the empty-slot guidance number AND its label,
 * so Today (web + mobile) and Plan can never drift (the spec's parity concern).
 *
 * Today uses {@link distributeMealBudget}, which REDISTRIBUTES already-consumed
 * calories across the still-empty slots — so a partial day's aims shrink/grow
 * honestly (go over at breakfast and lunch/dinner aims drop).
 *
 * Copy decisions (design panel 2026-06-13, body-neutral / trust posture):
 *   - "Aim ~X" not "Recommended X": permission, not prescription.
 *   - A single tilde-value, NOT a range: our helper returns one redistributed
 *     number; inventing a ±band would be fabricated precision.
 */
import { distributeMealBudget } from "./mealBudget";

/**
 * Aim kcal for an EMPTY slot, redistributing consumed calories across the
 * still-empty slots. Returns `null` when there is nothing to aim for — no
 * target yet, or the day is already at/over budget (so a caller never renders
 * "Aim ~0 kcal"). Rounds to the nearest 5.
 *
 * `consumedBySlot` is keyed by canonical slot name (Breakfast/Lunch/Dinner/
 * Snacks); the slot being rendered must be empty (its entry 0 or absent).
 *
 * IMPORTANT (the calories:0 trap): `distributeMealBudget` returns `calories: 0`
 * for any slot that has consumed > 0 — so this helper must only ever be called
 * for a slot the caller already knows is empty. The `<= 0` guard below is the
 * backstop, but the caller must still gate on its own `hasMeals === false`.
 */
export function emptySlotAimKcal(
  slot: string,
  totalCalories: number,
  totalFiber: number,
  consumedBySlot: Record<string, number>,
): number | null {
  if (!(totalCalories > 0)) return null;
  const budget = distributeMealBudget(totalCalories, totalFiber, consumedBySlot);
  const entry = budget.find((b) => b.slot === slot);
  if (!entry || entry.calories <= 0) return null;
  return Math.round(entry.calories / 5) * 5;
}

/** Body-neutral, permission-framed empty-slot label (single value, never a range). */
export function aimKcalLabel(kcal: number): string {
  return `Aim ~${kcal.toLocaleString()} kcal`;
}
