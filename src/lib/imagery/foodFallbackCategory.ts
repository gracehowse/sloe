/**
 * Deterministic food-row fallback resolution (ENG-1015 §5, tiered per
 * ENG-1448 PR 1).
 *
 * Pure data — importable from web, mobile, and tests. Title in →
 * resolution out, stable across sessions and platforms.
 *
 * ── The never-fabricated rule (ENG-1448 / ENG-1478) ────────────────
 * Two fabrication paths are dead: the sample remap that painted a
 * shipped sample on unshipped categories (the berry-smoothie-on-salmon
 * bug, fixed in ENG-1478) and the fnv1a32 title hash that mapped
 * unmatched titles into a 4-category pool. The hash path is DELETED and
 * must never return (repo-scan pin in
 * `tests/unit/foodFallbackCategory.test.ts`). A category is only ever
 * claimed on a CONFIDENT keyword hit; everything else degrades to an
 * honest slot- or generic-tier glyph + tint.
 *
 * ── Photo confidence (ENG-1448 refuter split) ──────────────────────
 * A category hit licenses the GLYPH + TINT only. The shipped sample
 * PHOTO additionally requires `photoConfident` — set per keyword row,
 * true ONLY when the matched string names the literal dish the shipped
 * sample depicts and the keyword cannot be a modifier ("zucchini
 * noodles" is honestly a noodle GLYPH; the tonkotsu ramen PHOTO would
 * be a fabrication). Conservative default: false.
 * ────────────────────────────────────────────────────────────────────
 */

import {
  HERO_TINTS,
  HERO_TINTS_DARK,
  SAGE_RGB,
  SAGE_RGB_DARK,
  type FallbackScheme,
} from "../recipe/recipeHeroFallback";
import { normaliseMealSlot, type MealSlot } from "../nutrition/mealSlots";

export type FoodFallbackCategoryId =
  | "breakfast-bowl"
  | "eggs"
  | "pancakes-waffles"
  | "toast-sandwich"
  | "smoothie"
  | "baked-goods"
  | "salad"
  | "soup"
  | "pasta"
  | "ramen-noodles"
  | "rice-bowl"
  | "stir-fry"
  | "curry"
  | "fish"
  | "chicken"
  | "red-meat"
  | "burger"
  | "pizza"
  | "tacos-wraps"
  | "vegetables-sides"
  | "legumes-grains"
  | "dessert"
  | "fruit"
  | "drink";

export type MealSlotName = "Breakfast" | "Lunch" | "Dinner" | "Snacks" | string;

/**
 * Glyph vocabulary — lucide names already shipped for food surfaces on
 * BOTH platforms (RecipeHeroFallback's 8 + the slot-icon language from
 * `MealTypePicker` / planner `SLOT_ICON_MOBILE` + onboarding diet's
 * Apple + hydration's Coffee + household's Drumstick). Do not add a
 * name here without confirming it exists in `lucide-react-native` at
 * the pinned version.
 */
export type FoodFallbackGlyph =
  | "Salad"
  | "Beef"
  | "Fish"
  | "Pizza"
  | "Cookie"
  | "Soup"
  | "Wheat"
  | "Utensils"
  | "UtensilsCrossed"
  | "Coffee"
  | "Apple"
  | "Drumstick"
  | "Sun";

/**
 * Ordered keyword table — first match wins (more specific rows first).
 * Extension policy (ENG-1448): obvious wins only — plurals and
 * unambiguous synonyms. When a word could plausibly belong to two
 * categories, it stays OUT: a miss degrades to an honest glyph, a
 * wrong hit paints the wrong food (the exact ENG-1478 bug class).
 *
 * `photoConfident` rows sit immediately before their category's broad
 * row so the dish-specific string wins first. Only shipped-sample
 * categories carry a photo-confident row, and each such pattern names
 * the literal dish the sample depicts (see the photo-confidence note
 * in the file banner).
 */
const KEYWORD_RULES: ReadonlyArray<{
  pattern: RegExp;
  category: FoodFallbackCategoryId;
  /** Licenses the shipped sample PHOTO (glyph+tint need no licence). */
  photoConfident?: true;
}> = [
  // Sample: ramen-bowl.png — literally a ramen bowl. "ramen" is a dish
  // name, not a modifier; pho/udon/soba/noodles are DIFFERENT dishes
  // ("zucchini noodles") and only earn the glyph.
  { pattern: /\bramen\b/i, category: "ramen-noodles", photoConfident: true },
  { pattern: /\b(pho|udon|soba|noodles?)\b/i, category: "ramen-noodles" },
  // Sample: berry-smoothie.png — literally a smoothie. "shake" is
  // ambiguous ("protein shake") and only earns the glyph.
  { pattern: /\bsmoothies?\b/i, category: "smoothie", photoConfident: true },
  { pattern: /\b(shakes?|milkshakes?)\b/i, category: "smoothie" },
  { pattern: /\b(pancakes?|waffles?|french\s*toast|crepes?)\b/i, category: "pancakes-waffles" },
  {
    pattern: /\b(omelettes?|omelets?|scrambled|fried\s*eggs?|boiled\s*eggs?|poached\s*eggs?|shakshuka|frittata|eggs?)\b/i,
    category: "eggs",
  },
  // Sample: berry-breakfast-bowl.png — only the literal "breakfast
  // bowl" string licenses it; yogurt/porridge/oats/granola/acai are
  // distinct foods and only earn the glyph.
  { pattern: /\bbreakfast\s*bowls?\b/i, category: "breakfast-bowl", photoConfident: true },
  {
    pattern: /\b(yoghurt|yogurt|porridge|oats|oatmeal|muesli|granola|acai)\b/i,
    category: "breakfast-bowl",
  },
  { pattern: /\b(sandwich(?:es)?|toasts?|bagels?|burritos?|wraps?|panini)\b/i, category: "toast-sandwich" },
  { pattern: /\b(muffins?|scones?|croissants?|banana\s*bread|pastry|pastries)\b/i, category: "baked-goods" },
  // Sample: green-salad.png — only the literal green/garden salad
  // licenses it; bare "salad" is a compound head ("fruit salad",
  // "pasta salad") and only earns the glyph.
  { pattern: /\b(green|garden)\s*salads?\b/i, category: "salad", photoConfident: true },
  { pattern: /\b(salads?|slaw|coleslaw)\b/i, category: "salad" },
  { pattern: /\b(soups?|broths?|chowder|stews?|minestrone)\b/i, category: "soup" },
  // Sample: pasta-tomato.png — generic pasta reads honestly as pasta;
  // named shapes/dishes (spaghetti can be squash/zoodles, lasagne and
  // mac & cheese look nothing like the sample) only earn the glyph.
  { pattern: /\bpasta\b/i, category: "pasta", photoConfident: true },
  {
    pattern: /\b(spaghetti|penne|macaroni|ravioli|lasagne|lasagna|gnocchi|mac\s*&?\s*cheese)\b/i,
    category: "pasta",
  },
  { pattern: /\b(rice\s*bowl|poke|bibimbap|risotto|paella)\b/i, category: "rice-bowl" },
  { pattern: /\b(stir[\s-]?fry|fried\s*rice|teriyaki)\b/i, category: "stir-fry" },
  { pattern: /\b(curry|curries|dal|dhal|tagine|korma|masala)\b/i, category: "curry" },
  {
    pattern: /\b(salmon|tuna|fish|cod|sardines?|mackerel|trout|prawns?|shrimp|crab|lobster|seafood|shellfish)\b/i,
    category: "fish",
  },
  // Sample: roast-chicken.png — only the literal dish licenses it;
  // bare "chicken" is overwhelmingly a modifier ("chicken breast",
  // "chicken nuggets") and only earns the glyph.
  { pattern: /\broast(?:ed)?\s*chicken\b/i, category: "chicken", photoConfident: true },
  { pattern: /\b(chicken|wings?|schnitzel)\b/i, category: "chicken" },
  { pattern: /\b(steaks?|beef|lamb|pork|bacon|sausages?|meatballs?)\b/i, category: "red-meat" },
  { pattern: /\b(burgers?|cheeseburgers?|sliders?)\b/i, category: "burger" },
  { pattern: /\b(pizzas?|flatbread|calzones?)\b/i, category: "pizza" },
  { pattern: /\b(tacos?|fajitas?|quesadillas?|gyros?)\b/i, category: "tacos-wraps" },
  {
    pattern: /\b(vegetables?|veggies?|broccoli|carrots?|potato(?:es)?|fries|mash|roast\s*veg)\b/i,
    category: "vegetables-sides",
  },
  { pattern: /\b(beans?|lentils?|chickpeas?|quinoa|couscous|hummus)\b/i, category: "legumes-grains" },
  {
    pattern: /\b(cakes?|brownies?|ice\s*cream|puddings?|desserts?|cookies?|chocolate|donuts?|doughnuts?)\b/i,
    category: "dessert",
  },
  {
    // Second alternative has no leading \b on purpose: it catches the
    // compound berries ("strawberries", "blueberry") that a bounded
    // \bberry\b would miss.
    pattern: /\b(apples?|bananas?|fruits?|grapes?|oranges?|melons?|pears?|peach(?:es)?|mango(?:es)?)\b|(?:berry|berries)\b/i,
    category: "fruit",
  },
  { pattern: /\b(coffee|tea|cocoa|lattes?|espresso|cappuccino|americano|juice|matcha)\b/i, category: "drink" },
];

/** Categories with shipped sample assets (interim until full batch). */
export const FOOD_FALLBACK_SAMPLE_CATEGORIES: readonly FoodFallbackCategoryId[] = [
  "ramen-noodles",
  "breakfast-bowl",
  "chicken",
  "salad",
  "pasta",
  "smoothie",
] as const;

/** Per-category glyph — drawn from the shared food glyph vocabulary. */
export const FOOD_FALLBACK_GLYPH_BY_CATEGORY: Record<FoodFallbackCategoryId, FoodFallbackGlyph> = {
  "breakfast-bowl": "Wheat",
  eggs: "Utensils",
  "pancakes-waffles": "Cookie",
  "toast-sandwich": "Wheat",
  smoothie: "Apple",
  "baked-goods": "Cookie",
  salad: "Salad",
  soup: "Soup",
  pasta: "Wheat",
  "ramen-noodles": "Soup",
  "rice-bowl": "Wheat",
  "stir-fry": "UtensilsCrossed",
  curry: "Soup",
  fish: "Fish",
  chicken: "Drumstick",
  "red-meat": "Beef",
  burger: "Beef",
  pizza: "Pizza",
  "tacos-wraps": "UtensilsCrossed",
  "vegetables-sides": "Salad",
  "legumes-grains": "Wheat",
  dessert: "Cookie",
  fruit: "Apple",
  drink: "Coffee",
};

/**
 * Per-category tint — the §11.4 cuisine/cream family shared with
 * recipe heroes (`HERO_TINTS`). Never a new hex, never white: this is
 * the opaque underlay that guarantees a food row can't flash a white
 * square whatever happens above it.
 */
export const FOOD_FALLBACK_TINT_BY_CATEGORY: Record<FoodFallbackCategoryId, string> = {
  "breakfast-bowl": HERO_TINTS.ambers,
  eggs: HERO_TINTS.ambers,
  "pancakes-waffles": HERO_TINTS.ambers,
  "toast-sandwich": HERO_TINTS.neutrals,
  smoothie: HERO_TINTS.greens,
  "baked-goods": HERO_TINTS.ambers,
  salad: HERO_TINTS.greens,
  soup: HERO_TINTS.earths,
  pasta: HERO_TINTS.warms,
  "ramen-noodles": HERO_TINTS.earths,
  "rice-bowl": HERO_TINTS.neutrals,
  "stir-fry": HERO_TINTS.earths,
  curry: HERO_TINTS.earths,
  fish: HERO_TINTS.blues,
  chicken: HERO_TINTS.reds,
  "red-meat": HERO_TINTS.reds,
  burger: HERO_TINTS.reds,
  pizza: HERO_TINTS.warms,
  "tacos-wraps": HERO_TINTS.warms,
  "vegetables-sides": HERO_TINTS.greens,
  "legumes-grains": HERO_TINTS.neutrals,
  dessert: HERO_TINTS.ambers,
  fruit: HERO_TINTS.greens,
  drink: HERO_TINTS.earths,
};

/**
 * ENG-1528 — the DARK-scheme twin of `FOOD_FALLBACK_TINT_BY_CATEGORY`.
 * Same category → cuisine mapping, drawn from `HERO_TINTS_DARK` instead of
 * `HERO_TINTS`, so a food row on a dark card gets a toned dark underlay
 * rather than a glowing cream one. The light map above is untouched.
 */
export const FOOD_FALLBACK_TINT_BY_CATEGORY_DARK: Record<FoodFallbackCategoryId, string> = {
  "breakfast-bowl": HERO_TINTS_DARK.ambers,
  eggs: HERO_TINTS_DARK.ambers,
  "pancakes-waffles": HERO_TINTS_DARK.ambers,
  "toast-sandwich": HERO_TINTS_DARK.neutrals,
  smoothie: HERO_TINTS_DARK.greens,
  "baked-goods": HERO_TINTS_DARK.ambers,
  salad: HERO_TINTS_DARK.greens,
  soup: HERO_TINTS_DARK.earths,
  pasta: HERO_TINTS_DARK.warms,
  "ramen-noodles": HERO_TINTS_DARK.earths,
  "rice-bowl": HERO_TINTS_DARK.neutrals,
  "stir-fry": HERO_TINTS_DARK.earths,
  curry: HERO_TINTS_DARK.earths,
  fish: HERO_TINTS_DARK.blues,
  chicken: HERO_TINTS_DARK.reds,
  "red-meat": HERO_TINTS_DARK.reds,
  burger: HERO_TINTS_DARK.reds,
  pizza: HERO_TINTS_DARK.warms,
  "tacos-wraps": HERO_TINTS_DARK.warms,
  "vegetables-sides": HERO_TINTS_DARK.greens,
  "legumes-grains": HERO_TINTS_DARK.neutrals,
  dessert: HERO_TINTS_DARK.ambers,
  fruit: HERO_TINTS_DARK.greens,
  drink: HERO_TINTS_DARK.earths,
};

/**
 * Slot-tier glyphs mirror the established slot-icon language
 * (`MealTypePicker` / planner `SLOT_ICON_MOBILE`): breakfast = Coffee,
 * lunch = Sun, dinner = UtensilsCrossed, snacks = Cookie — a slot mark,
 * deliberately NOT a food category claim.
 */
const SLOT_GLYPH: Record<MealSlot, FoodFallbackGlyph> = {
  Breakfast: "Coffee",
  Lunch: "Sun",
  Dinner: "UtensilsCrossed",
  Snacks: "Cookie",
};

const SLOT_TINT: Record<MealSlot, string> = {
  Breakfast: HERO_TINTS.ambers,
  Lunch: HERO_TINTS.greens,
  Dinner: HERO_TINTS.default,
  Snacks: HERO_TINTS.ambers,
};

/** ENG-1528 — dark-scheme twin of `SLOT_TINT` (same slot → cuisine map). */
const SLOT_TINT_DARK: Record<MealSlot, string> = {
  Breakfast: HERO_TINTS_DARK.ambers,
  Lunch: HERO_TINTS_DARK.greens,
  Dinner: HERO_TINTS_DARK.default,
  Snacks: HERO_TINTS_DARK.ambers,
};

/** Sage glyph colour shared with the §11.4 recipe-hero mark (0.7 alpha). */
export const FOOD_FALLBACK_GLYPH_COLOR = `rgba(${SAGE_RGB}, 0.7)`;

/**
 * ENG-1528 — dark-scheme glyph ink. Mirrors the recipe-hero mark lift: the
 * lighter sage `#9AA382` reads on the dark tints where the light `#7C8466`
 * would dim to a murky olive. Same 0.7 alpha.
 */
export const FOOD_FALLBACK_GLYPH_COLOR_DARK = `rgba(${SAGE_RGB_DARK}, 0.7)`;

export function normalizeFoodTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tiered food-row fallback resolution (ENG-1448 PR 1):
 *   'category' — CONFIDENT keyword hit only; may render a sample image
 *                ONLY when `photoConfident` AND one has shipped for
 *                the category — otherwise glyph + tint.
 *   'slot'     — no keyword hit but the caller knows the meal slot;
 *                renders the slot glyph + tint, never a food image.
 *   'generic'  — honest utensil glyph on the neutral cream tint.
 * Every tier carries an opaque tint so the rendered thumb is never
 * white and never a fabricated specific food.
 */
export type FoodFallbackResolution =
  | {
      tier: "category";
      category: FoodFallbackCategoryId;
      glyph: FoodFallbackGlyph;
      tint: string;
      /** True ONLY when the matched keyword names the literal shipped-
       *  sample dish — the licence to render the sample PHOTO. */
      photoConfident: boolean;
    }
  | { tier: "slot"; slot: MealSlot; glyph: FoodFallbackGlyph; tint: string }
  | { tier: "generic"; glyph: FoodFallbackGlyph; tint: string };

export function resolveFoodFallback(
  name: string,
  opts?: { slot?: MealSlotName | null },
  // ENG-1528 — the active surface scheme. `"dark"` swaps every tier's tint
  // to the dark ramp so a food row on a dark card doesn't glow; `"light"`
  // (default) is byte-identical to the pre-dark-ramp behaviour.
  scheme: FallbackScheme = "light",
): FoodFallbackResolution {
  const dark = scheme === "dark";
  const categoryTints = dark ? FOOD_FALLBACK_TINT_BY_CATEGORY_DARK : FOOD_FALLBACK_TINT_BY_CATEGORY;
  const slotTints = dark ? SLOT_TINT_DARK : SLOT_TINT;
  const normalized = normalizeFoodTitle(name);
  if (normalized) {
    for (const rule of KEYWORD_RULES) {
      if (rule.pattern.test(normalized)) {
        return {
          tier: "category",
          category: rule.category,
          glyph: FOOD_FALLBACK_GLYPH_BY_CATEGORY[rule.category],
          tint: categoryTints[rule.category],
          photoConfident: rule.photoConfident === true,
        };
      }
    }
  }

  const slot = normaliseMealSlot(opts?.slot ?? null);
  if (slot) {
    return { tier: "slot", slot, glyph: SLOT_GLYPH[slot], tint: slotTints[slot] };
  }

  return {
    tier: "generic",
    glyph: "Utensils",
    tint: dark ? HERO_TINTS_DARK.default : HERO_TINTS.default,
  };
}

/**
 * Map a resolved category to its shipped sample asset, or `null` when none
 * exists — callers render their honest glyph fallback on `null`.
 *
 * ENG-1478 — this used to hash-remap unshipped categories onto a random
 * shipped sample ("fish" → berry smoothie, "pizza" → salad, "eggs" →
 * smoothie…), presenting a confidently WRONG food image: the same
 * fabrication class ENG-1287 removed from recipe cards. A wrong specific
 * image is worse than no image; the glyph is the designed honest state.
 */
export function resolveFoodFallbackSampleCategory(
  category: FoodFallbackCategoryId,
): FoodFallbackCategoryId | null {
  return (FOOD_FALLBACK_SAMPLE_CATEGORIES as readonly string[]).includes(category)
    ? category
    : null;
}
