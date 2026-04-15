/**
 * Normalize food search text: "220 g rolled oats" / "220g rolled oats" → "rolled oats"
 * so USDA/OFF queries match the food name, not the recipe quantity.
 * Does not strip bare counts ("2 apples") — only number + recognized measure unit.
 */

const MEASURE_UNIT =
  "g|grams?|kg|kilograms?|mg|ml|m[Ll]|liters?|oz|ounces?|lb|lbs|pounds?|cups?|tablespoons?|tbsp|teaspoons?|tsp|quarts?|qt|fl\\.?\\s*oz";

/** Remove one leading quantity+unit prefix (e.g. "220 g ", "220g "). */
function stripOneLeadingMeasure(s: string): string {
  const spaced = new RegExp(`^\\s*\\d+(?:\\.\\d+)?\\s*(?:${MEASURE_UNIT})\\b\\s*`, "i");
  const glued = new RegExp(`^\\s*\\d+(?:\\.\\d+)?(?:g|kg|mg|ml|m[Ll]|oz|lb)\\b\\s*`, "i");
  return s.replace(spaced, "").replace(glued, "").trim();
}

export function stripLeadingMeasureFromFoodQuery(raw: string): string {
  let q = raw.trim();
  if (!q) return q;
  for (let i = 0; i < 6; i++) {
    const next = stripOneLeadingMeasure(q);
    if (next === q) break;
    q = next;
  }
  return q;
}

/** Use stripped text for search when it still looks like a food name; otherwise keep original. */
export function effectiveFoodSearchQuery(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  const stripped = stripLeadingMeasureFromFoodQuery(t);
  return stripped.length >= 2 ? stripped : t;
}
