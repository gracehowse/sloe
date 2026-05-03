/**
 * Recipe-detail viewing-servings stepper helpers (Paprika parity,
 * 2026-05-02 customer-lens audit). The Recipe detail screen lets the
 * viewer dial up / down the number of portions they're looking at —
 * ingredient amounts and the secondary "X kcal total for N portions"
 * line rescale in real time without touching the canonical recipe
 * yield.
 *
 * Two surfaces consume these helpers:
 *
 *  - mobile `apps/mobile/app/recipe/[id].tsx`
 *  - web    `src/app/components/RecipeDetail.tsx`
 *
 * Pure — no React, no DOM, no React Native — so both platforms can
 * share the exact same bounds / clamp / multiplier rules.
 *
 * Note: this is the *viewing* stepper (transient, per-render). The
 * canonical recipe yield (how many portions the recipe was authored
 * to make) is owned by `recipes.servings` and edited via the
 * separate yield editor on each platform.
 *
 * Cook-mode integration: the cook-mode flow (PR #72,
 * `src/app/components/CookMode.tsx` and the inline mobile cook
 * overlay) consumes the user's chosen viewing servings to scale step
 * text and the auto-log entry. On mobile we forward the multiplier
 * via `logPortion` (= `viewServings / baseServings`); on web we pass
 * `<CookMode servings={viewServings} baseServings={baseServings} />`
 * directly. This module owns the bounds / clamp; the cook-mode side
 * owns the step-text scaling.
 */

/** Lower bound — a recipe must always make at least 1 portion. Below
 *  this would imply scaling everything to zero / negative. */
export const RECIPE_VIEW_SERVINGS_MIN = 1;

/** Upper bound — defensive ceiling. 99 is conservative: even a
 *  scaled-up "feed the whole village" recipe rarely exceeds 50, and
 *  past ~100 the scaled ingredient amounts become absurd ("400 cups
 *  flour"). Cap protects the UI from pathological inputs (rapid
 *  tapping, pasted big numbers). Mirrors web behaviour. */
export const RECIPE_VIEW_SERVINGS_MAX = 99;

/** Debounce window (ms) for the stepper. Rapid taps (e.g. holding
 *  +) coalesce into one state update, which keeps the React Native
 *  re-render cost flat and avoids flickering the ingredient grams
 *  on every increment. Web uses the same value for keyboard
 *  auto-repeat parity. */
export const RECIPE_VIEW_STEPPER_DEBOUNCE_MS = 200;

/**
 * Clamp a candidate viewing-servings value into the supported range,
 * returning a positive integer. Non-finite, NaN, negative, zero, and
 * non-integer inputs all snap to {@link RECIPE_VIEW_SERVINGS_MIN}.
 *
 * The clamp is intentionally tight — a corrupt "0.5" should NOT be
 * preserved as 0.5; the stepper deals only in whole portions. The
 * separate cook-mode scaling preset (0.5x / 1x / 1.5x / 2x / 4x)
 * lives in `recipeScale.ts` and accepts fractional multipliers.
 */
export function clampViewServings(raw: unknown): number {
  if (typeof raw !== "number") return RECIPE_VIEW_SERVINGS_MIN;
  if (!Number.isFinite(raw)) return RECIPE_VIEW_SERVINGS_MIN;
  const n = Math.round(raw);
  if (n < RECIPE_VIEW_SERVINGS_MIN) return RECIPE_VIEW_SERVINGS_MIN;
  if (n > RECIPE_VIEW_SERVINGS_MAX) return RECIPE_VIEW_SERVINGS_MAX;
  return n;
}

/**
 * Compute the next viewing-servings after a stepper press. Honours
 * the upper / lower bounds. `delta` is normally +1 / -1, but the
 * helper accepts arbitrary integers so that a debounced burst of
 * taps can be coalesced into one accumulated delta and clamped at
 * the tail.
 */
export function stepViewServings(current: number, delta: number): number {
  return clampViewServings(current + delta);
}

/**
 * The multiplier applied to ingredient amounts and to the secondary
 * "X kcal total for N portions" line.
 *
 *   viewMultiplier(8, 4)   → 2     // viewing 8 of a 4-portion recipe
 *   viewMultiplier(2, 4)   → 0.5
 *   viewMultiplier(4, 4)   → 1
 *   viewMultiplier(4, 0)   → 4     // defensive: 0-yield treated as 1
 *   viewMultiplier(4, NaN) → 4
 *
 * Always > 0 — never returns zero or negative even for pathological
 * inputs. Never returns NaN.
 */
export function viewMultiplier(
  viewServings: number,
  baseServings: number | null | undefined,
): number {
  const view = clampViewServings(viewServings);
  const base =
    typeof baseServings === "number" && Number.isFinite(baseServings) && baseServings > 0
      ? baseServings
      : 1;
  const m = view / base;
  if (!Number.isFinite(m) || m <= 0) return 1;
  return m;
}

/**
 * Resolve the initial viewing-servings on first mount.
 *
 *   - When the URL carries a `?portion=N` param (planner / log flow
 *     deep-links pass the portion multiplier the user picked), seed
 *     the stepper with `recipe.servings * portion` so the detail
 *     screen reflects the deep-link intent.
 *   - Otherwise default to the recipe's authored yield (1×).
 *
 * The result is always clamped into the supported range, so a
 * malicious / corrupt `?portion=10000` cannot blow past 99.
 */
export function initialViewServings(input: {
  baseServings: number;
  portionParam?: number | null | undefined;
}): number {
  const base =
    typeof input.baseServings === "number" && Number.isFinite(input.baseServings) && input.baseServings > 0
      ? input.baseServings
      : RECIPE_VIEW_SERVINGS_MIN;
  if (
    typeof input.portionParam === "number" &&
    Number.isFinite(input.portionParam) &&
    input.portionParam > 0
  ) {
    return clampViewServings(base * input.portionParam);
  }
  return clampViewServings(base);
}
