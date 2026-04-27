/**
 * F-73 follow-up (2026-04-27) — generic-foods match shim.
 *
 * Parallel to `genericBeverages.ts`, this module covers solid foods
 * that hit the same USDA-Branded-noise class as "cortado" did:
 *   - "apple" → USDA Branded "Apple Cinnamon Bagel" outranks the
 *     Foundation "Apples, raw, with skin" row
 *   - "chicken breast" → branded breaded fillets / nuggets outrank
 *     the raw-meat Foundation row
 *   - "rice" → cooked-Uncle-Ben's-style branded rows outrank
 *     "Rice, white, long-grain, cooked" Foundation
 *
 * Same fix shape as F-73:
 *   1. Small in-memory table of canonical generics (fruit, veg, grains,
 *      protein, dairy, nuts) with verified per-100g macros sourced from
 *      USDA Foundation / SR Legacy.
 *   2. `matchGenericFood(query)` — exact-alias match (case-insensitive,
 *      after normalisation) so multi-word queries like "chicken breast
 *      with skin" don't false-positive onto "chicken breast".
 *   3. Wired into `searchFoods()` ABOVE USDA Branded so a "banana"
 *      query lands the canonical Foundation row first.
 *
 * Per-100g macros are USDA SR Legacy unless noted. We prefer the
 * "raw" / "uncooked" / "as eaten" generic — users can swap to a
 * cooked / branded row from the same search results if they want
 * something more specific.
 *
 * No invented values: when a nutrient class is unknown for an entry
 * we leave it at 0 (per-rule "if uncertain, do not guess"). The
 * commit path treats 0 as "not tracked" rather than "definitely zero".
 */

export interface GenericFood {
  /** Stable id used as the search-result key + a `generic-food:${id}` slug. */
  id: string;
  /** Canonical display name (sentence case, plural where natural — "Eggs" not "Egg"). */
  name: string;
  /** Aliases the matcher will accept (lowercase, exact-match after normalisation). */
  aliases: ReadonlyArray<string>;
  /**
   * Typical serving — grams + display label. Users overwrite via the
   * standard portion picker; this is what the row shows by default.
   * E.g. apple = 182g (medium); chicken breast = 174g (one fillet);
   * rice = 158g (cooked, ~1 cup).
   */
  servingG: number;
  servingLabel: string;
  /** Per-100g macros (USDA SR Legacy / Foundation). */
  per100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiberG: number;
    sugarG: number;
    sodiumMg: number;
  };
  /** Short subtitle shown under the name in search results. */
  subtitle?: string;
}

export const GENERIC_FOODS: ReadonlyArray<GenericFood> = [
  // ── Fruit (raw, with skin where applicable) ────────────────────────
  {
    id: "apple",
    name: "Apple",
    aliases: ["apple", "apples", "raw apple", "fresh apple"],
    servingG: 182,
    servingLabel: "1 medium (182g)",
    per100g: { calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiberG: 2.4, sugarG: 10.4, sodiumMg: 1 },
    subtitle: "Raw · with skin",
  },
  {
    id: "banana",
    name: "Banana",
    aliases: ["banana", "bananas", "raw banana"],
    servingG: 118,
    servingLabel: "1 medium (118g)",
    per100g: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiberG: 2.6, sugarG: 12.2, sodiumMg: 1 },
    subtitle: "Raw",
  },
  {
    id: "orange",
    name: "Orange",
    aliases: ["orange", "oranges", "raw orange"],
    servingG: 131,
    servingLabel: "1 medium (131g)",
    per100g: { calories: 47, protein: 0.9, carbs: 11.8, fat: 0.1, fiberG: 2.4, sugarG: 9.4, sodiumMg: 0 },
    subtitle: "Raw · navel",
  },
  {
    id: "pear",
    name: "Pear",
    aliases: ["pear", "pears", "raw pear"],
    servingG: 178,
    servingLabel: "1 medium (178g)",
    per100g: { calories: 57, protein: 0.4, carbs: 15.2, fat: 0.1, fiberG: 3.1, sugarG: 9.8, sodiumMg: 1 },
    subtitle: "Raw · with skin",
  },
  {
    id: "grapes",
    name: "Grapes",
    aliases: ["grapes", "grape", "red grapes", "green grapes"],
    servingG: 92,
    servingLabel: "1 cup (92g)",
    per100g: { calories: 69, protein: 0.7, carbs: 18.1, fat: 0.2, fiberG: 0.9, sugarG: 15.5, sodiumMg: 2 },
    subtitle: "Raw",
  },
  {
    id: "strawberries",
    name: "Strawberries",
    aliases: ["strawberries", "strawberry", "raw strawberries"],
    servingG: 152,
    servingLabel: "1 cup (152g)",
    per100g: { calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiberG: 2.0, sugarG: 4.9, sodiumMg: 1 },
    subtitle: "Raw",
  },
  {
    id: "blueberries",
    name: "Blueberries",
    aliases: ["blueberries", "blueberry", "raw blueberries"],
    servingG: 148,
    servingLabel: "1 cup (148g)",
    per100g: { calories: 57, protein: 0.7, carbs: 14.5, fat: 0.3, fiberG: 2.4, sugarG: 9.7, sodiumMg: 1 },
    subtitle: "Raw",
  },
  {
    id: "mango",
    name: "Mango",
    aliases: ["mango", "mangoes", "raw mango"],
    servingG: 165,
    servingLabel: "1 cup sliced (165g)",
    per100g: { calories: 60, protein: 0.8, carbs: 15.0, fat: 0.4, fiberG: 1.6, sugarG: 13.7, sodiumMg: 1 },
    subtitle: "Raw",
  },

  // ── Vegetables (raw unless noted) ─────────────────────────────────
  {
    id: "broccoli",
    name: "Broccoli",
    aliases: ["broccoli", "raw broccoli"],
    servingG: 91,
    servingLabel: "1 cup chopped (91g)",
    per100g: { calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4, fiberG: 2.6, sugarG: 1.7, sodiumMg: 33 },
    subtitle: "Raw",
  },
  {
    id: "carrot",
    name: "Carrot",
    aliases: ["carrot", "carrots", "raw carrot"],
    servingG: 61,
    servingLabel: "1 medium (61g)",
    per100g: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2, fiberG: 2.8, sugarG: 4.7, sodiumMg: 69 },
    subtitle: "Raw",
  },
  {
    id: "onion",
    name: "Onion",
    aliases: ["onion", "onions", "raw onion", "yellow onion", "white onion"],
    servingG: 110,
    servingLabel: "1 medium (110g)",
    per100g: { calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiberG: 1.7, sugarG: 4.2, sodiumMg: 4 },
    subtitle: "Raw",
  },
  {
    id: "potato",
    name: "Potato",
    aliases: ["potato", "potatoes", "russet potato", "white potato"],
    servingG: 213,
    servingLabel: "1 medium (213g)",
    per100g: { calories: 77, protein: 2.0, carbs: 17.5, fat: 0.1, fiberG: 2.2, sugarG: 0.8, sodiumMg: 6 },
    subtitle: "Raw · flesh + skin",
  },
  {
    id: "sweet-potato",
    name: "Sweet potato",
    aliases: ["sweet potato", "sweet potatoes", "yam"],
    servingG: 130,
    servingLabel: "1 medium (130g)",
    per100g: { calories: 86, protein: 1.6, carbs: 20.1, fat: 0.1, fiberG: 3.0, sugarG: 4.2, sodiumMg: 55 },
    subtitle: "Raw",
  },
  {
    id: "spinach",
    name: "Spinach",
    aliases: ["spinach", "raw spinach", "baby spinach"],
    servingG: 30,
    servingLabel: "1 cup (30g)",
    per100g: { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiberG: 2.2, sugarG: 0.4, sodiumMg: 79 },
    subtitle: "Raw",
  },
  {
    id: "tomato",
    name: "Tomato",
    aliases: ["tomato", "tomatoes", "raw tomato"],
    servingG: 123,
    servingLabel: "1 medium (123g)",
    per100g: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiberG: 1.2, sugarG: 2.6, sodiumMg: 5 },
    subtitle: "Raw",
  },
  {
    id: "cucumber",
    name: "Cucumber",
    aliases: ["cucumber", "cucumbers", "raw cucumber"],
    servingG: 104,
    servingLabel: "1/2 cup sliced (104g)",
    per100g: { calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiberG: 0.5, sugarG: 1.7, sodiumMg: 2 },
    subtitle: "Raw · with peel",
  },
  {
    id: "mushroom",
    name: "Mushrooms",
    aliases: ["mushroom", "mushrooms", "white mushrooms", "button mushrooms"],
    servingG: 70,
    servingLabel: "1 cup sliced (70g)",
    per100g: { calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3, fiberG: 1.0, sugarG: 1.7, sodiumMg: 5 },
    subtitle: "Raw · white",
  },

  // ── Grains (cooked unless noted — that's how users log them) ──────
  {
    id: "white-rice",
    name: "White rice (cooked)",
    aliases: ["rice", "white rice", "cooked rice", "cooked white rice", "steamed rice", "jasmine rice"],
    servingG: 158,
    servingLabel: "1 cup cooked (158g)",
    per100g: { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiberG: 0.4, sugarG: 0.1, sodiumMg: 1 },
    subtitle: "Cooked · long grain",
  },
  {
    id: "brown-rice",
    name: "Brown rice (cooked)",
    aliases: ["brown rice", "cooked brown rice", "wholegrain rice", "whole grain rice"],
    servingG: 195,
    servingLabel: "1 cup cooked (195g)",
    per100g: { calories: 123, protein: 2.7, carbs: 25.6, fat: 1.0, fiberG: 1.6, sugarG: 0.2, sodiumMg: 4 },
    subtitle: "Cooked · long grain",
  },
  {
    id: "oats-raw",
    name: "Oats (raw)",
    aliases: ["oats", "rolled oats", "porridge oats", "raw oats", "dry oats"],
    servingG: 40,
    servingLabel: "1/2 cup dry (40g)",
    per100g: { calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9, fiberG: 10.6, sugarG: 0, sodiumMg: 2 },
    subtitle: "Dry · before cooking",
  },
  {
    id: "quinoa",
    name: "Quinoa (cooked)",
    aliases: ["quinoa", "cooked quinoa"],
    servingG: 185,
    servingLabel: "1 cup cooked (185g)",
    per100g: { calories: 120, protein: 4.4, carbs: 21.3, fat: 1.9, fiberG: 2.8, sugarG: 0.9, sodiumMg: 7 },
    subtitle: "Cooked",
  },
  {
    id: "pasta",
    name: "Pasta (cooked)",
    aliases: ["pasta", "cooked pasta", "spaghetti", "penne", "fusilli"],
    servingG: 140,
    servingLabel: "1 cup cooked (140g)",
    per100g: { calories: 158, protein: 5.8, carbs: 30.9, fat: 0.9, fiberG: 1.8, sugarG: 0.6, sodiumMg: 1 },
    subtitle: "Cooked · enriched",
  },
  {
    id: "bread-white",
    name: "White bread",
    aliases: ["white bread", "bread", "sliced bread", "white toast", "toast"],
    servingG: 30,
    servingLabel: "1 slice (30g)",
    per100g: { calories: 265, protein: 9.0, carbs: 49.0, fat: 3.2, fiberG: 2.7, sugarG: 5.7, sodiumMg: 491 },
    subtitle: "Per slice",
  },

  // ── Protein (raw — this is how recipes spec it; cooked weights drop ~25%) ──
  {
    id: "chicken-breast",
    name: "Chicken breast",
    aliases: ["chicken breast", "chicken breasts", "raw chicken breast", "boneless skinless chicken breast"],
    servingG: 174,
    servingLabel: "1 fillet (174g)",
    per100g: { calories: 120, protein: 22.5, carbs: 0, fat: 2.6, fiberG: 0, sugarG: 0, sodiumMg: 45 },
    subtitle: "Raw · skinless",
  },
  {
    id: "salmon",
    name: "Salmon fillet",
    aliases: ["salmon", "salmon fillet", "raw salmon", "atlantic salmon"],
    servingG: 150,
    servingLabel: "1 fillet (150g)",
    per100g: { calories: 208, protein: 20.4, carbs: 0, fat: 13.4, fiberG: 0, sugarG: 0, sodiumMg: 59 },
    subtitle: "Raw · Atlantic",
  },
  {
    id: "tuna-canned",
    name: "Tuna (canned, in water)",
    aliases: ["tuna", "canned tuna", "tinned tuna", "tuna in water"],
    servingG: 100,
    servingLabel: "1 small can (100g)",
    per100g: { calories: 116, protein: 25.5, carbs: 0, fat: 0.8, fiberG: 0, sugarG: 0, sodiumMg: 247 },
    subtitle: "Drained",
  },
  {
    id: "beef-mince-5",
    name: "Beef mince (5% fat)",
    aliases: ["beef mince", "lean beef mince", "5% beef mince", "lean ground beef", "extra lean ground beef"],
    servingG: 113,
    servingLabel: "1 portion (113g)",
    per100g: { calories: 137, protein: 21.4, carbs: 0, fat: 5.0, fiberG: 0, sugarG: 0, sodiumMg: 66 },
    subtitle: "Raw · 95/5",
  },
  {
    id: "beef-mince-20",
    name: "Beef mince (20% fat)",
    aliases: ["regular beef mince", "20% beef mince", "ground beef", "regular ground beef"],
    servingG: 113,
    servingLabel: "1 portion (113g)",
    per100g: { calories: 254, protein: 17.2, carbs: 0, fat: 20.0, fiberG: 0, sugarG: 0, sodiumMg: 66 },
    subtitle: "Raw · 80/20",
  },
  {
    id: "egg",
    name: "Egg",
    aliases: ["egg", "eggs", "whole egg", "large egg", "raw egg"],
    servingG: 50,
    servingLabel: "1 large (50g)",
    per100g: { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiberG: 0, sugarG: 0.4, sodiumMg: 142 },
    subtitle: "Whole · raw",
  },
  {
    id: "tofu-firm",
    name: "Tofu (firm)",
    aliases: ["tofu", "firm tofu", "extra firm tofu"],
    servingG: 100,
    servingLabel: "100g",
    per100g: { calories: 144, protein: 17.3, carbs: 2.8, fat: 8.7, fiberG: 2.3, sugarG: 0.6, sodiumMg: 14 },
    subtitle: "Firm",
  },

  // ── Dairy ──────────────────────────────────────────────────────────
  {
    id: "greek-yogurt",
    name: "Greek yogurt (plain)",
    aliases: ["greek yogurt", "plain greek yogurt", "greek yoghurt", "plain greek yoghurt"],
    servingG: 170,
    servingLabel: "1 pot (170g)",
    per100g: { calories: 59, protein: 10.2, carbs: 3.6, fat: 0.4, fiberG: 0, sugarG: 3.2, sodiumMg: 36 },
    subtitle: "Plain · 0% fat",
  },
  {
    id: "cheddar",
    name: "Cheddar cheese",
    aliases: ["cheddar", "cheddar cheese", "mature cheddar"],
    servingG: 30,
    servingLabel: "30g (~matchbox)",
    per100g: { calories: 404, protein: 22.9, carbs: 3.4, fat: 33.3, fiberG: 0, sugarG: 0.5, sodiumMg: 653 },
    subtitle: "Sliced",
  },
  {
    id: "butter",
    name: "Butter",
    aliases: ["butter", "salted butter", "unsalted butter"],
    servingG: 14,
    servingLabel: "1 tbsp (14g)",
    per100g: { calories: 717, protein: 0.9, carbs: 0.1, fat: 81.1, fiberG: 0, sugarG: 0.1, sodiumMg: 643 },
    subtitle: "Salted",
  },

  // ── Nuts / spreads ─────────────────────────────────────────────────
  {
    id: "almonds",
    name: "Almonds",
    aliases: ["almonds", "raw almonds", "whole almonds"],
    servingG: 28,
    servingLabel: "1 oz (28g)",
    per100g: { calories: 579, protein: 21.2, carbs: 21.6, fat: 49.9, fiberG: 12.5, sugarG: 4.4, sodiumMg: 1 },
    subtitle: "Raw",
  },
  {
    id: "peanut-butter",
    name: "Peanut butter",
    aliases: ["peanut butter", "natural peanut butter", "smooth peanut butter"],
    servingG: 32,
    servingLabel: "2 tbsp (32g)",
    per100g: { calories: 588, protein: 25.1, carbs: 19.6, fat: 50.4, fiberG: 6.0, sugarG: 9.2, sodiumMg: 459 },
    subtitle: "Smooth",
  },
];

/**
 * Same normaliser as `genericBeverages.normaliseForMatch` so the two
 * matchers stay aligned. Lowercase, strip apostrophes, replace
 * non-letter/number with space, collapse whitespace, trim.
 */
function normaliseForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʼ']/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns the first generic-food entry whose alias list contains the
 * (normalised) query, or null. Exact-alias match (not substring), so
 * "chicken breast with skin" doesn't false-positive onto "chicken breast",
 * and "rice pudding" doesn't false-positive onto "rice".
 *
 * Tested by tests/unit/genericFoods.test.ts.
 */
export function matchGenericFood(query: string): GenericFood | null {
  const q = normaliseForMatch(query);
  if (!q) return null;
  for (const food of GENERIC_FOODS) {
    for (const alias of food.aliases) {
      if (normaliseForMatch(alias) === q) return food;
    }
  }
  return null;
}
