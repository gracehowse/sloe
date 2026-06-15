/**
 * ENG-1133 — keyword grocery aisle guesser for shopping-list grouping.
 * Returns labels from SHOPPING_AISLE_ORDER (first-match-wins, word boundaries).
 */
import { SHOPPING_AISLE_ORDER } from "./shoppingAisleOrder";

type CategoryRule = { pattern: RegExp; label: string };

/** Ordered table — first match wins. Patterns use word boundaries where possible. */
const CATEGORY_RULES: CategoryRule[] = [
  // Protein / meat / fish / eggs
  {
    pattern:
      /\b(?:chicken|turkey|beef|steak|pork|bacon|sausage|ham|lamb|duck|venison|salmon|tuna|cod|haddock|trout|mackerel|sardine|sardines|fish|shrimp|prawn|prawns|crab|lobster|scallop|scallops|tofu|tempeh|seitan|egg|eggs|mince|ground beef|ground turkey)\b/i,
    label: "Protein",
  },
  // Legumes (often grouped with protein or pantry — Protein keeps shopping compact)
  {
    pattern:
      /\b(?:bean|beans|black bean|kidney bean|chickpea|chickpeas|garbanzo|lentil|lentils|edamame|pea|peas|split pea)\b/i,
    label: "Protein",
  },
  // Dairy
  {
    pattern:
      /\b(?:yogurt|yoghurt|milk|cheese|cheddar|mozzarella|parmesan|feta|butter|cream|sour cream|creme fraiche|ricotta|cottage cheese|ghee|kefir)\b/i,
    label: "Dairy",
  },
  // Grains / carbs
  {
    pattern:
      /\b(?:rice|oat|oats|oatmeal|bread|pasta|noodle|noodles|granola|cereal|flour|quinoa|couscous|barley|bulgur|tortilla|wrap|bagel|bun|buns|crackers|pita|naan|polenta|semolina|cornmeal)\b/i,
    label: "Grains",
  },
  // Vegetables
  {
    pattern:
      /\b(?:broccoli|spinach|kale|lettuce|arugula|rocket|carrot|carrots|pepper|peppers|onion|onions|garlic|tomato|tomatoes|potato|potatoes|sweet potato|cucumber|zucchini|courgette|aubergine|eggplant|celery|mushroom|mushrooms|cabbage|cauliflower|asparagus|beet|beets|beetroot|corn|squash|pumpkin|leek|leeks|ginger|scallion|spring onion|shallot|shallots|radish|radishes|avocado)\b/i,
    label: "Vegetables",
  },
  // Fruit
  {
    pattern:
      /\b(?:berry|berries|strawberr|blueberr|raspberr|blackberr|banana|apple|orange|lemon|lime|grape|grapes|melon|watermelon|mango|mangoes|pineapple|peach|peaches|pear|pears|plum|plums|cherry|cherries|kiwi|papaya|fig|figs|date|dates|raisin|raisins|sultana|cranberr)\b/i,
    label: "Fruit",
  },
  // Herbs (fresh)
  {
    pattern:
      /\b(?:basil|parsley|cilantro|coriander|mint|dill|rosemary|thyme|oregano|sage|chive|chives|tarragon|bay leaf|bay leaves)\b/i,
    label: "Produce",
  },
  // Spices / dried seasonings
  {
    pattern:
      /\b(?:spice|spices|paprika|cumin|turmeric|curry|cinnamon|nutmeg|clove|cloves|cardamom|chili powder|chilli powder|cayenne|allspice|garam masala|oregano dried|dried herb)\b/i,
    label: "Spices",
  },
  // Sauces / condiments
  {
    pattern:
      /\b(?:sauce|sauces|ketchup|mustard|mayonnaise|mayo|soy sauce|tamari|fish sauce|oyster sauce|hoisin|sriracha|hot sauce|bbq sauce|barbecue sauce|pesto|salsa|vinegar|balsamic|worcestershire|tahini|miso|paste|harissa|chutney|relish|dressing|marinade|stock cube|bouillon|broth)\b/i,
    label: "Condiments",
  },
  // Oils / fats
  {
    pattern: /\b(?:oil|olive oil|avocado oil|vegetable oil|sunflower oil|rapeseed oil|canola oil|coconut oil|sesame oil|cooking spray)\b/i,
    label: "Oils",
  },
  // Pantry staples / nuts / seeds
  {
    pattern:
      /\b(?:chia|flax|hemp seed|sunflower seed|pumpkin seed|sesame seed|nut|nuts|almond|almonds|walnut|walnuts|pecan|pecans|cashew|cashews|peanut|peanuts|hazelnut|pistachio|seed|seeds|honey|maple syrup|sugar|brown sugar|baking powder|baking soda|yeast|vanilla|cocoa|chocolate|jam|marmalade|peanut butter|almond butter|coconut|breadcrumbs|stock|broth)\b/i,
    label: "Pantry",
  },
  // Canned
  {
    pattern: /\b(?:canned|tinned|can of|tin of)\b/i,
    label: "Canned",
  },
  // Frozen
  {
    pattern: /\b(?:frozen)\b/i,
    label: "Frozen",
  },
  // Drinks
  {
    pattern: /\b(?:juice|coffee|tea|soda|sparkling water|mineral water|wine|beer)\b/i,
    label: "Drinks",
  },
];

const VALID_LABELS = new Set<string>(SHOPPING_AISLE_ORDER);

export function guessGroceryCategory(ingredientName: string): string {
  const n = ingredientName.trim();
  if (!n) return "Other";

  for (const { pattern, label } of CATEGORY_RULES) {
    if (pattern.test(n)) {
      if (!VALID_LABELS.has(label)) {
        return "Other";
      }
      return label;
    }
  }

  return "Other";
}

/** @internal — exposed for tests asserting rule table hygiene */
export function groceryCategoryRulesForTests(): readonly CategoryRule[] {
  return CATEGORY_RULES;
}
