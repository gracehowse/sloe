/**
 * Canonical dietary tags stored in `profiles.dietary` (JSON string array).
 * Web onboarding, mobile onboarding, and recipe tagging must use the same ids.
 *
 * Two categories live here:
 *  - Lifestyle preferences (vegetarian, vegan, halal …) — user choice,
 *    not safety-critical.
 *  - Regulated-allergen avoidances ("peanut-free" …) — safety-critical,
 *    added 2026-04-24 (T12) to close DI-P0-01. The allergen-avoidance
 *    slug maps to the corresponding `RegulatedAllergenId` in
 *    `src/constants/regulatedAllergens.ts` (e.g. `peanut-free` avoids
 *    `peanuts`). `nut-free` is kept as a back-compat umbrella; new
 *    installs should pick `peanut-free` + `tree-nut-free` distinctly.
 */
export const DIETARY_PREFERENCE_ENTRIES = [
  // Lifestyle
  { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "pescatarian", label: "Pescatarian" },
  { id: "halal", label: "Halal" },
  { id: "kosher", label: "Kosher" },
  { id: "jain", label: "Jain" },
  { id: "hindu-veg", label: "Hindu vegetarian" },
  // Allergen-adjacent / dietary restriction (legacy aliases kept).
  // The `gluten-free` slug stays as an internal filter flag, but the
  // user-facing label uses descriptive ingredient-composition language:
  // "Gluten-free" is a regulated claim under EU/UK Reg 828/2014 (≤20 ppm
  // verification required). Computed-from-ingredients chips can't meet
  // that standard — see docs/decisions/2026-04-27-onboarding-seed-copyright-review.md §D.
  { id: "gluten-free", label: "No gluten-containing ingredients" },
  { id: "dairy-free", label: "Dairy-free" },
  { id: "nut-free", label: "Nut-free" },
  // T12 (2026-04-24) — 14 regulated allergens, explicit avoidances
  { id: "peanut-free", label: "Peanut-free" },
  { id: "tree-nut-free", label: "Tree nut-free" },
  { id: "egg-free", label: "Egg-free" },
  { id: "fish-free", label: "Fish-free" },
  { id: "shellfish-free", label: "Shellfish-free" },
  { id: "soy-free", label: "Soy-free" },
  { id: "wheat-free", label: "Wheat-free" },
  { id: "sesame-free", label: "Sesame-free" },
  { id: "mustard-free", label: "Mustard-free" },
  { id: "celery-free", label: "Celery-free" },
  { id: "sulfite-free", label: "Sulfite-free" },
  { id: "lupin-free", label: "Lupin-free" },
] as const;

/**
 * Map a dietary-preference id to the regulated-allergen id(s) it avoids.
 * Returns `null` for lifestyle preferences (vegetarian / halal / etc.)
 * that don't map to a single allergen. Used by recipe-filter logic so a
 * user with `peanut-free` set can have recipes tagged `peanuts` hidden
 * or warned on.
 */
export const DIETARY_TO_ALLERGEN_MAP: Readonly<Record<string, readonly string[]>> = {
  "peanut-free": ["peanuts"],
  "tree-nut-free": ["tree_nuts"],
  "nut-free": ["peanuts", "tree_nuts"],
  "egg-free": ["eggs"],
  "fish-free": ["fish"],
  "shellfish-free": ["crustaceans", "molluscs"],
  "soy-free": ["soy"],
  "wheat-free": ["wheat"],
  "dairy-free": ["milk"],
  "sesame-free": ["sesame"],
  "mustard-free": ["mustard"],
  "celery-free": ["celery"],
  "sulfite-free": ["sulfites"],
  "lupin-free": ["lupin"],
} as const;

export type DietaryPreferenceId = (typeof DIETARY_PREFERENCE_ENTRIES)[number]["id"];

const ALLOWED = new Set<string>(DIETARY_PREFERENCE_ENTRIES.map((e) => e.id));

/** Normalise `profiles.dietary` JSON to known ids only (drops unknown strings). */
export function normaliseDietaryFromProfile(raw: unknown): DietaryPreferenceId[] {
  if (!Array.isArray(raw)) return [];
  const out: DietaryPreferenceId[] = [];
  for (const x of raw) {
    if (typeof x === "string" && ALLOWED.has(x)) {
      out.push(x as DietaryPreferenceId);
    }
  }
  return out;
}
