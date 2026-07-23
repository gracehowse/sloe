/**
 * In-store shopping-list display helpers (ENG-1669).
 *
 * Shopping rows should read as buyable identity + amount — not meal-plan
 * archaeology (full recipe titles) or cook-step prep (`roughly chopped`).
 */

/** Trailing prep / cook-instruction noise that does not change what to buy. */
const PREP_SUFFIX_RE =
  /(?:,|\s)\s*(?:roughly|finely|thinly|freshly|lightly)?\s*(?:chopped|diced|sliced|minced|crushed|grated|peeled|seeded|halved|quartered|trimmed|drained|rinsed|washed|cubed|shredded|torn|crumbled|zested|juiced|mashed|pureed|puréed|beaten|whisked|melted|softened|toasted|roasted|cooked|blanched)\b.*$/i;

/** Parenthetical prep: "onion (diced)", "garlic (minced)". */
const PREP_PAREN_RE =
  /\s*\((?:roughly|finely|thinly|freshly|lightly)?\s*(?:chopped|diced|sliced|minced|crushed|grated|peeled|seeded|halved|quartered|trimmed|drained|rinsed|washed|cubed|shredded|torn|crumbled|zested|juiced|mashed|pureed|puréed|beaten|whisked|melted|softened|toasted|roasted|cooked|blanched)[^)]*\)\s*$/i;

/** "cut into florets / ribbons / strips / wedges …" trailing clauses. */
const CUT_INTO_RE = /(?:,|\s)\s*cut into\b.*$/i;

/**
 * Strip cook-prep suffixes from an ingredient name for shopping scan.
 * Keeps buyable identity ("broccoli", "brown onion"); drops "finely diced".
 */
export function stripShoppingPrepFromName(name: string): string {
  let n = name.trim();
  if (!n) return n;

  // Repeat a few times — imported names can stack prep phrases.
  for (let i = 0; i < 3; i++) {
    const before = n;
    n = n.replace(CUT_INTO_RE, "").trim();
    n = n.replace(PREP_PAREN_RE, "").trim();
    n = n.replace(PREP_SUFFIX_RE, "").trim();
    n = n.replace(/,\s*$/, "").trim();
    if (n === before) break;
  }

  return n || name.trim();
}

/**
 * Shop-sensible quantity formatting — kill fake precision like `266.66 g`.
 * Small spice amounts keep one decimal; larger mass/volume rounds to whole.
 */
export function formatShopSensibleQuantity(value: number, unit: string): string {
  if (!Number.isFinite(value) || value <= 0) return "";

  const u = unit.trim().toLowerCase();
  let rounded: number;

  if (u === "g" || u === "ml" || u === "oz") {
    if (value >= 10) rounded = Math.round(value);
    else rounded = Math.round(value * 10) / 10;
  } else if (u === "kg" || u === "l" || u === "lb") {
    rounded = Math.round(value * 100) / 100;
  } else if (u === "tbsp" || u === "tsp" || u === "cup") {
    rounded = Math.round(value * 10) / 10;
  } else {
    // Counts / each / custom units — whole numbers when close, else 1 decimal.
    if (Math.abs(value - Math.round(value)) < 0.05) rounded = Math.round(value);
    else rounded = Math.round(value * 10) / 10;
  }

  const n = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return u ? `${n} ${u}` : n;
}

/** Deduped recipe titles from a group's `from` fields. */
export function shoppingRecipeTitlesFromItems(
  items: ReadonlyArray<{ from: string }>,
): string[] {
  const titles = new Set<string>();
  for (const it of items) {
    for (const p of it.from.split(",").map((s) => s.trim()).filter(Boolean)) {
      titles.add(p);
    }
  }
  return [...titles];
}

/**
 * Quiet recipe-count caption for dense shopping rows.
 * Returns null when 0–1 recipes (single attribution is noise in-aisle).
 */
export function formatShoppingRecipeCountCaption(recipeCount: number): string | null {
  if (recipeCount < 2) return null;
  return `${recipeCount} recipes`;
}
