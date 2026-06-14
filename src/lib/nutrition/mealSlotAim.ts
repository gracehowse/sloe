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
/** Optional eating occasions never show an aim — a number on a slot the user may
 *  deliberately skip reads as a quota to fill (diet-culture / ED-adjacent).
 *  Sign-off 2026-06-13: diversity-inclusion (gating: Snacks-as-quota) +
 *  brand-manager (vetoed a conditional "~X if you snack" as off-voice) → the
 *  agreed resolution is to suppress the aim on optional slots entirely. Snacks
 *  stays in the budget ratios, so the main meals' aims still leave ~15% implicit
 *  headroom for snacking — just unnamed. */
const OPTIONAL_AIM_SLOTS = new Set(["Snacks", "Snack"]);

export function emptySlotAimKcal(
  slot: string,
  totalCalories: number,
  totalFiber: number,
  consumedBySlot: Record<string, number>,
): number | null {
  if (OPTIONAL_AIM_SLOTS.has(slot)) return null;
  if (!(totalCalories > 0)) return null;
  const budget = distributeMealBudget(totalCalories, totalFiber, consumedBySlot);
  const entry = budget.find((b) => b.slot === slot);
  if (!entry || entry.calories <= 0) return null;
  return Math.round(entry.calories / 5) * 5;
}

/**
 * Aim kcal for an empty PLAN day-card slot. The Plan surface uses the STATIC
 * per-slot ratio (`slotMacroTargets` — breakfast .25 / lunch .3 / dinner .35 /
 * snack .1, normalised over the day's enabled slots), NOT the dynamic
 * redistribution Today uses — intentional + documented divergence (a plan day
 * has no "consumed yet" to redistribute). The caller passes the slot's already-
 * computed target kcal (the planner computes `slotMacroTargets` already), so this
 * stays decoupled from `mealPlanAlgo`. Applies the SAME optional-slot suppression
 * + rounding + label as Today, so the two surfaces can't drift on copy/policy.
 * Returns `null` for optional slots (Snacks) or a non-positive target.
 */
export function planSlotAimKcal(slot: string, slotTargetKcal: number): number | null {
  if (OPTIONAL_AIM_SLOTS.has(slot)) return null;
  if (!(slotTargetKcal > 0)) return null;
  return Math.round(slotTargetKcal / 5) * 5;
}

/** Body-neutral, permission-framed empty-slot label (single value, never a range). */
export function aimKcalLabel(kcal: number): string {
  return `Aim ~${kcal.toLocaleString()} kcal`;
}
