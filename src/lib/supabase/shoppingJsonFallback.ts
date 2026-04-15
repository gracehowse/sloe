import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * JSON blob shopping tables. After migration `20260413100000_relational_user_data.sql`,
 * `shopping_lists` is renamed to `shopping_lists_legacy`; new data lives in `shopping_items`.
 */
export const SHOPPING_LIST_JSON_TABLES = ["shopping_lists", "shopping_lists_legacy"] as const;

function missingShoppingJsonTableMessage(msg: string): boolean {
  const m = (msg ?? "").toLowerCase();
  return (
    m.includes("could not find the table") ||
    m.includes("schema cache") ||
    m.includes("does not exist")
  );
}

/** True if at least one JSON shopping table exists (pre–Phase 1 or renamed legacy). */
export async function probeAnyShoppingListJsonTable(client: SupabaseClient): Promise<boolean> {
  for (const table of SHOPPING_LIST_JSON_TABLES) {
    const { error } = await client.from(table).select("user_id").limit(1);
    if (!error) return true;
    if (!missingShoppingJsonTableMessage(error.message ?? "")) return false;
  }
  return false;
}

export async function fetchShoppingListJsonItems(
  client: SupabaseClient,
  userId: string,
): Promise<{ items: unknown[] | null }> {
  for (const table of SHOPPING_LIST_JSON_TABLES) {
    const { data, error } = await client.from(table).select("items").eq("user_id", userId).maybeSingle();
    if (error) {
      if (missingShoppingJsonTableMessage(error.message ?? "")) continue;
      return { items: null };
    }
    if (data?.items && Array.isArray(data.items)) {
      return { items: data.items as unknown[] };
    }
  }
  return { items: null };
}

export async function upsertShoppingListJsonItems(
  client: SupabaseClient,
  userId: string,
  items: unknown[],
): Promise<{ error: { message: string } | null }> {
  const row = { user_id: userId, items, updated_at: new Date().toISOString() };
  for (const table of SHOPPING_LIST_JSON_TABLES) {
    const { error } = await client.from(table).upsert(row, { onConflict: "user_id" });
    if (!error) return { error: null };
    if (missingShoppingJsonTableMessage(error.message ?? "")) continue;
    return { error };
  }
  return { error: { message: "No shopping_lists JSON table in schema" } };
}
