/**
 * ENG-1276 security — `recordReadyAliases` must NOT trust client-supplied
 * `(name, aliasKey)` pairs blindly. `ingredient_image_aliases` is a shared,
 * public-read, service-role-write cache, so an authed caller could otherwise
 * bind an arbitrary food id to an unrelated ingredient's tile → wrong photo for
 * everyone (last-writer-wins). The write is corroborated against real persisted
 * matches in `recipe_ingredients`; a pair the matcher never produced is dropped.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/observability/captureRouteError", () => ({ captureRouteError: vi.fn() }));

import { recordReadyAliases } from "@/lib/recipe/recordReadyAliases";
import { canonicalImageKey } from "@/lib/recipe/canonicalImageKey";

type Row = { alias_key: string; name_key: string };

/** Admin double: `recipe_ingredients` select→in returns the corroboration
 *  result; `ingredient_image_aliases` upsert captures whatever gets written. */
function makeAdmin(corroboration: { data: unknown[] | null; error: unknown }) {
  const upserts: Row[][] = [];
  const admin = {
    from(table: string) {
      if (table === "recipe_ingredients") {
        return {
          select: () => ({ in: () => Promise.resolve(corroboration) }),
          upsert: () => {
            throw new Error("must not upsert recipe_ingredients");
          },
        };
      }
      if (table === "ingredient_image_aliases") {
        return {
          select: () => {
            throw new Error("must not select aliases");
          },
          upsert: (rows: Row[]) => {
            upserts.push(rows);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { admin, upserts };
}

describe("recordReadyAliases — poison corroboration (ENG-1276)", () => {
  it("REJECTS a fabricated alias: a food id bound to an unrelated tile isn't recorded", async () => {
    // Attacker POSTs { name: "chicken", aliasKey: "fatsecret:steak" } so steak
    // ingredients would show a chicken photo. No real steak row is named
    // "chicken", so nothing corroborates.
    const chickenKey = canonicalImageKey("chicken");
    const { admin, upserts } = makeAdmin({
      data: [{ name: "ribeye steak", matched_alias_key: "fatsecret:steak" }],
      error: null,
    });
    await recordReadyAliases(admin, [chickenKey], new Map([[chickenKey, "fatsecret:steak"]]));
    expect(upserts).toHaveLength(0);
  });

  it("ACCEPTS a legitimate alias: a real row establishes the same mapping", async () => {
    // "boneless chicken breast" and "chicken breast" both matched
    // fatsecret:chicken (≥0.85) — the alias bridges their differing text keys.
    const bonelessKey = canonicalImageKey("boneless chicken breast");
    const { admin, upserts } = makeAdmin({
      data: [
        { name: "boneless chicken breast", matched_alias_key: "fatsecret:chicken" },
        { name: "chicken breast", matched_alias_key: "fatsecret:chicken" },
      ],
      error: null,
    });
    await recordReadyAliases(admin, [bonelessKey], new Map([[bonelessKey, "fatsecret:chicken"]]));
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toEqual([{ alias_key: "fatsecret:chicken", name_key: bonelessKey }]);
  });

  it("FAILS CLOSED: a corroboration-query error records nothing (e.g. pre-migration DB)", async () => {
    const key = canonicalImageKey("spinach");
    const { admin, upserts } = makeAdmin({
      data: null,
      error: { code: "42703", message: "column matched_alias_key does not exist" },
    });
    await recordReadyAliases(admin, [key], new Map([[key, "fatsecret:100"]]));
    expect(upserts).toHaveLength(0);
  });

  it("is a no-op with no aliases (never queries, never writes)", async () => {
    const { admin, upserts } = makeAdmin({ data: [], error: null });
    await recordReadyAliases(admin, ["anykey"], new Map());
    expect(upserts).toHaveLength(0);
  });
});
