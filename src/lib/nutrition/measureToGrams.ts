/**
 * Ingredient measure → grams resolver.
 *
 * Count→grams resolution evaluates food-specific per-piece weights
 * (`foodSpecificCountGramsEach`) BEFORE the generic `COUNT_WEIGHT_G`
 * size/count fallback, so e.g. "2 large chicken breasts" → 400 g
 * (food-specific) not 360 g (generic size word). See the resolver
 * branches at ~lines 210–225 and ~260–266 (ENG-701).
 * Policy reference: `docs/product/nutrition-approximation-policy.md` §A3.
 */
export type CupRegion = "us" | "uk" | "metric";

export type MeasureInput = {
  name: string;
  amount: number;
  unit: string;
  /** g per ml (oils differ); defaults to 1 */
  gPerMl?: number;
  /** Cup convention — defaults to 'us' to preserve historical behaviour. */
  cupRegion?: CupRegion;
};

/**
 * Result returned by {@link measureToGramsDetailed}. Exposes flags so callers
 * can surface uncertainty (density defaulting, tin fallbacks) to users.
 */
export type MeasureResult = {
  grams: number;
  /** True when a cup/mug was converted using the default 0.9 g/ml density
   *  because the staple did not provide an explicit density. */
  densityDefaulted?: boolean;
};

/** Cooked vs raw per-piece breast weight (F-158 / ENG-564). */
export function poultryBreastGramsEach(ingredientName: string): number {
  const name = ingredientName.trim().toLowerCase();
  const cooked =
    /\b(cooked|roasted|grilled|baked|fried|boiled|steamed|smoked)\b/i.test(name) &&
    !/\b(raw|uncooked)\b/i.test(name);
  return cooked ? 150 : 200;
}

const COUNT_WEIGHT_G: Record<string, number> = {
  clove: 4,
  sprig: 2,
  rasher: 28,
  slice: 25,
  stalk: 40,
  medium: 110,
  large: 180,
  small: 80,
  pinch: 0.3,
  egg: 50,
  drizzle: 8,
  dash: 2,
  splash: 10,
  handful: 30,
  bunch: 60,
  knob: 15,
  head: 200,
  bulb: 60,
  stick: 30,
  fillet: 170,
  breast: 200,
  thigh: 120,
  drumstick: 90,
  wing: 40,
  can: 400,
  jar: 250,
  chop: 150,
  steak: 225,
  leg: 250,
};

/**
 * Result of {@link foodSpecificCountRef}: the grams ONE countable piece weighs,
 * plus whether that weight is defensible enough to surface as HIGH confidence.
 */
export type CountPieceRef = {
  /** Grams one countable piece weighs. */
  grams: number;
  /**
   * True when `grams` is a defensible single-food reference weight (a specific
   * USDA FoodData Central / Handbook per-piece value). False when it is a
   * coarse multi-food catch-all bucket whose per-piece weight varies too widely
   * to trust — those must NOT be surfaced as HIGH confidence (ENG-1544).
   */
  confident: boolean;
};

/**
 * ENG-701 / ENG-1544 — food-specific per-piece ("count") reference for a
 * discrete, countable ingredient, or `null` when no food-specific rule applies.
 *
 * This is the single source of truth for "what does ONE of this food weigh?"
 * It is consulted FIRST by both the count/no-unit path AND the generic size
 * word (large/medium/small) path, so a food-specific weight always beats the
 * generic ~180/110/80 g size fallback. Lookup order is:
 *   food-specific override → generic size → default.
 *
 * Per-piece weights are USDA FoodData Central single-unit portions / USDA
 * Handbook values (nuts = one shelled kernel or half; produce/stone fruit =
 * one medium). ENG-1544 replaced the old coarse buckets — "any nut = 5 g" (≈4×
 * too heavy for almonds) and "any small stone fruit = 15 g" (60–77% too light
 * for apricots/plums) — with these single-food references, and marks the two
 * remaining catch-all buckets (misc small pickled/allium bits; misc small
 * shellfish) `confident: false` so a coarse guess never rides on the HIGH tier.
 *
 * Only covers DISCRETE pieces (proteins, nuts, small/medium produce, etc.).
 * Bulk staples (rice/pasta/herbs/sauces) return null here because "one large
 * rice" is not a meaningful piece — those stay on the count-path heuristics or
 * the generic size fallback.
 */
export function foodSpecificCountRef(ingredientName: string): CountPieceRef | null {
  const name = ingredientName.trim().toLowerCase();
  const ref = (grams: number): CountPieceRef => ({ grams, confident: true });
  const coarse = (grams: number): CountPieceRef => ({ grams, confident: false });

  // ── Meat cuts — realistic per-piece weights (raw/cooked aware for poultry).
  if (/(?:chicken|turkey).{0,24}breast|breast.{0,24}(?:chicken|turkey)|chicken breast/.test(name)) {
    return ref(poultryBreastGramsEach(name));
  }
  if (/chicken thigh/.test(name)) return ref(120);
  if (/drumstick/.test(name)) return ref(90);
  if (/(?:chicken|turkey) wing/.test(name)) return ref(40);
  if (/fillet|filet/.test(name)) return ref(170);
  if (/steak/.test(name)) return ref(225);
  if (/chop/.test(name)) return ref(150);

  // ── Whole produce that comes in pieces — one medium reference weight.
  if (/(?:bell|red|green|yellow|orange|sweet|romano|roasted)\s+peppers?/.test(name)) return ref(110);
  if (/\bpeppers\b/.test(name) && !/\b(?:black|white|cayenne|chili|chilli)\b/.test(name)) return ref(110);
  if (/\bpepper\b/.test(name) && !/\b(?:black|white|cayenne|chili|chilli|ground|cracked)\b/.test(name)) return ref(110);
  if (/carrot|onion|potato|sweet potato|tomato|lemon|lime|apple|banana|avocado|courgette|zucchini|aubergine|eggplant/.test(name)) {
    return ref(110);
  }

  // ── Nuts — one shelled kernel / half (USDA FDC single-unit portions). The
  //    old coarse "any nut = 5 g" bucket was ~4× too heavy for almonds and
  //    wrong for the rest (ENG-1544).
  if (/almond/.test(name)) return ref(1.2);
  if (/walnut/.test(name)) return ref(2.5); // one half
  if (/cashew/.test(name)) return ref(1.5);
  if (/pistachio/.test(name)) return ref(0.7); // one kernel
  if (/hazelnut/.test(name)) return ref(1.0);
  if (/pecan/.test(name)) return ref(1.0); // one half
  if (/macadamia/.test(name)) return ref(2.5);
  if (/peanut/.test(name)) return ref(1.0); // one shelled kernel

  // ── Dried / stone fruit — single-piece USDA references. The old coarse 15 g
  //    bucket left stone fruit 60–77% too light (ENG-1544).
  if (/\bfigs?\b/.test(name)) return ref(/dried/.test(name) ? 8 : 50);
  if (/apricot/.test(name)) return ref(/dried/.test(name) ? 8 : 35);
  if (/\bplums?\b/.test(name)) return ref(65);
  if (/prune/.test(name)) return ref(9.5);
  if (/\bdates?\b/.test(name)) return ref(7);

  // ── Mushroom (button) / strawberry — single-piece USDA references.
  if (/mushroom/.test(name)) return ref(20);
  if (/strawberr/.test(name)) return ref(12);

  // ── Baked / handheld single pieces (biscuit, cookie, cracker, wrap ≈ 50 g).
  if (/sausage|biscuit|cookie|cracker|tortilla|wrap|pitta|naan/.test(name)) return ref(50);

  // ── Coarse catch-alls — a weight is still returned so the resolver yields a
  //    number, but per-piece varies too widely to trust for aggregation (a
  //    caper ≈ 0.3 g vs a shallot ≈ 30 g; a mussel vs an oyster), so these are
  //    NOT confident and stay off the HIGH tier (ENG-1544 — "if nutrition is
  //    uncertain, do not guess").
  if (/anchov|olive|caper|cornichon|gherkin|radish|shallot/.test(name)) return coarse(5);
  if (/prawn|shrimp|mussel|clam|scallop|oyster/.test(name)) return coarse(15);

  return null;
}

/**
 * ENG-701 — grams ONE countable piece of a food weighs, or `null` when no
 * food-specific rule applies. Thin wrapper over {@link foodSpecificCountRef}:
 * the resolver only needs the weight, while confidence is read separately by
 * {@link measureToGramsConfidence} via the ref's `confident` flag.
 */
export function foodSpecificCountGramsEach(ingredientName: string): number | null {
  return foodSpecificCountRef(ingredientName)?.grams ?? null;
}

/**
 * Per-egg weights by size modifier (USDA / British Egg Industry Council).
 * Used when the ingredient is explicitly an egg and a size unit is given.
 */
export const EGG_SIZE_G: Record<string, number> = {
  small: 38,
  medium: 44,
  large: 50,
  "extra-large": 56,
  "extra large": 56,
  xl: 56,
  jumbo: 63,
};

/**
 * Tin/can weights keyed by ingredient context. Matched against the ingredient
 * name before falling back to the generic 220 g default.
 */
export const TIN_WEIGHTS_G: Record<string, number> = {
  tuna: 145,
  anchovies: 50,
  anchovy: 50,
  coconut_milk: 400,
  chickpeas: 240,
  chickpea: 240,
  tomatoes: 400,
  tomato: 400,
  beans: 240,
  bean: 240,
};

const ML_PER_TBSP = 14.7868;
const ML_PER_TSP = 4.92892;
export const ML_PER_CUP_US = 236.588;
export const ML_PER_CUP_UK = 284;
export const ML_PER_CUP_METRIC = 250;

function mlPerCup(region: CupRegion | undefined): number {
  if (region === "uk") return ML_PER_CUP_UK;
  if (region === "metric") return ML_PER_CUP_METRIC;
  return ML_PER_CUP_US;
}

/**
 * Full result form — returns grams plus flags. Prefer this when the caller
 * needs to warn the user about low-confidence conversions (e.g. defaulted
 * density for cups).
 */
export function measureToGramsDetailed(input: MeasureInput): MeasureResult {
  const name = input.name.trim().toLowerCase();
  const amt = Number.isFinite(input.amount) && input.amount > 0 ? input.amount : 1;
  const u = input.unit.trim().toLowerCase();
  const gPerMl = input.gPerMl ?? 1;

  if (u === "tbsp") return { grams: amt * ML_PER_TBSP * gPerMl };
  if (u === "tsp") return { grams: amt * ML_PER_TSP * gPerMl };
  // Default density 0.9 g/ml is a weighted average across common cup contents
  // (liquids ~1.0, grains ~0.55–0.78, flour ~0.53). Callers should pass gPerMl
  // from STAPLES for precision; when they don't we flag densityDefaulted so UI
  // can surface the uncertainty.
  if (u === "cup" || u === "mug") {
    const ml = mlPerCup(input.cupRegion);
    const density = input.gPerMl ?? 0.9;
    const densityDefaulted = input.gPerMl === undefined;
    return { grams: amt * ml * density, ...(densityDefaulted ? { densityDefaulted: true } : {}) };
  }

  if (u === "g") return { grams: amt };
  if (u === "kg") return { grams: amt * 1000 };
  if (u === "ml") return { grams: amt * gPerMl };
  if (u === "l") return { grams: amt * 1000 * gPerMl };
  if (u === "fl oz" || u === "floz") return { grams: amt * 29.5735 * gPerMl };
  if (u === "oz") return { grams: amt * 28.3495 };
  if (u === "lb") return { grams: amt * 453.592 };

  if (u === "clove") return { grams: amt * COUNT_WEIGHT_G.clove };
  if (u === "sprig") return { grams: amt * COUNT_WEIGHT_G.sprig };
  if (u === "rasher") return { grams: amt * COUNT_WEIGHT_G.rasher };
  if (u === "slice") {
    // Deli/cured meats: thin slices ~10g; bread: ~30g; cheese: ~20g; default: 25g
    if (/prosciutto|parma|serrano|bresaola|salami|chorizo|coppa|pancetta|mortadella|ham.*cur|cur.*ham|deli/i.test(name)) return { grams: amt * 10 };
    if (/bread|toast/i.test(name)) return { grams: amt * 30 };
    if (/cheese/i.test(name)) return { grams: amt * 20 };
    return { grams: amt * COUNT_WEIGHT_G.slice };
  }
  if (u === "stalk") return { grams: amt * COUNT_WEIGHT_G.stalk };
  // Size words (large/medium/small): food-specific rules win over the generic
  // size fallback (ENG-701). Lookup order: food-specific → generic size.
  if (u === "small" || u === "medium" || u === "large") {
    // Egg size modifiers: "2 medium eggs" → 2 × 44g, not 2 × 110g.
    if (/\begg(?:s)?\b/.test(name)) {
      return { grams: amt * EGG_SIZE_G[u]! };
    }
    // Food-specific per-piece weight beats the generic size word.
    // "2 large chicken breasts" → 2 × 200g = 400g, not 2 × 180g = 360g.
    // "1 large walnut" → 5g (walnut-specific), not 180g (generic large).
    const foodSpecific = foodSpecificCountGramsEach(name);
    if (foodSpecific != null) {
      return { grams: amt * foodSpecific };
    }
    // No food-specific rule — fall back to the generic size weight.
    return { grams: amt * COUNT_WEIGHT_G[u]! };
  }
  if (u === "pinch") return { grams: amt * COUNT_WEIGHT_G.pinch };
  if (u === "leaf") return { grams: amt * 0.35 };
  if (u === "tin" || u === "can") {
    // Tinned tomatoes: 400g whole can. Beans/chickpeas: ~240g drained. Coconut milk: 400g.
    // Tuna: 145g (drained). Anchovies: 50g. Otherwise 220g default.
    if (/coconut\s*milk/.test(name)) return { grams: amt * TIN_WEIGHTS_G.coconut_milk! };
    if (/tomato|plum|chopped|passata|marzano|diced/.test(name)) return { grams: amt * TIN_WEIGHTS_G.tomatoes! };
    if (/bean|chickpea|lentil|kidney|cannellini|butter bean|lima|black bean|pinto/.test(name)) return { grams: amt * TIN_WEIGHTS_G.beans! };
    if (/tuna/.test(name)) return { grams: amt * TIN_WEIGHTS_G.tuna! };
    if (/anchov/.test(name)) return { grams: amt * TIN_WEIGHTS_G.anchovies! };
    return { grams: amt * 220 };
  }
  if (u === "pack") return { grams: amt * (/basil|herb|lettuce|salad|rocket|arugula|spinach/.test(name) ? 35 : 120) };

  // F-158: "2 × breast" on cooked chicken must not use raw 200g/breast.
  if ((u === "breast" || u === "breasts") && /(?:chicken|turkey)/.test(name)) {
    return { grams: amt * poultryBreastGramsEach(name) };
  }

  // Lookup unit in the COUNT_WEIGHT_G table (handles drizzle, dash, handful, etc.)
  if (COUNT_WEIGHT_G[u] != null) return { grams: amt * COUNT_WEIGHT_G[u] };

  if (u === "count" || u === "" || u === "each") {
    // Check if the name itself contains a quantity word (e.g. "drizzle of honey")
    for (const [word, g] of Object.entries(COUNT_WEIGHT_G)) {
      if (name.includes(word)) return { grams: amt * g };
    }
    // Eggs by name (no size word) → 50g each. Checked before the shared
    // discrete-piece resolver because "egg" isn't in that helper's whole-
    // produce branch (egg size handling lives on the size-word path).
    if (/egg/.test(name)) {
      return { grams: amt * COUNT_WEIGHT_G.egg };
    }
    // Food-specific discrete-piece weights (proteins, nuts, produce, etc.) —
    // shared with the size-word path so the two never disagree (ENG-701).
    const foodSpecific = foodSpecificCountGramsEach(name);
    if (foodSpecific != null) {
      return { grams: amt * foodSpecific };
    }
    if (/\b(?:salt|pepper|cinnamon|cumin|paprika|turmeric|oregano|thyme|basil|parsley|chili|chilli|nutmeg|cayenne|coriander|mint|dill|tarragon|sage)\b/.test(name)) {
      return { grams: amt * 3 };
    }
    if (/sauce|syrup|vinegar|extract|essence|paste|purée|puree|concentrate|dressing|glaze|marinade/.test(name)) {
      return { grams: amt * 15 };
    }
    if (/rice|pasta|noodle|couscous|quinoa|bulgur|oat|lentil|bean|chickpea|pea.*dried/.test(name)) {
      return { grams: amt * 75 };
    }
    if (process.env.NODE_ENV === "development") {
      console.warn(`[measureToGrams] no unit match for count item "${name}", using 80g default`);
    }
    return { grams: amt * 80 };
  }

  // Unrecognised unit — fall back to name-based heuristics (same as unit="" path).
  return measureToGramsDetailed({ ...input, unit: "" });
}

/**
 * Simple grams-only form, preserved for backward compatibility. Prefer
 * {@link measureToGramsDetailed} when you want access to quality flags.
 */
export function measureToGrams(input: MeasureInput): number {
  return measureToGramsDetailed(input).grams;
}

/**
 * Weight / volume units that convert to grams deterministically (mass) or with
 * a well-defined density (volume). These never fall back to a guessed weight.
 */
const HIGH_CONFIDENCE_WEIGHT_UNITS = new Set([
  "g",
  "kg",
  "oz",
  "lb",
  "ml",
  "l",
  "fl oz",
  "floz",
  "tbsp",
  "tsp",
]);

/**
 * ENG-943 — confidence read on a measure → grams conversion, for the shopping-
 * list count-to-weight normaliser. We must NEVER aggregate a count ("2 onions")
 * into a weight row ("400 g onions") on a guessed per-piece weight; the
 * generator only cross-converts when this returns `"high"`.
 *
 * `"high"` — the unit is a mass/volume unit, OR an explicit egg, OR a count/size
 *   of a food with a DEFENSIBLE single-food per-piece weight
 *   (`foodSpecificCountRef(...).confident`), OR a recognised discrete unit in
 *   `COUNT_WEIGHT_G` / the tin/pack branches — AND the conversion did not fall
 *   back to a defaulted cup density.
 * `"low"` — a bare count / size word with no food-specific rule (the generic
 *   80/110/180 g fallback) OR one that only resolves to a COARSE catch-all
 *   bucket (`confident: false` — misc pickled/allium bits, misc shellfish;
 *   ENG-1544), an unrecognised unit, or a cup/mug converted with a defaulted
 *   density. The caller keeps the count and weight as separate rows in this case
 *   (never guesses a weight on a low-confidence read).
 */
export function measureToGramsConfidence(input: MeasureInput): "high" | "low" {
  const name = input.name.trim().toLowerCase();
  const u = input.unit.trim().toLowerCase();

  // Defaulted cup density is explicitly a low-confidence conversion.
  const detailed = measureToGramsDetailed(input);
  if (detailed.densityDefaulted) return "low";

  // Mass + well-defined volume units convert deterministically.
  if (HIGH_CONFIDENCE_WEIGHT_UNITS.has(u)) return "high";

  // Egg size/count is well-characterised (per-egg weights by size).
  if (/\begg(?:s)?\b/.test(name)) return "high";

  // A count / size word is only high-confidence with a DEFENSIBLE single-food
  // per-piece weight. A coarse catch-all bucket (confident:false) or no rule at
  // all lands on a guess → LOW, so the count and weight stay separate rows
  // rather than aggregating on a guessed per-piece weight (ENG-1544).
  if (
    u === "count" ||
    u === "" ||
    u === "each" ||
    u === "small" ||
    u === "medium" ||
    u === "large"
  ) {
    return foodSpecificCountRef(name)?.confident === true ? "high" : "low";
  }

  // Recognised discrete units (clove, slice, rasher, stalk, …) have
  // characterised per-piece weights in COUNT_WEIGHT_G; tins/cans/packs resolve
  // via the contextual tin/pack branches.
  if (COUNT_WEIGHT_G[u] != null) return "high";
  if (
    u === "tin" ||
    u === "can" ||
    u === "pack" ||
    u === "clove" ||
    u === "sprig" ||
    u === "rasher" ||
    u === "slice" ||
    u === "stalk" ||
    u === "leaf" ||
    u === "pinch"
  ) {
    return "high";
  }

  // Unrecognised unit → name-based heuristic guess → low confidence.
  return "low";
}
