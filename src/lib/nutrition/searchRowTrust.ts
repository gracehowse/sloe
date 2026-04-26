/**
 * F-89 + F-90 (2026-04-25) — defence-in-depth filters for food-search
 * results that pass F-77's Atwater plausibility gate but are still
 * wrong:
 *
 *  - F-89 catches the "bare noun, wrong macros" poison. A row whose
 *    name is just a common single-word generic ("Egg", "Eggs",
 *    "Banana", "Chicken") and whose source isn't verified USDA is
 *    almost certainly a user-uploaded mislabelled product (e.g. an
 *    Edamam row called "Egg" at 525 kcal/100g — internally consistent
 *    but not a chicken egg). Verified USDA rows always carry modifiers
 *    ("Eggs, Grade A, Large, egg whole" / "Bananas, raw"), so dropping
 *    bare-noun unverified rows is a safe filter.
 *
 *  - F-90 catches Edamam's "category tagged" results that match the
 *    query weakly ("Cacio E Pepe Ravioli" surfacing for "eggs" because
 *    Edamam tagged it as containing eggs). Word-overlap relevance gives
 *    these rows ≤ 0.3 — drop them from non-verified sources to keep
 *    the list focused on what the user actually typed.
 */

/**
 * Common single-word generic food nouns that virtually always have a
 * verified USDA generic row. If a non-verified hit's display name is
 * exactly one of these (singular or plural), the row is suspect.
 *
 * Conservative — favour false-negatives (one or two real bare-noun rows
 * leak through) over false-positives (dropping a legitimate brand named
 * after a noun, e.g. "Apple Juice"). Each entry is ONE word; multi-word
 * names always pass.
 */
const GENERIC_FOOD_NOUNS = new Set([
  // Animal proteins
  "egg", "eggs", "chicken", "beef", "pork", "lamb", "turkey", "duck",
  "salmon", "tuna", "cod", "shrimp", "prawn", "prawns", "crab", "lobster",
  // Dairy / staples
  "milk", "cheese", "butter", "yogurt", "yoghurt", "cream", "tofu",
  // Fruits
  "apple", "apples", "banana", "bananas", "orange", "oranges",
  "lemon", "lemons", "lime", "limes", "grape", "grapes",
  "strawberry", "strawberries", "blueberry", "blueberries",
  "raspberry", "raspberries", "blackberry", "blackberries",
  "watermelon", "pineapple", "mango", "mangoes", "peach", "peaches",
  "pear", "pears", "plum", "plums", "kiwi", "avocado", "avocados",
  // Vegetables
  "tomato", "tomatoes", "potato", "potatoes", "carrot", "carrots",
  "onion", "onions", "garlic", "ginger", "cucumber", "cucumbers",
  "broccoli", "spinach", "kale", "lettuce", "cabbage", "cauliflower",
  "pepper", "peppers", "courgette", "zucchini", "aubergine", "eggplant",
  // Grains / staples
  "rice", "pasta", "bread", "oats", "quinoa", "couscous", "barley",
  // Beverages
  "water", "coffee", "tea", "juice", "wine", "beer",
]);

const PUNCT_SPLIT = /[\s,()/·•]+/;

/**
 * F-89 — return true when a non-verified result's display name is just
 * a single generic-food noun (and therefore the row is likely a
 * misnamed product rather than the canonical food the user wants).
 *
 * `displayName` may include a brand prefix joined by " · " (OFF
 * convention) — strip the brand before evaluating since "Lidl · Egg"
 * is a brand row, not a bare noun. The check intentionally only fires
 * on the post-brand part being one of the generic nouns.
 */
export function isBareGenericNounRow(
  displayName: string,
  isVerified: boolean,
): boolean {
  if (isVerified) return false;
  if (!displayName) return false;

  // Strip OFF-style brand prefix ("Lidl · Eggs" → "Eggs"). Don't strip
  // parentheticals or modifiers — a row like "Banana (overripe)" or
  // "Egg, raw" carries a real qualifier and isn't bare. The helper
  // fires only when the entire post-brand name is one bare noun.
  const afterBrand = displayName.includes(" · ")
    ? displayName.split(" · ").slice(1).join(" · ")
    : displayName;
  const cleaned = afterBrand.trim().toLowerCase();
  if (!cleaned) return false;

  // Bare noun — one token, no comma / parenthesis / space.
  if (/[\s,()/·•]/.test(cleaned)) return false;
  return GENERIC_FOOD_NOUNS.has(cleaned);
}

/**
 * F-90 — return true when a non-verified row's relevance score is
 * below the minimum threshold for non-verified sources. Verified USDA
 * rows are exempt because the user explicitly typed something the
 * verified corpus matched on.
 *
 * Threshold of 0.3 catches Edamam category-tag matches like
 * "Cacio E Pepe Ravioli" surfacing for "eggs" while still letting
 * legitimate near-matches like "egg noodles" through (they typically
 * score 0.45+).
 */
export function isLowRelevanceNonVerifiedRow(
  relevance: number,
  isVerified: boolean,
): boolean {
  if (isVerified) return false;
  return relevance < 0.30;
}
