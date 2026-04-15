import type { ShoppingItem } from "../../types/recipe.ts";
import { guessGroceryCategory } from "./category.ts";

function normalizeKey(name: string, unit: string): string {
  return `${name.trim().toLowerCase()}|${unit.trim().toLowerCase()}`;
}

/** @deprecated Catalog removed — always returns false. Kept for API compat. */
export function isCatalogRecipeId(_id: string): boolean {
  return false;
}

function mergeRows(
  rows: Array<{ name: string; amount: string; unit: string }>,
  title: string,
  itemsByKey: Map<string, ShoppingItem>,
  portionMultiplier = 1,
): void {
  const mult =
    Number.isFinite(portionMultiplier) && portionMultiplier > 0 ? portionMultiplier : 1;
  for (const ing of rows) {
    const category = guessGroceryCategory(ing.name);
    const key = normalizeKey(ing.name, ing.unit);
    const existing = itemsByKey.get(key);
    const parsed = Number.parseFloat(ing.amount);
    const scaled = Number.isFinite(parsed) ? parsed * mult : null;
    if (!existing) {
      itemsByKey.set(key, {
        id: key,
        name: ing.name,
        amount: scaled != null ? String(Math.round(scaled * 100) / 100) : ing.amount,
        unit: ing.unit,
        category,
        checked: false,
        from: title,
      });
    } else {
      const prevNum = Number.parseFloat(existing.amount);
      if (Number.isFinite(prevNum) && scaled != null) {
        existing.amount = String(Math.round((prevNum + scaled) * 100) / 100);
      } else if (scaled == null && Number.isFinite(prevNum)) {
        existing.amount = String(prevNum);
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
  const entries = input.recipeTitles.map((title) => ({ title, multiplier: 1 }));
  return generateShoppingListFromRecipeEntriesSync({
    entries,
    recipeTitleToId: input.recipeTitleToId,
  });
}

export function generateShoppingListFromRecipeEntriesSync(input: {
  entries: Array<{ title: string; multiplier: number }>;
  recipeTitleToId: (title: string) => string | null;
}): ShoppingItem[] {
  const itemsByKey = new Map<string, ShoppingItem>();

  for (const { title } of input.entries) {
    // Sync path: no ingredients available without DB fetch
    // This path is unused now that catalog is removed
    void title;
  }

  return sortItems(Array.from(itemsByKey.values()));
}

export async function generateShoppingListFromRecipeTitlesAsync(input: {
  recipeTitles: string[];
  recipeTitleToId: (title: string) => string | null;
  fetchDbIngredients: (recipeId: string) => Promise<Array<{ name: string; amount: string; unit: string }>>;
}): Promise<ShoppingItem[]> {
  const entries = input.recipeTitles.map((title) => ({ title, multiplier: 1 }));
  return generateShoppingListFromRecipeEntriesAsync({
    entries,
    recipeTitleToId: input.recipeTitleToId,
    fetchDbIngredients: input.fetchDbIngredients,
  });
}

export async function generateShoppingListFromRecipeEntriesAsync(input: {
  entries: Array<{ title: string; multiplier: number }>;
  recipeTitleToId: (title: string) => string | null;
  fetchDbIngredients: (recipeId: string) => Promise<Array<{ name: string; amount: string; unit: string }>>;
}): Promise<ShoppingItem[]> {
  const itemsByKey = new Map<string, ShoppingItem>();

  for (const { title, multiplier } of input.entries) {
    const id = input.recipeTitleToId(title);
    if (!id) continue;
    const rows = await input.fetchDbIngredients(id);
    mergeRows(rows, title, itemsByKey, multiplier);
  }

  return sortItems(Array.from(itemsByKey.values()));
}
