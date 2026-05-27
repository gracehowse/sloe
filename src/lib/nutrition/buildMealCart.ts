/**
 * buildMealCart — pure logic for the log-sheet multi-item "build meal"
 * cart (ENG-757). Shared across web (`src/app/components/...`) and
 * mobile (`apps/mobile/components/...`) so the cart total + combined-
 * meal naming behave identically on both platforms.
 *
 * The cart is a transient, in-sheet construct: the user adds several
 * foods (search-tab only for v1, matching the prototype at
 * `docs/ux/claude-design-bundles/prototype/project/flows.jsx:4-194`),
 * then commits the whole cart as ONE combined `nutrition_entries` row.
 *
 * This module owns NO React state and NO persistence — it only knows
 * how to:
 *   - sum cart items (per-item macros × that item's servings), and
 *   - resolve the combined meal's title.
 *
 * The host components own the `cart` array (add / remove / clear) and
 * call the existing single-item commit path with the combined item.
 *
 * Feature-flag note: this logic only runs when the host has the
 * `log-sheet-build-meal-cart` flag enabled. When the flag is off the
 * cart never gets items, so `buildMealCartTotals([])` returning zeros
 * is the inert default.
 */

/**
 * A single item staged in the build-meal cart. Per-item macros are
 * the ALREADY-SCALED values for ONE serving of the chosen portion
 * (i.e. what the food-search preview displayed as "Nutrition" before
 * the user pressed "Add"). `servings` then multiplies that — so a
 * value of 2 means "two of the previewed portion".
 *
 * We deliberately store scaled-per-serving macros (not per-100g +
 * grams) so the cart total math is a trivial sum and never re-derives
 * nutrition — the food-search panel is the single place that scales
 * raw API macros, and the cart trusts that result.
 */
export interface BuildMealCartItem {
  /** Stable client-side id (e.g. `"c" + Date.now()`). */
  id: string;
  /** Display title (the food name as shown in search results). */
  title: string;
  /** Scaled kcal for ONE serving of the chosen portion. */
  kcal: number;
  /** Scaled protein (g) for ONE serving. */
  protein: number;
  /** Scaled carbs (g) for ONE serving. */
  carbs: number;
  /** Scaled fat (g) for ONE serving. */
  fat: number;
  /** Number of servings of the chosen portion (>= 0). */
  servings: number;
}

export interface BuildMealCartTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Sum the cart: each item contributes `macro × item.servings`. kcal is
 * rounded to a whole number; macros to one decimal — matching how the
 * single-item commit path rounds before insert, so a 1-item cart logs
 * an identical row to the pre-cart flow.
 *
 * Negative or NaN inputs are clamped to 0 (never invent nutrition, and
 * never let a malformed item poison the whole total). An empty cart
 * totals to all-zero.
 */
export function buildMealCartTotals(
  cart: readonly BuildMealCartItem[],
): BuildMealCartTotals {
  const acc = cart.reduce(
    (a, item) => {
      const servings = safeNumber(item.servings);
      return {
        kcal: a.kcal + safeNumber(item.kcal) * servings,
        protein: a.protein + safeNumber(item.protein) * servings,
        carbs: a.carbs + safeNumber(item.carbs) * servings,
        fat: a.fat + safeNumber(item.fat) * servings,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    kcal: Math.round(acc.kcal),
    protein: round1(acc.protein),
    carbs: round1(acc.carbs),
    fat: round1(acc.fat),
  };
}

/**
 * The kcal for a single cart item, rounded — used by the cart-summary
 * row in the UI ("Chicken breast · ×2 · 330 kcal"). Kept here so the
 * row math matches the total math exactly.
 */
export function cartItemKcal(item: BuildMealCartItem): number {
  return Math.round(safeNumber(item.kcal) * safeNumber(item.servings));
}

/**
 * Resolve the combined meal's title, in priority order:
 *   1. a non-blank user-typed meal name (trimmed), else
 *   2. for a single-item cart, that item's own title, else
 *   3. `"${N}-item meal"` for a multi-item cart.
 *
 * Matches the prototype's `logAll()` naming
 * (`flows.jsx:63`). An empty cart returns the typed name or "" — the
 * host must guard against committing an empty cart, so the empty-cart
 * branch is defensive only.
 */
export function resolveMealName(
  mealName: string,
  cart: readonly BuildMealCartItem[],
): string {
  const typed = mealName.trim();
  if (typed.length > 0) return typed;
  if (cart.length === 1) return cart[0].title;
  return `${cart.length}-item meal`;
}

function safeNumber(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
