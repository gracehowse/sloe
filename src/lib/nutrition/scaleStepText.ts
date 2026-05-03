/**
 * scaleStepText — multiply ingredient amounts inside a recipe step
 * string by a scaleFactor.
 *
 * Why this exists:
 *   When a user opens a recipe scaled to a different serving count
 *   (e.g. a 4-serving recipe scaled to 8 via the servings stepper),
 *   the step instructions still reference the original quantities
 *   ("Add 4 tbsp olive oil"). That's a real accuracy gap — the user
 *   pours 4 tbsp into a doubled batch and the dish is half-seasoned.
 *
 *   The recipe model stores instructions as free-text strings, not as
 *   structured (amount, unit, ingredient) tuples, so we can't re-render
 *   from a parsed shape. We do the next-best thing: a regex pass that
 *   matches plausible (number unit) pairs and multiplies the number
 *   in place.
 *
 * Scope (intentionally narrow):
 *   - Numeric prefixes only: integers, decimals (1.5), simple fractions
 *     (1/2), and mixed numbers (1 1/2). No "a quarter cup" or "half a
 *     teaspoon" — those would need a true NLP pass.
 *   - Units must be on a known cooking-unit allowlist. Anything else
 *     ("4 minutes", "350 °F", "Step 4") is left alone — multiplying
 *     temperatures or step counts would be a worse bug than not
 *     scaling them.
 *   - Output is a plain decimal (rounded to two places, trailing zeros
 *     stripped) for ease of parsing back. We don't try to reconstruct
 *     pretty fractions ("1/2" → "1.00"); pretty-printing is a
 *     downstream concern if it ever matters.
 *
 * Cross-platform contract:
 *   Used by `apps/mobile/app/recipe/[id].tsx` (inline cook-mode modal)
 *   and `src/app/components/CookMode.tsx` (web cook overlay). Same
 *   helper, same regex, same output — parity by construction.
 */

// Multi-character units only — single letters like "c" / "l" / "g" /
// "F" / "C" are too easy to collide with temperature ("350 F"), step
// numbers ("Step 4"), or letter abbreviations. We accept that as a
// trade-off: "1 g salt" with no further qualifier is rare in real
// recipes and "1 gram salt" still scales. False-positive on temperature
// ("180 C" → "360 C") is a worse bug than missing the occasional
// single-letter abbreviation.
const UNIT_ALTERNATION = [
  // Volume
  "tablespoons?", "tbsps?", "tbsp", "tbs", "tbl",
  "teaspoons?", "tsps?", "tsp",
  "cups?",
  "pints?",
  "quarts?",
  "gallons?",
  "fl\\s?oz", "fluid\\s+ounces?",
  "ml", "millilit(?:re|er)s?",
  "lit(?:re|er)s?", "ltrs?",
  "dl", "decilit(?:re|er)s?",
  // Weight (multi-char or unambiguous; "g" alone is allowed because it's
  // the canonical metric abbreviation in recipes, but we lean on the
  // word-boundary `\b` after the unit + the `(?:^|[\s(\[])` lookbehind
  // before the number to avoid matching letters inside identifiers).
  "g", "grams?", "gr",
  "kg", "kilograms?",
  "mg", "milligrams?",
  "oz", "ounces?",
  "lbs", "lb", "pounds?",
  // Count / household
  "pieces?", "slices?", "cloves?", "sprigs?", "stalks?",
  "cans?", "jars?", "packs?", "packages?", "bunches?",
  "sticks?", "leaves", "leaf",
];

const UNIT_PATTERN = UNIT_ALTERNATION.join("|");

// Group 1: leading whole-number-or-fraction or mixed number
//   matches: "4", "0.5", "1.5", "1/2", "1 1/2"
// Group 2: unit (one of the allowlist, case-insensitive)
//
// Word boundary `\b` after the unit ensures "1 lb" doesn't accidentally
// match the start of "lbsfsomething"; and the `(?:^|...)` lookbehind on
// the front ensures we don't mid-word-match digits inside identifiers.
const SCALE_REGEX = new RegExp(
  `(?:^|(?<=[\\s(\\[]))(\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})\\b`,
  "gi",
);

/**
 * Parse the matched number string into a real number.
 * Handles "4", "0.5", "1/2", and "1 1/2".
 */
function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  // Mixed: "1 1/2"
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]!, 10);
    const num = parseInt(mixedMatch[2]!, 10);
    const den = parseInt(mixedMatch[3]!, 10);
    if (den === 0) return null;
    return whole + num / den;
  }
  // Fraction: "1/2"
  const fracMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    const num = parseInt(fracMatch[1]!, 10);
    const den = parseInt(fracMatch[2]!, 10);
    if (den === 0) return null;
    return num / den;
  }
  // Plain decimal / integer
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Format a scaled amount for display. Round to 2 decimal places, strip
 * trailing zeros so "8.00" → "8" and "0.50" → "0.5".
 */
function formatScaled(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  // Avoid scientific notation for tiny / huge values.
  return rounded.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Multiply every recognised (number unit) pair in `text` by `factor`.
 * Returns the original string unchanged if `factor` is `1` (or invalid)
 * or no matches are found. Pure function — safe to call on every
 * render.
 */
export function scaleStepText(text: string, factor: number): string {
  if (typeof text !== "string") return "";
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return text;

  return text.replace(SCALE_REGEX, (match, numStr: string, unit: string) => {
    const original = parseAmount(numStr);
    if (original == null) return match;
    const scaled = original * factor;
    const formatted = formatScaled(scaled);
    if (!formatted) return match;
    return `${formatted} ${unit}`;
  });
}
