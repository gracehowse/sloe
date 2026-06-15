/**
 * Detect mid-prep states and serving notes that must not become buyable ingredient rows.
 * Positive: "cornflour mixed with warm water", "cooked rice to serve (optional)".
 * Negative: "200g chicken breast", "cornflour", "2 tbsp soy sauce".
 */

const MIXED_WITH = /\bmixed with\b/i;
const COMBINED_WITH = /\b(combined|stirred|whisked|dissolved)\s+(with|in|into)\b/i;
const TO_SERVE_OPTIONAL = /\bto serve\b.*\boptional\b/i;
const TO_GARNISH = /\bto garnish\b/i;

/** Pure slurry/instruction lines with no standalone buyable noun after stripping clauses. */
export function isPrepStateOrServingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  if (MIXED_WITH.test(trimmed)) return true;
  if (COMBINED_WITH.test(trimmed)) return true;
  if (TO_GARNISH.test(trimmed)) return true;
  if (TO_SERVE_OPTIONAL.test(trimmed)) return true;

  // "cooked rice to serve (optional)" and similar serving-only rows.
  if (/\bto serve\b/i.test(trimmed) && /\boptional\b/i.test(trimmed)) return true;

  // Slurry with quantity prefix but no buyable standalone ingredient name.
  if (MIXED_WITH.test(trimmed.replace(/^[\d./\s]+(?:tsp|tbsp|cup|g|ml|oz|lb)?\s*/i, ""))) {
    return true;
  }

  return false;
}
