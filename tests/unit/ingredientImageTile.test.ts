/**
 * Sloe image system — ingredient tile spec + graceful image hydration
 * (2026-06-08).
 *
 *   - `getIngredientTilePlaceholder` — deterministic calm cream tile
 *   - `resolveIngredientTileImage` — image map lookup by name_key
 *   - `fetchIngredientImageMap` — degrades to an empty map when the
 *     `ingredient_images` table is missing / errors (it is empty until
 *     the fal-funded backfill runs)
 */
import { describe, expect, it } from "vitest";
import {
  getIngredientTilePlaceholder,
  resolveIngredientTileImage,
} from "../../src/lib/recipe/ingredientImageTile";
import { fetchIngredientImageMap } from "../../src/lib/recipe/ingredientImages";
import { normalizeIngredientNameKey } from "../../src/lib/planning/ingredientNameKey";

describe("getIngredientTilePlaceholder — calm cream, deterministic", () => {
  it("uses the ingredient's first letter, uppercased", () => {
    expect(getIngredientTilePlaceholder("garlic").initial).toBe("G");
    expect(getIngredientTilePlaceholder("Essential Waitrose · Garlic").initial).toBe("E");
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
    const key = normalizeIngredientNameKey("Essential Waitrose · Garlic");
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
    const garlicKey = normalizeIngredientNameKey("garlic");
    const onionKey = normalizeIngredientNameKey("onion");
    const butterKey = normalizeIngredientNameKey("butter");
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
    // "Garlic" and "garlic, minced" both normalise to the same key.
    await fetchIngredientImageMap(fakeClient, ["Garlic", "garlic, minced", "onion"]);
    expect(receivedKeys).toContain(normalizeIngredientNameKey("garlic"));
    expect(receivedKeys).toContain(normalizeIngredientNameKey("onion"));
    // Deduped — no duplicate garlic key.
    expect(new Set(receivedKeys).size).toBe(receivedKeys.length);
  });
});
