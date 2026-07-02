/**
 * Path B (T19, 2026-04-25) — FatSecret Basic-tier compliance.
 *
 * The FatSecret Platform API Basic-tier ToS prohibits caching macro
 * values. Decision doc:
 *   docs/decisions/2026-04-25-fatsecret-tier-confirmation.md
 *
 * Suppr's account is Basic. The historical write-path cached macros in
 * `recipe_ingredients.{calories,protein,carbs,fat,fiber_g,sugar_g,sodium_mg}`
 * and `recipes.{same}` whenever the verify pipeline matched against
 * FatSecret. The 20260503100900 migration zeroed those existing rows.
 *
 * To prevent the violation reappearing on the next save, every code
 * path that persists verify-pipeline output to those tables must run
 * the row through {@link scrubFatSecretMacros} first. The function:
 *
 *   - Leaves rows with any non-FatSecret source untouched (USDA, OFF,
 *     Edamam, Estimated, etc. are all permitted to be cached).
 *   - For FatSecret rows: zeroes every macro field, marks the row as
 *     `is_verified = false`, and rewrites `source` to `'Unverified'`.
 *   - **Keeps `fatsecret_food_id`** — that is the permitted reference
 *     pointer; only the co-stored macros are the violation.
 *
 * The recipe-detail render path then sees `fatsecret_food_id is not
 * null && is_verified = false` and triggers a runtime re-fetch via
 * `/api/nutrition/verify-recipe`. The fetched macros render in-memory
 * but are never written back.
 *
 * Aggregate scrub for the `recipes` table: if any ingredient row in a
 * given recipe was FatSecret-sourced, the recipe-level aggregate is
 * also a cache of FatSecret data and must not be persisted. Use
 * {@link shouldZeroRecipeAggregate} to decide whether the aggregate
 * write should be replaced with zeros.
 */

export type ScrubableRow = {
  /** Verify-pipeline label; FatSecret matches arrive as exactly this string. */
  source?: string | null;
  /** When set, identifies the FatSecret food this row was matched to. Always preserved. */
  fatsecret_food_id?: string | null;
  /** Macro fields. All set to 0 when the row's source is FatSecret. */
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  /** Verification flag. Set false when scrubbed. */
  is_verified?: boolean | null;
  /** Confidence travels with the source label and is dropped on scrub. */
  confidence?: number | null;
  /**
   * ENG-1299 — optional micronutrient panels. The micros map is FatSecret
   * data exactly like the macro columns, so both spellings are cleared on
   * scrub (in-memory rows use `micros`; DB payloads use `nutrition_micros`).
   * Only keys already present on the row are rewritten, so a scrubbed DB
   * payload never gains a column it didn't carry.
   */
  micros?: Record<string, number> | null;
  nutrition_micros?: Record<string, number> | null;
  /** Permit other columns through unchanged. */
  [extra: string]: unknown;
};

/** Source label persisted to recipe_ingredients.source after scrub. */
export const SCRUBBED_SOURCE_LABEL = "Unverified" as const;

/** Source labels we treat as FatSecret-cached and therefore must scrub. */
const FATSECRET_LABELS = new Set<string>(["FatSecret", "fatsecret"]);

/**
 * True if the row was sourced from FatSecret and therefore cannot have
 * its macros persisted under Basic-tier ToS.
 */
export function isFatSecretSourced(row: ScrubableRow): boolean {
  if (typeof row.source === "string" && FATSECRET_LABELS.has(row.source)) return true;
  // Defensive: a row could legitimately keep a `fatsecret_food_id`
  // pointer even after the macros have been re-verified against
  // another source (e.g. user manually overrode). In that case the
  // current `source` is the truth — only treat as FS-cached when the
  // source label still says FatSecret.
  return false;
}

/**
 * Returns a row safe to persist to recipe_ingredients. FatSecret-sourced
 * rows have macros zeroed + is_verified false + source rewritten;
 * everything else passes through.
 */
export function scrubFatSecretMacros<T extends ScrubableRow>(row: T): T {
  if (!isFatSecretSourced(row)) return row;
  const scrubbed: T = {
    ...row,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 0,
    is_verified: false,
    source: SCRUBBED_SOURCE_LABEL,
    confidence: null,
  };
  // ENG-1299 — clear the micros panel too (same FatSecret-cached data class
  // as the macro columns). Only rewrite keys the row already carries so DB
  // update payloads never gain a column they didn't have.
  if ("micros" in row) (scrubbed as ScrubableRow).micros = undefined;
  if ("nutrition_micros" in row) (scrubbed as ScrubableRow).nutrition_micros = {};
  return scrubbed;
}

/**
 * Apply {@link scrubFatSecretMacros} to a list of rows.
 */
export function scrubFatSecretRows<T extends ScrubableRow>(rows: T[]): T[] {
  return rows.map(scrubFatSecretMacros);
}

/**
 * True when at least one row in a verify-pipeline result was sourced
 * from FatSecret. The recipe-aggregate write must zero its macros in
 * that case — even if other rows came from USDA, the aggregate is a
 * mixed cache that includes FatSecret data and is therefore prohibited.
 */
export function recipeAggregateHasFatSecret(rows: ScrubableRow[]): boolean {
  return rows.some(isFatSecretSourced);
}

/**
 * Replacement aggregate columns when {@link recipeAggregateHasFatSecret}
 * returns true. Use this when writing the parent `recipes` nutrition totals.
 * Recipe-level trust metadata is server-owned (ENG-1244) and intentionally
 * omitted from this client-side aggregate scrub.
 */
export const ZEROED_RECIPE_AGGREGATE = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber_g: 0,
  sugar_g: 0,
  sodium_mg: 0,
} as const;
