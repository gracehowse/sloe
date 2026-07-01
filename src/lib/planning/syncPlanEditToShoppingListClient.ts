// Extensionless relative imports — mobile-safe (Metro + the mobile tsconfig).
// ENG-957 — the shared persistence side of the plan→shopping-list re-sync. Both
// web (MealPlanner via AppDataContext) and mobile (planner.tsx) call this so the
// merge/decrement + write semantics are identical by construction. Reads the
// LIVE list first (never trusts in-memory state), applies the edit, and persists
// ONLY the delta: INSERT new rows, UPDATE changed rows (preserves `checked`),
// DELETE rows the edit emptied. This is deliberately NOT the plan generator's
// delete-and-replace — an edit must never clobber a checked-off row or a
// household-mate's manual addition.
import type { ShoppingItem } from "../../types/recipe";
import {
  applyPlanEditToShoppingList,
  type PlanShoppingEdit,
  type PlanShoppingSyncResult,
} from "./syncPlanEditToShoppingList";
import {
  shoppingScopeInsertStamp,
  shoppingScopeReadFilters,
  type ShoppingScope,
} from "../household/shoppingScope";

/**
 * Minimal structural shape of a Supabase client the sync needs. Kept
 * dependency-light so both the web typed client and the mobile client satisfy it
 * without a hard import. Adds `delete` on top of the append client's shape.
 */
type ShoppingClient = {
  from: (table: string) => {
    select: (cols: string) => ChainableRead;
    insert: (rows: ShoppingInsertRow[]) => Promise<{ error: { message?: string } | null }>;
    update: (
      patch: { amount?: string; source?: string },
    ) => { eq: (col: string, val: string) => Promise<{ error: { message?: string } | null }> };
    delete: () => { in: (col: string, vals: string[]) => Promise<{ error: { message?: string } | null }> };
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

export type SyncPlanEditClientResult =
  | ({ ok: true } & PlanShoppingSyncResult)
  | { ok: false; error: string };

/**
 * Read the current list for the scope, apply the plan edit (add / remove / swap)
 * in memory, and persist ONLY the delta:
 *  - existing rows whose quantity/source changed → UPDATE (preserves `checked`),
 *  - brand-new rows → INSERT,
 *  - rows the edit emptied (present before, gone after) → DELETE by id.
 *
 * Reading the live list first keeps two devices + household members consistent
 * and never clobbers checked rows or a mate's manual additions — the plan
 * generator's full delete-and-replace would. Returns the merged list + counts so
 * the host can update local state without a refetch.
 */
export async function syncPlanEditToShoppingListClient(input: {
  client: ShoppingClient;
  scope: ShoppingScope;
  edit: PlanShoppingEdit;
}): Promise<SyncPlanEditClientResult> {
  const { client, scope, edit } = input;

  // 1. Read the current list for this scope (canonical solo/household filters).
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

  // 2. Apply the edit in memory. New rows get a temp id; inserts omit `id`.
  const result = applyPlanEditToShoppingList({
    existing,
    edit,
    makeId: (key) => `new:${key}`,
  });
  const resultById = new Map(result.items.map((it) => [it.id, it]));

  // 3. Diff → inserts / updates / deletes.
  const stamp = shoppingScopeInsertStamp(scope);
  const inserts: ShoppingInsertRow[] = [];
  const updates: Array<{ id: string; amount: string; source: string }> = [];
  const deletes: string[] = [];

  for (const item of result.items) {
    const prior = existingById.get(item.id);
    if (!prior) {
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
  // Rows that existed before but are absent from the result → the edit removed them.
  for (const prior of existing) {
    if (!resultById.has(prior.id)) deletes.push(prior.id);
  }

  // 4. Persist. Deletes first so a swap that empties then re-adds the same key
  //    never leaves a stale row (temp-id inserts use a distinct `new:` id space).
  if (deletes.length > 0) {
    for (let i = 0; i < deletes.length; i += 50) {
      const { error } = await client
        .from("shopping_items")
        .delete()
        .in("id", deletes.slice(i, i + 50));
      if (error) return { ok: false, error: error.message ?? "delete failed" };
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
