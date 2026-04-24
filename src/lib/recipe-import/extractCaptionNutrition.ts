/**
 * Parse a social-post caption for per-serving nutrition claims made by the
 * creator — e.g. "210 kcal per serving", "9g protein", "~130 cal each".
 * Used on the Verify screen to flag when our ingredient-matched total
 * disagrees materially with what the creator said, so users know to
 * double-check the ingredient matches.
 *
 * Intentionally conservative:
 * - Only matches when the number is clearly per-serving / per-portion / each.
 * - Rejects ranges ("300-400 kcal") and total-batch numbers.
 * - Returns `null` for each field it can't extract confidently — a missing
 *   claim must never look like a zero claim.
 */
export type CaptionNutritionClaim = {
  caloriesPerServing: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

const PER_SERVING_HINT = /\b(per\s+serving|per\s+portion|per\s+meal|each|a\s+serving)\b/i;

function extractNumber(
  caption: string,
  unitPattern: RegExp,
): number | null {
  // Split on sentences / line breaks so we don't accidentally borrow a
  // per-serving hint from elsewhere in the caption.
  const segments = caption.split(/[\n\r.!?]+|(?:\s{2,})/g);
  for (const raw of segments) {
    const seg = raw.trim();
    if (!seg) continue;

    // Reject ranges in this segment — "300-400 kcal" is ambiguous.
    if (/\b\d+\s*[-–]\s*\d+\s*(?:kcal|cal|calorie|g|grams?)\b/i.test(seg)) continue;

    const numMatch = seg.match(unitPattern);
    if (!numMatch) continue;
    const n = Number.parseFloat(numMatch[1]!);
    if (!Number.isFinite(n) || n <= 0) continue;

    // Require a per-serving hint somewhere in the segment OR in the
    // caption overall if the number is accompanied by "each".
    if (!PER_SERVING_HINT.test(seg) && !PER_SERVING_HINT.test(caption)) continue;

    return n;
  }
  return null;
}

export function extractCaptionNutrition(caption: string | null | undefined): CaptionNutritionClaim {
  const empty: CaptionNutritionClaim = {
    caloriesPerServing: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  };
  if (!caption || typeof caption !== "string") return empty;
  const text = caption.replace(/\s+/g, " ").trim();
  if (!text) return empty;

  const caloriesPerServing = extractNumber(
    text,
    /(?:~|approx\.?\s*|around\s+)?(\d+(?:\.\d+)?)\s*(?:kcal|cal(?:orie)?s?)\b/i,
  );

  // Macros: accept "25g protein" or "protein: 25g".
  const protein =
    extractNumber(text, /(?:~|approx\.?\s*|around\s+)?(\d+(?:\.\d+)?)\s*g\s*(?:of\s+)?protein\b/i) ??
    extractNumber(text, /\bprotein[:\s]+(\d+(?:\.\d+)?)\s*g/i);
  const carbs =
    extractNumber(text, /(?:~|approx\.?\s*|around\s+)?(\d+(?:\.\d+)?)\s*g\s*(?:of\s+)?carbs?\b/i) ??
    extractNumber(text, /\bcarbs?[:\s]+(\d+(?:\.\d+)?)\s*g/i);
  const fat =
    extractNumber(text, /(?:~|approx\.?\s*|around\s+)?(\d+(?:\.\d+)?)\s*g\s*(?:of\s+)?fat\b/i) ??
    extractNumber(text, /\bfat[:\s]+(\d+(?:\.\d+)?)\s*g/i);

  return {
    caloriesPerServing,
    proteinG: protein,
    carbsG: carbs,
    fatG: fat,
  };
}

export type NutritionDelta = {
  /** Absolute calorie delta between creator claim and calculated total. */
  caloriesDelta: number | null;
  /** Signed percent delta (positive = we're over, negative = under). */
  caloriesPercent: number | null;
  /**
   * True when the calculated per-serving calories diverge from the caption
   * claim by more than 25% — a threshold that tolerates brand variation
   * (double cream vs single, salted vs unsalted butter, etc.) while
   * flagging obviously-wrong matches (silken → firm tofu, missing
   * ingredient, or "X or Y" compound mismatch).
   */
  materiallyDiverges: boolean;
};

export const MATERIAL_DIVERGENCE_THRESHOLD = 0.25;

export function nutritionDelta(
  claim: CaptionNutritionClaim,
  calculatedCaloriesPerServing: number,
): NutritionDelta {
  const claimed = claim.caloriesPerServing;
  if (
    claimed == null ||
    !Number.isFinite(claimed) ||
    claimed <= 0 ||
    !Number.isFinite(calculatedCaloriesPerServing) ||
    calculatedCaloriesPerServing <= 0
  ) {
    return { caloriesDelta: null, caloriesPercent: null, materiallyDiverges: false };
  }
  const delta = calculatedCaloriesPerServing - claimed;
  const pct = delta / claimed;
  return {
    caloriesDelta: Math.round(delta),
    caloriesPercent: Math.round(pct * 100) / 100,
    materiallyDiverges: Math.abs(pct) > MATERIAL_DIVERGENCE_THRESHOLD,
  };
}
