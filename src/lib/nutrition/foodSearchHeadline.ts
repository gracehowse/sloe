/**
 * Food-search row headline resolution.
 *
 * TestFlight build 11 feedback (2026-04-19):
 *   - `AKvgjnb` ("Everything defaults to 100g rather than showing actual
 *     portion sizes")
 *   - `APGJJlg` ("Lots of foods still defaulting to 100g")
 *
 * Follow-on to `APo0qS9vcFvmBJEJJ_-61YA` (see
 * `src/lib/nutrition/primaryServing.ts`): the inference was already
 * picking the natural portion for Edamam + USDA Branded + OFF hits, but
 * the search row copy still read "per 100g" under the macros and the
 * subline still carried the per-100g reference alongside the serving
 * label. Testers read that as "everything still defaults to 100g".
 *
 * This helper is the single source of truth for what the row should
 * render in each of the two paths — per-serving (when the source supplied
 * a natural portion via `primaryServing`) and per-100g fallback (when it
 * didn't). Kept pure so web + mobile produce byte-identical copy and the
 * unit tests can pin the decision table.
 *
 * Rules:
 *   - `primary` present  → headline kcal = `primary.kcal`,
 *                          macros       = `primary.protein|carbs|fat`,
 *                          badge        = "per serving",
 *                          subLabel     = "{primary.label} ({grams} g)"
 *                                         (+ optional "· N kcal / 100 g"
 *                                            reference when `per100gKcal`
 *                                            is a real number > 0)
 *   - `primary` absent, `macrosPer100g` present
 *                       → headline kcal = `macrosPer100g.calories`,
 *                          macros       = the per-100g values,
 *                          badge        = "per 100g",
 *                          subLabel     = null
 *   - `primary` absent, `calsPer100g` > 0 only
 *                       → headline kcal = `calsPer100g`,
 *                          macros       = null (caller renders kcal only),
 *                          badge        = "per 100g",
 *                          subLabel     = null
 *   - neither            → mode: "placeholder" → caller shows
 *                          "Tap for nutrition info".
 *
 * The "per serving" badge text is locked here so the structural parity
 * test (see `apps/mobile/tests/unit/foodSearchPrimaryServingParity.test.ts`)
 * can assert both surfaces render the same string.
 */

import type { PrimaryServing } from "./primaryServing";

/**
 * Round macros to 1dp for the search-row preview strip. USDA Branded
 * and Edamam often ship per-100g macros as raw floats (e.g.
 * `7.967347722423224`); the search row renders them as
 * `P {n}g`, so without rounding the row reads "P 7.967347722423224g".
 * 1dp matches the food-card standard (see microNutrientDisplay.ts).
 */
function round1(n: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

export type FoodSearchMacroPreview = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type FoodSearchHeadline =
  | {
      mode: "per-serving";
      /** Big kcal number on the right rail. */
      headlineKcal: number;
      /** Macros rendered in the small P/C/F strip. */
      macros: FoodSearchMacroPreview;
      /** Badge text — always `"per serving"` in this branch. */
      badge: string;
      /** "1 sandwich (230 g)" — never null in this branch. */
      servingLabel: string;
      /** Optional "· 211 kcal / 100 g" reference appended after the label. */
      per100gReference: string | null;
    }
  | {
      mode: "per-100g";
      headlineKcal: number;
      /** Macros when the caller has the full per-100g block; else null. */
      macros: FoodSearchMacroPreview | null;
      /** Badge text — always `"per 100g"` in this branch. */
      badge: string;
    }
  | {
      mode: "placeholder";
    };

/**
 * Per-100g macro block the helper accepts. Matches the subset the search
 * row actually reads (calories + P/C/F), so callers can pass either the
 * widened mobile `Macros` type or the narrow helper shape from tests
 * without adapting.
 */
export type FoodSearchPer100g = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** Inputs the two platforms read from a `SearchRow` / `SearchResult`. */
export type FoodSearchHeadlineInput = {
  primaryServing?: PrimaryServing | null;
  macrosPer100g?: FoodSearchPer100g | null;
  /** Some rows (USDA pre-backfill) only carry kcal. */
  calsPer100g?: number | null;
};

export const FOOD_SEARCH_PER_SERVING_BADGE = "per serving";
export const FOOD_SEARCH_PER_100G_BADGE = "per 100g";

/**
 * Pick the headline shape for a single search row. Pure; no allocations
 * beyond the returned object.
 */
export function resolveFoodSearchHeadline(
  row: FoodSearchHeadlineInput,
): FoodSearchHeadline {
  const primary = row.primaryServing ?? null;
  if (primary) {
    const per100gKcal =
      typeof row.calsPer100g === "number" && Number.isFinite(row.calsPer100g) && row.calsPer100g > 0
        ? Math.round(row.calsPer100g)
        : typeof row.macrosPer100g?.calories === "number" &&
            Number.isFinite(row.macrosPer100g.calories) &&
            row.macrosPer100g.calories > 0
          ? Math.round(row.macrosPer100g.calories)
          : null;
    // 2026-05-06: `grams === 0` is the sentinel for per-serving-only
    // foods (FatSecret no-metric path, e.g. McDonald's Big Mac).
    // Render just the label without a "(0 g)" suffix, and skip the
    // "/ 100 g" reference since there's no per-100g basis.
    const isPerServingOnly = primary.grams <= 0;
    const servingLabel = isPerServingOnly
      ? primary.label
      : `${primary.label} (${primary.grams} g)`;
    return {
      mode: "per-serving",
      headlineKcal: primary.kcal,
      macros: {
        calories: primary.kcal,
        protein: round1(primary.protein),
        carbs: round1(primary.carbs),
        fat: round1(primary.fat),
      },
      badge: FOOD_SEARCH_PER_SERVING_BADGE,
      servingLabel,
      per100gReference:
        !isPerServingOnly && per100gKcal != null
          ? `${per100gKcal} kcal / 100 g`
          : null,
    };
  }

  const m = row.macrosPer100g;
  const hasFullMacros =
    !!m &&
    typeof m.calories === "number" &&
    Number.isFinite(m.calories) &&
    m.calories > 0;
  if (hasFullMacros) {
    return {
      mode: "per-100g",
      headlineKcal: Math.round(m!.calories),
      macros: {
        calories: Math.round(m!.calories),
        protein: round1(m!.protein),
        carbs: round1(m!.carbs),
        fat: round1(m!.fat),
      },
      badge: FOOD_SEARCH_PER_100G_BADGE,
    };
  }

  const cals = row.calsPer100g;
  if (typeof cals === "number" && Number.isFinite(cals) && cals > 0) {
    return {
      mode: "per-100g",
      headlineKcal: Math.round(cals),
      macros: null,
      badge: FOOD_SEARCH_PER_100G_BADGE,
    };
  }

  return { mode: "placeholder" };
}
