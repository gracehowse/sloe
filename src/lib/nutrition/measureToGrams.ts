export type MeasureInput = {
  name: string;
  amount: number;
  unit: string;
  /** g per ml (oils differ); defaults to 1 */
  gPerMl?: number;
};

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

const ML_PER_TBSP = 14.7868;
const ML_PER_TSP = 4.92892;
const ML_PER_CUP_US = 236.588;

export function measureToGrams(input: MeasureInput): number {
  const name = input.name.trim().toLowerCase();
  const amt = Number.isFinite(input.amount) && input.amount > 0 ? input.amount : 1;
  const u = input.unit.trim().toLowerCase();
  const gPerMl = input.gPerMl ?? 1;

  if (u === "tbsp") return amt * ML_PER_TBSP * gPerMl;
  if (u === "tsp") return amt * ML_PER_TSP * gPerMl;
  // Default density 0.9 g/ml is a weighted average across common cup contents
  // (liquids ~1.0, grains ~0.55–0.78, flour ~0.53). Previous 0.55 underestimated
  // liquids by ~45%. Callers should pass gPerMl from STAPLES for precision.
  if (u === "cup" || u === "mug") return amt * ML_PER_CUP_US * (input.gPerMl ?? 0.9);

  if (u === "g") return amt;
  if (u === "kg") return amt * 1000;
  if (u === "ml") return amt * gPerMl;
  if (u === "l") return amt * 1000 * gPerMl;
  if (u === "fl oz" || u === "floz") return amt * 29.5735 * gPerMl;
  if (u === "oz") return amt * 28.3495;
  if (u === "lb") return amt * 453.592;

  if (u === "clove") return amt * COUNT_WEIGHT_G.clove;
  if (u === "sprig") return amt * COUNT_WEIGHT_G.sprig;
  if (u === "rasher") return amt * COUNT_WEIGHT_G.rasher;
  if (u === "slice") {
    // Deli/cured meats: thin slices ~10g; bread: ~30g; cheese: ~20g; default: 25g
    if (/prosciutto|parma|serrano|bresaola|salami|chorizo|coppa|pancetta|mortadella|ham.*cur|cur.*ham|deli/i.test(name)) return amt * 10;
    if (/bread|toast/i.test(name)) return amt * 30;
    if (/cheese/i.test(name)) return amt * 20;
    return amt * COUNT_WEIGHT_G.slice;
  }
  if (u === "stalk") return amt * COUNT_WEIGHT_G.stalk;
  if (u === "medium") return amt * COUNT_WEIGHT_G.medium;
  if (u === "large") return amt * COUNT_WEIGHT_G.large;
  if (u === "small") return amt * COUNT_WEIGHT_G.small;
  if (u === "pinch") return amt * COUNT_WEIGHT_G.pinch;
  if (u === "leaf") return amt * 0.35;
  if (u === "tin" || u === "can") {
    // Tinned tomatoes: 400g whole can. Beans/chickpeas: ~240g drained. Other: 220g default.
    if (/tomato|plum|chopped|passata|marzano|diced/.test(name)) return amt * 400;
    if (/bean|chickpea|lentil|kidney|cannellini|butter bean|lima|black bean|pinto/.test(name)) return amt * 240;
    return amt * 220;
  }
  if (u === "pack") return amt * (/basil|herb|lettuce|salad|rocket|arugula|spinach/.test(name) ? 35 : 120);

  // Lookup unit in the COUNT_WEIGHT_G table (handles drizzle, dash, handful, etc.)
  if (COUNT_WEIGHT_G[u] != null) return amt * COUNT_WEIGHT_G[u];

  if (u === "count" || u === "" || u === "each") {
    // Check if the name itself contains a quantity word (e.g. "drizzle of honey")
    for (const [word, g] of Object.entries(COUNT_WEIGHT_G)) {
      if (name.includes(word)) return amt * g;
    }
    // Meat cuts — use realistic per-piece weights
    if (/chicken breast/.test(name)) return amt * 200;
    if (/chicken thigh/.test(name)) return amt * 120;
    if (/drumstick/.test(name)) return amt * 90;
    if (/(?:chicken|turkey) wing/.test(name)) return amt * 40;
    if (/fillet|filet/.test(name)) return amt * 170;
    if (/steak/.test(name)) return amt * 225;
    if (/chop/.test(name)) return amt * 150;
    // Medium-sized whole produce
    // Peppers: colour-qualified → vegetable (110g); bare "pepper(s)" plural → vegetable; singular "pepper" → spice (handled below)
    if (/(?:bell|red|green|yellow|orange|sweet|romano|roasted)\s+peppers?/.test(name)) {
      return amt * COUNT_WEIGHT_G.medium;
    }
    // "peppers" (plural) likely means vegetable; bare "pepper" without spice qualifiers in countable context
    if (/\bpeppers\b/.test(name) && !/\b(?:black|white|cayenne|chili|chilli)\b/.test(name)) {
      return amt * COUNT_WEIGHT_G.medium;
    }
    if (/\bpepper\b/.test(name) && !/\b(?:black|white|cayenne|chili|chilli|ground|cracked)\b/.test(name) && amt >= 1) {
      return amt * COUNT_WEIGHT_G.medium;
    }
    if (/carrot|onion|potato|sweet potato|tomato|lemon|lime|egg|apple|banana|avocado|courgette|zucchini|aubergine|eggplant/.test(name)) {
      const per = /egg/.test(name) ? COUNT_WEIGHT_G.egg : COUNT_WEIGHT_G.medium;
      return amt * per;
    }
    // Small items (individual pieces weigh a few grams)
    if (/anchov|olive|caper|cornichon|gherkin|cherry tomato|grape tomato|radish|shallot|date|prune|almond|walnut|pecan|cashew|pistachio|hazelnut|macadamia|peanut/.test(name)) {
      return amt * 5;
    }
    // Medium-small items
    if (/mushroom|strawberr|fig|apricot|plum|prawn|shrimp|mussel|clam|scallop|oyster/.test(name)) {
      return amt * 15;
    }
    // Sausages, biscuits etc (check BEFORE herbs — "sausage" contains "sage")
    if (/sausage|biscuit|cookie|cracker|tortilla|wrap|pitta|naan/.test(name)) {
      return amt * 50;
    }
    // Herbs and spices are light (use \b to avoid matching "sage" inside "sausage")
    if (/\b(?:salt|pepper|cinnamon|cumin|paprika|turmeric|oregano|thyme|basil|parsley|chili|chilli|nutmeg|cayenne|coriander|mint|dill|tarragon|sage)\b/.test(name)) {
      return amt * 3;
    }
    // Liquid condiments / sauces — default to ~15ml (1 tbsp) per "count"
    if (/sauce|syrup|vinegar|extract|essence|paste|purée|puree|concentrate|dressing|glaze|marinade/.test(name)) {
      return amt * 15;
    }
    // Grains, pulses, dried goods — a "serving" is roughly 75g dry
    if (/rice|pasta|noodle|couscous|quinoa|bulgur|oat|lentil|bean|chickpea|pea.*dried/.test(name)) {
      return amt * 75;
    }
    // Catch-all: 80g is a reasonable middle-ground for an unrecognised medium food item
    if (process.env.NODE_ENV === "development") {
      console.warn(`[measureToGrams] no unit match for count item "${name}", using 80g default`);
    }
    return amt * 80;
  }

  // Unrecognised unit — fall back to name-based heuristics (same as unit="" path).
  // This handles cases like unit="whole" or unit="piece" that aren't in the table.
  return measureToGrams({ ...input, unit: "" });
}

