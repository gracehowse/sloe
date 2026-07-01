// Extensionless relative imports — mobile-safe (Metro + mobile tsconfig).
// ENG-943 — the shared persistence side of "Add to shopping list from a
// recipe". Both web (RecipeDetail) and mobile (recipe/[id]) call this so the
// merge + write semantics are identical by construction.
import type { ShoppingItem } from "../../types/recipe";
import {
  appendRecipeToShoppingList,
  type AppendRecipeToShoppingListResult,
  type RecipeIngredientLine,
} from "./appendRecipeToShoppingList";
import {
  shoppingScopeInsertStamp,
  shoppingScopeReadFilters,
  type ShoppingScope,
} from "../household/shoppingScope";

/**
 * Minimal structural shape of a Supabase client the appender needs. Kept
 * dependency-light so both the web typed client and the mobile client satisfy
 * it without a hard import.
 */
type ShoppingClient = {
  from: (table: string) => {
    select: (cols: string) => ChainableRead;
    insert: (rows: ShoppingInsertRow[]) => Promise<{ error: { message?: string } | null }>;
    update: (
      patch: { amount?: string; source?: string },
    ) => { eq: (col: string, val: string) => Promise<{ error: { message?: string } | null }> };
  };
};

type ChainableRead = {
  eq: (col: string, val: string) => ChainableRead;
  is: (col: string, val: null) => ChainableRead;
  then: (
    onfulfilled: (res: { data: ShoppingRow[] | null; error: { message?: string } | null }) => unknown,
  ) => Promise<unknown>;
};

type ShoppingRow = {
  id: string;
  name: string | null;
  amount: string | null;
  unit: string | null;
  category: string | null;
  checked: boolean | null;
  source: string | null;
  checked_by?: string | null;
};

type ShoppingInsertRow = {
  user_id: string;
  household_id: string | null;
  name: string;
  amount: string;
  unit: string;
  category: string;
  checked: boolean;
  source: string;
};

function readRowsToItems(rows: ShoppingRow[]): ShoppingItem[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name ?? "",
    amount: r.amount ?? "",
    unit: r.unit ?? "",
    category: r.category ?? "Other",
    checked: r.checked ?? false,
    from: r.source ?? "",
    checkedBy: r.checked_by ?? null,
  }));
}

export type AppendRecipeClientResult =
  | ({ ok: true } & AppendRecipeToShoppingListResult)
  | { ok: false; error: string };

/**
 * Read the current list for the scope, merge the recipe in (silent dedup +
 * count-to-weight where high-confidence), and persist ONLY the delta:
 *  - existing rows whose quantity/source changed → UPDATE (preserves `checked`),
 *  - brand-new rows → INSERT.
 *
 * Reading the live list first (rather than trusting in-memory state) keeps two
 * devices consistent and never clobbers checked rows or a household-mate's
 * items — the plan path's full delete-and-replace would. Returns the merged
 * list so the host can update local state without a refetch.
 */
export async function appendRecipeToShoppingListClient(input: {
  client: ShoppingClient;
  scope: ShoppingScope;
  recipeTitle: string;
  ingredients: readonly RecipeIngredientLine[];
  multiplier?: number;
}): Promise<AppendRecipeClientResult> {
  const { client, scope } = input;

  // 1. Read the current list for this scope. We apply the canonical solo /
  //    household read filters so we merge against the exact rows the list shows.
  let chain: ChainableRead = client
    .from("shopping_items")
    .select("id, name, amount, unit, category, checked, source, checked_by");
  for (const filter of shoppingScopeReadFilters(scope)) {
    const [col, op, val] = filter;
    chain = op === "is" ? chain.is(col, val) : chain.eq(col, val as string);
  }
  const readRes = (await chain) as {
    data: ShoppingRow[] | null;
    error: { message?: string } | null;
  };
  if (readRes.error) return { ok: false, error: readRes.error.message ?? "read failed" };

  const existing = readRowsToItems(readRes.data ?? []);
  const existingById = new Map(existing.map((it) => [it.id, it]));

  // 2. Merge in memory.
  const result = appendRecipeToShoppingList({
    existing,
    recipeTitle: input.recipeTitle,
    ingredients: input.ingredients,
    multiplier: input.multiplier,
    // New rows get a temp id; the DB assigns the real one on insert. We never
    // surface the temp id to the DB — inserts omit `id`.
    makeId: (key) => `new:${key}`,
  });

  // 3. Persist the delta.
  const stamp = shoppingScopeInsertStamp(scope);
  const inserts: ShoppingInsertRow[] = [];
  const updates: Array<{ id: string; amount: string; source: string }> = [];

  for (const item of result.items) {
    const prior = existingById.get(item.id);
    if (!prior) {
      // Brand-new row (temp id `new:*`, or an existing-but-not-in-DB id).
      inserts.push({
        user_id: stamp.user_id,
        household_id: stamp.household_id,
        name: item.name,
        amount: item.amount,
        unit: item.unit,
        category: item.category,
        checked: false,
        source: item.from,
      });
    } else if (prior.amount !== item.amount || prior.from !== item.from) {
      updates.push({ id: item.id, amount: item.amount, source: item.from });
    }
  }

  for (const u of updates) {
    const { error } = await client
      .from("shopping_items")
      .update({ amount: u.amount, source: u.source })
      .eq("id", u.id);
    if (error) return { ok: false, error: error.message ?? "update failed" };
  }

  for (let i = 0; i < inserts.length; i += 50) {
    const { error } = await client.from("shopping_items").insert(inserts.slice(i, i + 50));
    if (error) return { ok: false, error: error.message ?? "insert failed" };
  }

  return { ok: true, ...result };
}
