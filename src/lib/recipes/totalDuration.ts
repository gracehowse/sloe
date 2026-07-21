/**
 * ENG-1617 — the ONE shared "total recipe duration" selector.
 *
 * Before this fix, Quick Weeknight / Recipe Detail summed prep + cook,
 * while cuisine-cluster cards, the Today "What to eat next" hero, and a
 * handful of other cards showed cook time ALONE — so the same recipe
 * displayed two different "total time" numbers depending which surface
 * you viewed it on. Every call site that needs a recipe's total duration
 * must go through `totalRecipeDurationMin` (or its formatted twin,
 * `formatTotalRecipeDuration`) instead of re-deriving the sum ad hoc.
 *
 * Degrade rules (per the ticket's acceptance criteria):
 *   - both prep + cook present → sum
 *   - only one present → that one value
 *   - neither present → `null` (never `0`, never a fabricated number —
 *     callers must hide the time chip rather than render "0 min")
 *
 * A non-positive value (`0`, negative, `NaN`/non-finite) is treated the
 * same as "not set". This matches the existing codebase convention for
 * these two fields — `materialiseSeedRecipe.ts` / `seedRecipesToCard.ts`
 * both normalise a `0` prep/cook minute value to `null` at write time,
 * since no real recipe takes literally zero minutes to prep or cook; a
 * `0` reaching here is missing data, not a real measurement.
 *
 * Mobile-importable: no `@/` aliases, pure function, no platform APIs —
 * mirrors `recipeCardAccessibilityLabel.ts` / `displayAttribution.ts`.
 * Mobile imports this file directly via `@suppr/shared/recipes/totalDuration`
 * (the `@suppr/shared/*` → `src/lib/*` alias) rather than a local shim.
 */

import { formatRecipeMinutes } from "../recipe/formatRecipeMinutes";

function toPositiveMinutes(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Pure numeric total: prep + cook when both are present, whichever one is
 * present when only one is, or `null` when neither is set.
 */
export function totalRecipeDurationMin(
  prepMin: number | null | undefined,
  cookMin: number | null | undefined,
): number | null {
  const prep = toPositiveMinutes(prepMin);
  const cook = toPositiveMinutes(cookMin);
  if (prep == null && cook == null) return null;
  return (prep ?? 0) + (cook ?? 0);
}

/**
 * Formatted label ("15 min", "1h 30m") for the combined prep + cook
 * duration, or `undefined` when neither is set — composes
 * `totalRecipeDurationMin` with the existing `formatRecipeMinutes`
 * formatter so callers get one function for "the total time label to
 * show on this card".
 */
export function formatTotalRecipeDuration(
  prepMin: number | null | undefined,
  cookMin: number | null | undefined,
): string | undefined {
  return formatRecipeMinutes(totalRecipeDurationMin(prepMin, cookMin));
}
