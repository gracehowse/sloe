/**
 * Auto-classify a recipe into meal types based on title, ingredients, optional caption/body, and calories.
 * Returns an array of applicable meal slots, e.g. ["lunch", "dinner"].
 *
 * When the caption or description **explicitly** names a meal (hashtags, "for breakfast", "dinner recipe", …),
 * that wins over title-only heuristics so social imports match creator intent.
 */

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

type ExplicitHit = { index: number; priority: number; slot: MealType };

/**
 * Detect a single explicit meal call-out in social / long-form text (caption, description, hashtags).
 * Returns one slot when confident; otherwise `null` so callers fall back to title heuristics.
 */
export function inferExplicitMealSlotsFromText(text: string): MealType[] | null {
  const hay = text.replace(/\s+/g, " ").trim().toLowerCase();
  if (!hay) return null;

  const hits: ExplicitHit[] = [];
  const add = (re: RegExp, slot: MealType, priority: number) => {
    const m = hay.match(re);
    if (m && m.index !== undefined) hits.push({ index: m.index, priority, slot });
  };

  // Hashtags — highest confidence
  add(/#easybreakfast\b/, "breakfast", 110);
  add(/#breakfast\b/, "breakfast", 105);
  add(/#brunch\b/, "breakfast", 104);
  add(/#lunch\b/, "lunch", 105);
  add(/#lunchbox\b/, "lunch", 104);
  add(/#dinner\b/, "dinner", 105);
  add(/#weeknightdinner\b/, "dinner", 104);
  add(/#(snacks?|healthysnack)\b/, "snack", 105);

  // Phrases — avoid bare "dinner" in "dinner rolls" via "dinner recipe / for dinner / dinner tonight"
  add(/(?<!\bnot\s)for\s+breakfast\b/, "breakfast", 96);
  add(/(?<!\bnot\s)for\s+brunch\b/, "breakfast", 95);
  add(/\b(a\s+)?(quick|easy|healthy|high[- ]protein|best|yummy|delicious)\s+breakfast\b/, "breakfast", 90);
  add(/\bbreakfast\s+(recipe|recipes|ideas?|inspo|bowl|toast|parfait|sandwich|wrap|idea|meal)\b/, "breakfast", 92);
  add(/\bbrunch\s+(recipe|ideas?|time)?\b/, "breakfast", 88);
  add(/\bmorning\s+(meal|fuel|routine)\b/, "breakfast", 85);

  add(/(?<!\bnot\s)for\s+lunch\b/, "lunch", 96);
  add(/\blunch\s+(recipe|recipes|ideas?|idea|meal|prep|box|bowl)\b/, "lunch", 92);
  add(/\b(light|quick|easy|healthy)\s+lunch\b/, "lunch", 88);

  add(/(?<!\bnot\s)for\s+dinner\b/, "dinner", 96);
  add(/\bdinner\s+(recipe|recipes|ideas?|idea|tonight|time|meal|plate)\b/, "dinner", 92);
  add(/\b(weeknight|sunday|family|date\s*night)\s+dinner\b/, "dinner", 90);

  add(/(?<!\bnot\s)for\s+a\s+snack\b/, "snack", 95);
  add(/\b(post[- ]workout|afternoon|mid[- ]morning|healthy)\s+snack\b/, "snack", 90);
  add(/\bsnack\s+(recipe|recipes|ideas?|time|attack)\b/, "snack", 88);

  if (hits.length === 0) return null;
  hits.sort((a, b) => a.index - b.index || b.priority - a.priority);
  const best = hits[0]!;
  return [best.slot];
}

const BREAKFAST_TITLE = /\b(breakfast|pancakes?|waffles?|omelette|omelet|scrambled?\b|french toast|overnight oats|oatmeal|porridge|granola|smoothie bowl|acai|egg muffins?|frittata|shakshuka|eggs benedict|morning|brunch|cereal|muesli)\b/i;
const SNACK_TITLE = /\b(snack|energy balls?|protein balls?|protein bar|trail mix|hummus|dip|guacamole|popcorn|crackers|bliss balls?|bites|cookies?|brownies?|banana bread|flapjack|cake|cupcake|muffins?|crumble|pudding|tart|scones?|sponge)\b/i;
const DINNER_TITLE = /\b(stew|roast(?:ed)?|casserole|lasagne|lasagna|curry|stir.?fry|chili|chilli|slow.?cook|pot pie|shepherd|cottage pie|beef bourguignon|coq au vin|bolognese|ragu|tagine|braised|wellington|ramen|pho|biryani|enchiladas?|fajitas?|paella|risotto|goulash|stroganoff|parmesan|marsala|piccata|teriyaki|kung pao|sesame chicken|tikka masala|korma|jalfrezi|pad thai|chow mein|lo mein|yakisoba|carbonara|alfredo|chicken breast|pulled pork|meatballs?|meat ?loaf)\b/i;
const LUNCH_TITLE = /\b(salad|sandwich|wrap|(?<!burrito )bowl|soup|quesadilla|lettuce wraps?|pita|pitta|bagel|bento|meal prep)\b/i;

export function classifyMealType(opts: {
  title: string;
  ingredients?: string[];
  caloriesPerServing?: number | null;
  /** Social caption, meta description, or any extra prose — checked first for explicit meal tags. */
  caption?: string | null;
  /** Recipe / post description body (HTML import, etc.). */
  description?: string | null;
}): MealType[] {
  const { title, caloriesPerServing, caption, description } = opts;

  const blob = [caption, description, title, ...(opts.ingredients ?? [])]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .join("\n");
  const explicit = inferExplicitMealSlotsFromText(blob);
  if (explicit && explicit.length > 0) return explicit;

  const tags = new Set<MealType>();

  // Breakfast signals
  if (BREAKFAST_TITLE.test(title)) tags.add("breakfast");

  // Snack signals
  if (SNACK_TITLE.test(title)) tags.add("snack");
  if (caloriesPerServing != null && caloriesPerServing < 200) {
    if (/\b(cookie|brownie|muffin|bar|balls?|bites|bread|hash browns?|cauliflower)\b/i.test(title)) {
      tags.add("snack");
    }
  }
  if (caloriesPerServing != null && caloriesPerServing < 150) tags.add("snack");

  // Dinner signals
  if (DINNER_TITLE.test(title)) tags.add("dinner");
  if (/\b(chicken|salmon|beef|pork|tofu|shrimp|prawn|turkey|lamb|fish|cod|tuna)\b/i.test(title)) {
    tags.add("dinner");
  }
  if (/\b(fried rice|noodle|pasta|rice|sheet.?pan|one.?pot|skillet)\b/i.test(title)) {
    tags.add("dinner");
  }

  // Lunch signals
  if (LUNCH_TITLE.test(title)) tags.add("lunch");

  // Many dinner-tagged items also work for lunch
  if (tags.has("dinner") && !tags.has("breakfast") && !tags.has("snack")) {
    // Lighter dinner dishes (under ~500 cal) also work for lunch
    if (caloriesPerServing == null || caloriesPerServing < 500) {
      tags.add("lunch");
    }
  }

  // Calorie fallback when nothing matched
  if (tags.size === 0 && caloriesPerServing != null) {
    if (caloriesPerServing >= 400) {
      tags.add("dinner");
      tags.add("lunch");
    } else if (caloriesPerServing >= 200) {
      tags.add("lunch");
    } else {
      tags.add("snack");
    }
  }

  return tags.size > 0 ? Array.from(tags) : ["dinner"];
}
