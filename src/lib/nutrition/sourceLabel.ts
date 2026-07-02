/**
 * sourceLabel — human display names for nutrition-data source ids.
 *
 * e2e walk 2026-06-10 (Grace report follow-up): the meal-nutrition
 * surfaces rendered raw snake_case source ids in user-facing copy
 * ("3 of 35 fields published by apple_health", "Breakfast · 19:37 ·
 * apple_health"). Raw identifiers never belong in UI; unknown ids
 * fall back to de-snaked title case so a new source can't regress
 * this without at worst reading as plain English.
 *
 * Pure module — no React, no I/O. Shared by mobile
 * `app/meal-nutrition.tsx` and web `meal-nutrition-dialog.tsx`.
 */

const SOURCE_DISPLAY: Record<string, string> = {
  apple_health: "Apple Health",
  healthkit: "Apple Health",
  fatsecret: "FatSecret",
  open_food_facts: "Open Food Facts",
  off: "Open Food Facts",
  myfitnesspal: "MyFitnessPal",
  mfp: "MyFitnessPal",
  manual: "manual entry",
  user: "manual entry",
  barcode: "barcode scan",
  recipe: "your recipe",
  ai: "AI estimate",
  photo: "photo log",
  photo_correction: "photo log",
  voice: "voice log",
  // ENG-1298 — "Suppr" is the canonical DB/verify-pipeline value for our own
  // food database (pinned by the nutrition_entries CHECK constraint, so the
  // stored value must NOT be renamed); the live brand is Sloe, remapped here
  // at the display boundary — same pattern as recipes/displayAttribution.
  suppr: "Sloe",
  // The verify pipeline emits ALL-CAPS "USDA"; the de-snake fallback would
  // render it as "Usda". Pin the correct casing for both USDA ids.
  usda: "USDA",
  "usda fooddata central": "USDA FoodData Central",
};

/**
 * Display name for a nutrition source id. Returns null for null/empty
 * input so callers keep their own "the data source" style fallbacks.
 */
export function formatNutritionSourceLabel(
  source: string | null | undefined,
): string | null {
  const key = (source ?? "").trim().toLowerCase();
  if (!key) return null;
  const known = SOURCE_DISPLAY[key];
  if (known) return known;
  // Unknown id — de-snake + title-case (e.g. "some_new_source" →
  // "Some New Source") so raw identifiers never reach the UI.
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
