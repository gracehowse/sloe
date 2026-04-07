import type { ShoppingItem } from "../../types/recipe.ts";
import { getIngredientsForRecipe } from "../../data/recipeCatalog.ts";
import { guessGroceryCategory } from "./category.ts";

function normalizeKey(name: string, unit: string): string {
  return `${name.trim().toLowerCase()}|${unit.trim().toLowerCase()}`;
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
    for (const ing of ingredients) {
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
        // Combine amounts when they parse as numbers and the unit matches.
        const prevNum = Number.parseFloat(existing.amount);
        if (Number.isFinite(prevNum) && Number.isFinite(amountNum)) {
          existing.amount = String(Math.round((prevNum + amountNum) * 100) / 100);
        } else {
          existing.amount = existing.amount; // keep original
        }
        // Keep a short provenance string
        if (!existing.from.includes(title)) {
          existing.from = `${existing.from}, ${title}`;
        }
        itemsByKey.set(key, existing);
      }
    }
  }

  return Array.from(itemsByKey.values()).sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });
}

