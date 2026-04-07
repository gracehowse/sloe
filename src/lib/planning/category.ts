export function guessGroceryCategory(ingredientName: string): string {
  const n = ingredientName.toLowerCase();

  if (/(chicken|turkey|beef|pork|salmon|tuna|fish|shrimp|egg|eggs)/.test(n)) return "Protein";
  if (/(yogurt|milk|cheese|butter)/.test(n)) return "Dairy";
  if (/(rice|oat|oats|bread|pasta|granola|cereal|flour)/.test(n)) return "Grains";
  if (/(broccoli|spinach|kale|lettuce|carrot|pepper|onion|garlic|tomato|potato)/.test(n)) return "Vegetables";
  if (/(berry|berries|banana|apple|orange|lemon|lime)/.test(n)) return "Fruit";
  if (/(oil|olive|avocado oil)/.test(n)) return "Oils";
  if (/(chia|nuts|almond|peanut|seed|seeds)/.test(n)) return "Pantry";

  return "Other";
}

