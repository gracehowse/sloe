/**
 * ENG-1276 — `fetchIngredientImages` alias fallback.
 *
 * The `ingredient_images` text key (`canonicalImageKey`) stays the PRIMARY
 * path. When a name's text key MISSES the images map AND the ingredient
 * carries a trusted `matched_alias_key`, the helper consults
 * `ingredient_image_aliases` to find the `name_key` that food resolved to and
 * surfaces THAT tile under the missed ingredient's own canonical key — so
 * `resolveIngredientTileImage(name, map)` finds it unchanged. A missing alias
 * table / row / tile must change nothing (additive, null-safe).
 */
import { describe, it, expect, vi } from "vitest";
import {
  fetchIngredientImages,
  fetchIngredientImageMap,
} from "../../src/lib/recipe/ingredientImages";
import { canonicalImageKey } from "../../src/lib/recipe/canonicalImageKey";
import { resolveIngredientTileImage } from "../../src/lib/recipe/ingredientImageTile";

/** Rows keyed per table so a single mock serves both the images + alias
 *  lookups. `in(col, values)` filters the table's rows by the queried set. */
type ImageRow = { name_key: string; image_url: string | null; status: string };
type AliasRow = { alias_key: string; name_key: string };

function makeSupabase(opts: {
  images?: ImageRow[];
  imagesError?: unknown;
  aliases?: AliasRow[];
  aliasesError?: unknown;
  aliasTableMissing?: boolean;
}) {
  const imageCalls: string[][] = [];
  const aliasCalls: string[][] = [];
  const from = vi.fn((table: string) => ({
    select: (_cols: string) => ({
      in: (_col: string, values: string[]) => {
        if (table === "ingredient_images") {
          imageCalls.push(values);
          if (opts.imagesError) return Promise.resolve({ data: null, error: opts.imagesError });
          const rows = (opts.images ?? []).filter((r) => values.includes(r.name_key));
          return Promise.resolve({ data: rows, error: null });
        }
        if (table === "ingredient_image_aliases") {
          aliasCalls.push(values);
          if (opts.aliasTableMissing) {
            return Promise.resolve({ data: null, error: { code: "42P01", message: "relation does not exist" } });
          }
          if (opts.aliasesError) return Promise.resolve({ data: null, error: opts.aliasesError });
          const rows = (opts.aliases ?? []).filter((r) => values.includes(r.alias_key));
          return Promise.resolve({ data: rows, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      },
    }),
  }));
  return { client: { from }, imageCalls, aliasCalls };
}

describe("fetchIngredientImages — ENG-1276 alias fallback", () => {
  it("resolves a text-key MISS via the alias table to the matched food's tile", async () => {
    // "baby spinach" and the tile-owning "spinach leaves" derive DIFFERENT
    // canonical keys, but both matched FatSecret food 4001. Only the
    // "spinach" tile has an image.
    const missName = "120g baby spinach, washed";
    const missKey = canonicalImageKey(missName);
    const tileKey = "spinach leaf"; // the name_key the aliased food resolves to
    const aliasKey = "fatsecret:4001";

    const { client, aliasCalls } = makeSupabase({
      images: [{ name_key: tileKey, image_url: "https://cdn/spinach.webp", status: "ready" }],
      aliases: [{ alias_key: aliasKey, name_key: tileKey }],
    });

    const { map, missingKeys } = await fetchIngredientImages(client, [missName], {
      aliasKeyByCanonicalKey: new Map([[missKey, aliasKey]]),
    });

    // The missed ingredient now resolves — via its OWN canonical key.
    expect(resolveIngredientTileImage(missName, map)).toBe("https://cdn/spinach.webp");
    expect(map.get(missKey)).toBe("https://cdn/spinach.webp");
    // The alias table was consulted for exactly the missed key's alias.
    expect(aliasCalls).toEqual([[aliasKey]]);
    // Once aliased, the key is no longer "missing" (so we don't regenerate it).
    expect(missingKeys).not.toContain(missKey);
  });

  it("leaves behaviour unchanged when NO alias key is provided (text-only path)", async () => {
    const missName = "baby spinach";
    const missKey = canonicalImageKey(missName);
    const { client, aliasCalls } = makeSupabase({
      images: [], // no direct tile
      aliases: [{ alias_key: "fatsecret:4001", name_key: "spinach leaf" }],
    });

    // No aliasKeyByCanonicalKey → the alias table is never touched.
    const { map, missingKeys } = await fetchIngredientImages(client, [missName]);
    expect(map.size).toBe(0);
    expect(missingKeys).toContain(missKey);
    expect(aliasCalls).toEqual([]);
  });

  it("does not consult the alias table when the text key already HIT", async () => {
    const name = "spinach";
    const key = canonicalImageKey(name);
    const { client, aliasCalls } = makeSupabase({
      images: [{ name_key: key, image_url: "https://cdn/direct.webp", status: "ready" }],
      aliases: [{ alias_key: "fatsecret:4001", name_key: "other" }],
    });
    const { map, missingKeys } = await fetchIngredientImages(client, [name], {
      aliasKeyByCanonicalKey: new Map([[key, "fatsecret:4001"]]),
    });
    // Direct hit wins; alias never consulted (no miss to resolve).
    expect(map.get(key)).toBe("https://cdn/direct.webp");
    expect(missingKeys).toEqual([]);
    expect(aliasCalls).toEqual([]);
  });

  it("changes nothing when the alias table has no matching row", async () => {
    const missName = "baby spinach";
    const missKey = canonicalImageKey(missName);
    const { client } = makeSupabase({
      images: [],
      aliases: [], // alias key present on the ingredient, but no row for it
    });
    const { map, missingKeys } = await fetchIngredientImages(client, [missName], {
      aliasKeyByCanonicalKey: new Map([[missKey, "fatsecret:9999"]]),
    });
    expect(map.size).toBe(0);
    expect(missingKeys).toContain(missKey);
  });

  it("changes nothing when the alias resolves but its tile is not ready", async () => {
    const missName = "baby spinach";
    const missKey = canonicalImageKey(missName);
    const aliasKey = "fatsecret:4001";
    const tileKey = "spinach leaf";
    const { client } = makeSupabase({
      // the resolved tile exists but is still pending (no usable url)
      images: [{ name_key: tileKey, image_url: null, status: "pending" }],
      aliases: [{ alias_key: aliasKey, name_key: tileKey }],
    });
    const { map, missingKeys } = await fetchIngredientImages(client, [missName], {
      aliasKeyByCanonicalKey: new Map([[missKey, aliasKey]]),
    });
    expect(map.has(missKey)).toBe(false);
    expect(missingKeys).toContain(missKey);
  });

  it("degrades to the primary result when the alias table is missing (not migrated)", async () => {
    const missName = "baby spinach";
    const missKey = canonicalImageKey(missName);
    const { client } = makeSupabase({
      images: [],
      aliasTableMissing: true,
    });
    const { map, missingKeys } = await fetchIngredientImages(client, [missName], {
      aliasKeyByCanonicalKey: new Map([[missKey, "fatsecret:4001"]]),
    });
    // No throw; the primary (empty) result stands, key still missing.
    expect(map.size).toBe(0);
    expect(missingKeys).toContain(missKey);
  });

  it("returns an empty map (no alias attempt) when the images table itself errors", async () => {
    const missName = "baby spinach";
    const missKey = canonicalImageKey(missName);
    const { client, aliasCalls } = makeSupabase({
      imagesError: { code: "42P01", message: "relation does not exist" },
      aliases: [{ alias_key: "fatsecret:4001", name_key: "spinach leaf" }],
    });
    const { map, missingKeys } = await fetchIngredientImages(client, [missName], {
      aliasKeyByCanonicalKey: new Map([[missKey, "fatsecret:4001"]]),
    });
    // Images error → empty map + no missing keys + never touches the alias table.
    expect(map.size).toBe(0);
    expect(missingKeys).toEqual([]);
    expect(aliasCalls).toEqual([]);
  });

  it("fetchIngredientImageMap forwards the alias options", async () => {
    const missName = "baby spinach";
    const missKey = canonicalImageKey(missName);
    const aliasKey = "fatsecret:4001";
    const tileKey = "spinach leaf";
    const { client } = makeSupabase({
      images: [{ name_key: tileKey, image_url: "https://cdn/spinach.webp", status: "ready" }],
      aliases: [{ alias_key: aliasKey, name_key: tileKey }],
    });
    const map = await fetchIngredientImageMap(client, [missName], {
      aliasKeyByCanonicalKey: new Map([[missKey, aliasKey]]),
    });
    expect(map.get(missKey)).toBe("https://cdn/spinach.webp");
  });
});
