/**
 * Canonical dietary tags stored in `profiles.dietary` (JSON string array).
 * Web onboarding, mobile onboarding, and recipe tagging must use the same ids.
 */
export const DIETARY_PREFERENCE_ENTRIES = [
  { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "pescatarian", label: "Pescatarian" },
  { id: "gluten-free", label: "Gluten-free" },
  { id: "dairy-free", label: "Dairy-free" },
  { id: "nut-free", label: "Nut-free" },
  { id: "halal", label: "Halal" },
  { id: "kosher", label: "Kosher" },
] as const;

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
