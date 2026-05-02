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
 * equivalent) calls matchGenericBeverages(query) FIRST. If a family
 * match lands, every sibling row in the family is prepended to the
 * merged results so the user sees the right row first AND the dairy /
 * size variants right below it.
 *
 * 2026-04-27 (same day, follow-up) — extended beyond coffee. Same noisy
 * USDA Branded class hits "milk", "green tea", "red wine", "orange
 * juice"; same fix shape applies. Tea + milk + juice + light-alcohol
 * entries appended below. Alcohol entries carry alcohol-content via
 * `alcoholGPer100ml` so the F-13 alcohol auto-track can pick them up
 * when logged (parallel to caffeine via `caffeineMgPer100ml`). Sister
 * module `src/lib/nutrition/genericFoods.ts` follows the same pattern
 * for solid foods (per-100g instead of per-100ml).
 *
 * 2026-05-01 (TestFlight Build 40 feedback — "cortado should have lots
 * of options") — expanded from 30 single-row entries to 60+ entries
 * grouped into beverage `family` blocks. A "cortado" / "latte" /
 * "americano" query now surfaces all family siblings (size + dairy
 * variants), not just one row. The legacy `matchGenericBeverage()`
 * single-result function is preserved for back-compat callers; new
 * search wiring uses `matchGenericBeverages()` to surface the full
 * family. Variant macros are computed from the verified milk +
 * espresso bases already in the table (e.g. an oat-milk latte =
 * milk-volume-weighted blend of oat-milk per100ml + espresso per100ml).
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
  /**
   * Build-40 (2026-05-01) — beverage family slug. Rows that share a
   * family value (e.g. "latte") are surfaced together when any one of
   * them matches the query. Used by `matchGenericBeverages()` to expand
   * a single-alias hit into the full family ladder (size + dairy
   * variants). Undefined → row stands alone (no siblings to surface).
   */
  family?: string;
}

export const GENERIC_BEVERAGES: ReadonlyArray<GenericBeverage> = [
  // ── Espresso family ────────────────────────────────────────────────
  {
    id: "espresso-single",
    name: "Espresso (single shot)",
    aliases: ["espresso", "espresso single", "espresso shot", "single espresso", "shot of espresso"],
    servingMl: 30,
    per100ml: { calories: 9, protein: 0.4, carbs: 1.5, fat: 0.2 },
    caffeineMgPer100ml: 213,
    subtitle: "30ml · ~64mg caffeine",
    family: "espresso",
  },
  {
    id: "espresso-double",
    name: "Espresso (double shot)",
    aliases: ["double espresso", "doppio", "espresso double", "double shot"],
    servingMl: 60,
    per100ml: { calories: 9, protein: 0.4, carbs: 1.5, fat: 0.2 },
    caffeineMgPer100ml: 213,
    subtitle: "60ml · ~128mg caffeine",
    family: "espresso",
  },
  {
    id: "espresso-triple",
    name: "Espresso (triple shot)",
    aliases: ["triple espresso", "espresso triple", "triple shot"],
    servingMl: 90,
    per100ml: { calories: 9, protein: 0.4, carbs: 1.5, fat: 0.2 },
    caffeineMgPer100ml: 213,
    subtitle: "90ml · ~192mg caffeine",
    family: "espresso",
  },
  {
    id: "ristretto",
    name: "Ristretto",
    aliases: ["ristretto", "ristretto shot", "short shot"],
    servingMl: 22,
    per100ml: { calories: 12, protein: 0.5, carbs: 2.0, fat: 0.3 },
    caffeineMgPer100ml: 290,
    subtitle: "22ml · ~64mg caffeine",
    family: "espresso",
  },

  // ── Americano family ───────────────────────────────────────────────
  {
    id: "americano",
    name: "Americano",
    aliases: ["americano", "long black", "café americano"],
    servingMl: 240,
    per100ml: { calories: 4, protein: 0.2, carbs: 0.7, fat: 0.1 },
    caffeineMgPer100ml: 53,
    subtitle: "240ml · ~128mg caffeine",
    family: "americano",
  },
  {
    id: "americano-small",
    name: "Americano (small)",
    aliases: ["small americano", "americano small", "8oz americano"],
    servingMl: 180,
    per100ml: { calories: 4, protein: 0.2, carbs: 0.7, fat: 0.1 },
    caffeineMgPer100ml: 53,
    subtitle: "180ml · ~96mg caffeine",
    family: "americano",
  },
  {
    id: "americano-large",
    name: "Americano (large)",
    aliases: ["large americano", "americano large", "16oz americano"],
    servingMl: 475,
    per100ml: { calories: 4, protein: 0.2, carbs: 0.7, fat: 0.1 },
    caffeineMgPer100ml: 53,
    subtitle: "475ml · ~252mg caffeine",
    family: "americano",
  },
  {
    id: "iced-americano",
    name: "Iced americano",
    aliases: ["iced americano", "ice americano"],
    servingMl: 350,
    per100ml: { calories: 4, protein: 0.2, carbs: 0.7, fat: 0.1 },
    caffeineMgPer100ml: 53,
    subtitle: "350ml over ice · ~186mg caffeine",
    family: "americano",
  },

  // ── Cortado family ─────────────────────────────────────────────────
  // Cortado is by definition small (typically 90ml — a 1:1 espresso to
  // steamed milk shot). Variant axis here is dairy, not size. Macros
  // computed as 50% espresso (~9,0.4,1.5,0.2) + 50% milk per 100ml.
  {
    id: "cortado",
    name: "Cortado",
    aliases: ["cortado", "gibraltar"],
    servingMl: 90,
    per100ml: { calories: 32, protein: 1.7, carbs: 2.6, fat: 1.6 },
    caffeineMgPer100ml: 142,
    subtitle: "90ml · whole milk · ~128mg caffeine",
    family: "cortado",
  },
  {
    id: "cortado-skim",
    name: "Cortado (skim milk)",
    aliases: ["cortado skim", "cortado skimmed", "skim milk cortado", "skimmed milk cortado", "cortado with skim milk"],
    servingMl: 90,
    per100ml: { calories: 19, protein: 1.7, carbs: 2.7, fat: 0.2 },
    caffeineMgPer100ml: 142,
    subtitle: "90ml · skim milk · ~128mg caffeine",
    family: "cortado",
  },
  {
    id: "cortado-oat",
    name: "Cortado (oat milk)",
    aliases: ["oat cortado", "cortado oat", "oat milk cortado", "cortado with oat milk"],
    servingMl: 90,
    per100ml: { calories: 26, protein: 0.6, carbs: 3.7, fat: 0.8 },
    caffeineMgPer100ml: 142,
    subtitle: "90ml · oat milk · ~128mg caffeine",
    family: "cortado",
  },
  {
    id: "cortado-almond",
    name: "Cortado (almond milk)",
    aliases: ["almond cortado", "cortado almond", "almond milk cortado", "cortado with almond milk"],
    servingMl: 90,
    per100ml: { calories: 10, protein: 0.4, carbs: 0.7, fat: 0.6 },
    caffeineMgPer100ml: 142,
    subtitle: "90ml · almond milk · ~128mg caffeine",
    family: "cortado",
  },
  {
    id: "cortado-soy",
    name: "Cortado (soy milk)",
    aliases: ["soy cortado", "cortado soy", "soy milk cortado", "cortado with soy milk", "soya cortado"],
    servingMl: 90,
    per100ml: { calories: 19, protein: 1.5, carbs: 0.7, fat: 0.9 },
    caffeineMgPer100ml: 142,
    subtitle: "90ml · soy milk · ~128mg caffeine",
    family: "cortado",
  },

  // ── Flat white family ──────────────────────────────────────────────
  // Flat white is ~67% milk by volume (180ml = 60ml espresso + 120ml
  // steamed milk). Variant macros = 0.67 × milk + 0.33 × espresso.
  {
    id: "flat-white",
    name: "Flat white",
    aliases: ["flat white", "flatwhite", "flat-white"],
    servingMl: 180,
    per100ml: { calories: 36, protein: 1.9, carbs: 2.9, fat: 1.8 },
    caffeineMgPer100ml: 71,
    subtitle: "180ml · whole milk · ~128mg caffeine",
    family: "flat-white",
  },
  {
    id: "flat-white-small",
    name: "Flat white (small)",
    aliases: ["small flat white", "flat white small", "small flatwhite"],
    servingMl: 160,
    per100ml: { calories: 36, protein: 1.9, carbs: 2.9, fat: 1.8 },
    caffeineMgPer100ml: 80,
    subtitle: "160ml · whole milk · ~128mg caffeine",
    family: "flat-white",
  },
  {
    id: "flat-white-large",
    name: "Flat white (large)",
    aliases: ["large flat white", "flat white large", "large flatwhite"],
    servingMl: 240,
    per100ml: { calories: 36, protein: 1.9, carbs: 2.9, fat: 1.8 },
    caffeineMgPer100ml: 80,
    subtitle: "240ml · whole milk · ~192mg caffeine",
    family: "flat-white",
  },
  {
    id: "flat-white-oat",
    name: "Flat white (oat milk)",
    aliases: ["oat flat white", "flat white oat", "oat milk flat white", "flat white with oat milk", "oat flatwhite"],
    servingMl: 180,
    per100ml: { calories: 37, protein: 0.8, carbs: 5.0, fat: 1.1 },
    caffeineMgPer100ml: 71,
    subtitle: "180ml · oat milk · ~128mg caffeine",
    family: "flat-white",
  },
  {
    id: "flat-white-almond",
    name: "Flat white (almond milk)",
    aliases: ["almond flat white", "flat white almond", "almond milk flat white", "flat white with almond milk", "almond flatwhite"],
    servingMl: 180,
    per100ml: { calories: 12, protein: 0.4, carbs: 0.6, fat: 0.8 },
    caffeineMgPer100ml: 71,
    subtitle: "180ml · almond milk · ~128mg caffeine",
    family: "flat-white",
  },
  {
    id: "flat-white-soy",
    name: "Flat white (soy milk)",
    aliases: ["soy flat white", "flat white soy", "soy milk flat white", "flat white with soy milk", "soya flat white", "soy flatwhite"],
    servingMl: 180,
    per100ml: { calories: 25, protein: 2.1, carbs: 0.6, fat: 1.3 },
    caffeineMgPer100ml: 71,
    subtitle: "180ml · soy milk · ~128mg caffeine",
    family: "flat-white",
  },

  // ── Cappuccino family ──────────────────────────────────────────────
  // Cappuccino ~50% milk + 50% foam (foam is milk by mass, mostly air
  // by volume). For per-100ml calorie purposes treat as 60% effective
  // milk volume + 33% espresso (matches existing canonical).
  {
    id: "cappuccino",
    name: "Cappuccino",
    aliases: ["cappuccino", "cappucino", "capuccino"],
    servingMl: 180,
    per100ml: { calories: 32, protein: 1.7, carbs: 2.6, fat: 1.6 },
    caffeineMgPer100ml: 71,
    subtitle: "180ml · whole milk · ~128mg caffeine",
    family: "cappuccino",
  },
  {
    id: "cappuccino-large",
    name: "Cappuccino (large)",
    aliases: ["large cappuccino", "cappuccino large", "large cappucino"],
    servingMl: 360,
    per100ml: { calories: 32, protein: 1.7, carbs: 2.6, fat: 1.6 },
    caffeineMgPer100ml: 35,
    subtitle: "360ml · whole milk · ~128mg caffeine",
    family: "cappuccino",
  },
  {
    id: "cappuccino-oat",
    name: "Cappuccino (oat milk)",
    aliases: ["oat cappuccino", "cappuccino oat", "oat milk cappuccino", "cappuccino with oat milk", "oat cappucino"],
    servingMl: 180,
    per100ml: { calories: 30, protein: 0.7, carbs: 4.5, fat: 1.0 },
    caffeineMgPer100ml: 71,
    subtitle: "180ml · oat milk · ~128mg caffeine",
    family: "cappuccino",
  },
  {
    id: "cappuccino-almond",
    name: "Cappuccino (almond milk)",
    aliases: ["almond cappuccino", "cappuccino almond", "almond milk cappuccino", "cappuccino with almond milk", "almond cappucino"],
    servingMl: 180,
    per100ml: { calories: 10, protein: 0.3, carbs: 0.5, fat: 0.7 },
    caffeineMgPer100ml: 71,
    subtitle: "180ml · almond milk · ~128mg caffeine",
    family: "cappuccino",
  },
  {
    id: "cappuccino-soy",
    name: "Cappuccino (soy milk)",
    aliases: ["soy cappuccino", "cappuccino soy", "soy milk cappuccino", "cappuccino with soy milk", "soya cappuccino"],
    servingMl: 180,
    per100ml: { calories: 22, protein: 1.9, carbs: 0.5, fat: 1.2 },
    caffeineMgPer100ml: 71,
    subtitle: "180ml · soy milk · ~128mg caffeine",
    family: "cappuccino",
  },

  // ── Latte family ───────────────────────────────────────────────────
  // Latte is ~80% milk (240ml = 50ml espresso + 190ml steamed milk).
  // Variant macros = 0.80 × milk + 0.20 × espresso (per 100ml).
  // Caffeine driven by shot count; small=1, medium=2, large=2-3.
  {
    id: "latte",
    name: "Latte",
    aliases: ["latte", "café latte", "caffe latte", "caffé latte", "small latte", "12oz latte"],
    servingMl: 240,
    per100ml: { calories: 38, protein: 2.1, carbs: 3.0, fat: 2.0 },
    caffeineMgPer100ml: 53,
    subtitle: "240ml · whole milk · ~128mg caffeine",
    family: "latte",
  },
  {
    id: "latte-medium",
    name: "Latte (medium)",
    aliases: ["medium latte", "latte medium", "16oz latte"],
    servingMl: 360,
    per100ml: { calories: 47, protein: 2.6, carbs: 3.7, fat: 2.5 },
    caffeineMgPer100ml: 36,
    subtitle: "360ml · whole milk · ~128mg caffeine",
    family: "latte",
  },
  {
    id: "latte-large",
    name: "Latte (large)",
    aliases: ["large latte", "latte large", "20oz latte"],
    servingMl: 475,
    per100ml: { calories: 50, protein: 2.8, carbs: 3.9, fat: 2.7 },
    caffeineMgPer100ml: 27,
    subtitle: "475ml · whole milk · ~128mg caffeine",
    family: "latte",
  },
  {
    id: "latte-skim",
    name: "Latte (skim milk)",
    aliases: ["skim latte", "skimmed latte", "latte skim", "skim milk latte", "skimmed milk latte", "non fat latte"],
    servingMl: 240,
    per100ml: { calories: 29, protein: 2.7, carbs: 4.1, fat: 0.1 },
    caffeineMgPer100ml: 53,
    subtitle: "240ml · skim milk · ~128mg caffeine",
    family: "latte",
  },
  {
    id: "latte-oat",
    name: "Latte (oat milk)",
    aliases: ["oat latte", "latte oat", "oat milk latte", "latte with oat milk", "oatly latte"],
    servingMl: 240,
    per100ml: { calories: 42, protein: 0.9, carbs: 5.7, fat: 1.2 },
    caffeineMgPer100ml: 53,
    subtitle: "240ml · oat milk · ~128mg caffeine",
    family: "latte",
  },
  {
    id: "latte-almond",
    name: "Latte (almond milk)",
    aliases: ["almond latte", "latte almond", "almond milk latte", "latte with almond milk"],
    servingMl: 240,
    per100ml: { calories: 12, protein: 0.4, carbs: 0.4, fat: 0.9 },
    caffeineMgPer100ml: 53,
    subtitle: "240ml · almond milk · ~128mg caffeine",
    family: "latte",
  },
  {
    id: "latte-soy",
    name: "Latte (soy milk)",
    aliases: ["soy latte", "latte soy", "soy milk latte", "latte with soy milk", "soya latte"],
    servingMl: 240,
    per100ml: { calories: 28, protein: 2.5, carbs: 0.4, fat: 1.5 },
    caffeineMgPer100ml: 53,
    subtitle: "240ml · soy milk · ~128mg caffeine",
    family: "latte",
  },
  {
    id: "iced-latte",
    name: "Iced latte",
    aliases: ["iced latte", "ice latte", "iced cafe latte"],
    servingMl: 350,
    per100ml: { calories: 38, protein: 2.1, carbs: 3.0, fat: 2.0 },
    caffeineMgPer100ml: 36,
    subtitle: "350ml over ice · whole milk · ~128mg caffeine",
    family: "latte",
  },

  // ── Macchiato family ───────────────────────────────────────────────
  {
    id: "macchiato",
    name: "Macchiato",
    aliases: ["macchiato", "espresso macchiato"],
    servingMl: 60,
    per100ml: { calories: 13, protein: 0.7, carbs: 1.7, fat: 0.5 },
    caffeineMgPer100ml: 213,
    subtitle: "60ml · ~128mg caffeine",
    family: "macchiato",
  },
  {
    id: "caramel-macchiato",
    name: "Caramel macchiato",
    aliases: ["caramel macchiato"],
    servingMl: 355,
    per100ml: { calories: 70, protein: 2.0, carbs: 11.0, fat: 1.8 },
    caffeineMgPer100ml: 41,
    subtitle: "355ml (12oz) · whole milk · ~145mg caffeine",
    family: "macchiato",
  },

  // ── Mocha family ───────────────────────────────────────────────────
  {
    id: "mocha",
    name: "Mocha",
    aliases: ["mocha", "café mocha", "caffè mocha", "mocha latte"],
    servingMl: 240,
    per100ml: { calories: 75, protein: 2.5, carbs: 11.0, fat: 2.5 },
    caffeineMgPer100ml: 38,
    subtitle: "240ml · whole milk · ~91mg caffeine",
    family: "mocha",
  },
  {
    id: "mocha-large",
    name: "Mocha (large)",
    aliases: ["large mocha", "mocha large", "16oz mocha"],
    servingMl: 475,
    per100ml: { calories: 75, protein: 2.5, carbs: 11.0, fat: 2.5 },
    caffeineMgPer100ml: 27,
    subtitle: "475ml · whole milk · ~128mg caffeine",
    family: "mocha",
  },
  {
    id: "mocha-oat",
    name: "Mocha (oat milk)",
    aliases: ["oat mocha", "mocha oat", "oat milk mocha", "mocha with oat milk"],
    servingMl: 240,
    per100ml: { calories: 70, protein: 1.5, carbs: 12.5, fat: 2.0 },
    caffeineMgPer100ml: 38,
    subtitle: "240ml · oat milk · ~91mg caffeine",
    family: "mocha",
  },
  {
    id: "iced-mocha",
    name: "Iced mocha",
    aliases: ["iced mocha", "ice mocha", "iced cafe mocha"],
    servingMl: 350,
    per100ml: { calories: 75, protein: 2.5, carbs: 11.0, fat: 2.5 },
    caffeineMgPer100ml: 26,
    subtitle: "350ml over ice · whole milk · ~91mg caffeine",
    family: "mocha",
  },

  // ── Drip / pour-over / cold brew ───────────────────────────────────
  {
    id: "drip-coffee",
    name: "Drip coffee",
    aliases: ["drip coffee", "filter coffee", "regular coffee", "black coffee", "brewed coffee"],
    servingMl: 240,
    per100ml: { calories: 1, protein: 0.1, carbs: 0, fat: 0 },
    caffeineMgPer100ml: 40,
    subtitle: "240ml · ~95mg caffeine",
    family: "drip-coffee",
  },
  {
    id: "drip-coffee-large",
    name: "Drip coffee (large)",
    aliases: ["large drip coffee", "large filter coffee", "large black coffee", "16oz drip coffee", "mug of coffee"],
    servingMl: 475,
    per100ml: { calories: 1, protein: 0.1, carbs: 0, fat: 0 },
    caffeineMgPer100ml: 40,
    subtitle: "475ml mug · ~190mg caffeine",
    family: "drip-coffee",
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
    family: "black-tea",
  },
  {
    id: "black-tea-with-milk",
    name: "Black tea with milk",
    aliases: ["tea with milk", "milky tea", "builders tea", "british tea", "english tea with milk"],
    servingMl: 240,
    per100ml: { calories: 9, protein: 0.5, carbs: 1.0, fat: 0.5 },
    caffeineMgPer100ml: 18,
    subtitle: "240ml · whole milk splash · ~43mg caffeine",
    family: "black-tea",
  },
  {
    id: "black-tea-mug",
    name: "Black tea (mug)",
    aliases: ["mug of tea", "large black tea", "large english breakfast"],
    servingMl: 350,
    per100ml: { calories: 1, protein: 0, carbs: 0.3, fat: 0 },
    caffeineMgPer100ml: 20,
    subtitle: "350ml mug · ~70mg caffeine",
    family: "black-tea",
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
    subtitle: "240ml · whole milk · ~70mg caffeine",
    family: "matcha-latte",
  },
  {
    id: "matcha-latte-oat",
    name: "Matcha latte (oat milk)",
    aliases: ["oat matcha latte", "matcha latte oat", "oat matcha", "oat milk matcha latte", "matcha latte with oat milk"],
    servingMl: 240,
    per100ml: { calories: 42, protein: 0.9, carbs: 6.7, fat: 1.2 },
    caffeineMgPer100ml: 29,
    subtitle: "240ml · oat milk · ~70mg caffeine",
    family: "matcha-latte",
  },
  {
    id: "matcha-latte-almond",
    name: "Matcha latte (almond milk)",
    aliases: ["almond matcha latte", "matcha latte almond", "almond milk matcha latte", "matcha latte with almond milk"],
    servingMl: 240,
    per100ml: { calories: 12, protein: 0.4, carbs: 0.6, fat: 0.9 },
    caffeineMgPer100ml: 29,
    subtitle: "240ml · almond milk · ~70mg caffeine",
    family: "matcha-latte",
  },
  {
    id: "chai-latte",
    name: "Chai latte",
    aliases: ["chai latte", "chai", "iced chai latte", "iced chai"],
    servingMl: 240,
    per100ml: { calories: 50, protein: 2.0, carbs: 8.0, fat: 1.5 },
    caffeineMgPer100ml: 21,
    subtitle: "240ml · whole milk · ~50mg caffeine",
    family: "chai-latte",
  },
  {
    id: "chai-latte-oat",
    name: "Chai latte (oat milk)",
    aliases: ["oat chai latte", "chai latte oat", "oat chai", "oat milk chai latte", "chai latte with oat milk"],
    servingMl: 240,
    per100ml: { calories: 52, protein: 1.0, carbs: 9.5, fat: 1.2 },
    caffeineMgPer100ml: 21,
    subtitle: "240ml · oat milk · ~50mg caffeine",
    family: "chai-latte",
  },
  {
    id: "dirty-chai",
    name: "Dirty chai",
    aliases: ["dirty chai", "dirty chai latte"],
    servingMl: 240,
    per100ml: { calories: 51, protein: 2.1, carbs: 8.2, fat: 1.5 },
    caffeineMgPer100ml: 47,
    subtitle: "240ml · chai + espresso shot · ~113mg caffeine",
    family: "chai-latte",
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
 * Tested by tests/unit/genericBeverages.test.ts. Preserved unchanged for
 * back-compat — Build-40 callers should switch to `matchGenericBeverages()`
 * which surfaces the full size + dairy ladder rather than a single row.
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

/**
 * Build-40 (2026-05-01) — multi-result matcher. Resolves the canonical
 * row by exact-alias match (same rules as `matchGenericBeverage`), then
 * expands to all sibling rows that share its `family` slug. The
 * canonical row leads; siblings follow in their declared order in the
 * `GENERIC_BEVERAGES` array. Empty array when the query has no match.
 *
 * Examples (TestFlight Build 40 feedback):
 *   - "cortado" → [cortado, cortado-skim, cortado-oat, cortado-almond, cortado-soy]
 *   - "oat latte" → [latte-oat, latte, latte-medium, latte-large, latte-skim,
 *                    latte-almond, latte-soy, iced-latte]   (matched row first,
 *                    then the rest of the family in array order)
 *   - "americano" → [americano, americano-small, americano-large, iced-americano]
 *   - "ribeye steak" → []
 *
 * Family-less rows (e.g. drip coffee from before, herbal tea, milks,
 * juice, alcohol) return as a single-row family of `[match]`.
 *
 * Wired into `searchFoods()` in apps/mobile/lib/verifyRecipe.ts and the
 * web equivalent in src/app/components/food-search/FoodSearchPanel.tsx.
 */
export function matchGenericBeverages(query: string): GenericBeverage[] {
  const m = matchGenericBeverage(query);
  if (!m) return [];
  if (!m.family) return [m];
  const family: GenericBeverage[] = [];
  // Canonical (matched) row first.
  family.push(m);
  // Then every other row in the same family, in declaration order, so
  // the ladder stays stable across queries that hit different siblings.
  for (const b of GENERIC_BEVERAGES) {
    if (b.id === m.id) continue;
    if (b.family === m.family) family.push(b);
  }
  return family;
}
