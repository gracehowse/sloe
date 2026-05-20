/**
 * Supermarket walk order for shopping list sections (ENG-607).
 * Shared by web + mobile so aisles scan top-down without backtracking.
 */
export const SHOPPING_AISLE_ORDER = [
  "Produce",
  "Fruit & Veg",
  "Vegetables",
  "Fruit",
  "Bakery",
  "Meat",
  "Meat & Fish",
  "Seafood",
  "Protein",
  "Deli",
  "Dairy",
  "Dairy & Eggs",
  "Eggs",
  "Frozen",
  "Pantry",
  "Grains",
  "Carbs & Grains",
  "Pasta",
  "Canned",
  "Condiments",
  "Spices",
  "Oils",
  "Baking",
  "Snacks",
  "Drinks",
  "Alcohol",
  "Household",
  "Other",
] as const;

export function sortShoppingCategories(categories: Iterable<string>): string[] {
  const unique = [...new Set(categories)];
  return unique.sort((a, b) => {
    const ai = SHOPPING_AISLE_ORDER.indexOf(a as (typeof SHOPPING_AISLE_ORDER)[number]);
    const bi = SHOPPING_AISLE_ORDER.indexOf(b as (typeof SHOPPING_AISLE_ORDER)[number]);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
