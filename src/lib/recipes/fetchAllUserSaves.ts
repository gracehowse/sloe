import type { SupabaseClient } from "@supabase/supabase-js";

export type SaveRow = { recipe_id: string; created_at: string };

/**
 * ENG-1413 — page a user's full `saves` set to exhaustion instead of one
 * unbounded fetch. Supabase's default `max_rows` (1000) means an unbounded
 * fetch already silently truncates any user past 1,000 saves; `isRecipeSaved`
 * membership checks need the complete set (arbitrary recipe cards can
 * reference any saved id, not just the most recent page), so bounding the
 * fetch itself would trade a scaling smell for a correctness bug. Cursor is
 * `recipe_id` (unique per user via the `saves` primary key) rather than
 * `created_at` (not unique alone) — callers that care about save order
 * should sort the returned rows by `created_at` themselves once all pages
 * have landed.
 */
export async function fetchAllUserSaves(
  supabase: Pick<SupabaseClient, "from">,
  userId: string,
  pageSize = 1000,
): Promise<{ rows: SaveRow[]; error: { message?: string } | null }> {
  const rows: SaveRow[] = [];
  let cursor: string | null = null;
  for (;;) {
    let query = supabase
      .from("saves")
      .select("recipe_id, created_at")
      .eq("user_id", userId)
      .order("recipe_id", { ascending: true })
      .limit(pageSize);
    if (cursor) query = query.gt("recipe_id", cursor);
    const { data: page, error } = await query;
    if (error) return { rows, error };
    if (!page || page.length === 0) break;
    rows.push(...(page as SaveRow[]));
    if (page.length < pageSize) break;
    cursor = page[page.length - 1].recipe_id as string;
  }
  return { rows, error: null };
}
