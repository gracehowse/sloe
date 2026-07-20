/**
 * ENG-1274 — seed ingredient → grocery price mapping (UK GBP, mid-range
 * supermarket indicative averages). This is NOT live pricing data — it is a
 * static reference table for honest *estimates* only. Prices are rounded and
 * intentionally coarse; the estimator surfaces a range, not a single penny.
 *
 * Source posture: indicative UK mid-market averages (2026-Q2), not tied to a
 * single retailer. Refresh via a follow-up data-integration ticket when a live
 * feed exists.
 */

export type IngredientPriceEntry = {
  /** Lower-case match keys (longest wins at lookup time). */
  keys: readonly string[];
  /** Indicative price in GBP per 100 g (or per countable unit when `perEach`). */
  gbpPer100g: number;
  /** When true, `gbpPer100g` is the price for one discrete piece, not 100 g. */
  perEach?: boolean;
};

/**
 * Sorted longest-key-first at module init so substring matching prefers the
 * most specific rule ("chicken breast" before "chicken").
 */
export const INGREDIENT_PRICE_TABLE: readonly IngredientPriceEntry[] = [
  // Proteins
  { keys: ["chicken breast", "chicken breasts"], gbpPer100g: 2.5 },
  { keys: ["chicken thigh", "chicken thighs"], gbpPer100g: 1.9 },
  { keys: ["chicken"], gbpPer100g: 2.2 },
  { keys: ["turkey"], gbpPer100g: 2.4 },
  { keys: ["beef mince", "minced beef"], gbpPer100g: 2.8 },
  { keys: ["beef steak", "steak"], gbpPer100g: 4.5 },
  { keys: ["beef"], gbpPer100g: 3.6 },
  { keys: ["pork mince"], gbpPer100g: 2.4 },
  { keys: ["pork"], gbpPer100g: 2.8 },
  { keys: ["lamb"], gbpPer100g: 4.2 },
  { keys: ["salmon"], gbpPer100g: 3.8 },
  { keys: ["cod", "haddock", "white fish"], gbpPer100g: 3.2 },
  { keys: ["tuna"], gbpPer100g: 2.6 },
  { keys: ["prawn", "prawns", "shrimp"], gbpPer100g: 3.4 },
  { keys: ["tofu"], gbpPer100g: 1.4 },
  { keys: ["tempeh"], gbpPer100g: 2.0 },
  { keys: ["egg", "eggs"], gbpPer100g: 0.35, perEach: true },

  // Dairy
  { keys: ["cheddar", "cheddar cheese"], gbpPer100g: 1.8 },
  { keys: ["mozzarella"], gbpPer100g: 1.6 },
  { keys: ["parmesan", "parmigiano"], gbpPer100g: 3.2 },
  { keys: ["feta"], gbpPer100g: 2.0 },
  { keys: ["cottage cheese"], gbpPer100g: 1.2 },
  { keys: ["cream cheese"], gbpPer100g: 1.5 },
  { keys: ["butter"], gbpPer100g: 1.1 },
  { keys: ["milk"], gbpPer100g: 0.12 },
  { keys: ["cream", "double cream", "single cream"], gbpPer100g: 0.55 },
  { keys: ["yogurt", "yoghurt", "greek yogurt", "greek yoghurt"], gbpPer100g: 0.65 },
  { keys: ["cheese"], gbpPer100g: 1.9 },

  // Carbs & grains
  { keys: ["basmati rice", "jasmine rice"], gbpPer100g: 0.28 },
  { keys: ["rice"], gbpPer100g: 0.22 },
  { keys: ["pasta", "spaghetti", "penne", "fusilli"], gbpPer100g: 0.25 },
  { keys: ["noodle", "noodles"], gbpPer100g: 0.3 },
  { keys: ["bread", "sourdough", "baguette"], gbpPer100g: 0.35 },
  { keys: ["tortilla", "wrap", "pitta", "naan"], gbpPer100g: 0.45 },
  { keys: ["potato", "potatoes"], gbpPer100g: 0.18 },
  { keys: ["sweet potato"], gbpPer100g: 0.28 },
  { keys: ["oats", "porridge oats"], gbpPer100g: 0.2 },
  { keys: ["quinoa"], gbpPer100g: 0.9 },
  { keys: ["couscous"], gbpPer100g: 0.35 },
  { keys: ["flour"], gbpPer100g: 0.15 },

  // Legumes & tinned
  { keys: ["chickpea", "chickpeas"], gbpPer100g: 0.35 },
  { keys: ["lentil", "lentils"], gbpPer100g: 0.3 },
  { keys: ["black bean", "kidney bean", "cannellini", "beans"], gbpPer100g: 0.32 },
  { keys: ["tomato", "chopped tomato", "tinned tomato", "passata"], gbpPer100g: 0.2 },
  { keys: ["coconut milk"], gbpPer100g: 0.35 },

  // Produce
  { keys: ["onion", "onions"], gbpPer100g: 0.2 },
  { keys: ["garlic"], gbpPer100g: 0.8 },
  { keys: ["shallot", "shallots"], gbpPer100g: 0.9 },
  { keys: ["carrot", "carrots"], gbpPer100g: 0.18 },
  { keys: ["celery"], gbpPer100g: 0.35 },
  { keys: ["pepper", "bell pepper", "red pepper"], gbpPer100g: 0.45 },
  { keys: ["courgette", "zucchini"], gbpPer100g: 0.35 },
  { keys: ["aubergine", "eggplant"], gbpPer100g: 0.4 },
  { keys: ["mushroom", "mushrooms"], gbpPer100g: 0.55 },
  { keys: ["spinach"], gbpPer100g: 0.5 },
  { keys: ["kale"], gbpPer100g: 0.55 },
  { keys: ["broccoli"], gbpPer100g: 0.45 },
  { keys: ["cauliflower"], gbpPer100g: 0.4 },
  { keys: ["cabbage"], gbpPer100g: 0.2 },
  { keys: ["lettuce", "rocket", "arugula"], gbpPer100g: 0.6 },
  { keys: ["cucumber"], gbpPer100g: 0.3 },
  { keys: ["tomato", "tomatoes"], gbpPer100g: 0.35 },
  { keys: ["avocado"], gbpPer100g: 0.9 },
  { keys: ["lemon", "lemons", "lime", "limes"], gbpPer100g: 0.5 },
  { keys: ["apple", "apples"], gbpPer100g: 0.35 },
  { keys: ["banana", "bananas"], gbpPer100g: 0.25 },
  { keys: ["berry", "berries", "strawberr"], gbpPer100g: 1.2 },

  // Pantry
  { keys: ["olive oil"], gbpPer100g: 0.9 },
  { keys: ["vegetable oil", "sunflower oil"], gbpPer100g: 0.25 },
  { keys: ["honey"], gbpPer100g: 1.1 },
  { keys: ["sugar"], gbpPer100g: 0.15 },
  { keys: ["soy sauce"], gbpPer100g: 0.4 },
  { keys: ["vinegar"], gbpPer100g: 0.3 },
  { keys: ["stock", "broth"], gbpPer100g: 0.15 },
  { keys: ["peanut butter"], gbpPer100g: 0.7 },
  { keys: ["almond", "almonds"], gbpPer100g: 1.8 },
  { keys: ["walnut", "walnuts"], gbpPer100g: 2.0 },
  { keys: ["nut", "nuts"], gbpPer100g: 1.6 },
  { keys: ["herb", "herbs", "basil", "parsley", "coriander", "mint", "thyme", "oregano"], gbpPer100g: 1.5 },
  { keys: ["spice", "spices", "cumin", "paprika", "turmeric", "cinnamon"], gbpPer100g: 2.5 },
  { keys: ["salt"], gbpPer100g: 0.05 },
  { keys: ["bacon", "pancetta", "prosciutto"], gbpPer100g: 2.8 },
  { keys: ["sausage", "sausages"], gbpPer100g: 2.2 },
  { keys: ["ham"], gbpPer100g: 1.8 },
];

type PriceLookupRule = {
  key: string;
  gbpPer100g: number;
  perEach: boolean;
};

const PRICE_LOOKUP_RULES: PriceLookupRule[] = INGREDIENT_PRICE_TABLE.flatMap((entry) =>
  entry.keys.map((key) => ({
    key,
    gbpPer100g: entry.gbpPer100g,
    perEach: entry.perEach === true,
  })),
).sort((a, b) => b.key.length - a.key.length);

/**
 * Resolve an indicative price for a normalised ingredient name. Returns null
 * when no table entry matches — callers must exclude unmatched lines rather
 * than invent a price.
 */
export function lookupIngredientPrice(normalisedName: string): PriceLookupRule | null {
  const name = normalisedName.trim().toLowerCase();
  if (!name) return null;
  for (const rule of PRICE_LOOKUP_RULES) {
    if (name.includes(rule.key) || rule.key.includes(name)) return rule;
  }
  return null;
}
