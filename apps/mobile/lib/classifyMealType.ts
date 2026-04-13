/**
 * Auto-classify a recipe into meal types based on title, ingredients, and calories.
 * Returns an array of applicable meal slots, e.g. ["lunch", "dinner"].
 */

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

const BREAKFAST_TITLE = /\b(breakfast|pancakes?|waffles?|omelette|omelet|scrambled?\b|french toast|overnight oats|oatmeal|porridge|granola|smoothie bowl|acai|egg muffins?|frittata|shakshuka|eggs benedict|morning|brunch|cereal|muesli)\b/i;
const SNACK_TITLE = /\b(snack|energy balls?|protein balls?|protein bar|trail mix|hummus|dip|guacamole|popcorn|crackers|bliss balls?|bites|cookies?|brownies?|banana bread|flapjack|cake|cupcake|muffins?|crumble|pudding|tart|scones?|sponge)\b/i;
const DINNER_TITLE = /\b(stew|roast(?:ed)?|casserole|lasagne|lasagna|curry|stir.?fry|chili|chilli|slow.?cook|pot pie|shepherd|cottage pie|beef bourguignon|coq au vin|bolognese|ragu|tagine|braised|wellington|ramen|pho|biryani|enchiladas?|fajitas?|paella|risotto|goulash|stroganoff|parmesan|marsala|piccata|teriyaki|kung pao|sesame chicken|tikka masala|korma|jalfrezi|pad thai|chow mein|lo mein|yakisoba|carbonara|alfredo|chicken breast|pulled pork|meatballs?|meat ?loaf)\b/i;
const LUNCH_TITLE = /\b(salad|sandwich|wrap|(?<!burrito )bowl|soup|quesadilla|lettuce wraps?|pita|pitta|bagel|bento|meal prep)\b/i;

export function classifyMealType(opts: {
  title: string;
  ingredients?: string[];
  caloriesPerServing?: number | null;
}): MealType[] {
  const { title, caloriesPerServing } = opts;
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
