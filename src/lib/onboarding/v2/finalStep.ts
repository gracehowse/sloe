/**
 * Onboarding final step — "Pick 5 recipes" selection state.
 *
 * Production design spec — 2026-04-27 Surface F.
 * Authority: D-2026-04-27-14 (onboarding ends with a populated first
 * week, not just a target).
 *
 * The selection model: an immutable Set of recipe ids, capped at the
 * library minimum (≥5 by default — V-6 sub-decision). Below the cap
 * the CTA is disabled; at or above it the CTA reads "Build my first
 * week" and triggers the seed-and-plan flow.
 *
 * Cross-platform: shared lib so web + mobile use identical logic.
 *
 * The actual seed-and-plan persistence (writing rows to
 * `saved_recipes` + `meal_plans`) is staged for follow-up — adds a
 * Supabase write path that needs schema verification per CLAUDE.md
 * (no MCP `apply_migration`). This file ships the selection state +
 * the threshold constants + the primary CTA copy generator. Once
 * the persist hook lands, it consumes `pickedRecipeIds` from this
 * module.
 */

import { NORTH_STAR_LIBRARY_MIN } from "../../nutrition/northStarSuggestion";

/** Minimum number of recipes the user must pick before the CTA unlocks.
 *  Single source of truth — sourced from the same constant as the
 *  north-star block's library threshold so the two surfaces can't
 *  drift apart accidentally. V-6 sub-decision allows a flag override
 *  later. */
export const ONBOARDING_PICK_MIN = NORTH_STAR_LIBRARY_MIN;

export interface PickerState {
  /** Set of selected recipe ids. */
  picked: ReadonlySet<string>;
  /** Whether the CTA is enabled (count >= ONBOARDING_PICK_MIN). */
  canSubmit: boolean;
  /** Number more the user needs to pick before the CTA unlocks. */
  remaining: number;
  /** CTA label — disabled state shows "Pick {n} more to continue". */
  ctaLabel: string;
}

/**
 * Toggle a recipe id in the set. Returns a new Set so callers can
 * use referential equality to skip rerenders when nothing changed.
 */
export function togglePick(
  picked: ReadonlySet<string>,
  recipeId: string,
): ReadonlySet<string> {
  const next = new Set(picked);
  if (next.has(recipeId)) {
    next.delete(recipeId);
  } else {
    next.add(recipeId);
  }
  return next;
}

/**
 * Derive the picker state (count, can-submit, CTA label) from a set
 * of picked ids. Pure function — testable.
 */
export function derivePickerState(picked: ReadonlySet<string>): PickerState {
  const count = picked.size;
  const remaining = Math.max(0, ONBOARDING_PICK_MIN - count);
  const canSubmit = count >= ONBOARDING_PICK_MIN;
  const ctaLabel = canSubmit
    ? "Build my first week"
    : `Pick ${remaining} more to continue`;
  return { picked, canSubmit, remaining, ctaLabel };
}

/**
 * Counter copy for the body — e.g. "4 of 5 picked". Capped at
 * ONBOARDING_PICK_MIN even when the user picks more (avoids the
 * UI reading "12 of 5" which would be confusing).
 */
export function pickCounterLabel(picked: ReadonlySet<string>): string {
  const shown = Math.min(picked.size, ONBOARDING_PICK_MIN);
  return `${shown} of ${ONBOARDING_PICK_MIN} picked`;
}
