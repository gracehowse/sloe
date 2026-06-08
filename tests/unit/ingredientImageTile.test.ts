/**
 * Sloe image system — ingredient tile spec + graceful image hydration
 * (2026-06-08). Keyed by `canonicalImageKey` (NOT `normalizeIngredientNameKey`)
 * as of the 2026-06-08 re-key — the tile + the hydration + the backfill all
 * key the same way (write-key == read-key; see `canonicalImageKey.test.ts`).
 *
 *   - `getIngredientTilePlaceholder` — deterministic calm cream tile
 *   - `resolveIngredientTileImage` — image map lookup by canonical key
 *   - `fetchIngredientImageMap` / `fetchIngredientImages` — degrade to an
 *     empty map (+ no missing keys) when the table is missing / errors
 *   - `canonicalKeysForNames` — distinct canonical keys for a name set
 */
import { describe, expect, it } from "vitest";
import {
  getIngredientTilePlaceholder,
  resolveIngredientTileImage,
} from "../../src/lib/recipe/ingredientImageTile";
import {
  fetchIngredientImageMap,
  fetchIngredientImages,
  canonicalKeysForNames,
} from "../../src/lib/recipe/ingredientImages";
import { canonicalImageKey } from "../../src/lib/recipe/canonicalImageKey";

describe("getIngredientTilePlaceholder — calm cream, deterministic", () => {
  it("uses the FOOD's first letter (brand prefix stripped by the canonical key)", () => {
    expect(getIngredientTilePlaceholder("garlic").initial).toBe("G");
    // Canonical key strips the brand prefix, so the placeholder is keyed on
    // the real food — "Essential Waitrose · Garlic" → "garlic" → "G" (the old
    // key gave the brand's "E"; the food initial is the correct behaviour).
    expect(getIngredientTilePlaceholder("Essential Waitrose · Garlic").initial).toBe("G");
  });

  it("renders the sage mark colour (§11.4)", () => {
    expect(getIngredientTilePlaceholder("onion").fg).toBe("#7C8466");
  });

  it("always picks a cream-family background", () => {
    const tints = new Set(["#F1EFE8", "#ECEAE1"]);
    for (const name of ["garlic", "onion", "salmon", "rice", "butter"]) {
      expect(tints.has(getIngredientTilePlaceholder(name).bg)).toBe(true);
    }
  });

  it("is deterministic per ingredient", () => {
    expect(getIngredientTilePlaceholder("garlic")).toEqual(getIngredientTilePlaceholder("garlic"));
  });

  it("falls back to a dot for a letterless name", () => {
    expect(getIngredientTilePlaceholder("12345").initial).toBe("·");
    expect(getIngredientTilePlaceholder("").initial).toBe("·");
    expect(getIngredientTilePlaceholder(null).initial).toBe("·");
  });
});

describe("resolveIngredientTileImage — name_key lookup", () => {
  it("returns the mapped URL when the key is present", () => {
    const key = canonicalImageKey("Essential Waitrose · Garlic");
    const map = new Map([[key, "https://cdn/garlic.png"]]);
    expect(resolveIngredientTileImage("Essential Waitrose · Garlic", map)).toBe(
      "https://cdn/garlic.png",
    );
  });

  it("returns null when the key is absent", () => {
    const map = new Map([["onion", "https://cdn/onion.png"]]);
    expect(resolveIngredientTileImage("garlic", map)).toBeNull();
  });

  it("returns null for an empty / missing map (placeholder shows)", () => {
    expect(resolveIngredientTileImage("garlic", null)).toBeNull();
    expect(resolveIngredientTileImage("garlic", new Map())).toBeNull();
  });
});

describe("fetchIngredientImageMap — graceful degradation", () => {
  it("returns an empty map for no names without touching the client", async () => {
    let called = false;
    const fakeClient = {
      from() {
        called = true;
        throw new Error("should not be called");
      },
    };
    const map = await fetchIngredientImageMap(fakeClient, []);
    expect(map.size).toBe(0);
    expect(called).toBe(false);
  });

  it("returns an empty map when the table is missing (Postgrest error)", async () => {
    const fakeClient = {
      from() {
        return {
          select() {
            return {
              in() {
                return Promise.resolve({
                  data: null,
                  error: { code: "42P01", message: 'relation "ingredient_images" does not exist' },
                });
              },
            };
          },
        };
      },
    };
    const map = await fetchIngredientImageMap(fakeClient, ["garlic", "onion"]);
    expect(map.size).toBe(0);
  });

  it("never throws when the client itself throws", async () => {
    const fakeClient = {
      from() {
        return {
          select() {
            return {
              in() {
                return Promise.reject(new Error("network down"));
              },
            };
          },
        };
      },
    };
    await expect(fetchIngredientImageMap(fakeClient, ["garlic"])).resolves.toBeInstanceOf(Map);
  });

  it("only surfaces ready rows with a real URL", async () => {
    const garlicKey = canonicalImageKey("garlic");
    const onionKey = canonicalImageKey("onion");
    const butterKey = canonicalImageKey("butter");
    const fakeClient = {
      from() {
        return {
          select() {
            return {
              in() {
                return Promise.resolve({
                  data: [
                    { name_key: garlicKey, image_url: "https://cdn/garlic.png", status: "ready" },
                    { name_key: onionKey, image_url: null, status: "pending" },
                    { name_key: butterKey, image_url: "https://cdn/butter.png", status: "failed" },
                  ],
                  error: null,
                });
              },
            };
          },
        };
      },
    };
    const map = await fetchIngredientImageMap(fakeClient, ["garlic", "onion", "butter"]);
    expect(map.get(garlicKey)).toBe("https://cdn/garlic.png");
    // pending (no url) + failed (not ready) are excluded → placeholder shows.
    expect(map.has(onionKey)).toBe(false);
    expect(map.has(butterKey)).toBe(false);
  });

  it("dedupes + normalises names before the lookup", async () => {
    let receivedKeys: string[] = [];
    const fakeClient = {
      from() {
        return {
          select() {
            return {
              in(_col: string, values: string[]) {
                receivedKeys = values;
                return Promise.resolve({ data: [], error: null });
              },
            };
          },
        };
      },
    };
    // "Garlic" and "garlic, minced" both canonicalise to the same key.
    await fetchIngredientImageMap(fakeClient, ["Garlic", "garlic, minced", "onion"]);
    expect(receivedKeys).toContain(canonicalImageKey("garlic"));
    expect(receivedKeys).toContain(canonicalImageKey("onion"));
    // Deduped — no duplicate garlic key.
    expect(new Set(receivedKeys).size).toBe(receivedKeys.length);
  });
});

describe("canonicalKeysForNames — distinct canonical keys", () => {
  it("dedupes quantity/brand variants into one key per food", () => {
    const keys = canonicalKeysForNames([
      "120g spinach",
      "120 grams spinach",
      "1 large red onion",
      "1 medium Red onion",
    ]);
    expect(keys).toContain("spinach");
    expect(keys).toContain("red onion");
    // 4 raw names → 2 distinct keys.
    expect(keys.length).toBe(2);
  });

  it("drops empty / letterless names", () => {
    expect(canonicalKeysForNames(["", "   ", null, undefined])).toEqual([]);
  });
});

describe("fetchIngredientImages — map + missingKeys for lazy generate-on-miss", () => {
  function clientReturning(
    rows: Array<{ name_key: string; image_url: string | null; status: string }>,
  ) {
    return {
      from() {
        return {
          select() {
            return {
              in() {
                return Promise.resolve({ data: rows, error: null });
              },
            };
          },
        };
      },
    };
  }

  it("reports keys with no ready image as missing (so they get enqueued)", async () => {
    const spinach = canonicalImageKey("spinach");
    const onion = canonicalImageKey("red onion");
    const salt = canonicalImageKey("salt");
    const client = clientReturning([
      { name_key: spinach, image_url: "https://cdn/spinach.jpg", status: "ready" },
      { name_key: onion, image_url: null, status: "pending" },
      // salt has no row at all
    ]);
    const { map, missingKeys } = await fetchIngredientImages(client, [
      "120g spinach",
      "1 large red onion",
      "fine salt",
    ]);
    // ready → in the map
    expect(map.get(spinach)).toBe("https://cdn/spinach.jpg");
    // pending (onion) + absent (salt) → missing
    expect(missingKeys).toContain(onion);
    expect(missingKeys).toContain(salt);
    expect(missingKeys).not.toContain(spinach);
  });

  it("returns NO missing keys on a table/RLS error (never enqueue blind)", async () => {
    const client = {
      from() {
        return {
          select() {
            return {
              in() {
                return Promise.resolve({
                  data: null,
                  error: { code: "42P01", message: "missing" },
                });
              },
            };
          },
        };
      },
    };
    const { map, missingKeys } = await fetchIngredientImages(client, ["spinach", "onion"]);
    expect(map.size).toBe(0);
    expect(missingKeys).toEqual([]);
  });

  it("returns NO missing keys when the client throws", async () => {
    const client = {
      from() {
        return {
          select() {
            return {
              in() {
                return Promise.reject(new Error("down"));
              },
            };
          },
        };
      },
    };
    const { map, missingKeys } = await fetchIngredientImages(client, ["spinach"]);
    expect(map.size).toBe(0);
    expect(missingKeys).toEqual([]);
  });

  it("no missing keys for an empty name set", async () => {
    const { map, missingKeys } = await fetchIngredientImages({ from() { throw new Error("x"); } }, []);
    expect(map.size).toBe(0);
    expect(missingKeys).toEqual([]);
  });
});
