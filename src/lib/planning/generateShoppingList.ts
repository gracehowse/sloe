import type { ShoppingItem } from "../../types/recipe.ts";
import { getIngredientsForRecipe, RECIPE_CATALOG } from "../../data/recipeCatalog.ts";
import { guessGroceryCategory } from "./category.ts";

function normalizeKey(name: string, unit: string): string {
  return `${name.trim().toLowerCase()}|${unit.trim().toLowerCase()}`;
}

export function isCatalogRecipeId(id: string): boolean {
  return RECIPE_CATALOG.some((r) => r.id === id);
}

function mergeRows(
  rows: Array<{ name: string; amount: string; unit: string }>,
  title: string,
  itemsByKey: Map<string, ShoppingItem>,
): void {
  for (const ing of rows) {
    const category = guessGroceryCategory(ing.name);
    const key = normalizeKey(ing.name, ing.unit);
    const existing = itemsByKey.get(key);
    const amountNum = Number.parseFloat(ing.amount);
    if (!existing) {
      itemsByKey.set(key, {
        id: key,
        name: ing.name,
        amount: Number.isFinite(amountNum) ? String(amountNum) : ing.amount,
        unit: ing.unit,
        category,
        checked: false,
        from: title,
      });
    } else {
      const prevNum = Number.parseFloat(existing.amount);
      if (Number.isFinite(prevNum) && Number.isFinite(amountNum)) {
        existing.amount = String(Math.round((prevNum + amountNum) * 100) / 100);
      }
      if (!existing.from.includes(title)) {
        existing.from = `${existing.from}, ${title}`;
      }
      itemsByKey.set(key, existing);
    }
  }
}

function sortItems(items: ShoppingItem[]): ShoppingItem[] {
  return [...items].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });
}

export function generateShoppingListFromRecipeTitles(input: {
  recipeTitles: string[];
  recipeTitleToId: (title: string) => string | null;
}): ShoppingItem[] {
  const { recipeTitles, recipeTitleToId } = input;
  const itemsByKey = new Map<string, ShoppingItem>();

  for (const title of recipeTitles) {
    const id = recipeTitleToId(title);
    if (!id) continue;
    const ingredients = getIngredientsForRecipe(id);
    const rows = ingredients.map((ing) => ({ name: ing.name, amount: ing.amount, unit: ing.unit }));
    mergeRows(rows, title, itemsByKey);
  }

  return sortItems(Array.from(itemsByKey.values()));
}

export async function generateShoppingListFromRecipeTitlesAsync(input: {
  recipeTitles: string[];
  recipeTitleToId: (title: string) => string | null;
  fetchDbIngredients: (recipeId: string) => Promise<Array<{ name: string; amount: string; unit: string }>>;
}): Promise<ShoppingItem[]> {
  const itemsByKey = new Map<string, ShoppingItem>();

  for (const title of input.recipeTitles) {
    const id = input.recipeTitleToId(title);
    if (!id) continue;
    let rows: Array<{ name: string; amount: string; unit: string }>;
    if (isCatalogRecipeId(id)) {
      const ingredients = getIngredientsForRecipe(id);
      rows = ingredients.map((ing) => ({ name: ing.name, amount: ing.amount, unit: ing.unit }));
    } else {
      rows = await input.fetchDbIngredients(id);
    }
    mergeRows(rows, title, itemsByKey);
  }

  return sortItems(Array.from(itemsByKey.values()));
}
