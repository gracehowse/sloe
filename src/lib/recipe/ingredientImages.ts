/**
 * `ingredient_images` hydration helper — fetch the on-brand tile image
 * for a set of ingredient names, keyed by `normalizeIngredientNameKey`.
 *
 * Part of the Sloe image system (2026-06-08,
 * `docs/decisions/2026-06-08-recipe-ingredient-image-system.md`).
 *
 * The `ingredient_images` table is GLOBAL (public read) and populated
 * off-line by `scripts/backfill-images.ts`. It is EMPTY until that
 * backfill runs (which needs fal.ai funded), so this helper is built to
 * degrade gracefully:
 *   - table missing / RLS / network error → returns an empty map, never
 *     throws. The caller renders the calm placeholder tile.
 *   - a name with no row → simply absent from the map.
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

import { normalizeIngredientNameKey } from "../planning/ingredientNameKey";

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
 *   They are normalised with `normalizeIngredientNameKey` before lookup,
 *   so pass the raw names — the helper keys them the same way the table
 *   was populated.
 * @returns a Map keyed by the NORMALISED name_key. Callers look up with
 *   `map.get(normalizeIngredientNameKey(name))`. Empty when the table is
 *   absent/empty or anything fails.
 */
export async function fetchIngredientImageMap(
  supabase: unknown,
  names: ReadonlyArray<string | null | undefined>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();

  // Distinct, non-empty keys only — avoids an `in (...)` with dupes or
  // empty strings.
  const keys = Array.from(
    new Set(
      names
        .map((n) => (typeof n === "string" ? normalizeIngredientNameKey(n) : ""))
        .filter((k) => k.length > 0),
    ),
  );
  if (keys.length === 0) return out;

  try {
    const client = supabase as LooseSupabase;
    const { data, error } = await client
      .from("ingredient_images")
      .select("name_key, image_url, status")
      .in("name_key", keys);

    // Table missing (42P01) / RLS / any Postgrest error → empty map. The
    // UI falls back to the calm placeholder. We swallow deliberately: a
    // missing image is never worth a thrown error on the recipe screen.
    if (error || !Array.isArray(data)) return out;

    for (const row of data) {
      const key = typeof row?.name_key === "string" ? row.name_key : "";
      const url = typeof row?.image_url === "string" ? row.image_url.trim() : "";
      const status = typeof row?.status === "string" ? row.status : "ready";
      // Only surface a real, ready image. `pending` / `failed` rows have
      // no usable URL — treat them as "no image" so the placeholder shows.
      if (key && url && status === "ready") {
        out.set(key, url);
      }
    }
  } catch {
    // Network throw / unexpected shape — return whatever we have (likely
    // empty). Never let the ingredient grid crash over a decorative tile.
    return out;
  }

  return out;
}
