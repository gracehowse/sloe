/**
 * Estimate calories + macros for a single ingredient line (no external API).
 * Values are approximate; suitable for home-cooking recipes.
 *
 * Weight calculation delegates to measureToGrams (single source of truth for
 * count-to-weight, unit conversions, and name-based heuristics). This file
 * only owns the STAPLES macro table and the stapleForName lookup.
 */

import { measureToGramsDetailed } from "./measureToGrams";

export type MacroBreakdown = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  /** Null when the staple does not define sugar (unknown, not zero). */
  sugarG: number | null;
  /** Null when the staple does not define sodium (unknown, not zero). */
  sodiumMg: number | null;
  /** True when the ingredient could not be matched to any known staple and
   *  fell back to the generic default (150 kcal/100g). UI should surface this
   *  so users know the estimate may be unreliable. */
  isDefaultFallback?: boolean;
  /** True when the ingredient text implied a cooked preparation (grilled,
   *  roasted, fried, etc.) but the matched staple is a raw/generic entry.
   *  Macros are NOT adjusted — caller should warn the user. */
  preparationApproximation?: boolean;
  /** True when the cup conversion fell back to the default 0.9 g/ml density. */
  densityDefaulted?: boolean;
  /** True when the amount string could not be parsed (e.g. "some",
   *  "a few"). Macros are returned as zero with confidence 0. */
  amountUnparseable?: boolean;
  /** True when measured weight came out as 0g or negative — no reliable
   *  match. Macros are returned as zero with confidence 0. */
  noReliableMatch?: boolean;
  /** Recommended confidence for this line. 0..1. When present, callers
   *  should prefer this over their own heuristic. */
  confidence?: number;
};

type StapleMacros = Omit<MacroBreakdown, "sugarG" | "sodiumMg"> & {
  sugarG?: number;
  sodiumMg?: number;
};

type Staple = {
  /** Per 100 g edible portion. sugarG/sodiumMg may be omitted → unknown. */
  per100g: StapleMacros;
  /** Optional density g per 1 ml (oils ~0.92, water 1) */
  gPerMl?: number;
};

const STAPLES: Record<string, Staple> = {
  "olive oil": { per100g: { calories: 884, protein: 0, carbs: 0, fat: 100, fiberG: 0 }, gPerMl: 0.92 },
  oil: { per100g: { calories: 884, protein: 0, carbs: 0, fat: 100, fiberG: 0 }, gPerMl: 0.92 },
  butter: { per100g: { calories: 717, protein: 0.9, carbs: 0.1, fat: 81, fiberG: 0 } },
  onion: { per100g: { calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiberG: 1.7 } },
  carrot: { per100g: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2, fiberG: 2.8 } },
  celery: { per100g: { calories: 14, protein: 0.7, carbs: 3, fat: 0.2, fiberG: 1.6 } },
  garlic: { per100g: { calories: 149, protein: 6.4, carbs: 33, fat: 0.5, fiberG: 2.1 } },
  rosemary: { per100g: { calories: 131, protein: 3.3, carbs: 21, fat: 5.9, fiberG: 14.1 } },
  thyme: { per100g: { calories: 101, protein: 5.6, carbs: 24, fat: 1.7, fiberG: 14 } },
  bacon: { per100g: { calories: 541, protein: 37, carbs: 1.4, fat: 42, fiberG: 0, sodiumMg: 1717 } },
  "chicken breast": { per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiberG: 0 } },
  chicken: { per100g: { calories: 200, protein: 27, carbs: 0, fat: 10, fiberG: 0 } },
  beef: { per100g: { calories: 250, protein: 26, carbs: 0, fat: 17, fiberG: 0 } },
  rice: { per100g: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiberG: 0.4 }, gPerMl: 0.78 },
  pasta: { per100g: { calories: 131, protein: 5, carbs: 25, fat: 1.1, fiberG: 1.8 }, gPerMl: 0.55 },
  flour: { per100g: { calories: 364, protein: 10, carbs: 76, fat: 1, fiberG: 2.7 }, gPerMl: 0.53 },
  sugar: { per100g: { calories: 387, protein: 0, carbs: 100, fat: 0, fiberG: 0, sugarG: 100 }, gPerMl: 0.85 },
  salt: { per100g: { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0, sodiumMg: 38758 } },
  "black pepper": { per100g: { calories: 251, protein: 10, carbs: 64, fat: 3.3, fiberG: 25.3 } },
  "white pepper": { per100g: { calories: 296, protein: 10.4, carbs: 68, fat: 2.1, fiberG: 26.2 } },
  "red pepper": { per100g: { calories: 31, protein: 1, carbs: 6, fat: 0.3, fiberG: 2.1 } },
  "green pepper": { per100g: { calories: 20, protein: 0.9, carbs: 4.6, fat: 0.2, fiberG: 1.7 } },
  "yellow pepper": { per100g: { calories: 27, protein: 1, carbs: 6.3, fat: 0.2, fiberG: 0.9 } },
  "orange pepper": { per100g: { calories: 31, protein: 1, carbs: 6, fat: 0.3, fiberG: 2.1 } },
  "sweet pepper": { per100g: { calories: 31, protein: 1, carbs: 6, fat: 0.3, fiberG: 2.1 } },
  pepper: { per100g: { calories: 251, protein: 10, carbs: 64, fat: 3.3, fiberG: 25.3 } },
  tomato: { per100g: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiberG: 1.2 } },
  potato: { per100g: { calories: 77, protein: 2, carbs: 17, fat: 0.1, fiberG: 2.2 } },
  milk: { per100g: { calories: 42, protein: 3.4, carbs: 5, fat: 1, fiberG: 0, sugarG: 5 }, gPerMl: 1.03 },
  cream: { per100g: { calories: 340, protein: 2.8, carbs: 2.8, fat: 36, fiberG: 0 }, gPerMl: 0.99 },
  egg: { per100g: { calories: 143, protein: 13, carbs: 1.1, fat: 9.5, fiberG: 0 } },
  cheese: { per100g: { calories: 350, protein: 23, carbs: 1, fat: 28, fiberG: 0, sodiumMg: 621 } },
  salmon: { per100g: { calories: 208, protein: 20, carbs: 0, fat: 13, fiberG: 0 } },
  "bell pepper": { per100g: { calories: 31, protein: 1, carbs: 6, fat: 0.3, fiberG: 2.1 } },
  spinach: { per100g: { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiberG: 2.2 } },
  mushroom: { per100g: { calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3, fiberG: 1 } },
  lemon: { per100g: { calories: 29, protein: 1.1, carbs: 9, fat: 0.3, fiberG: 2.8 } },
  lime: { per100g: { calories: 30, protein: 0.7, carbs: 11, fat: 0.2, fiberG: 2.8 } },
  honey: { per100g: { calories: 304, protein: 0.3, carbs: 82, fat: 0, fiberG: 0.2, sugarG: 82 }, gPerMl: 1.42 },
  stock: { per100g: { calories: 5, protein: 0.5, carbs: 0.5, fat: 0.2, fiberG: 0, sodiumMg: 300 }, gPerMl: 1.0 },
  wine: { per100g: { calories: 83, protein: 0.1, carbs: 2.6, fat: 0, fiberG: 0 }, gPerMl: 0.99 },
  "beef mince": { per100g: { calories: 250, protein: 26, carbs: 0, fat: 17, fiberG: 0 } },
  mince: { per100g: { calories: 250, protein: 26, carbs: 0, fat: 17, fiberG: 0 } },
  "tomato purée": { per100g: { calories: 82, protein: 4.3, carbs: 16, fat: 0.5, fiberG: 3.9 } },
  "tomato paste": { per100g: { calories: 82, protein: 4.3, carbs: 16, fat: 0.5, fiberG: 3.9 } },
  "plum tomato": { per100g: { calories: 20, protein: 1, carbs: 4.2, fat: 0.2, fiberG: 1.2 } },
  basil: { per100g: { calories: 23, protein: 3.2, carbs: 2.6, fat: 0.6, fiberG: 1.6 } },
  oregano: { per100g: { calories: 265, protein: 9, carbs: 69, fat: 4.3, fiberG: 42.5 } },
  "bay leaf": { per100g: { calories: 313, protein: 7.2, carbs: 75, fat: 8.4, fiberG: 26.3 } },
  "chicken thigh": { per100g: { calories: 209, protein: 26, carbs: 0, fat: 11, fiberG: 0 } },
  "chicken drumstick": { per100g: { calories: 172, protein: 28, carbs: 0, fat: 6, fiberG: 0 } },
  "chicken wing": { per100g: { calories: 203, protein: 30, carbs: 0, fat: 8, fiberG: 0 } },
  lamb: { per100g: { calories: 258, protein: 25, carbs: 0, fat: 17, fiberG: 0 } },
  pork: { per100g: { calories: 242, protein: 27, carbs: 0, fat: 14, fiberG: 0 } },
  turkey: { per100g: { calories: 135, protein: 30, carbs: 0, fat: 1, fiberG: 0 } },
  cod: { per100g: { calories: 82, protein: 18, carbs: 0, fat: 0.7, fiberG: 0 } },
  tuna: { per100g: { calories: 132, protein: 28, carbs: 0, fat: 1.3, fiberG: 0 } },
  prawn: { per100g: { calories: 99, protein: 24, carbs: 0.2, fat: 0.3, fiberG: 0 } },
  shrimp: { per100g: { calories: 99, protein: 24, carbs: 0.2, fat: 0.3, fiberG: 0 } },
  tofu: { per100g: { calories: 76, protein: 8, carbs: 1.9, fat: 4.8, fiberG: 0.3 } },
  banana: { per100g: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiberG: 2.6 } },
  apple: { per100g: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiberG: 2.4 } },
  avocado: { per100g: { calories: 160, protein: 2, carbs: 9, fat: 15, fiberG: 6.7 } },
  broccoli: { per100g: { calories: 34, protein: 2.8, carbs: 7, fat: 0.4, fiberG: 2.6 } },
  "sweet potato": { per100g: { calories: 86, protein: 1.6, carbs: 20, fat: 0.1, fiberG: 3 } },
  courgette: { per100g: { calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3, fiberG: 1 } },
  zucchini: { per100g: { calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3, fiberG: 1 } },
  cucumber: { per100g: { calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiberG: 0.5 } },
  "soy sauce": { per100g: { calories: 53, protein: 8, carbs: 4.9, fat: 0.6, fiberG: 0.8 } },
  yogurt: { per100g: { calories: 59, protein: 10, carbs: 3.6, fat: 0.4, fiberG: 0 }, gPerMl: 1.04 },
  oats: { per100g: { calories: 389, protein: 17, carbs: 66, fat: 7, fiberG: 10.6 }, gPerMl: 0.34 },
  lentil: { per100g: { calories: 116, protein: 9, carbs: 20, fat: 0.4, fiberG: 7.9 }, gPerMl: 0.80 },
  chickpea: { per100g: { calories: 164, protein: 8.9, carbs: 27, fat: 2.6, fiberG: 7.6 }, gPerMl: 0.80 },
  // ── Nuts & seeds ─────────────────────────────────────────────
  almond: { per100g: { calories: 579, protein: 21, carbs: 22, fat: 50, fiberG: 12.5 } },
  walnut: { per100g: { calories: 654, protein: 15, carbs: 14, fat: 65, fiberG: 6.7 } },
  cashew: { per100g: { calories: 553, protein: 18, carbs: 30, fat: 44, fiberG: 3.3 } },
  "peanut butter": { per100g: { calories: 588, protein: 25, carbs: 20, fat: 50, fiberG: 6 } },
  peanut: { per100g: { calories: 567, protein: 26, carbs: 16, fat: 49, fiberG: 8.5 } },
  "sesame seed": { per100g: { calories: 573, protein: 18, carbs: 23, fat: 50, fiberG: 11.8 } },
  "chia seed": { per100g: { calories: 486, protein: 17, carbs: 42, fat: 31, fiberG: 34.4 } },
  "flax seed": { per100g: { calories: 534, protein: 18, carbs: 29, fat: 42, fiberG: 27.3 } },
  "sunflower seed": { per100g: { calories: 584, protein: 21, carbs: 20, fat: 51, fiberG: 8.6 } },
  "pine nut": { per100g: { calories: 673, protein: 14, carbs: 13, fat: 68, fiberG: 3.7 } },
  coconut: { per100g: { calories: 354, protein: 3.3, carbs: 15, fat: 33, fiberG: 9 } },
  "coconut milk": { per100g: { calories: 230, protein: 2.3, carbs: 6, fat: 24, fiberG: 2.2 }, gPerMl: 1.0 },
  "coconut oil": { per100g: { calories: 862, protein: 0, carbs: 0, fat: 100, fiberG: 0 }, gPerMl: 0.92 },
  // ── Grains & legumes ─────────────────────────────────────────
  quinoa: { per100g: { calories: 120, protein: 4.4, carbs: 21, fat: 1.9, fiberG: 2.8 }, gPerMl: 0.72 },
  couscous: { per100g: { calories: 112, protein: 3.8, carbs: 23, fat: 0.2, fiberG: 1.4 }, gPerMl: 0.63 },
  "black bean": { per100g: { calories: 132, protein: 8.9, carbs: 24, fat: 0.5, fiberG: 8.7 }, gPerMl: 0.77 },
  "kidney bean": { per100g: { calories: 127, protein: 8.7, carbs: 23, fat: 0.5, fiberG: 6.4 }, gPerMl: 0.77 },
  bread: { per100g: { calories: 265, protein: 9, carbs: 49, fat: 3.2, fiberG: 2.7 } },
  tortilla: { per100g: { calories: 312, protein: 8, carbs: 52, fat: 8, fiberG: 3.4 } },
  noodle: { per100g: { calories: 138, protein: 4.5, carbs: 25, fat: 2.1, fiberG: 1.2 } },
  polenta: { per100g: { calories: 85, protein: 2, carbs: 18, fat: 0.5, fiberG: 1.4 } },
  // ── Dairy & alternatives ─────────────────────────────────────
  "cream cheese": { per100g: { calories: 342, protein: 6, carbs: 4, fat: 34, fiberG: 0 } },
  mozzarella: { per100g: { calories: 280, protein: 28, carbs: 3.1, fat: 17, fiberG: 0 } },
  parmesan: { per100g: { calories: 431, protein: 38, carbs: 4, fat: 29, fiberG: 0 } },
  "sour cream": { per100g: { calories: 193, protein: 2.1, carbs: 4.6, fat: 20, fiberG: 0 }, gPerMl: 1.01 },
  "greek yogurt": { per100g: { calories: 97, protein: 9, carbs: 3.6, fat: 5, fiberG: 0 }, gPerMl: 1.06 },
  ricotta: { per100g: { calories: 174, protein: 11, carbs: 3, fat: 13, fiberG: 0 } },
  feta: { per100g: { calories: 264, protein: 14, carbs: 4, fat: 21, fiberG: 0 } },
  // ── Vegetables ───────────────────────────────────────────────
  kale: { per100g: { calories: 35, protein: 2.9, carbs: 4.4, fat: 1.5, fiberG: 4.1 } },
  cauliflower: { per100g: { calories: 25, protein: 1.9, carbs: 5, fat: 0.3, fiberG: 2 } },
  asparagus: { per100g: { calories: 20, protein: 2.2, carbs: 3.9, fat: 0.1, fiberG: 2.1 } },
  "green bean": { per100g: { calories: 31, protein: 1.8, carbs: 7, fat: 0.1, fiberG: 3.4 } },
  pea: { per100g: { calories: 81, protein: 5.4, carbs: 14, fat: 0.4, fiberG: 5.1 } },
  corn: { per100g: { calories: 86, protein: 3.3, carbs: 19, fat: 1.2, fiberG: 2.7 } },
  cabbage: { per100g: { calories: 25, protein: 1.3, carbs: 6, fat: 0.1, fiberG: 2.5 } },
  beetroot: { per100g: { calories: 43, protein: 1.6, carbs: 10, fat: 0.2, fiberG: 2.8 } },
  lettuce: { per100g: { calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2, fiberG: 1.3 } },
  aubergine: { per100g: { calories: 25, protein: 1, carbs: 6, fat: 0.2, fiberG: 3 } },
  eggplant: { per100g: { calories: 25, protein: 1, carbs: 6, fat: 0.2, fiberG: 3 } },
  leek: { per100g: { calories: 61, protein: 1.5, carbs: 14, fat: 0.3, fiberG: 1.8 } },
  ginger: { per100g: { calories: 80, protein: 1.8, carbs: 18, fat: 0.8, fiberG: 2 } },
  // ── Fruits ───────────────────────────────────────────────────
  strawberry: { per100g: { calories: 32, protein: 0.7, carbs: 8, fat: 0.3, fiberG: 2 } },
  blueberry: { per100g: { calories: 57, protein: 0.7, carbs: 14, fat: 0.3, fiberG: 2.4 } },
  raspberry: { per100g: { calories: 52, protein: 1.2, carbs: 12, fat: 0.7, fiberG: 6.5 } },
  mango: { per100g: { calories: 60, protein: 0.8, carbs: 15, fat: 0.4, fiberG: 1.6 } },
  orange: { per100g: { calories: 47, protein: 0.9, carbs: 12, fat: 0.1, fiberG: 2.4 } },
  pineapple: { per100g: { calories: 50, protein: 0.5, carbs: 13, fat: 0.1, fiberG: 1.4 } },
  grape: { per100g: { calories: 69, protein: 0.7, carbs: 18, fat: 0.2, fiberG: 0.9 } },
  peach: { per100g: { calories: 39, protein: 0.9, carbs: 10, fat: 0.3, fiberG: 1.5 } },
  // ── Condiments & sauces ──────────────────────────────────────
  vinegar: { per100g: { calories: 18, protein: 0, carbs: 0.6, fat: 0, fiberG: 0 }, gPerMl: 1.01 },
  mayonnaise: { per100g: { calories: 680, protein: 1, carbs: 1, fat: 75, fiberG: 0 }, gPerMl: 0.91 },
  ketchup: { per100g: { calories: 112, protein: 1.7, carbs: 26, fat: 0.3, fiberG: 0.3, sugarG: 22, sodiumMg: 907 }, gPerMl: 1.15 },
  mustard: { per100g: { calories: 60, protein: 4, carbs: 6, fat: 3, fiberG: 3 } },
  tahini: { per100g: { calories: 595, protein: 17, carbs: 21, fat: 54, fiberG: 9 } },
  "maple syrup": { per100g: { calories: 260, protein: 0, carbs: 67, fat: 0, fiberG: 0, sugarG: 60 }, gPerMl: 1.33 },
  // ── Seafood ──────────────────────────────────────────────────
  mackerel: { per100g: { calories: 205, protein: 19, carbs: 0, fat: 14, fiberG: 0 } },
  sardine: { per100g: { calories: 208, protein: 25, carbs: 0, fat: 11, fiberG: 0 } },
  haddock: { per100g: { calories: 90, protein: 20, carbs: 0, fat: 0.6, fiberG: 0 } },
  squid: { per100g: { calories: 92, protein: 16, carbs: 3, fat: 1.4, fiberG: 0 } },
  default: { per100g: { calories: 150, protein: 5, carbs: 15, fat: 6, fiberG: 2 } },
};

/* COUNT_WEIGHT_G and unit conversion constants live in measureToGrams.ts
 * (single source of truth). This file only handles STAPLES macros + scaling. */

/** Preparation keywords that imply cooked state. */
const PREPARATION_KEYWORDS = /\b(grilled|cooked|baked|fried|boiled|roasted|steamed|braised|smoked|sauteed|saut[ée]ed|broiled|poached|seared)\b/i;

/** Staple keys whose entries represent raw/generic state (not cooked). */
const RAW_STAPLE_KEYS = new Set([
  "chicken", "chicken breast", "chicken thigh", "chicken drumstick", "chicken wing",
  "beef", "beef mince", "mince", "pork", "lamb", "turkey",
  "salmon", "cod", "tuna", "haddock", "mackerel", "sardine", "squid",
  "prawn", "shrimp",
  "egg", "tofu",
]);

function stapleForName(name: string): { staple: Staple; isDefault: boolean; matchedKey: string } {
  const n = name.toLowerCase().trim();
  if (!n) return { staple: STAPLES.default, isDefault: true, matchedKey: "default" };
  const keys = Object.keys(STAPLES).filter((k) => k !== "default");

  // Collect every key that matches with a word boundary. Optional trailing "s"
  // on each key's final word handles plurals: "lentil" → matches "lentils",
  // "tomato" → matches "tomatoes", "chickpea" → "chickpeas".
  type Match = { key: string; length: number; endIndex: number; wordCount: number };
  const matches: Match[] = [];
  for (const k of keys) {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Allow trailing "s" OR "es" on the final word only.
    const re = new RegExp(`\\b${escaped}(?:es|s)?\\b`, "i");
    const m = n.match(re);
    if (m && m.index !== undefined) {
      matches.push({
        key: k,
        length: k.length,
        endIndex: m.index + m[0].length,
        wordCount: k.split(/\s+/).length,
      });
    }
  }
  if (matches.length === 0) return { staple: STAPLES.default, isDefault: true, matchedKey: "default" };

  // Ranking:
  //  1. multi-word keys beat single-word (specificity — "olive oil" > "oil").
  //  2. among equal word-count, the right-most match wins — English compound
  //     ingredients carry the head noun at the end: "chicken stock" → stock.
  //  3. tie-break by longer key.
  matches.sort((a, b) => {
    if (b.wordCount !== a.wordCount) return b.wordCount - a.wordCount;
    if (b.endIndex !== a.endIndex) return b.endIndex - a.endIndex;
    return b.length - a.length;
  });
  const best = matches[0];
  return { staple: STAPLES[best.key]!, isDefault: false, matchedKey: best.key };
}

/**
 * Parse a human-written amount string into a number.
 *
 * Returns `{ amount: 1, unparseable: true }` when the caller gave us a
 * non-empty string we couldn't parse (e.g. "some", "a few"). Empty strings
 * resolve cleanly to 1 (no flag) to preserve the common "1 unit" default.
 */
function parseAmountNumeric(amount: string): { amount: number; unparseable: boolean } {
  const t = amount.trim();
  if (!t) return { amount: 1, unparseable: false };
  if (t.includes("-")) {
    const [a, b] = t.split("-").map((x) => Number.parseFloat(x.trim()));
    if (Number.isFinite(a) && Number.isFinite(b)) return { amount: (a + b) / 2, unparseable: false };
  }
  const v = Number.parseFloat(t);
  if (Number.isFinite(v) && v > 0) return { amount: v, unparseable: false };
  return { amount: 1, unparseable: true };
}

function scale(m: StapleMacros, factor: number): MacroBreakdown {
  return {
    calories: (m.calories * factor) / 100,
    protein: (m.protein * factor) / 100,
    carbs: (m.carbs * factor) / 100,
    fat: (m.fat * factor) / 100,
    fiberG: (m.fiberG * factor) / 100,
    sugarG: m.sugarG === undefined ? null : (m.sugarG * factor) / 100,
    sodiumMg: m.sodiumMg === undefined ? null : (m.sodiumMg * factor) / 100,
  };
}

function emptyResult(flags: Partial<MacroBreakdown>): MacroBreakdown {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiberG: 0,
    sugarG: null,
    sodiumMg: null,
    confidence: 0,
    ...flags,
  };
}

/**
 * Estimate total macros for one structured ingredient row.
 * Delegates weight calculation to measureToGrams (single source of truth).
 */
export function estimateLineMacros(input: {
  name: string;
  amount: string;
  unit: string;
}): MacroBreakdown {
  const name = input.name.trim() || "ingredient";
  const { staple, isDefault, matchedKey } = stapleForName(name);
  const { amount: amt, unparseable } = parseAmountNumeric(input.amount);

  // H16 — refuse to silently treat "some chicken" as "1 chicken".
  if (unparseable) {
    return emptyResult({ amountUnparseable: true, isDefaultFallback: isDefault || undefined });
  }

  const u = input.unit.trim().toLowerCase();

  const measure = measureToGramsDetailed({
    name,
    amount: amt,
    unit: u,
    gPerMl: staple.gPerMl,
  });
  const grams = measure.grams;

  // H15 — grams must be positive; don't paper over a 0g conversion.
  if (!Number.isFinite(grams) || grams <= 0) {
    return emptyResult({ noReliableMatch: true, isDefaultFallback: isDefault || undefined });
  }

  // C4 — flag raw/cooked mismatch. Do NOT correct the macros; just lower
  // confidence and annotate so the caller (and UI) can warn.
  const nameHasCookedKeyword = PREPARATION_KEYWORDS.test(name);
  const stapleIsRaw = RAW_STAPLE_KEYS.has(matchedKey);
  const preparationApproximation = nameHasCookedKeyword && stapleIsRaw;

  const scaled = scale(staple.per100g, grams);
  const baseConfidence = isDefault ? 0.15 : 0.35;
  const confidence = Math.max(
    0,
    baseConfidence - (preparationApproximation ? 0.1 : 0),
  );

  return {
    calories: Math.max(0, Math.round(scaled.calories)),
    protein: Math.max(0, Math.round(scaled.protein * 10) / 10),
    carbs: Math.max(0, Math.round(scaled.carbs * 10) / 10),
    fat: Math.max(0, Math.round(scaled.fat * 10) / 10),
    fiberG: Math.max(0, Math.round(scaled.fiberG * 10) / 10),
    sugarG: scaled.sugarG === null ? null : Math.max(0, Math.round(scaled.sugarG * 10) / 10),
    sodiumMg: scaled.sodiumMg === null ? null : Math.max(0, Math.round(scaled.sodiumMg)),
    confidence,
    ...(isDefault ? { isDefaultFallback: true } : {}),
    ...(preparationApproximation ? { preparationApproximation: true } : {}),
    ...(measure.densityDefaulted ? { densityDefaulted: true } : {}),
  };
}

export function sumMacros(rows: MacroBreakdown[]): MacroBreakdown {
  return rows.reduce<MacroBreakdown>(
    (acc, r) => ({
      calories: acc.calories + r.calories,
      protein: acc.protein + r.protein,
      carbs: acc.carbs + r.carbs,
      fat: acc.fat + r.fat,
      fiberG: acc.fiberG + r.fiberG,
      sugarG:
        acc.sugarG === null && r.sugarG === null
          ? null
          : (acc.sugarG ?? 0) + (r.sugarG ?? 0),
      sodiumMg:
        acc.sodiumMg === null && r.sodiumMg === null
          ? null
          : (acc.sodiumMg ?? 0) + (r.sodiumMg ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0, sugarG: null, sodiumMg: null },
  );
}
