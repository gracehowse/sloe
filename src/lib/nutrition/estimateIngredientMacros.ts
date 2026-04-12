/**
 * Estimate calories + macros for a single ingredient line (no external API).
 * Values are approximate; suitable for home-cooking recipes.
 */

export type MacroBreakdown = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type Staple = {
  /** Per 100 g edible portion */
  per100g: MacroBreakdown;
  /** Optional density g per 1 ml (oils ~0.92, water 1) */
  gPerMl?: number;
};

const STAPLES: Record<string, Staple> = {
  "olive oil": { per100g: { calories: 884, protein: 0, carbs: 0, fat: 100 }, gPerMl: 0.92 },
  oil: { per100g: { calories: 884, protein: 0, carbs: 0, fat: 100 }, gPerMl: 0.92 },
  butter: { per100g: { calories: 717, protein: 0.9, carbs: 0.1, fat: 81 } },
  onion: { per100g: { calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1 } },
  carrot: { per100g: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 } },
  celery: { per100g: { calories: 14, protein: 0.7, carbs: 3, fat: 0.2 } },
  garlic: { per100g: { calories: 149, protein: 6.4, carbs: 33, fat: 0.5 } },
  rosemary: { per100g: { calories: 131, protein: 3.3, carbs: 21, fat: 5.9 } },
  thyme: { per100g: { calories: 101, protein: 5.6, carbs: 24, fat: 1.7 } },
  bacon: { per100g: { calories: 541, protein: 37, carbs: 1.4, fat: 42 } },
  "chicken breast": { per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 } },
  chicken: { per100g: { calories: 200, protein: 27, carbs: 0, fat: 10 } },
  beef: { per100g: { calories: 250, protein: 26, carbs: 0, fat: 17 } },
  rice: { per100g: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 } },
  pasta: { per100g: { calories: 131, protein: 5, carbs: 25, fat: 1.1 } },
  flour: { per100g: { calories: 364, protein: 10, carbs: 76, fat: 1 } },
  sugar: { per100g: { calories: 387, protein: 0, carbs: 100, fat: 0 } },
  salt: { per100g: { calories: 0, protein: 0, carbs: 0, fat: 0 } },
  pepper: { per100g: { calories: 251, protein: 10, carbs: 64, fat: 3.3 } },
  tomato: { per100g: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 } },
  potato: { per100g: { calories: 77, protein: 2, carbs: 17, fat: 0.1 } },
  milk: { per100g: { calories: 42, protein: 3.4, carbs: 5, fat: 1 } },
  cream: { per100g: { calories: 340, protein: 2.8, carbs: 2.8, fat: 36 } },
  egg: { per100g: { calories: 143, protein: 13, carbs: 1.1, fat: 9.5 } },
  cheese: { per100g: { calories: 350, protein: 23, carbs: 1, fat: 28 } },
  salmon: { per100g: { calories: 208, protein: 20, carbs: 0, fat: 13 } },
  "bell pepper": { per100g: { calories: 31, protein: 1, carbs: 6, fat: 0.3 } },
  spinach: { per100g: { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 } },
  mushroom: { per100g: { calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3 } },
  lemon: { per100g: { calories: 29, protein: 1.1, carbs: 9, fat: 0.3 } },
  lime: { per100g: { calories: 30, protein: 0.7, carbs: 11, fat: 0.2 } },
  honey: { per100g: { calories: 304, protein: 0.3, carbs: 82, fat: 0 } },
  stock: { per100g: { calories: 5, protein: 0.5, carbs: 0.5, fat: 0.2 } },
  wine: { per100g: { calories: 83, protein: 0.1, carbs: 2.6, fat: 0 } },
  "beef mince": { per100g: { calories: 250, protein: 26, carbs: 0, fat: 17 } },
  mince: { per100g: { calories: 250, protein: 26, carbs: 0, fat: 17 } },
  "tomato purée": { per100g: { calories: 82, protein: 4.3, carbs: 16, fat: 0.5 } },
  "tomato paste": { per100g: { calories: 82, protein: 4.3, carbs: 16, fat: 0.5 } },
  "plum tomato": { per100g: { calories: 20, protein: 1, carbs: 4.2, fat: 0.2 } },
  basil: { per100g: { calories: 23, protein: 3.2, carbs: 2.6, fat: 0.6 } },
  oregano: { per100g: { calories: 265, protein: 9, carbs: 69, fat: 4.3 } },
  "bay leaf": { per100g: { calories: 313, protein: 7.2, carbs: 75, fat: 8.4 } },
  default: { per100g: { calories: 150, protein: 5, carbs: 15, fat: 6 } },
};

/** Average grams per countable unit (rough) */
const COUNT_WEIGHT_G: Record<string, number> = {
  clove: 4,
  sprig: 2,
  rasher: 28,
  slice: 25,
  stalk: 40,
  medium: 110, // e.g. onion
  large: 180,
  small: 80,
  pinch: 0.3,
  egg: 50,
};

const ML_PER_TBSP = 14.7868;
const ML_PER_TSP = 4.92892;
const ML_PER_CUP_US = 236.588;

function stapleForName(name: string): Staple {
  const n = name.toLowerCase().trim();
  if (!n) return STAPLES.default;
  const keys = Object.keys(STAPLES).filter((k) => k !== "default").sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (n.includes(k)) return STAPLES[k]!;
  }
  return STAPLES.default;
}

function parseAmountNumeric(amount: string): number {
  const t = amount.trim();
  if (!t) return 1;
  if (t.includes("-")) {
    const [a, b] = t.split("-").map((x) => Number.parseFloat(x.trim()));
    if (Number.isFinite(a) && Number.isFinite(b)) return (a + b) / 2;
  }
  const v = Number.parseFloat(t);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function scale(m: MacroBreakdown, factor: number): MacroBreakdown {
  return {
    calories: (m.calories * factor) / 100,
    protein: (m.protein * factor) / 100,
    carbs: (m.carbs * factor) / 100,
    fat: (m.fat * factor) / 100,
  };
}

/** Estimate grams per countable item based on name pattern. */
function countableGrams(name: string): number {
  const n = name.toLowerCase();
  if (/egg/i.test(n)) return COUNT_WEIGHT_G.egg;
  if (/carrot|onion|potato|tomato|lemon|lime|pepper|apple|banana|courgette|zucchini|aubergine|eggplant|cucumber|avocado|beetroot|turnip|parsnip|leek|mango|peach|pear|orange/i.test(n)) return COUNT_WEIGHT_G.medium;
  if (/sausage/i.test(n)) return 50;
  // Small items
  if (/anchov|olive|caper|cornichon|gherkin|cherry tomato|grape tomato|radish|date|prune|almond|walnut|pecan|cashew|pistachio|hazelnut|peanut/i.test(n)) return 5;
  if (/mushroom|strawberr|fig|apricot|plum|prawn|shrimp|mussel|clam|scallop|oyster|shallot/i.test(n)) return 15;
  if (/salt|pepper|cinnamon|cumin|paprika|turmeric|oregano|thyme|basil|parsley|chili|chilli|nutmeg|cayenne|coriander|mint|dill/i.test(n)) return 3;
  return 80;
}

/**
 * Estimate total macros for one structured ingredient row.
 */
export function estimateLineMacros(input: {
  name: string;
  amount: string;
  unit: string;
}): MacroBreakdown {
  const name = input.name.trim() || "ingredient";
  const staple = stapleForName(name);
  const amt = parseAmountNumeric(input.amount);
  const u = input.unit.trim().toLowerCase();

  let grams = 0;

  if (u === "tbsp" || u === "tablespoon" || u === "tablespoons") {
    const ml = amt * ML_PER_TBSP;
    const gPerMl = staple.gPerMl ?? 1;
    grams = ml * gPerMl;
  } else if (u === "tsp" || u === "teaspoon" || u === "teaspoons") {
    const ml = amt * ML_PER_TSP;
    const gPerMl = staple.gPerMl ?? 1;
    grams = ml * gPerMl;
  } else if (u === "cup" || u === "cups") {
    const ml = amt * ML_PER_CUP_US;
    const gPerMl = staple.gPerMl ?? 0.55; // rough for non-liquids in cup
    grams = ml * gPerMl;
  } else if (u === "g" || u === "gram" || u === "grams") {
    grams = amt;
  } else if (u === "kg") {
    grams = amt * 1000;
  } else if (u === "ml") {
    grams = amt * (staple.gPerMl ?? 1);
  } else if (u === "fl oz" || u === "floz") {
    grams = amt * 29.5735 * (staple.gPerMl ?? 1);
  } else if (u === "l") {
    grams = amt * 1000 * (staple.gPerMl ?? 1);
  } else if (u === "oz" || u === "ounce" || u === "ounces") {
    grams = amt * 28.3495;
  } else if (u === "lb" || u === "pound" || u === "pounds") {
    grams = amt * 453.592;
  } else if (u === "clove" || u === "cloves") {
    grams = amt * COUNT_WEIGHT_G.clove;
  } else if (u === "sprig" || u === "sprigs") {
    grams = amt * COUNT_WEIGHT_G.sprig;
  } else if (u === "rasher" || u === "rashers") {
    grams = amt * COUNT_WEIGHT_G.rasher;
  } else if (u === "slice" || u === "slices") {
    grams = amt * COUNT_WEIGHT_G.slice;
  } else if (u === "stalk" || u === "stalks") {
    grams = amt * COUNT_WEIGHT_G.stalk;
  } else if (u === "medium") {
    grams = amt * COUNT_WEIGHT_G.medium;
  } else if (u === "large") {
    grams = amt * COUNT_WEIGHT_G.large;
  } else if (u === "small") {
    grams = amt * COUNT_WEIGHT_G.small;
  } else if (u === "pinch" || u === "pinches") {
    grams = amt * COUNT_WEIGHT_G.pinch;
  } else if (u === "tin" || u === "tins") {
    const perTin = /tomato|plum|chopped|passata|marzano|diced/i.test(name) ? 400 : 220;
    grams = amt * perTin;
  } else if (u === "pack" || u === "packs") {
    grams = amt * (/basil|herb|lettuce|salad|rocket|arugula|spinach/i.test(name) ? 35 : 120);
  } else if (u === "leaf" || u === "leaves") {
    grams = amt * 0.35;
  } else if (u === "count" || u === "each" || u === "piece" || u === "pieces") {
    grams = amt * countableGrams(name);
  } else if (!u && amt > 0) {
    grams = amt * countableGrams(name);
  } else {
    grams = amt * 50;
  }

  if (grams <= 0) grams = 30;

  const scaled = scale(staple.per100g, grams);
  return {
    calories: Math.max(0, Math.round(scaled.calories)),
    protein: Math.max(0, Math.round(scaled.protein * 10) / 10),
    carbs: Math.max(0, Math.round(scaled.carbs * 10) / 10),
    fat: Math.max(0, Math.round(scaled.fat * 10) / 10),
  };
}

export function sumMacros(rows: MacroBreakdown[]): MacroBreakdown {
  return rows.reduce(
    (acc, r) => ({
      calories: acc.calories + r.calories,
      protein: acc.protein + r.protein,
      carbs: acc.carbs + r.carbs,
      fat: acc.fat + r.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}
