/**
 * `ingredient_images` hydration helper — fetch the on-brand tile image
 * for a set of ingredient names, keyed by `canonicalImageKey`.
 *
 * Part of the Sloe image system (2026-06-08,
 * `docs/decisions/2026-06-08-recipe-ingredient-image-system.md`).
 *
 * The `ingredient_images` table is GLOBAL (public read) and populated by
 * `scripts/backfill-images.ts` (pre-seed) and the lazy generate-on-miss
 * endpoint (`/api/ingredient-image`). This helper degrades gracefully:
 *   - table missing / RLS / network error → returns an empty map, never
 *     throws. The caller renders the calm placeholder tile.
 *   - a name with no `ready` row → absent from the map, AND reported in
 *     `missingKeys` (via `fetchIngredientImages`) so the display layer can
 *     enqueue lazy generation for it (spec §4).
 *
 * Key: `canonicalImageKey` — the SAME key the backfill writer uses, so
 * write-key == read-key. Do NOT swap back to `normalizeIngredientNameKey`
 * (that was the drift bug + the quantity-pollution dup-tile bug).
 *
 * Typing note: the table is not yet in the generated
 * `database.types.ts` (the migration is staged, not applied). We query
 * through a deliberately-loosened client cast so this compiles today and
 * keeps working unchanged once `npm run db:types` picks the table up.
 * This is the ONE place the loose cast lives — callers get a clean typed
 * `Map<string, string>`.
 *
 * Pure-ish: one network read, no caching by ref. Safe to call from a
 * load effect. NOT safe to call in render (it's async).
 */

import { canonicalImageKey } from "./canonicalImageKey";

/** Minimal shape of the Supabase client method-chain we use. Loosened
 *  on purpose — see the typing note above. */
type LooseSupabase = {
  from: (table: string) => {
    select: (cols: string) => {
      in: (
        col: string,
        values: string[],
      ) => Promise<{
        data: Array<{ name_key?: string | null; image_url?: string | null; status?: string | null }> | null;
        error: unknown;
      }>;
    };
  };
};

/**
 * Build a `name_key → image_url` map for the given ingredient names.
 *
 * @param supabase a Supabase client (browser or RN); typed loosely so
 *   both platforms' clients satisfy it without the generated table type.
 * @param names    raw ingredient names (the stored `recipe_ingredients.name`).
 *   They are keyed with `canonicalImageKey` before lookup, so pass the raw
 *   names — the helper keys them the SAME way the backfill writer populated
 *   the table (write-key == read-key).
 * @returns a Map keyed by the CANONICAL name_key. Callers look up with
 *   `map.get(canonicalImageKey(name))` (which is what `resolveIngredientTileImage`
 *   does). Empty when the table is absent/empty or anything fails.
 */
export async function fetchIngredientImageMap(
  supabase: unknown,
  names: ReadonlyArray<string | null | undefined>,
): Promise<Map<string, string>> {
  const { map } = await fetchIngredientImages(supabase, names);
  return map;
}

/** Distinct, non-empty canonical keys for a set of raw ingredient names. */
export function canonicalKeysForNames(
  names: ReadonlyArray<string | null | undefined>,
): string[] {
  return Array.from(
    new Set(
      names
        .map((n) => (typeof n === "string" ? canonicalImageKey(n) : ""))
        .filter((k) => k.length > 0),
    ),
  );
}

/**
 * Richer variant: returns the `name_key → image_url` map for ready images
 * AND the set of canonical keys that have NO ready image yet (so the display
 * layer can enqueue lazy generation for exactly those — spec §4). A key is
 * "missing" when there is no row, or the row is `pending`/`failed`. Degrades
 * to `{ map: empty, missingKeys: [] }` on any error — when we can't read the
 * table we do NOT enqueue (avoids hammering generation while the DB is down).
 */
export async function fetchIngredientImages(
  supabase: unknown,
  names: ReadonlyArray<string | null | undefined>,
): Promise<{ map: Map<string, string>; missingKeys: string[] }> {
  const out = new Map<string, string>();
  const keys = canonicalKeysForNames(names);
  if (keys.length === 0) return { map: out, missingKeys: [] };

  try {
    const client = supabase as LooseSupabase;
    const { data, error } = await client
      .from("ingredient_images")
      .select("name_key, image_url, status")
      .in("name_key", keys);

    // Table missing (42P01) / RLS / any Postgrest error → empty map + NO
    // missing keys (don't enqueue while we can't read state). The UI falls
    // back to the calm placeholder. We swallow deliberately: a missing image
    // is never worth a thrown error on the recipe screen.
    if (error || !Array.isArray(data)) return { map: out, missingKeys: [] };

    const readyKeys = new Set<string>();
    for (const row of data) {
      const key = typeof row?.name_key === "string" ? row.name_key : "";
      const url = typeof row?.image_url === "string" ? row.image_url.trim() : "";
      const status = typeof row?.status === "string" ? row.status : "ready";
      // Only surface a real, ready image. `pending` / `failed` rows have
      // no usable URL — treat them as "no image" so the placeholder shows.
      if (key && url && status === "ready") {
        out.set(key, url);
        readyKeys.add(key);
      }
    }
    const missingKeys = keys.filter((k) => !readyKeys.has(k));
    return { map: out, missingKeys };
  } catch {
    // Network throw / unexpected shape — return whatever we have (likely
    // empty) + no missing keys. Never let the ingredient grid crash over a
    // decorative tile, and never enqueue on an error path.
    return { map: out, missingKeys: [] };
  }
}
