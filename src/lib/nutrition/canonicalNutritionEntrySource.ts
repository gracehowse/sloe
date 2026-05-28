/**
 * Maps journal `source` strings to values allowed by
 * `nutrition_entries_source_canonical` (ENG-674).
 *
 * Historical rows may carry legacy labels; any new INSERT (including
 * copy-yesterday / duplicate-day clones) must pass through here.
 */

/** Keep in sync with `supabase/migrations/20260527200000_nutrition_entries_source_check.sql`. */
export const CANONICAL_NUTRITION_ENTRY_SOURCES = [
  "USDA FoodData Central",
  "USDA",
  "FatSecret",
  "Open Food Facts",
  "Open Food Facts (adjusted)",
  "Edamam",
  "manual",
  "custom",
  "custom_food",
  "Recipe",
  "Saved meal",
  "apple_health",
  "AI voice",
  "AI photo",
  "Suppr",
  "Estimated",
  "Unverified",
  "barcode",
] as const;

export type CanonicalNutritionEntrySource =
  (typeof CANONICAL_NUTRITION_ENTRY_SOURCES)[number];

const CANONICAL_SET = new Set<string>(CANONICAL_NUTRITION_ENTRY_SOURCES);

/**
 * Return a `nutrition_entries.source` value that satisfies the CHECK
 * constraint, or `null` when the input is empty.
 */
export function canonicalNutritionEntrySource(
  source: string | null | undefined,
): CanonicalNutritionEntrySource | null {
  if (source == null) return null;
  const trimmed = String(source).trim();
  if (!trimmed) return null;

  if (CANONICAL_SET.has(trimmed)) {
    return trimmed as CanonicalNutritionEntrySource;
  }

  const low = trimmed.toLowerCase();

  if (low === "manual" || low.includes("quick entry")) return "manual";
  if (low === "custom" || low === "custom food" || low === "custom_food") {
    return "custom_food";
  }
  if (low === "recipe" || low.includes("meal plan") || low === "planner" || low === "planned") {
    return "Recipe";
  }
  if (low === "saved meal" || low.includes("saved meal")) return "Saved meal";
  if (low.includes("usda fooddata central")) return "USDA FoodData Central";
  if (low === "usda" || low.startsWith("usda ")) return "USDA";
  if (low.includes("fatsecret")) return "FatSecret";
  if (low.includes("open food facts") && low.includes("adjusted")) {
    return "Open Food Facts (adjusted)";
  }
  if (low.includes("open food facts") || low === "off" || low.startsWith("off ")) {
    return "Open Food Facts";
  }
  if (low.includes("edamam")) return "Edamam";
  if (low === "ai voice" || low === "voice" || low === "ai_voice") return "AI voice";
  if (low === "ai photo" || low === "photo" || low === "ai_photo") return "AI photo";
  if (low.includes("apple health") || low === "apple_health" || low === "healthkit") {
    return "apple_health";
  }
  if (low === "barcode" || low.includes("barcode")) return "barcode";
  if (low === "plan_import" || low.includes("plan import")) return "Recipe";
  if (low === "suppr") return "Suppr";
  if (low === "estimated") return "Estimated";
  if (low === "unverified" || low === "site") return "Unverified";

  // CSV / diary imports: `mfp_import`, `lose-it_import`, etc.
  if (low.endsWith("_import") || low.includes("myfitnesspal") || low.includes("lose it")) {
    return "manual";
  }

  return "manual";
}
