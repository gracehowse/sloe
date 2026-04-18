/**
 * Canonical meal-slot names.
 *
 * Single source of truth for slot literals (`"Breakfast"`, `"Lunch"`,
 * `"Dinner"`, `"Snacks"`) used across the whole product. Every
 * comparison against a slot name should go through `isMealSlot` or
 * `normaliseMealSlot` so a future rename (e.g. localisation) has one
 * place to land.
 *
 * Pure — no React, no Supabase, safe to import from anywhere.
 *
 * Design notes:
 *  - `"Snacks"` is canonical. Legacy writes used `"Snack"`; the
 *    normaliser maps the singular to the plural so pre-existing
 *    `nutrition_entries.meal` values keep working.
 *  - `normaliseMealSlot` is case-insensitive and trims whitespace —
 *    it accepts user-facing text (Siri transcripts, voice parse
 *    results) and returns the canonical casing, or `null` if the
 *    input is not a known slot.
 *  - UI rendering should keep the literal as-is (e.g. `"Breakfast"`
 *    in a header). Only comparison / routing sites swap to the
 *    helper — enforced by the L5 audit 2026-04-18.
 */

export const MEAL_SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

export type MealSlot = (typeof MEAL_SLOTS)[number];

/** Narrowing guard — true when `s` is one of the four canonical slot names. */
export function isMealSlot(s: unknown): s is MealSlot {
  return (
    typeof s === "string" &&
    (s === "Breakfast" || s === "Lunch" || s === "Dinner" || s === "Snacks")
  );
}

/**
 * Case-insensitive slot resolver. Trims whitespace. Maps the legacy
 * singular `"Snack"` to the canonical plural `"Snacks"`. Returns the
 * canonical-cased slot on match, `null` otherwise.
 *
 * Examples:
 *   normaliseMealSlot("breakfast")   // "Breakfast"
 *   normaliseMealSlot("  LUNCH  ")   // "Lunch"
 *   normaliseMealSlot("Snack")       // "Snacks"
 *   normaliseMealSlot("Dessert")     // null
 *   normaliseMealSlot(null)          // null
 */
export function normaliseMealSlot(raw: unknown): MealSlot | null {
  if (raw == null) return null;
  const lc = String(raw).trim().toLowerCase();
  if (!lc) return null;
  if (lc === "breakfast") return "Breakfast";
  if (lc === "lunch") return "Lunch";
  if (lc === "dinner") return "Dinner";
  if (lc === "snacks" || lc === "snack") return "Snacks";
  return null;
}
