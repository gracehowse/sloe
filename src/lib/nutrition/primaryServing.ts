/**
 * Primary-serving inference for food search results.
 *
 * TestFlight build 9 feedback `APo0qS9vcFvmBJEJJ_-61YA` (2026-04-19): the
 * search list was showing every row on a per-100g basis — "Pret tuna
 * sandwich · 211 kcal per 100g" — while MFP and LoseIt default to the
 * natural portion ("1 sandwich, 230 g, 480 kcal"). This module picks
 * the item's natural portion from whatever fields the source supplies
 * and scales the per-100g macros to that weight so both platforms can
 * render a primary per-portion line plus a subdued per-100g reference.
 *
 * Rules per source:
 *   - Edamam: `food.servingSizes[]` — first entry whose label is not
 *     "gram" and whose quantity > 0.
 *   - USDA Branded: prefer `servingSize` + `servingSizeUnit` ("g"/"ml"
 *     treated as grams) with the human label from
 *     `householdServingFullText`.
 *   - USDA Survey/Foundation/SR Legacy: first `foodPortions[]` entry
 *     whose `portionDescription` / `modifier` isn't the "quantity not
 *     specified" / plain-gram placeholder.
 *   - OpenFoodFacts `serving_size`: narrow `{N} g|ml` regex — no
 *     interpretation of free-text "1 piece" without a gram weight.
 *
 * `scalePrimaryServingFromPer100g` does the macro math so callers never
 * round twice and so parity tests can pin the exact outputs.
 */

export type PrimaryServing = {
  /** Human-readable label for the chip, e.g. "1 sandwich" or "1 serving". */
  label: string;
  /** Grams this serving weighs. Always > 0. */
  grams: number;
  /** Per-portion kcal (rounded). */
  kcal: number;
  /** Per-portion macros, rounded to 1dp. */
  protein: number;
  carbs: number;
  fat: number;
};

export type MacrosPer100gLite = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** Edamam `servingSizes[]` row. */
export type EdamamServingSize = {
  uri?: string;
  label?: string;
  quantity?: number;
};

/** USDA FDC branded food fields we care about for the natural portion. */
export type UsdaBrandedServingFields = {
  /** Numeric serving size. */
  servingSize?: number | null;
  /** "g", "ml", "GRM", "MLT", etc. */
  servingSizeUnit?: string | null;
  /** Free-text e.g. "1 SANDWICH" / "2 tbsp" / "1 cup (240 ml)". */
  householdServingFullText?: string | null;
};

/** USDA FDC non-branded `foodPortions[]` row (Survey/Foundation/SR Legacy). */
export type UsdaFoodPortion = {
  gramWeight?: number | null;
  amount?: number | null;
  modifier?: string | null;
  portionDescription?: string | null;
  measureUnit?: { name?: string | null; abbreviation?: string | null } | null;
};

/** Strings that mean "no real portion here — skip". */
const USDA_PORTION_BLOCKLIST = new Set(
  [
    "quantity not specified",
    "undetermined",
    "1 g",
    "1g",
    "100 g",
    "100g",
    "not specified",
  ].map((s) => s.toLowerCase()),
);

/**
 * F-88 (2026-04-25) — modifiers that indicate a "standard FDA label
 * serving" rather than a natural unit. NLEA = Nutrition Labeling and
 * Education Act; these rows describe the serving size that appears on
 * the Nutrition Facts panel (e.g. 126 g for bananas, 30 g for cereal).
 *
 * A user searching "banana" expects to log "1 medium banana", not
 * "1 NLEA serving (126 g)". Skip these rows when better natural-unit
 * portions are present in the same `foodPortions[]` array.
 */
const USDA_NLEA_MODIFIERS = new Set(
  ["nlea serving", "household reference"].map((s) => s.toLowerCase()),
);

/**
 * F-88 — preferred modifier substrings. When a foodPortions array has
 * multiple entries, prefer rows whose modifier reads as a recognisable
 * unit ("medium banana", "large egg") over generic ones. Ranked by how
 * close the row is to "what most people mean by 1 of these".
 */
const USDA_PREFERRED_MODIFIER_RANKS: Array<{ pattern: RegExp; rank: number }> = [
  // Negative lookbehind keeps `\blarge\b` from matching "extra large", and
  // `\bsmall\b` from matching "extra small". Without this, both "large
  // (8\")" and "extra large (9\")" tie at rank 90 and the picker returns
  // whichever USDA shipped first.
  { pattern: /\bmedium\b/i, rank: 100 },
  { pattern: /(?<!extra )\blarge\b/i, rank: 90 },
  { pattern: /\bwhole\b/i, rank: 85 },
  { pattern: /(?<!extra )\bsmall\b/i, rank: 80 },
  { pattern: /\bextra large\b/i, rank: 70 },
  { pattern: /\bextra small\b/i, rank: 60 },
  { pattern: /\bslice\b/i, rank: 55 },
  { pattern: /\bpiece\b/i, rank: 50 },
  { pattern: /\bcup\b/i, rank: 30 },
  { pattern: /\btbsp\b/i, rank: 20 },
  { pattern: /\btsp\b/i, rank: 15 },
];

/** Round a macro to one decimal place. Keeps the primary chip stable. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Scale per-100g macros to a primary serving's gram weight and attach
 * the supplied label. Kept pure so unit tests can lock the arithmetic.
 */
export function scalePrimaryServingFromPer100g(
  per100g: MacrosPer100gLite,
  label: string,
  grams: number,
): PrimaryServing | null {
  if (!Number.isFinite(grams) || grams <= 0) return null;
  const f = grams / 100;
  return {
    label,
    grams: Math.round(grams * 10) / 10,
    kcal: Math.round((per100g.calories ?? 0) * f),
    protein: round1((per100g.protein ?? 0) * f),
    carbs: round1((per100g.carbs ?? 0) * f),
    fat: round1((per100g.fat ?? 0) * f),
  };
}

/**
 * Pick the natural portion from an Edamam `servingSizes` array.
 * Returns `null` when the array is empty or only contains the per-gram
 * fallback.
 */
/**
 * Minimum gram weight we'll accept from Edamam's `servingSizes[*].quantity`
 * for a non-"Gram" label. Edamam's data is supposed to ship `quantity` in
 * grams, but for a meaningful slice of branded items
 * (Pret A Manger sandwiches, wraps, bowls) it ships `quantity: 1` —
 * the *count* of items, not the gram weight. Without a floor, the search
 * row defaults to "1 sandwich (1 g)" and the kcal headline reads "2 kcal"
 * for a 200 kcal/100g sandwich. 3 g is well below any real food serving
 * (a single garlic clove is ~3 g, an olive is ~5 g) and well above
 * Edamam's count-as-grams placeholder of 1.
 *
 * 2026-05-06 — TestFlight feedback: "actually a lot are coming up with
 * crazy low cals" — every Pret entry surfaced as 2-4 kcal headline.
 */
const EDAMAM_MIN_SERVING_GRAMS = 3;

export function pickEdamamPrimaryServing(
  per100g: MacrosPer100gLite,
  servingSizes: EdamamServingSize[] | null | undefined,
): PrimaryServing | null {
  if (!Array.isArray(servingSizes) || servingSizes.length === 0) return null;
  for (const s of servingSizes) {
    const label = (s.label ?? "").trim();
    const qty = typeof s.quantity === "number" ? s.quantity : Number(s.quantity ?? 0);
    if (!label) continue;
    if (label.toLowerCase() === "gram") continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    // Reject implausibly small quantities — Edamam ships `quantity: 1`
    // for "1 Sandwich"/"1 Wrap"/"1 Bowl" on poorly-curated branded
    // entries, which would otherwise produce a 1g default portion.
    // Falling through returns null → caller falls back to the per-100g
    // basis so the kcal headline is plausible.
    if (qty < EDAMAM_MIN_SERVING_GRAMS) continue;
    // Edamam labels are usually "Serving" / "Sandwich" / "Slice" — they
    // describe ONE portion so we always prefix with "1 " for clarity.
    const display = `1 ${label.toLowerCase()}`;
    return scalePrimaryServingFromPer100g(per100g, display, qty);
  }
  return null;
}

/** Treat USDA `servingSizeUnit` as grams when "g" or "GRM" (or ml, which we treat as 1g=1ml for macro math). */
function usdaServingSizeUnitIsMass(unit: string | null | undefined): boolean {
  const u = (unit ?? "").toLowerCase().trim();
  return u === "g" || u === "grm" || u === "gram" || u === "grams" || u === "ml" || u === "mlt" || u === "milliliter" || u === "millilitre";
}

/**
 * Pick the natural portion from a USDA Branded food's per-serving fields.
 * Preference: `servingSize` (number) × gram unit + `householdServingFullText`
 * for the label. Falls back to a generic "1 serving" label when OFF/USDA
 * omits the household text.
 */
export function pickUsdaBrandedPrimaryServing(
  per100g: MacrosPer100gLite,
  fields: UsdaBrandedServingFields | null | undefined,
): PrimaryServing | null {
  if (!fields) return null;
  const size = typeof fields.servingSize === "number"
    ? fields.servingSize
    : Number(fields.servingSize ?? 0);
  if (!Number.isFinite(size) || size <= 0) return null;
  if (!usdaServingSizeUnitIsMass(fields.servingSizeUnit)) return null;
  const raw = (fields.householdServingFullText ?? "").trim();
  let label: string;
  if (raw) {
    // "1 SANDWICH" → "1 sandwich". Collapse runs of whitespace.
    label = raw.toLowerCase().replace(/\s+/g, " ").trim();
  } else {
    label = "1 serving";
  }
  return scalePrimaryServingFromPer100g(per100g, label, size);
}

/**
 * F-88 (2026-04-25) — score a portion candidate so the highest-scoring
 * row wins as the primary serving. Higher = better. Negative = unusable.
 *
 * Scoring rationale:
 *  - Reject NLEA / household reference rows outright (USDA "standard
 *    serving" rows that read as opaque jargon to a user).
 *  - Reject blocklisted placeholder rows.
 *  - Boost rows whose modifier reads as a recognisable natural unit
 *    ("medium banana", "large egg") via `USDA_PREFERRED_MODIFIER_RANKS`.
 *  - Mild preference for shorter labels (less likely to read awkwardly
 *    when concatenated with measureUnit).
 */
function scoreUsdaPortion(p: UsdaFoodPortion): number {
  const grams = typeof p.gramWeight === "number" ? p.gramWeight : Number(p.gramWeight ?? 0);
  if (!Number.isFinite(grams) || grams <= 0) return -1;
  const desc = (p.portionDescription ?? "").trim().toLowerCase();
  const mod = (p.modifier ?? "").trim().toLowerCase();
  if (USDA_PORTION_BLOCKLIST.has(desc) || USDA_PORTION_BLOCKLIST.has(mod)) return -1;
  if (USDA_NLEA_MODIFIERS.has(mod) || USDA_NLEA_MODIFIERS.has(desc)) return -1;

  // Match the highest-priority preferred modifier substring.
  const text = `${desc} ${mod}`.trim();
  let bestRank = 0;
  for (const { pattern, rank } of USDA_PREFERRED_MODIFIER_RANKS) {
    if (pattern.test(text) && rank > bestRank) bestRank = rank;
  }
  return bestRank > 0 ? bestRank : 1; // 1 = "usable but generic"
}

/** F-88 — strip "undetermined" / placeholder unit names from a label. */
function cleanUnitToken(unit: string | null | undefined): string {
  const u = (unit ?? "").trim().toLowerCase();
  if (!u || u === "undetermined" || u === "n/a" || u === "not specified") return "";
  return u;
}

/**
 * Pick the best-scoring portion from a USDA Survey/Foundation/SR Legacy
 * `foodPortions[]` array. Prefers natural-unit modifiers ("medium",
 * "large", "whole") over USDA "standard serving" jargon ("NLEA serving").
 *
 * Returns `null` when every entry scores below zero (all placeholders).
 */
export function pickUsdaFoodPortionsPrimaryServing(
  per100g: MacrosPer100gLite,
  portions: UsdaFoodPortion[] | null | undefined,
): PrimaryServing | null {
  if (!Array.isArray(portions) || portions.length === 0) return null;
  let best: { portion: UsdaFoodPortion; score: number } | null = null;
  for (const p of portions) {
    const score = scoreUsdaPortion(p);
    if (score < 0) continue;
    if (!best || score > best.score) best = { portion: p, score };
  }
  if (!best) return null;
  const p = best.portion;
  const grams = typeof p.gramWeight === "number" ? p.gramWeight : Number(p.gramWeight ?? 0);
  const desc = (p.portionDescription ?? "").trim();
  const mod = (p.modifier ?? "").trim();
  const amount = typeof p.amount === "number" && p.amount > 0 ? p.amount : 1;
  const unit = cleanUnitToken(p.measureUnit?.name ?? p.measureUnit?.abbreviation ?? "");
  // F-88 — assemble a clean label. Drop the parenthetical size hint
  // ("(7" to 7-7/8" long)") that USDA tacks onto banana modifiers — the
  // gram weight already conveys "this is a medium one". Result reads
  // "1 medium" rather than `1 medium (7" to 7-7/8" long)`.
  const cleanedMod = mod.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const label = desc
    || [amount, unit, cleanedMod].filter(Boolean).join(" ").trim()
    || `${grams} g`;
  return scalePrimaryServingFromPer100g(per100g, label.toLowerCase(), grams);
}

/**
 * Narrow OpenFoodFacts `serving_size` parser. Accepts only unambiguous
 * mass strings — "28 g", "1 slice (28 g)", "250 ml". Returns `null` for
 * anything else ("1 piece" with no gram weight → skip; don't guess).
 */
export function parseOffPrimaryServing(
  per100g: MacrosPer100gLite,
  rawServingSize: string | null | undefined,
): PrimaryServing | null {
  if (typeof rawServingSize !== "string") return null;
  const raw = rawServingSize.trim();
  if (!raw) return null;

  // "1 slice (28 g)" or "4 dumplings (82 g)" — take parenthetical mass,
  // keep the outer count/unit as the human label.
  const paren = raw.match(/^(.+?)\s*\(\s*(\d+(?:\.\d+)?)\s*(g|gram|grams|ml)\s*\)\s*$/i);
  if (paren) {
    const labelPart = paren[1]!.trim().toLowerCase();
    const grams = Number.parseFloat(paren[2]!);
    if (Number.isFinite(grams) && grams > 0 && labelPart) {
      return scalePrimaryServingFromPer100g(per100g, labelPart, grams);
    }
  }

  // "28 g" / "250 ml" — bare mass, label it "1 serving".
  const bare = raw.match(/^(\d+(?:\.\d+)?)\s*(g|gram|grams|ml)\s*$/i);
  if (bare) {
    const grams = Number.parseFloat(bare[1]!);
    if (Number.isFinite(grams) && grams > 0) {
      return scalePrimaryServingFromPer100g(per100g, "1 serving", grams);
    }
  }

  return null;
}

/**
 * Build the natural-portion chip that the preview picker should default
 * to when a primary serving exists. Surfacing this as a `FoodPortion`-
 * shaped row lets the existing mobile/web preview UIs treat it like any
 * other unit without a new render branch.
 */
export function primaryServingToPortionChip(ps: PrimaryServing): {
  label: string;
  gramWeight: number;
  amount: number;
} {
  return { label: ps.label, gramWeight: ps.grams, amount: 1 };
}
