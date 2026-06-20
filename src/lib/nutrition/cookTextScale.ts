/**
 * Cook-mode text scale — pure helpers shared by web (`CookMode.tsx`) and
 * mobile (the cook overlay in `apps/mobile/app/recipe/[id].tsx`).
 *
 * ENG-949: "text is tiny, forcing users to squint while something boils
 * over" is one of the most repeated cook-mode complaints. For a screen
 * read from ~60cm away on a counter, glanceability is the whole job. We
 * give the user an in-cook A−/A+ control that scales the step text and
 * persist their choice.
 *
 * The preference is stored PER USER, not per recipe (unlike the serving
 * `recipeScale`): someone who wants large cook text wants it for every
 * recipe they cook, so the key is keyed on the user alone. A cold /
 * missing store resolves to `COOK_TEXT_SCALE_DEFAULT` (1×) so the step
 * text renders exactly as before until the user opts into a bigger size.
 *
 * No React, no DOM, no React Native. Safe to import anywhere.
 */

/** The discrete multipliers the A−/A+ control steps through. 1× is the
 *  default (current sizing); 0.9× is the one step below for users who
 *  want more text on screen; 1.5× is the practical ceiling before step
 *  text starts wrapping past a comfortable line count. */
export const COOK_TEXT_SCALE_STEPS: readonly number[] = [0.9, 1, 1.15, 1.3, 1.5];

/** Unscaled default — present in `COOK_TEXT_SCALE_STEPS` so a brand-new
 *  user sees the step text at its historical size. */
export const COOK_TEXT_SCALE_DEFAULT = 1;

/** AsyncStorage / localStorage key prefix for the chosen cook text
 *  scale. Keyed per user (not per recipe) so the size preference
 *  follows the cook across every recipe. */
export const COOK_TEXT_SCALE_KEY_PREFIX = "suppr-cook-text-scale-v1:";

/** Build the per-user storage key. The user id keeps a shared device
 *  from bleeding one account's size preference into another. Falls back
 *  to "anon" when no user is signed in. */
export function cookTextScaleStorageKey(userId: string | null | undefined): string {
  const u = userId && userId.trim() ? userId : "anon";
  return `${COOK_TEXT_SCALE_KEY_PREFIX}${u}`;
}

/** Validate a raw scale and snap it to the nearest supported step.
 *  Non-finite / non-positive inputs fall back to the default. Unlike
 *  the serving-scale clamp we DO snap arbitrary values to the nearest
 *  step here: a stored size is a UI preference, so the closest legible
 *  step is the right recovery (never blank the size out). */
export function clampCookTextScale(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return COOK_TEXT_SCALE_DEFAULT;
  }
  let nearest = COOK_TEXT_SCALE_STEPS[0]!;
  let bestDelta = Infinity;
  for (const step of COOK_TEXT_SCALE_STEPS) {
    const delta = Math.abs(step - raw);
    if (delta < bestDelta) {
      bestDelta = delta;
      nearest = step;
    }
  }
  return nearest;
}

/** Step the scale one notch in `direction` (>0 = bigger, <=0 = smaller),
 *  clamped to the ends of `COOK_TEXT_SCALE_STEPS`. Idempotent at the
 *  bounds so a tap on a disabled control would be a no-op. */
export function stepCookTextScale(current: number, direction: number): number {
  const cur = clampCookTextScale(current);
  const idx = COOK_TEXT_SCALE_STEPS.indexOf(cur);
  const safeIdx = idx >= 0 ? idx : COOK_TEXT_SCALE_STEPS.indexOf(COOK_TEXT_SCALE_DEFAULT);
  const nextIdx = Math.min(
    COOK_TEXT_SCALE_STEPS.length - 1,
    Math.max(0, safeIdx + (direction > 0 ? 1 : -1)),
  );
  return COOK_TEXT_SCALE_STEPS[nextIdx]!;
}

/** Whether the A+ control should be enabled (not already at the max). */
export function canIncreaseCookTextScale(current: number): boolean {
  return clampCookTextScale(current) < COOK_TEXT_SCALE_STEPS[COOK_TEXT_SCALE_STEPS.length - 1]!;
}

/** Whether the A− control should be enabled (not already at the min). */
export function canDecreaseCookTextScale(current: number): boolean {
  return clampCookTextScale(current) > COOK_TEXT_SCALE_STEPS[0]!;
}

/** Apply the scale to a base font size and round to a whole pixel. A
 *  non-positive / non-finite base falls back to 16 so a bad call never
 *  yields a zero-height line. */
export function cookStepFontSize(baseSize: number, scale: number): number {
  const base = Number.isFinite(baseSize) && baseSize > 0 ? baseSize : 16;
  return Math.round(base * clampCookTextScale(scale));
}
