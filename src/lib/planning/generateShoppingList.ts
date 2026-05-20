import type { ShoppingItem } from "../../types/recipe.ts";
import { guessGroceryCategory } from "./category.ts";
import { normalizeShoppingIngredientRow } from "./normalizeShoppingIngredientRow.ts";

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
    const normalized = normalizeShoppingIngredientRow(ing);
    const category = guessGroceryCategory(normalized.name);
    const key = normalizeKey(normalized.name, normalized.unit);
    const existing = itemsByKey.get(key);
    const parsed = Number.parseFloat(normalized.amount);
    const scaled = Number.isFinite(parsed) ? parsed * mult : null;
    if (!existing) {
      itemsByKey.set(key, {
        id: key,
        name: normalized.name,
        amount: scaled != null ? String(Math.round(scaled * 100) / 100) : normalized.amount,
        unit: normalized.unit,
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

export type RecipeIngredientRow = { name: string; amount: string; unit: string };

export function generateShoppingListFromRecipeEntries(input: {
  entries: Array<{ title: string; multiplier: number }>;
  recipeTitleToId: (title: string) => string | null;
  ingredientsByRecipeId: Map<string, RecipeIngredientRow[]>;
}): ShoppingItem[] {
  const itemsByKey = new Map<string, ShoppingItem>();

  for (const { title, multiplier } of input.entries) {
    const id = input.recipeTitleToId(title);
    if (!id) continue;
    mergeRows(input.ingredientsByRecipeId.get(id) ?? [], title, itemsByKey, multiplier);
  }

  return sortItems(Array.from(itemsByKey.values()));
}

/** @deprecated Use {@link generateShoppingListFromRecipeEntries} with a pre-fetched ingredient map. */
export function generateShoppingListFromRecipeEntriesSync(input: {
  entries: Array<{ title: string; multiplier: number }>;
  recipeTitleToId: (title: string) => string | null;
}): ShoppingItem[] {
  return generateShoppingListFromRecipeEntries({
    ...input,
    ingredientsByRecipeId: new Map(),
  });
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
  fetchDbIngredients: (recipeId: string) => Promise<RecipeIngredientRow[]>;
  fetchDbIngredientsBatch?: (recipeIds: string[]) => Promise<Map<string, RecipeIngredientRow[]>>;
}): Promise<ShoppingItem[]> {
  const uniqueIds = [
    ...new Set(
      input.entries
        .map((e) => input.recipeTitleToId(e.title))
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  let ingredientsByRecipeId: Map<string, RecipeIngredientRow[]>;
  if (input.fetchDbIngredientsBatch) {
    ingredientsByRecipeId = await input.fetchDbIngredientsBatch(uniqueIds);
  } else {
    ingredientsByRecipeId = new Map();
    await Promise.all(
      uniqueIds.map(async (id) => {
        ingredientsByRecipeId.set(id, await input.fetchDbIngredients(id));
      }),
    );
  }

  return generateShoppingListFromRecipeEntries({
    entries: input.entries,
    recipeTitleToId: input.recipeTitleToId,
    ingredientsByRecipeId,
  });
}
