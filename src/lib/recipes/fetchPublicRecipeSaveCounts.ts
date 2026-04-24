import type { SupabaseClient } from "@supabase/supabase-js";

/** Max recipe IDs per `public_recipe_save_counts_batch` call (single RPC round-trip per chunk). */
const BATCH_RPC_CHUNK = 500;

type BatchRow = { recipe_id: string; save_count: number | string | null };

/**
 * Fetches global save counts for published discover cards via
 * `public_recipe_save_counts_batch` (SECURITY DEFINER — not subject to per-user saves RLS).
 * Used so Discover “Popular” (≥ min saves) matches web + mobile.
 */
export async function fetchPublicRecipeSaveCounts(
  supabase: Pick<SupabaseClient, "rpc">,
  recipeIds: readonly string[],
): Promise<Map<string, number>> {
  const ids = [...new Set(recipeIds.filter((id): id is string => typeof id === "string" && id.length > 0))];
  const out = new Map<string, number>();
  for (const id of ids) out.set(id, 0);

  for (let i = 0; i < ids.length; i += BATCH_RPC_CHUNK) {
    const chunk = ids.slice(i, i + BATCH_RPC_CHUNK);
    const { data, error } = await supabase.rpc("public_recipe_save_counts_batch", {
      p_recipe_ids: chunk,
    });
    if (error) {
      console.warn("[fetchPublicRecipeSaveCounts]", error.message);
      continue;
    }
    if (!Array.isArray(data)) continue;
    for (const row of data as BatchRow[]) {
      const id = row.recipe_id;
      if (typeof id !== "string" || id.length === 0) continue;
      const n = Math.max(0, Math.floor(Number(row.save_count ?? 0)));
      out.set(id, n);
    }
  }
  return out;
}

/** Discover “Popular” pill — same threshold on web and mobile (`discover.tsx` / `DiscoverFeed.tsx`). */
export const DISCOVER_POPULAR_MIN_SAVES = 50;
