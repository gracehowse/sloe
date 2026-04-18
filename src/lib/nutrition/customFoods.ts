/**
 * Custom foods — pure helpers (Batch 3.9).
 *
 * Used by both web and mobile so scaling / normalisation can never
 * drift between platforms. No React, no I/O — this file must remain
 * trivially unit-testable.
 *
 * Concepts:
 *  - A `CustomFood` stores macros per `baseGrams` (default 100). To log
 *    a portion, the caller picks either direct grams or a named serving
 *    (e.g. "1 bowl = 80g") × a quantity.
 *  - Scaling is strictly linear. If `baseGrams` is missing or ≤ 0 we
 *    return zeros rather than invent a divisor — this follows the
 *    project rule of never minting nutrition values.
 *  - Servings are de-duped case-insensitively before persistence so a
 *    user cannot save both "1 bowl" and "1 Bowl" with conflicting gram
 *    weights.
 */

/** One named serving shortcut, e.g. `{ label: "1 bowl", grams: 80 }`. */
export type CustomFoodServing = {
  label: string;
  grams: number;
};

/** One row of `public.user_custom_foods` in client-friendly shape. */
export type CustomFood = {
  id: string;
  userId: string;
  name: string;
  brand?: string;
  /** Grams the macros below are defined for. Default 100 (nutrition-label convention). */
  baseGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Optional: homemade items often genuinely lack a fiber value. */
  fiber?: number;
  servings: CustomFoodServing[];
  createdAt: string;
  updatedAt: string;
};

/** Macros per-portion, optionally including fiber. Mirrors how every
 * other scaler in `src/lib/nutrition/*` returns data. */
export type ScaledCustomMacros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
};

/** Portion selector shape for `resolvePortionToGrams`. Discriminated
 * union so TS can enforce the right fields at call sites. */
export type CustomFoodPortion =
  | { type: "grams"; grams: number }
  | { type: "serving"; label: string; quantity: number };

/** Shape used by the food-search portion picker on both platforms. Kept
 * loose (no `readonly`) to stay compatible with USDA/OFF portions which
 * are constructed as plain objects. */
export type CustomFoodPortionChip = {
  label: string;
  gramWeight: number;
  amount: number;
};

/** Macros-per-100g shape shared with the food-search UI. Mirrors
 * `src/app/components/FoodSearch.tsx` and `apps/mobile/lib/verifyRecipe.ts`
 * exactly so a custom food can slot into either panel without branching. */
export type CustomFoodMacrosPer100g = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
};

/** Maximum length of a custom-food name. Matches the DB CHECK. */
export const CUSTOM_FOOD_NAME_MAX = 120;

function safeNumber(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function safeNonNegative(n: unknown): number {
  const v = safeNumber(n);
  return v >= 0 ? v : 0;
}

function roundTo(n: number, decimals: number): number {
  const m = Math.pow(10, decimals);
  return Math.round(n * m) / m;
}

/**
 * Scale a custom food's macros linearly to the given gram weight.
 *
 * Defensive: if `grams` is zero / negative / non-finite, returns zeros
 * (never NaN, never negative). Same if `baseGrams` is missing or ≤ 0
 * — we refuse to invent a divisor.
 *
 * Fiber is echoed only when the input food has a numeric `fiber`; we
 * do not backfill a fiber value from "close enough" heuristics.
 */
export function scaleMacrosForGrams(
  food: Pick<CustomFood, "baseGrams" | "calories" | "protein" | "carbs" | "fat" | "fiber">,
  grams: number,
): ScaledCustomMacros {
  const base = safeNumber(food.baseGrams);
  const g = safeNumber(grams);
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(g) || g <= 0) {
    const out: ScaledCustomMacros = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    if (typeof food.fiber === "number" && Number.isFinite(food.fiber)) out.fiber = 0;
    return out;
  }
  const factor = g / base;
  const out: ScaledCustomMacros = {
    calories: Math.round(safeNonNegative(food.calories) * factor),
    protein: roundTo(safeNonNegative(food.protein) * factor, 1),
    carbs: roundTo(safeNonNegative(food.carbs) * factor, 1),
    fat: roundTo(safeNonNegative(food.fat) * factor, 1),
  };
  if (typeof food.fiber === "number" && Number.isFinite(food.fiber)) {
    out.fiber = roundTo(safeNonNegative(food.fiber) * factor, 1);
  }
  return out;
}

/**
 * Resolve a portion selection to a gram weight.
 *
 * `{ type: "grams" }` returns the grams directly (clamped ≥ 0).
 * `{ type: "serving" }` looks up the named serving case-insensitively
 * and returns `grams × quantity`.
 *
 * Throws when `type === "serving"` and the label is not in the food's
 * saved servings. The UI is responsible for only exposing labels the
 * food actually has — but we throw rather than silently fall back to 0
 * so a stale UI can never log 0 kcal by mistake.
 */
export function resolvePortionToGrams(
  food: Pick<CustomFood, "servings">,
  portion: CustomFoodPortion,
): number {
  if (portion.type === "grams") {
    const g = safeNumber(portion.grams);
    return g > 0 ? g : 0;
  }
  const wantedLabel = String(portion.label ?? "").trim().toLowerCase();
  if (!wantedLabel) {
    throw new Error("resolvePortionToGrams: serving label is required");
  }
  const match = (food.servings ?? []).find(
    (s) => String(s.label ?? "").trim().toLowerCase() === wantedLabel,
  );
  if (!match) {
    throw new Error(`resolvePortionToGrams: unknown serving label "${portion.label}"`);
  }
  const grams = safeNumber(match.grams);
  const qty = safeNumber(portion.quantity);
  const q = qty > 0 ? qty : 0;
  if (grams <= 0) return 0;
  return grams * q;
}

/**
 * Normalise a custom-food name for display + dedupe: trim, collapse
 * internal whitespace to single spaces, and cap at `CUSTOM_FOOD_NAME_MAX`
 * characters. Returns an empty string for non-string input.
 */
export function normaliseCustomFoodName(name: string): string {
  if (typeof name !== "string") return "";
  const collapsed = name.replace(/\s+/g, " ").trim();
  if (collapsed.length <= CUSTOM_FOOD_NAME_MAX) return collapsed;
  return collapsed.slice(0, CUSTOM_FOOD_NAME_MAX).trim();
}

/**
 * Project a custom food's macros onto a per-100g basis so the food-search
 * portion picker — which uniformly reasons in `per100g × grams / 100` —
 * can scale it using the same `scaleMacros` path as USDA/OFF results.
 *
 * Defensive: if `baseGrams` is non-finite or ≤ 0 we fall back to 100 so
 * the caller never divides by zero. Fiber is echoed as `0` (not omitted)
 * when the food has no fiber value so downstream code can rely on the
 * shape. `sugarG` / `sodiumMg` are always zero — custom foods don't
 * collect them. Math deliberately mirrors `scaleMacrosForGrams`
 * rounding so scaled custom foods and edit-preview output agree to the
 * byte.
 */
export function customFoodToMacrosPer100g(
  food: Pick<CustomFood, "baseGrams" | "calories" | "protein" | "carbs" | "fat" | "fiber">,
): CustomFoodMacrosPer100g {
  const baseRaw = safeNumber(food.baseGrams);
  const base = Number.isFinite(baseRaw) && baseRaw > 0 ? baseRaw : 100;
  const factor = 100 / base;
  return {
    calories: Math.round(safeNonNegative(food.calories) * factor),
    protein: roundTo(safeNonNegative(food.protein) * factor, 1),
    carbs: roundTo(safeNonNegative(food.carbs) * factor, 1),
    fat: roundTo(safeNonNegative(food.fat) * factor, 1),
    fiberG: typeof food.fiber === "number" && Number.isFinite(food.fiber)
      ? roundTo(safeNonNegative(food.fiber) * factor, 1)
      : 0,
    sugarG: 0,
    sodiumMg: 0,
  };
}

/**
 * Build the portion-chip list for a custom food: always grams first,
 * then one chip per saved serving with `gramWeight` == saved grams.
 * Invalid entries (empty label, non-finite or ≤ 0 grams) are silently
 * dropped so a half-saved row never renders a 0 g chip.
 *
 * Runs `dedupeServings` first so the returned list already respects
 * case-insensitive label uniqueness.
 */
export function buildCustomFoodPortions(
  food: Pick<CustomFood, "servings">,
): CustomFoodPortionChip[] {
  const portions: CustomFoodPortionChip[] = [{ label: "g", gramWeight: 1, amount: 1 }];
  const servings = dedupeServings(food.servings ?? []);
  for (const s of servings) {
    portions.push({ label: s.label, gramWeight: s.grams, amount: 1 });
  }
  return portions;
}

/**
 * De-duplicate a list of serving rows:
 *  - trims labels and collapses internal whitespace
 *  - drops rows with empty labels or `grams <= 0`
 *  - dedupes case-insensitively; first occurrence wins
 *
 * Returns a fresh array; never mutates the input.
 */
export function dedupeServings(servings: CustomFoodServing[]): CustomFoodServing[] {
  if (!Array.isArray(servings)) return [];
  const seen = new Set<string>();
  const out: CustomFoodServing[] = [];
  for (const raw of servings) {
    if (!raw || typeof raw !== "object") continue;
    const label = String(raw.label ?? "").replace(/\s+/g, " ").trim();
    const grams = safeNumber(raw.grams);
    if (!label || grams <= 0) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, grams: roundTo(grams, 2) });
  }
  return out;
}
