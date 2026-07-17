/**
 * ENG-1532 — unified search-result row sub-line (component grammar dedup).
 *
 * Fable ruling 2026-07-16 (Linear ENG-1532, comment 8e1b9d71): the food
 * search panel renders ONE row grammar across its history-style groups
 * (Favourites / Past logged) and the database results (Best matches / More
 * results). The database rows' big right-aligned KCAL display numeral dies —
 * it invited misreading per-100g values as per-serving — and the macro
 * sub-line becomes the canonical kcal-LEADS / basis-TRAILS shape:
 *
 *   `450 kcal · 20g P · 0g C · 40g F · per 100g · USDA`
 *
 *   - kcal + macros come from the shared `formatMacroTrailer` (the same
 *     formatter the Past-logged / Favourites rows already render), so the
 *     groups cannot drift apart again.
 *   - the serving basis TRAILS the macros (`per 100g`, or
 *     `per 1 sandwich (230 g)` when the source supplied a natural portion)
 *     so a per-100g row can never be skimmed as per-serving.
 *   - the optional trailing source name keeps the ENG-1464 source-name-first
 *     trust signal inline in the row (web already rendered it; mobile joins
 *     for parity). The Verified/Estimated tier chip stays on the title line —
 *     this helper only owns the sub-line string.
 *
 * Pure + shared (web `@/lib/nutrition/...`, mobile
 * `@suppr/nutrition-core/...`) so both platforms render byte-identical
 * sub-lines and the unit tests can pin the shape once.
 */

import { formatMacroTrailer } from "./macroFormat";
import {
  FOOD_SEARCH_PER_100G_BADGE,
  type FoodSearchHeadline,
} from "./foodSearchHeadline";

/**
 * Build the unified row sub-line for a resolved search-row headline.
 *
 * Returns `null` for `placeholder` headlines (no nutrition data yet) — the
 * caller renders its "Tap for nutrition info" copy in that case.
 */
export function formatFoodSearchRowSubline(
  headline: FoodSearchHeadline,
  sourceLabel?: string | null,
): string | null {
  if (headline.mode === "placeholder") return null;

  const parts: string[] = [];
  if (headline.mode === "per-serving") {
    parts.push(
      formatMacroTrailer({
        calories: headline.headlineKcal,
        protein: headline.macros.protein,
        carbs: headline.macros.carbs,
        fat: headline.macros.fat,
      }),
    );
    parts.push(`per ${headline.servingLabel}`);
  } else if (headline.macros) {
    parts.push(
      formatMacroTrailer({
        calories: headline.headlineKcal,
        protein: headline.macros.protein,
        carbs: headline.macros.carbs,
        fat: headline.macros.fat,
      }),
    );
    parts.push(FOOD_SEARCH_PER_100G_BADGE);
  } else {
    // kcal-only rows (e.g. USDA pre-backfill) — no macros to lead with,
    // but the basis still trails so the value can't be misread.
    parts.push(`${Math.round(headline.headlineKcal)} kcal`);
    parts.push(FOOD_SEARCH_PER_100G_BADGE);
  }
  if (sourceLabel) parts.push(sourceLabel);
  return parts.join(" · ");
}
