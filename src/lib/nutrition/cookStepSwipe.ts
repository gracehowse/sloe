/**
 * ENG-947 — shared swipe-between-steps resolution for cook mode.
 * Pure helpers so web touch handlers and mobile Pan gestures share
 * identical thresholds and edge behaviour.
 */

/** Fraction of viewport width the finger must travel before a swipe
 *  commits (unless velocity overrides — see below). Tuned for messy
 *  hands: generous enough to avoid accidental advances, short enough
 *  that a deliberate flick feels responsive. */
export const COOK_STEP_SWIPE_THRESHOLD_RATIO = 0.22;

/** Horizontal velocity (px/s) that commits a swipe even when distance
 *  is below the ratio threshold — the "quick flick" path. */
export const COOK_STEP_SWIPE_VELOCITY_THRESHOLD = 450;

export type CookStepSwipeDirection = "next" | "prev" | "none";

export interface ResolveCookStepSwipeInput {
  translationX: number;
  velocityX: number;
  viewportWidth: number;
  stepIndex: number;
  stepCount: number;
}

/** Decide whether a horizontal pan/touch gesture should advance,
 *  retreat, or snap back. Respects first/last step bounds. */
export function resolveCookStepSwipe(
  input: ResolveCookStepSwipeInput,
): CookStepSwipeDirection {
  const { translationX, velocityX, viewportWidth, stepIndex, stepCount } =
    input;
  if (stepCount <= 0) return "none";

  const threshold = viewportWidth * COOK_STEP_SWIPE_THRESHOLD_RATIO;
  const canGoNext = stepIndex < stepCount - 1;
  const canGoPrev = stepIndex > 0;

  if (
    canGoNext &&
    (translationX < -threshold ||
      velocityX < -COOK_STEP_SWIPE_VELOCITY_THRESHOLD)
  ) {
    return "next";
  }
  if (
    canGoPrev &&
    (translationX > threshold ||
      velocityX > COOK_STEP_SWIPE_VELOCITY_THRESHOLD)
  ) {
    return "prev";
  }
  return "none";
}

/** Rubber-band factor applied at the first/last step so the user feels
 *  resistance instead of a dead stop. */
export function cookStepSwipeRubberBand(
  translationX: number,
  stepIndex: number,
  stepCount: number,
): number {
  if (stepCount <= 0) return translationX;
  const atStart = stepIndex <= 0;
  const atEnd = stepIndex >= stepCount - 1;
  if (atStart && translationX > 0) return translationX * 0.35;
  if (atEnd && translationX < 0) return translationX * 0.35;
  return translationX;
}
