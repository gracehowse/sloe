/**
 * Deterministic food-row fallback category resolution (ENG-1015 §5).
 *
 * Pure data — importable from web, mobile, and tests. Title in → category
 * id out, stable across sessions and platforms.
 */

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

/** Ordered keyword table — first match wins (more specific rows first). */
const KEYWORD_RULES: ReadonlyArray<{ pattern: RegExp; category: FoodFallbackCategoryId }> = [
  { pattern: /\b(ramen|pho|udon|noodle\s*bowl)\b/i, category: "ramen-noodles" },
  { pattern: /\b(smoothie|shake|protein\s*shake)\b/i, category: "smoothie" },
  { pattern: /\b(pancake|waffle|french\s*toast|crepe)\b/i, category: "pancakes-waffles" },
  { pattern: /\b(omelette|omelet|scrambled|fried\s*egg|boiled\s*egg|shakshuka)\b/i, category: "eggs" },
  { pattern: /\b(yoghurt|yogurt|porridge|oats|granola|acai|breakfast\s*bowl)\b/i, category: "breakfast-bowl" },
  { pattern: /\b(sandwich|toast|bagel|burrito|wrap)\b/i, category: "toast-sandwich" },
  { pattern: /\b(muffin|scone|croissant|banana\s*bread)\b/i, category: "baked-goods" },
  { pattern: /\b(salad|slaw)\b/i, category: "salad" },
  { pattern: /\b(soup|broth|chowder|stew)\b/i, category: "soup" },
  { pattern: /\b(pasta|lasagne|lasagna|gnocchi|mac\s*&?\s*cheese)\b/i, category: "pasta" },
  { pattern: /\b(rice\s*bowl|poke|bibimbap|risotto|paella)\b/i, category: "rice-bowl" },
  { pattern: /\b(stir[\s-]?fry|fried\s*rice|teriyaki)\b/i, category: "stir-fry" },
  { pattern: /\b(curry|dal|tagine|korma)\b/i, category: "curry" },
  { pattern: /\b(salmon|tuna|fish|prawn|shrimp|seafood|shellfish)\b/i, category: "fish" },
  { pattern: /\b(chicken|wing|schnitzel)\b/i, category: "chicken" },
  { pattern: /\b(steak|beef|lamb|pork|meatball)\b/i, category: "red-meat" },
  { pattern: /\b(burger|slider)\b/i, category: "burger" },
  { pattern: /\b(pizza|flatbread|calzone)\b/i, category: "pizza" },
  { pattern: /\b(taco|fajita|quesadilla|gyro)\b/i, category: "tacos-wraps" },
  { pattern: /\b(vegetable|broccoli|carrot|fries|mash|roast\s*veg)\b/i, category: "vegetables-sides" },
  { pattern: /\b(bean|lentil|chickpea|quinoa|couscous|hummus)\b/i, category: "legumes-grains" },
  { pattern: /\b(cake|brownie|ice\s*cream|pudding|dessert|cookie)\b/i, category: "dessert" },
  { pattern: /\b(apple|banana|berry|fruit|grape|orange)\b/i, category: "fruit" },
  { pattern: /\b(coffee|tea|cocoa|latte|espresso)\b/i, category: "drink" },
];

const SLOT_DEFAULTS: Record<string, FoodFallbackCategoryId> = {
  breakfast: "breakfast-bowl",
  lunch: "salad",
  dinner: "rice-bowl",
  snacks: "fruit",
  snack: "fruit",
};

const HASH_FALLBACK_POOL: readonly FoodFallbackCategoryId[] = [
  "rice-bowl",
  "pasta",
  "salad",
  "vegetables-sides",
] as const;

/** Categories with shipped sample assets (interim until full batch). */
export const FOOD_FALLBACK_SAMPLE_CATEGORIES: readonly FoodFallbackCategoryId[] = [
  "ramen-noodles",
  "breakfast-bowl",
  "chicken",
  "salad",
  "pasta",
  "smoothie",
] as const;

export function normalizeFoodTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** FNV-1a 32-bit — stable hash for title-only fallback. */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function resolveFoodFallbackCategory(args: {
  title: string;
  slot?: MealSlotName | null;
}): FoodFallbackCategoryId {
  const normalized = normalizeFoodTitle(args.title);
  if (normalized) {
    for (const rule of KEYWORD_RULES) {
      if (rule.pattern.test(normalized)) {
        return rule.category;
      }
    }
  }

  const slotKey = (args.slot ?? "").trim().toLowerCase();
  if (slotKey && slotKey in SLOT_DEFAULTS) {
    return SLOT_DEFAULTS[slotKey];
  }

  const hashSource = normalized || "food";
  const idx = fnv1a32(hashSource) % HASH_FALLBACK_POOL.length;
  return HASH_FALLBACK_POOL[idx];
}

/** Map a resolved category to the nearest shipped sample asset category. */
export function resolveFoodFallbackSampleCategory(
  category: FoodFallbackCategoryId,
): FoodFallbackCategoryId {
  if ((FOOD_FALLBACK_SAMPLE_CATEGORIES as readonly string[]).includes(category)) {
    return category;
  }
  const idx = fnv1a32(category) % FOOD_FALLBACK_SAMPLE_CATEGORIES.length;
  return FOOD_FALLBACK_SAMPLE_CATEGORIES[idx];
}
