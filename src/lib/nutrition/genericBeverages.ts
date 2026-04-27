/**
 * F-73 (2026-04-27) — generic-beverages match shim.
 *
 * Tester feedback: searching "cortado" returned USDA Branded "Cortado"
 * (a Spanish cheese) because the USDA Branded dataset has noisy, stale,
 * brand-prefixed entries that outrank Foundation/Survey for unusual
 * queries. The fix path captured in 2026-04-27-pre-submission-readiness.md
 * was: ship a small in-memory table of common coffee drinks + a matcher
 * that preempts USDA Branded results for known beverage queries.
 *
 * Per-100ml macros sourced from USDA Foundation / SR Legacy averages
 * (espresso shot bases, milk-vol weighted for milk-based drinks).
 * Caffeine values are conservative averages — actual brewed strength
 * varies; we err on the lower side so users don't worry about a phantom
 * +50mg jump from a single match.
 *
 * Wiring: searchFoods() in apps/mobile/lib/verifyRecipe.ts (and web
 * equivalent) calls matchGenericBeverage(query) FIRST. If a match lands,
 * the helper's UnifiedSearchResult-shaped row is inserted at the top of
 * the merged results so the USDA Branded cheese / packaged-soda noise
 * lands below.
 *
 * 2026-04-27 (same day, follow-up) — extended beyond coffee. Same noisy
 * USDA Branded class hits "milk", "green tea", "red wine", "orange
 * juice"; same fix shape applies. Tea + milk + juice + light-alcohol
 * entries appended below. Alcohol entries carry alcohol-content via
 * `alcoholGPer100ml` so the F-13 alcohol auto-track can pick them up
 * when logged (parallel to caffeine via `caffeineMgPer100ml`). Sister
 * module `src/lib/nutrition/genericFoods.ts` follows the same pattern
 * for solid foods (per-100g instead of per-100ml).
 */

export interface GenericBeverage {
  /** Stable id used as the search-result key + a `generic-beverage:${id}` slug. */
  id: string;
  /** Canonical display name (Title Case). */
  name: string;
  /** Aliases the matcher will accept (lowercase). Include common typos / abbreviations. */
  aliases: ReadonlyArray<string>;
  /** Typical serving size users mean when they say "a {name}", in millilitres. */
  servingMl: number;
  /** Per-100ml macros. Calorie-light drinks (americano) have tiny values here; matcher serves them up faithfully. */
  per100ml: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  /** Caffeine mg per 100ml. */
  caffeineMgPer100ml: number;
  /**
   * Alcohol grams (ethanol) per 100ml. Optional — coffee/tea/juice/milk
   * leave this undefined; wine/beer/spirits set it so F-13's alcohol
   * auto-track can record an entry when the drink is logged. Conservative
   * averages: red/white wine ~12% ABV → ~9.5 g/100ml; lager ~5% ABV →
   * ~3.9 g/100ml; IPA ~6.5% ABV → ~5.1 g/100ml.
   */
  alcoholGPer100ml?: number;
  /** Short subtitle shown under the name in search results. */
  subtitle?: string;
}

export const GENERIC_BEVERAGES: ReadonlyArray<GenericBeverage> = [
  {
    id: "espresso-single",
    name: "Espresso (single shot)",
    aliases: ["espresso", "espresso single", "espresso shot", "single espresso", "shot of espresso"],
    servingMl: 30,
    per100ml: { calories: 9, protein: 0.4, carbs: 1.5, fat: 0.2 },
    caffeineMgPer100ml: 213,
    subtitle: "30ml · ~64mg caffeine",
  },
  {
    id: "espresso-double",
    name: "Espresso (double shot)",
    aliases: ["double espresso", "doppio", "espresso double", "double shot"],
    servingMl: 60,
    per100ml: { calories: 9, protein: 0.4, carbs: 1.5, fat: 0.2 },
    caffeineMgPer100ml: 213,
    subtitle: "60ml · ~128mg caffeine",
  },
  {
    id: "americano",
    name: "Americano",
    aliases: ["americano", "long black", "café americano"],
    servingMl: 240,
    per100ml: { calories: 4, protein: 0.2, carbs: 0.7, fat: 0.1 },
    caffeineMgPer100ml: 53,
    subtitle: "240ml · ~128mg caffeine",
  },
  {
    id: "cortado",
    name: "Cortado",
    aliases: ["cortado", "gibraltar"],
    servingMl: 90,
    per100ml: { calories: 32, protein: 1.7, carbs: 2.6, fat: 1.6 },
    caffeineMgPer100ml: 142,
    subtitle: "90ml · ~128mg caffeine",
  },
  {
    id: "flat-white",
    name: "Flat white",
    aliases: ["flat white", "flatwhite", "flat-white"],
    servingMl: 180,
    per100ml: { calories: 36, protein: 1.9, carbs: 2.9, fat: 1.8 },
    caffeineMgPer100ml: 71,
    subtitle: "180ml · ~128mg caffeine",
  },
  {
    id: "cappuccino",
    name: "Cappuccino",
    aliases: ["cappuccino", "cappucino", "capuccino"],
    servingMl: 180,
    per100ml: { calories: 32, protein: 1.7, carbs: 2.6, fat: 1.6 },
    caffeineMgPer100ml: 71,
    subtitle: "180ml · ~128mg caffeine",
  },
  {
    id: "latte",
    name: "Latte",
    aliases: ["latte", "café latte", "caffe latte", "caffé latte"],
    servingMl: 240,
    per100ml: { calories: 38, protein: 2.1, carbs: 3.0, fat: 2.0 },
    caffeineMgPer100ml: 53,
    subtitle: "240ml · ~128mg caffeine",
  },
  {
    id: "macchiato",
    name: "Macchiato",
    aliases: ["macchiato", "espresso macchiato"],
    servingMl: 60,
    per100ml: { calories: 13, protein: 0.7, carbs: 1.7, fat: 0.5 },
    caffeineMgPer100ml: 213,
    subtitle: "60ml · ~128mg caffeine",
  },
  {
    id: "mocha",
    name: "Mocha",
    aliases: ["mocha", "café mocha", "caffè mocha", "mocha latte"],
    servingMl: 240,
    per100ml: { calories: 75, protein: 2.5, carbs: 11.0, fat: 2.5 },
    caffeineMgPer100ml: 38,
    subtitle: "240ml · ~91mg caffeine",
  },
  {
    id: "drip-coffee",
    name: "Drip coffee",
    aliases: ["drip coffee", "filter coffee", "regular coffee", "black coffee", "brewed coffee"],
    servingMl: 240,
    per100ml: { calories: 1, protein: 0.1, carbs: 0, fat: 0 },
    caffeineMgPer100ml: 40,
    subtitle: "240ml · ~95mg caffeine",
  },
  {
    id: "pour-over",
    name: "Pour-over coffee",
    aliases: ["pour over", "pour-over", "pourover", "v60", "chemex"],
    servingMl: 240,
    per100ml: { calories: 1, protein: 0.1, carbs: 0, fat: 0 },
    caffeineMgPer100ml: 50,
    subtitle: "240ml · ~120mg caffeine",
  },
  {
    id: "cold-brew",
    name: "Cold brew coffee",
    aliases: ["cold brew", "coldbrew", "cold-brew", "iced coffee"],
    servingMl: 240,
    per100ml: { calories: 1, protein: 0.1, carbs: 0, fat: 0 },
    caffeineMgPer100ml: 83,
    subtitle: "240ml · ~200mg caffeine",
  },

  // ── Tea ────────────────────────────────────────────────────────────
  // Caffeine values are typical brewed-cup averages (USDA SR Legacy +
  // Tea Council data). Black tea ~47mg/240ml; green tea ~28mg/240ml;
  // matcha ~70mg/240ml (much higher than steeped green); chai latte
  // built on black tea + half whole-milk so caffeine and macros sit
  // between tea and latte. Herbal infusions are caffeine-free.
  {
    id: "black-tea",
    name: "Black tea",
    aliases: ["black tea", "english breakfast", "english breakfast tea", "tea"],
    servingMl: 240,
    per100ml: { calories: 1, protein: 0, carbs: 0.3, fat: 0 },
    caffeineMgPer100ml: 20,
    subtitle: "240ml · ~47mg caffeine",
  },
  {
    id: "green-tea",
    name: "Green tea",
    aliases: ["green tea", "sencha"],
    servingMl: 240,
    per100ml: { calories: 1, protein: 0.2, carbs: 0, fat: 0 },
    caffeineMgPer100ml: 12,
    subtitle: "240ml · ~28mg caffeine",
  },
  {
    id: "matcha-latte",
    name: "Matcha latte",
    aliases: ["matcha latte", "matcha", "iced matcha latte", "iced matcha"],
    servingMl: 240,
    per100ml: { calories: 38, protein: 1.8, carbs: 4.5, fat: 1.5 },
    caffeineMgPer100ml: 29,
    subtitle: "240ml · ~70mg caffeine",
  },
  {
    id: "chai-latte",
    name: "Chai latte",
    aliases: ["chai latte", "chai", "iced chai latte", "iced chai"],
    servingMl: 240,
    per100ml: { calories: 50, protein: 2.0, carbs: 8.0, fat: 1.5 },
    caffeineMgPer100ml: 21,
    subtitle: "240ml · ~50mg caffeine",
  },
  {
    id: "herbal-tea",
    name: "Herbal tea",
    aliases: ["herbal tea", "peppermint tea", "chamomile tea", "rooibos", "rooibos tea"],
    servingMl: 240,
    per100ml: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    caffeineMgPer100ml: 0,
    subtitle: "240ml · caffeine-free",
  },
  {
    id: "earl-grey",
    name: "Earl Grey",
    aliases: ["earl grey", "earl grey tea"],
    servingMl: 240,
    per100ml: { calories: 1, protein: 0, carbs: 0.3, fat: 0 },
    caffeineMgPer100ml: 17,
    subtitle: "240ml · ~40mg caffeine",
  },

  // ── Milk ───────────────────────────────────────────────────────────
  // Per-100ml macros are USDA SR Legacy / OFF-curated averages for the
  // mainstream UK supermarket version of each milk. Plant-milks vary
  // wildly across brands — values here track unsweetened Oatly Barista,
  // Alpro Almond Original, Alpro Soya Original (the most-logged in our
  // OFF tail). User can override portion if they meant a glass vs a
  // splash via the standard portion picker.
  {
    id: "whole-milk",
    name: "Whole milk",
    aliases: ["whole milk", "full fat milk", "full-fat milk", "milk"],
    servingMl: 240,
    per100ml: { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3 },
    caffeineMgPer100ml: 0,
    subtitle: "240ml glass",
  },
  {
    id: "semi-skimmed-milk",
    name: "Semi-skimmed milk",
    aliases: ["semi-skimmed milk", "semi skimmed milk", "semi-skim milk", "2% milk", "reduced fat milk"],
    servingMl: 240,
    per100ml: { calories: 47, protein: 3.4, carbs: 4.7, fat: 1.7 },
    caffeineMgPer100ml: 0,
    subtitle: "240ml glass",
  },
  {
    id: "skim-milk",
    name: "Skim milk",
    aliases: ["skim milk", "skimmed milk", "fat free milk", "fat-free milk", "0% milk", "non fat milk"],
    servingMl: 240,
    per100ml: { calories: 34, protein: 3.4, carbs: 5.0, fat: 0.1 },
    caffeineMgPer100ml: 0,
    subtitle: "240ml glass",
  },
  {
    id: "oat-milk",
    name: "Oat milk",
    aliases: ["oat milk", "oatmilk", "oatly"],
    servingMl: 240,
    per100ml: { calories: 50, protein: 1.0, carbs: 6.7, fat: 1.5 },
    caffeineMgPer100ml: 0,
    subtitle: "240ml glass",
  },
  {
    id: "almond-milk",
    name: "Almond milk",
    aliases: ["almond milk", "almondmilk", "unsweetened almond milk"],
    servingMl: 240,
    per100ml: { calories: 13, protein: 0.4, carbs: 0.1, fat: 1.1 },
    caffeineMgPer100ml: 0,
    subtitle: "240ml glass",
  },
  {
    id: "soy-milk",
    name: "Soy milk",
    aliases: ["soy milk", "soya milk", "soymilk"],
    servingMl: 240,
    per100ml: { calories: 33, protein: 3.0, carbs: 0.1, fat: 1.8 },
    caffeineMgPer100ml: 0,
    subtitle: "240ml glass",
  },

  // ── Juice ──────────────────────────────────────────────────────────
  // Standard 250ml glass — same portion the NHS Eatwell Guide assumes
  // for "one serving". Values from USDA SR Legacy unsweetened juice.
  {
    id: "orange-juice",
    name: "Orange juice",
    aliases: ["orange juice", "oj", "fresh orange juice"],
    servingMl: 250,
    per100ml: { calories: 45, protein: 0.7, carbs: 10.4, fat: 0.2 },
    caffeineMgPer100ml: 0,
    subtitle: "250ml glass",
  },
  {
    id: "apple-juice",
    name: "Apple juice",
    aliases: ["apple juice"],
    servingMl: 250,
    per100ml: { calories: 46, protein: 0.1, carbs: 11.3, fat: 0.1 },
    caffeineMgPer100ml: 0,
    subtitle: "250ml glass",
  },

  // ── Alcohol ────────────────────────────────────────────────────────
  // Servings match UK unit guidance: 175ml wine glass = 2.1 units;
  // 568ml pint = 2.3 units of 4% lager. ABV → g ethanol ≈ ABV * 0.789
  // (ethanol density). 12% wine → 9.5g/100ml. 4% lager → 3.16g/100ml.
  // 6.5% IPA → 5.13g/100ml. F-74 (alcohol auto-track) reads
  // alcoholGPer100ml when the user logs the drink.
  {
    id: "red-wine",
    name: "Red wine",
    aliases: ["red wine", "merlot", "cabernet", "shiraz", "pinot noir"],
    servingMl: 175,
    per100ml: { calories: 85, protein: 0.1, carbs: 2.6, fat: 0 },
    caffeineMgPer100ml: 0,
    alcoholGPer100ml: 9.5,
    subtitle: "175ml glass · 12% ABV",
  },
  {
    id: "white-wine",
    name: "White wine",
    aliases: ["white wine", "sauvignon blanc", "chardonnay", "pinot grigio"],
    servingMl: 175,
    per100ml: { calories: 82, protein: 0.1, carbs: 2.6, fat: 0 },
    caffeineMgPer100ml: 0,
    alcoholGPer100ml: 9.5,
    subtitle: "175ml glass · 12% ABV",
  },
  {
    id: "lager",
    name: "Lager (pint)",
    aliases: ["lager", "beer", "pint", "pint of lager", "pint of beer"],
    servingMl: 568,
    per100ml: { calories: 43, protein: 0.5, carbs: 3.6, fat: 0 },
    caffeineMgPer100ml: 0,
    alcoholGPer100ml: 3.16,
    subtitle: "568ml pint · 4% ABV",
  },
  {
    id: "ipa",
    name: "IPA",
    aliases: ["ipa", "india pale ale"],
    servingMl: 330,
    per100ml: { calories: 65, protein: 0.6, carbs: 5.8, fat: 0 },
    caffeineMgPer100ml: 0,
    alcoholGPer100ml: 5.13,
    subtitle: "330ml bottle · 6.5% ABV",
  },
];

/**
 * Normalise a query string for alias-matching. Lowercase, strip
 * apostrophes and other punctuation, collapse whitespace, trim.
 * Same shape as recipeSearchMatch's normaliser so the two stay aligned.
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
 * Returns the first generic-beverage entry whose alias list contains the
 * (normalised) query, or null. Uses exact-alias match to avoid false
 * positives on substrings (a user typing "latte" gets the Latte row, not
 * the Macchiato; a user typing "macchiato latte" doesn't get the Latte row).
 *
 * Tested by tests/unit/genericBeverages.test.ts.
 */
export function matchGenericBeverage(query: string): GenericBeverage | null {
  const q = normaliseForMatch(query);
  if (!q) return null;
  for (const drink of GENERIC_BEVERAGES) {
    for (const alias of drink.aliases) {
      if (normaliseForMatch(alias) === q) return drink;
    }
  }
  return null;
}
