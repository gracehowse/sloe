/**
 * Ingredient measure → grams resolver.
 *
 * KNOWN APPROXIMATION: the generic `COUNT_WEIGHT_G.{large,medium,small}`
 * fallback (~180 / 110 / 70 g) is applied before food-specific count
 * rules are evaluated in some paths. For proteins this produces notable
 * error (e.g. 2 large chicken breasts → 360 g via generic vs 400 g via
 * food-specific). Fix: re-order so name-specific rules fire first.
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
  // Egg size modifiers: "2 medium eggs" → 2 × 44g, not 2 × 110g.
  if ((u === "small" || u === "medium" || u === "large") && /\begg(?:s)?\b/.test(name)) {
    return { grams: amt * EGG_SIZE_G[u]! };
  }
  if (u === "medium") return { grams: amt * COUNT_WEIGHT_G.medium };
  if (u === "large") return { grams: amt * COUNT_WEIGHT_G.large };
  if (u === "small") return { grams: amt * COUNT_WEIGHT_G.small };
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
    // Meat cuts — use realistic per-piece weights
    if (/(?:chicken|turkey).{0,24}breast|breast.{0,24}(?:chicken|turkey)|chicken breast/.test(name)) {
      return { grams: amt * poultryBreastGramsEach(name) };
    }
    if (/chicken thigh/.test(name)) return { grams: amt * 120 };
    if (/drumstick/.test(name)) return { grams: amt * 90 };
    if (/(?:chicken|turkey) wing/.test(name)) return { grams: amt * 40 };
    if (/fillet|filet/.test(name)) return { grams: amt * 170 };
    if (/steak/.test(name)) return { grams: amt * 225 };
    if (/chop/.test(name)) return { grams: amt * 150 };
    // Medium-sized whole produce
    if (/(?:bell|red|green|yellow|orange|sweet|romano|roasted)\s+peppers?/.test(name)) {
      return { grams: amt * COUNT_WEIGHT_G.medium };
    }
    if (/\bpeppers\b/.test(name) && !/\b(?:black|white|cayenne|chili|chilli)\b/.test(name)) {
      return { grams: amt * COUNT_WEIGHT_G.medium };
    }
    if (/\bpepper\b/.test(name) && !/\b(?:black|white|cayenne|chili|chilli|ground|cracked)\b/.test(name) && amt >= 1) {
      return { grams: amt * COUNT_WEIGHT_G.medium };
    }
    if (/carrot|onion|potato|sweet potato|tomato|lemon|lime|egg|apple|banana|avocado|courgette|zucchini|aubergine|eggplant/.test(name)) {
      const per = /egg/.test(name) ? COUNT_WEIGHT_G.egg : COUNT_WEIGHT_G.medium;
      return { grams: amt * per };
    }
    if (/anchov|olive|caper|cornichon|gherkin|cherry tomato|grape tomato|radish|shallot|date|prune|almond|walnut|pecan|cashew|pistachio|hazelnut|macadamia|peanut/.test(name)) {
      return { grams: amt * 5 };
    }
    if (/mushroom|strawberr|fig|apricot|plum|prawn|shrimp|mussel|clam|scallop|oyster/.test(name)) {
      return { grams: amt * 15 };
    }
    if (/sausage|biscuit|cookie|cracker|tortilla|wrap|pitta|naan/.test(name)) {
      return { grams: amt * 50 };
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
