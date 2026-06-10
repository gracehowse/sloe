/**
 * `cleanIngredientDisplayName(raw)` — turn a stored/raw ingredient
 * string into a tidy human label for DISPLAY surfaces (recipe-detail
 * ingredient rows, ingredient tiles, shopping rows).
 *
 * ────────────────────────────────────────────────────────────────────
 * DISPLAY ONLY. This function MUST NOT be fed back into nutrition
 * matching, verification, or the `recipe_ingredients.name` write path.
 * Brand prefixes, parentheticals, and leading quantities sometimes
 * carry signal the matcher uses; stripping them for the matcher could
 * change which food is matched. The raw name stays the source of truth
 * for nutrition — this is purely a presentation transform. (Tested:
 * see `cleanIngredientDisplayName.test.ts`.)
 * ────────────────────────────────────────────────────────────────────
 *
 * What it does, in order:
 *   1. Strip a leading quantity + optional unit ("500 g", "1 medium",
 *      "2 tsp", "1½", "2 x") — the bit a stepper/amount column already
 *      shows separately.
 *   2. Strip a brand prefix before a "·" / "|" / " - " separator
 *      ("Essential Waitrose · Garlic" → "Garlic").
 *   3. Strip trailing parentheticals ("Puntalette (Dried)" → "Puntalette").
 *   4. Drop a trailing prep clause after a comma ("Garlic, finely
 *      chopped" → "Garlic") so tiles read as the food, not the method.
 *   5. Collapse whitespace and Title Case the result.
 *
 * Worked cases (from the brief):
 *   "Essential Waitrose · Garlic"  → "Garlic"
 *   "500 g Puntalette (Dried)"     → "Puntalette"
 *   "Amylu · Chicken Meatballs"    → "Chicken Meatballs"
 *
 * Defensive: never returns an empty string. If every transform would
 * empty the label (e.g. the raw was only a quantity), it falls back to
 * the trimmed raw so the row never renders blank.
 *
 * Pure + sync. Safe to call in render. No network, no allocation churn.
 */

/**
 * Units we tolerate immediately after a leading number when stripping a
 * quantity prefix. Kept deliberately close to the import parser's
 * vocabulary (`parseIngredientLine.ts`) so "1 medium", "500 g",
 * "2 tbsp" all peel cleanly. Matched case-insensitively, plural-aware.
 */
const LEADING_UNIT_WORDS = [
  // weights / volumes
  "g", "kg", "mg", "ml", "l", "cl", "oz", "lb", "lbs", "fl oz",
  "gram", "grams", "gramme", "grammes", "kilogram", "kilograms",
  "milliliter", "milliliters", "millilitre", "millilitres",
  "liter", "liters", "litre", "litres", "ounce", "ounces", "pound", "pounds",
  // spoons / cups
  "tsp", "tbsp", "teaspoon", "teaspoons", "tablespoon", "tablespoons",
  "cup", "cups", "mug", "mugs",
  // sizes
  "small", "medium", "large", "x-large", "xl",
  // countable measures
  "pinch", "pinches", "dash", "dashes", "splash", "splashes",
  "handful", "handfuls", "bunch", "bunches", "knob", "knobs",
  "clove", "cloves", "sprig", "sprigs", "slice", "slices",
  "stick", "sticks", "stalk", "stalks", "rasher", "rashers",
  "head", "heads", "bulb", "bulbs", "fillet", "fillets",
  "tin", "tins", "can", "cans", "jar", "jars", "pack", "packs",
  "packet", "packets", "drizzle", "drizzles",
  "piece", "pieces", "leaf", "leaves",
] as const;

const UNICODE_FRAC = "½¼¾⅓⅔⅕⅖⅗⅘⅙⅛";

/**
 * Build the leading-quantity regex once. Matches an optional leading
 * number (int / decimal / fraction / unicode fraction / "a"/"an" /
 * "2 x"), optionally followed by one of the known unit words, anchored
 * at the start. The trailing `\b`/space guard means it never eats the
 * first letter of the food noun.
 */
const UNIT_ALT = LEADING_UNIT_WORDS
  // escape spaces in multi-word units ("fl oz")
  .map((u) => u.replace(/ /g, "\\s+"))
  .join("|");

/**
 * Leading quantity + unit matcher. Exported so the canonical image key
 * (`canonicalImageKey.ts`) reuses the EXACT same quantity-strip spine the
 * display label uses — write-key and read-key must share one regex or the
 * tile lookup drifts (the original `ingredient_images` bug).
 */
export const LEADING_QTY_RE = new RegExp(
  // start
  "^\\s*" +
    // optional "a "/"an " article OR a numeric quantity
    "(?:" +
    "(?:a|an)\\s+" +
    "|" +
    // number — fraction forms FIRST so "1/2" / "1 1/2" / "1½" win over a
    // bare leading "1": mixed "1 1/2" | simple "1/2" | "1½" | "½" |
    // decimal/int "1.5"/"1". Optional "× N" pack form ("2 x 400 g").
    "(?:" +
    "\\d+\\s+\\d+\\s*\\/\\s*\\d+" +
    "|\\d+\\s*\\/\\s*\\d+" +
    `|\\d+\\s*[${UNICODE_FRAC}]` +
    `|[${UNICODE_FRAC}]` +
    "|\\d+(?:[.,]\\d+)?" +
    ")" +
    `(?:\\s*[x×]\\s*\\d+(?:[.,]\\d+)?\\s*(?:${UNIT_ALT})?)?` +
    "\\s*" +
    ")" +
    // optional unit word + optional "of", then a boundary so the noun
    // is never clipped. "a pinch of salt" → "salt"; "500 g flour" → "flour".
    `(?:(?:${UNIT_ALT})\\b\\.?\\s+)?` +
    "(?:of\\s+)?",
  "i",
);

/**
 * Separators that introduce a brand prefix. Only treat the segment
 * BEFORE the separator as a brand when there is exactly one separator
 * and a non-trivial tail — this keeps "Salt · Pepper · Garlic" style
 * lists intact rather than dropping the first item.
 */
export function stripBrandPrefix(s: string): string {
  // Prefer the middot / pipe brand convention.
  for (const sep of [" · ", "·", " | ", "|"]) {
    const idx = s.indexOf(sep);
    if (idx > 0) {
      const tail = s.slice(idx + sep.length).trim();
      // Only strip when the tail still looks like a food noun (has
      // letters) and the head looks like a brand (≤ 4 words). Avoids
      // eating a legitimately hyphen/pipe-joined dish name.
      const headWords = s.slice(0, idx).trim().split(/\s+/).filter(Boolean);
      if (tail.length > 0 && /[a-z]/i.test(tail) && headWords.length <= 4) {
        return tail;
      }
    }
  }
  // " - " brand separator ("Tesco - Chopped Tomatoes"). Same guard.
  const dashIdx = s.indexOf(" - ");
  if (dashIdx > 0) {
    const tail = s.slice(dashIdx + 3).trim();
    const headWords = s.slice(0, dashIdx).trim().split(/\s+/).filter(Boolean);
    if (tail.length > 0 && /[a-z]/i.test(tail) && headWords.length <= 4) {
      return tail;
    }
  }
  return s;
}

/** Strip ALL trailing/embedded parentheticals: "Puntalette (Dried)" → "Puntalette". */
export function stripParentheticals(s: string): string {
  return s.replace(/\s*\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Drop a trailing prep clause after the first comma when what follows
 * reads like a cooking instruction rather than a second ingredient.
 * "Garlic, finely chopped" → "Garlic"; "Salt, to taste" → "Salt".
 * Conservative: only fires when the head still has letters.
 */
function stripPrepClause(s: string): string {
  const commaIdx = s.indexOf(",");
  if (commaIdx <= 0) return s;
  const head = s.slice(0, commaIdx).trim();
  if (head.length > 0 && /[a-z]/i.test(head)) {
    return head;
  }
  return s;
}

/**
 * Title Case a cleaned food label. Lowercases first, then uppercases
 * the first letter of each word, with small exceptions for connective
 * words so "Salt And Pepper" reads as "Salt and Pepper". Preserves an
 * existing all-caps acronym-ish short token (e.g. "BBQ").
 */
const LOWER_WORDS = new Set(["and", "of", "with", "in", "the", "a", "an", "or"]);

function titleCase(s: string): string {
  const words = s.split(/\s+/).filter(Boolean);
  return words
    .map((w, i) => {
      // Preserve short all-caps tokens (BBQ, EVOO) as-is.
      if (w.length <= 4 && w === w.toUpperCase() && /[A-Z]/.test(w)) return w;
      const lower = w.toLowerCase();
      if (i > 0 && LOWER_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export function cleanIngredientDisplayName(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  const original = raw.trim();
  if (original === "") return "";

  // 1. brand prefix (before quantity strip — brands rarely carry a
  //    leading quantity, and a brand like "100% Pure" could otherwise
  //    confuse the quantity matcher).
  let s = stripBrandPrefix(original);

  // 2. leading quantity + unit
  s = s.replace(LEADING_QTY_RE, "").trim();

  // 3. parentheticals
  s = stripParentheticals(s);

  // 4. trailing prep clause
  s = stripPrepClause(s);

  // 5. collapse + title case
  s = s.replace(/\s+/g, " ").trim();
  if (s === "") {
    // Everything was stripped (raw was e.g. only a quantity). Fall back
    // to the brand-stripped form, then the original, so we never blank.
    const fallback = stripBrandPrefix(original).trim() || original;
    return titleCase(fallback.replace(/\s+/g, " ").trim());
  }
  return titleCase(s);
}
