// Extensionless relative imports so this module is mobile-safe (Metro +
// the mobile tsconfig, which rejects `.ts` import paths). ENG-1040 routes
// the mobile shopping list through this shared generator, pulling it into
// the mobile module graph for the first time.
import type { ShoppingItem } from "../../types/recipe";
import { effectivePortionMultiplier } from "../nutrition/portionMultiplier";
import { guessGroceryCategory } from "./category";
import { normalizeIngredientNameKey } from "./ingredientNameKey";
import { normalizeShoppingIngredientRow } from "./normalizeShoppingIngredientRow";
import { sortShoppingCategories } from "./shoppingAisleOrder";

/** ENG-983 — merge key uses normalized ingredient identity, not raw label text. */
function shoppingMergeKey(name: string, unit: string): string {
  return `${normalizeIngredientNameKey(name)}|${unit.trim().toLowerCase()}`;
}

/** @deprecated Catalog removed — always returns false. Kept for API compat. */
export function isCatalogRecipeId(_id: string): boolean {
  return false;
}

/**
 * ENG-1134 — recipe ingredient rows are stored for the full recipe yield
 * (`servings`). A planned 1-portion meal should buy 1/servings of each line,
 * not the whole batch. Combines the plan's portion multiplier with yield.
 */
export function shoppingListIngredientMultiplier(
  portionMultiplier: number | undefined,
  recipeServings: number | undefined,
): number {
  const portion = effectivePortionMultiplier(portionMultiplier);
  const servings =
    typeof recipeServings === "number" && Number.isFinite(recipeServings) && recipeServings > 0
      ? recipeServings
      : 1;
  return portion / servings;
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
    const key = shoppingMergeKey(normalized.name, normalized.unit);
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
  const categories = sortShoppingCategories(items.map((i) => i.category));
  const aisleRank = new Map(categories.map((c, i) => [c, i]));
  return [...items].sort((a, b) => {
    const ar = aisleRank.get(a.category) ?? Number.MAX_SAFE_INTEGER;
    const br = aisleRank.get(b.category) ?? Number.MAX_SAFE_INTEGER;
    if (ar !== br) return ar - br;
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
