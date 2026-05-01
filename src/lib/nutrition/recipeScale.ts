/**
 * Recipe scaling — pure helpers shared by web (`CookMode.tsx`) and
 * mobile (`apps/mobile/app/cook.tsx`) cook screens. Paprika parity
 * (2026-04-30 competitor audit): a Cook-screen scale control that
 * rewrites visible amounts in real time.
 *
 * Two surfaces consume these helpers:
 *
 *  - `scaleAmountText(text, factor)` — rewrites every numeric
 *    amount-followed-by-unit token in a step / ingredient string.
 *    Handles whole numbers ("2 cups"), decimals ("1.5 tbsp"), simple
 *    fractions ("1/2 onion"), and unicode vulgar fractions
 *    ("½ tsp salt"). Hyphenated ranges ("1-2 cloves") scale both
 *    ends. Counts without an explicit unit ("3 eggs") scale via the
 *    unit-less branch.
 *
 *  - `formatScaledAmount(value)` — turns the raw scaled number back
 *    into a human-friendly string. 0.5 → "1/2", 0.75 → "3/4", 1.25 →
 *    "1 1/4", 0.333 → "1/3", non-trivial decimals → at most 2 dp.
 *    Mirrors the conventions in print cookbooks so a 0.5x of "1 cup"
 *    reads as "1/2 cup", not "0.5 cup".
 *
 * Out of scope — narrative qualifiers ("a pinch of", "season to
 * taste", "salt to season"). Those have no number to scale, and
 * Paprika leaves them alone too. The visible-scaling surface is
 * intentionally conservative: when in doubt, leave the original
 * text untouched.
 *
 * No React, no DOM, no React Native. Safe to import anywhere.
 */

/** The scale presets the Cook screen offers. 0.5x and 4x are the
 *  practical extremes — outside this range users tend to want a
 *  different recipe rather than a scaled one. 1x is the default and
 *  always present so a user without scaling needs sees their intended
 *  recipe verbatim.
 *
 *  User-sentiment audit (round 4, 2026-04-30): added 3x explicitly so
 *  a 2-serving recipe scales cleanly to 6 (a standard household pan)
 *  without forcing the user to pick the next nearest preset (4x ⇒ 8)
 *  and over-cook. Mealime's locked 2/4/6 was a top community
 *  complaint; we now cover 1, 1.5, 2, 3, 4 plus a half (0.5) for the
 *  solo-cook path. */
export const COOK_SCALE_PRESETS: readonly number[] = [0.5, 1, 1.5, 2, 3, 4];

/** AsyncStorage / localStorage key prefix for the chosen scale per
 *  (userId, recipeId). Keeps the scale across app reopen. */
export const COOK_SCALE_KEY_PREFIX = "suppr-cook-scale-v1:";

/** Build the per-(user, recipe) storage key for the chosen scale. The
 *  user id is part of the key so a shared device doesn't bleed scale
 *  between accounts. Falls back to "anon" when no user is signed in. */
export function cookScaleStorageKey(
  userId: string | null | undefined,
  recipeId: string,
): string {
  const u = userId && userId.trim() ? userId : "anon";
  return `${COOK_SCALE_KEY_PREFIX}${u}:${recipeId}`;
}

/** Validate + clamp a scale factor to the supported preset set. Falls
 *  back to 1 (the unscaled default) for any non-finite, non-positive,
 *  or out-of-range input. We do NOT round arbitrary inputs into the
 *  nearest preset — a corrupt "0.7" should reset to 1, not silently
 *  pick 0.5 or 1. */
export function clampCookScale(raw: unknown): number {
  if (typeof raw !== "number") return 1;
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return COOK_SCALE_PRESETS.includes(raw) ? raw : 1;
}

/** Unicode vulgar fractions that show up in user-pasted recipes. Maps
 *  the glyph to its decimal value. We keep the set small — the long
 *  tail (⅖, ⅗, ⅛-⅞) shows up < 1% of the time. */
const VULGAR_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "¼": 0.25,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

/** A small set of "near-fraction" decimal values we render back as a
 *  human fraction. Anything outside this list falls back to a numeric
 *  string trimmed to at most 2 decimal places. The tolerance is 0.01
 *  to absorb floating-point error from scaling 1/3 by 2 (0.6666…). */
const FRACTION_TARGETS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0.125, label: "1/8" },
  { value: 0.25, label: "1/4" },
  { value: 1 / 3, label: "1/3" },
  { value: 0.375, label: "3/8" },
  { value: 0.5, label: "1/2" },
  { value: 0.625, label: "5/8" },
  { value: 2 / 3, label: "2/3" },
  { value: 0.75, label: "3/4" },
  { value: 0.875, label: "7/8" },
];

/**
 * Format a raw decimal back into a human-friendly cookbook string.
 *
 *   formatScaledAmount(0.5)   → "1/2"
 *   formatScaledAmount(1.25)  → "1 1/4"
 *   formatScaledAmount(2)     → "2"
 *   formatScaledAmount(0.333) → "1/3"
 *   formatScaledAmount(1.7)   → "1.7"
 *
 * Negative values clamp to "0". NaN / Infinity → "0".
 */
export function formatScaledAmount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value <= 0) return "0";

  const whole = Math.floor(value);
  const fractional = value - whole;
  // Treat anything within 1e-2 of zero as a clean whole number — picks
  // up 1.0001 from 0.5 × 2.0002 etc.
  if (fractional < 0.01) return String(whole);
  // Likewise, clamp up to the next whole number.
  if (fractional > 0.99) return String(whole + 1);

  for (const target of FRACTION_TARGETS) {
    if (Math.abs(fractional - target.value) < 0.01) {
      return whole === 0 ? target.label : `${whole} ${target.label}`;
    }
  }
  // Fall back to a 2-dp number — strip trailing zeros so "1.50" reads
  // as "1.5". Use `Number.parseFloat` for the strip, not `toFixed`.
  const trimmed = Math.round(value * 100) / 100;
  return String(trimmed);
}

/** Parse one numeric token from the head of a string. Returns the
 *  parsed value, the consumed length, and an "isCount" flag (true for
 *  a bare integer, false for fractional / decimal — useful when the
 *  caller wants to skip "3" in "Step 3:" but scale "3" in "3 eggs").
 *  Returns null when the head is not a number-like token. */
type ParsedNumber = {
  value: number;
  consumed: number;
  /** True iff the token is a bare integer (no fraction / decimal). */
  isCount: boolean;
};

function parseLeadingNumber(s: string): ParsedNumber | null {
  // Mixed-fraction first ("1 1/2"). We commit to the mixed form only
  // when the whole-number is followed by a SPACE and a fraction —
  // never by a hyphen (range) or unit.
  const mixedMatch = /^(\d+)\s+(\d+)\s*\/\s*(\d+)/.exec(s);
  if (mixedMatch) {
    const w = Number.parseInt(mixedMatch[1]!, 10);
    const num = Number.parseInt(mixedMatch[2]!, 10);
    const den = Number.parseInt(mixedMatch[3]!, 10);
    if (den > 0) {
      return {
        value: w + num / den,
        consumed: mixedMatch[0].length,
        isCount: false,
      };
    }
  }
  // Pure ASCII fraction.
  const fracMatch = /^(\d+)\s*\/\s*(\d+)/.exec(s);
  if (fracMatch) {
    const num = Number.parseInt(fracMatch[1]!, 10);
    const den = Number.parseInt(fracMatch[2]!, 10);
    if (den > 0) {
      return {
        value: num / den,
        consumed: fracMatch[0].length,
        isCount: false,
      };
    }
  }
  // Decimal or whole.
  const decMatch = /^(\d+(?:\.\d+)?)/.exec(s);
  if (decMatch) {
    const v = Number.parseFloat(decMatch[1]!);
    if (Number.isFinite(v)) {
      const isCount = !decMatch[1]!.includes(".");
      return { value: v, consumed: decMatch[0].length, isCount };
    }
  }
  // Unicode vulgar fraction.
  const ch = s.charAt(0);
  if (ch in VULGAR_FRACTIONS) {
    return { value: VULGAR_FRACTIONS[ch]!, consumed: 1, isCount: false };
  }
  // "1 ½" — whole + space + vulgar fraction.
  const wholeVulgar = /^(\d+)\s+([½¼¾⅓⅔⅛⅜⅝⅞])/.exec(s);
  if (wholeVulgar) {
    const w = Number.parseInt(wholeVulgar[1]!, 10);
    const v = VULGAR_FRACTIONS[wholeVulgar[2]!]!;
    return { value: w + v, consumed: wholeVulgar[0].length, isCount: false };
  }
  return null;
}

/**
 * Units we recognise as "cooking units". A bare integer is only
 * scaled when followed by one of these (or by a recognised whole-food
 * noun via the noun pattern below). This keeps "Step 1:" / "350°F"
 * out of the rewrite path.
 *
 * Lowercased + stripped of trailing punctuation when matched.
 */
const COOKING_UNITS = new Set<string>([
  // volume
  "tsp", "teaspoon", "teaspoons",
  "tbsp", "tbs", "tablespoon", "tablespoons",
  "cup", "cups",
  "ml", "millilitre", "millilitres", "milliliter", "milliliters",
  "l", "litre", "litres", "liter", "liters",
  "fl", "floz",
  "pt", "pint", "pints",
  "qt", "quart", "quarts",
  "gal", "gallon", "gallons",
  // weight
  "g", "gram", "grams",
  "kg", "kilo", "kilos", "kilogram", "kilograms",
  "oz", "ounce", "ounces",
  "lb", "lbs", "pound", "pounds",
  // counts / vague
  "clove", "cloves",
  "stick", "sticks",
  "slice", "slices",
  "head", "heads",
  "can", "cans",
  "jar", "jars",
  "bag", "bags",
  "bunch", "bunches",
  "stalk", "stalks",
  "sprig", "sprigs",
  "leaf", "leaves",
  "piece", "pieces",
  "handful", "handfuls",
  "pinch", "pinches",
  "dash", "dashes",
  "drop", "drops",
  "scoop", "scoops",
  "package", "packages",
  "packet", "packets",
  "stick", "sticks",
]);

/** Whole-food nouns we treat as implicit count units — e.g. "3 eggs"
 *  scales, "3 minutes" does not. The list is conservative: only nouns
 *  that almost always describe an ingredient when paired with a
 *  number. Add to this list reluctantly. */
const COUNT_NOUNS = new Set<string>([
  "egg", "eggs",
  "onion", "onions",
  "garlic", "carrot", "carrots",
  "potato", "potatoes",
  "tomato", "tomatoes",
  "apple", "apples",
  "banana", "bananas",
  "lemon", "lemons",
  "lime", "limes",
  "orange", "oranges",
  "avocado", "avocados",
  "pepper", "peppers",
  "chicken", "thigh", "thighs", "breast", "breasts",
  "fillet", "fillets", "filet", "filets",
  "steak", "steaks",
  "sausage", "sausages",
  "rasher", "rashers",
  "tortilla", "tortillas",
  "wrap", "wraps",
]);

/** Recognise time / temperature units we MUST NOT scale — these turn
 *  up adjacent to numbers in step text ("bake for 25 minutes") and
 *  scaling them would corrupt the recipe. The check runs before the
 *  cooking-unit / noun path so a count of 25 followed by "minutes"
 *  always falls through unchanged. */
const TIME_TEMP_UNITS = new Set<string>([
  "second", "seconds", "sec", "secs",
  "minute", "minutes", "min", "mins",
  "hour", "hours", "hr", "hrs",
  "day", "days",
  "°", "°c", "°f",
  "c", "f",
  "celsius", "fahrenheit",
  "degree", "degrees",
]);

function stripTrailingPunct(s: string): string {
  return s.replace(/[.,;:!?]+$/, "");
}

/**
 * Decide whether the run of text immediately AFTER a numeric token
 * names a cooking unit (so we should scale) or a time / temperature /
 * unrelated phrase (so we should not). Returns the length of the
 * matched unit token (0 when no scale-eligible unit is found).
 *
 * The matcher consumes one token of whitespace then one or two words
 * — "fl oz" / "fluid ounces" / "tablespoon" — and only commits to
 * the longer match when both halves are recognised. This is the bit
 * that distinguishes "2 c flour" (scale) from "2 c oven" (don't —
 * "c" alone isn't a recognised unit in this list, by design; we keep
 * the single-letter unit set tight to avoid `c`/`g`/`l` ambiguity
 * outside obvious contexts).
 */
function matchTrailingUnit(s: string): { length: number; isCookingUnit: boolean; isCountNoun: boolean } {
  // Skip leading whitespace.
  const wsMatch = /^\s+/.exec(s);
  const wsLen = wsMatch ? wsMatch[0].length : 0;
  const rest = s.slice(wsLen);

  // First word — letters or the degree symbol cluster.
  const firstMatch = /^([°a-zA-Z]+)/.exec(rest);
  if (!firstMatch) return { length: 0, isCookingUnit: false, isCountNoun: false };
  const firstRaw = firstMatch[1]!;
  const first = stripTrailingPunct(firstRaw).toLowerCase();

  // Time / temperature trumps everything — never scale.
  if (TIME_TEMP_UNITS.has(first)) {
    return { length: 0, isCookingUnit: false, isCountNoun: false };
  }

  // Two-word units — "fl oz", "fluid ounces". Try the two-word form
  // first so "fl oz" scales as a unit, not "fl" + bare "oz".
  const twoWordMatch = /^([a-zA-Z]+)(\s+)([a-zA-Z]+)/.exec(rest);
  if (twoWordMatch) {
    const a = twoWordMatch[1]!.toLowerCase();
    const b = stripTrailingPunct(twoWordMatch[3]!).toLowerCase();
    if (a === "fl" && (b === "oz" || b === "ounce" || b === "ounces")) {
      return {
        length: wsLen + twoWordMatch[0].length,
        isCookingUnit: true,
        isCountNoun: false,
      };
    }
    if (a === "fluid" && (b === "oz" || b === "ounce" || b === "ounces")) {
      return {
        length: wsLen + twoWordMatch[0].length,
        isCookingUnit: true,
        isCountNoun: false,
      };
    }
  }

  if (COOKING_UNITS.has(first)) {
    return {
      length: wsLen + firstRaw.length,
      isCookingUnit: true,
      isCountNoun: false,
    };
  }

  if (COUNT_NOUNS.has(first)) {
    return {
      length: wsLen + firstRaw.length,
      isCookingUnit: false,
      isCountNoun: true,
    };
  }

  return { length: 0, isCookingUnit: false, isCountNoun: false };
}

/**
 * Rewrite numeric amounts in `text` by `factor`. Pure — does not
 * mutate or fetch anything. When `factor === 1` returns the input
 * verbatim so the caller can wire it unconditionally.
 *
 * Scaling rules:
 *  - Number followed by a recognised cooking unit ("2 cups",
 *    "1/2 tbsp", "½ tsp", "1-2 cloves") → scale.
 *  - Number followed by a recognised count noun ("3 eggs",
 *    "1 onion") → scale.
 *  - Number followed by a time / temperature word ("25 minutes",
 *    "350°F") → do not scale.
 *  - Bare integer with no recognised unit / noun ("Step 1:",
 *    "8 servings") → do not scale (we'd hit too many false positives).
 *  - Hyphen ranges ("1-2 cloves") → scale both ends, render with the
 *    same hyphen.
 *
 * The output preserves casing of unit words verbatim — we never
 * normalise "Cups" to "cups". Trailing punctuation on the unit
 * (commas, periods, semicolons) is preserved.
 *
 * `factor` of 0 / NaN / negative collapses to 1 — never blank a
 * recipe out.
 */
export function scaleAmountText(text: string, factor: number): string {
  if (!text) return text;
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  if (f === 1) return text;

  let out = "";
  let i = 0;
  const n = text.length;

  while (i < n) {
    // Look for a number-like character at this offset. Cheap pre-check
    // before we run the parser.
    const ch = text.charAt(i);
    const isDigit = ch >= "0" && ch <= "9";
    const isVulgar = ch in VULGAR_FRACTIONS;
    if (!isDigit && !isVulgar) {
      out += ch;
      i++;
      continue;
    }

    const parsed = parseLeadingNumber(text.slice(i));
    if (!parsed) {
      out += ch;
      i++;
      continue;
    }

    // Range form — "1-2 cloves".
    let rangeUpper: ParsedNumber | null = null;
    let rangeSepLen = 0;
    const afterFirst = text.slice(i + parsed.consumed);
    const rangeSepMatch = /^\s*[-–]\s*/.exec(afterFirst);
    if (rangeSepMatch) {
      const upper = parseLeadingNumber(afterFirst.slice(rangeSepMatch[0].length));
      if (upper) {
        rangeUpper = upper;
        rangeSepLen = rangeSepMatch[0].length;
      }
    }

    const consumedNum =
      parsed.consumed + (rangeUpper ? rangeSepLen + rangeUpper.consumed : 0);
    const tail = text.slice(i + consumedNum);
    const unit = matchTrailingUnit(tail);

    const eligibleAsCount =
      parsed.isCount && (rangeUpper ? rangeUpper.isCount : true);
    const shouldScale =
      unit.isCookingUnit ||
      unit.isCountNoun ||
      // Non-integer (fraction / decimal / vulgar) without a recognised
      // unit still scales — "1/2 of the dough" is meaningful as a
      // proportional amount, and refusing to scale fractions would
      // miss the very common "1/4 of the recipe" idiom. Counts (bare
      // integers) need an explicit unit / noun, otherwise we'd start
      // rewriting "Step 3:" and "350°F".
      !eligibleAsCount;

    if (shouldScale) {
      const scaled = parsed.value * f;
      let replacement = formatScaledAmount(scaled);
      if (rangeUpper) {
        const scaledUpper = rangeUpper.value * f;
        replacement = `${formatScaledAmount(scaled)}-${formatScaledAmount(scaledUpper)}`;
      }
      out += replacement;
      i += consumedNum;
    } else {
      // Not scale-eligible. Emit verbatim and advance.
      out += text.slice(i, i + consumedNum);
      i += consumedNum;
    }
  }

  return out;
}

/**
 * Convenience for callers that need the human-readable label below
 * the segmented control. Returns "1x" / "0.5x" / "1.5x" / "2x" / "4x"
 * — never "1.0x" (we strip trailing ".0" to keep the pill compact).
 */
export function formatCookScaleLabel(scale: number): string {
  if (!Number.isFinite(scale) || scale <= 0) return "1x";
  const trimmed = Math.round(scale * 10) / 10;
  // Whole numbers render without a decimal — "1x", "2x", "4x".
  if (Math.abs(trimmed - Math.round(trimmed)) < 1e-6) {
    return `${Math.round(trimmed)}x`;
  }
  return `${trimmed}x`;
}

/**
 * Caption rendered below the scale segmented control. Mirrors the
 * Paprika "Scaled to N servings" copy when a recipe yield is known;
 * falls back to the multiplier when not. `baseServings` of 0 / NaN /
 * negative is treated as missing.
 *
 * User-sentiment audit (round 4, 2026-04-30): when `baseServings` is
 * known AND scale === 1, render "Serves N" (singular for 1) rather
 * than the generic "Original recipe". The previous wording hid the
 * yield from solo cooks — Mealime's locked 2/4/6 was a top community
 * complaint and "Serves 1" being implicit (not surfaced) felt like
 * the same gap. When the yield is unknown we still fall back to
 * "Original recipe" so the caption never misrepresents the dish.
 */
export function cookScaleCaption(
  scale: number,
  baseServings: number | null | undefined,
): string {
  const base =
    typeof baseServings === "number" && Number.isFinite(baseServings) && baseServings > 0
      ? baseServings
      : null;
  if (scale === 1) {
    if (base != null) {
      return `Serves ${base}`;
    }
    return "Original recipe";
  }
  if (base != null) {
    const scaledServings = base * scale;
    const label = formatScaledAmount(scaledServings);
    return `Scaled to ${label} serving${scaledServings === 1 ? "" : "s"}`;
  }
  return `Scaled ${formatCookScaleLabel(scale)}`;
}
