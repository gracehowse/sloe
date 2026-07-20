import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchMaterialisedSeedMap,
  isUuid,
  materialiseSeedRecipe,
  materialiseSeedRecipeById,
} from "../../src/lib/recipes/materialiseSeedRecipe";
import { SEED_RECIPES_V2, type SeedRecipe } from "../../src/lib/recipes/seedRecipesV2";

/**
 * ENG-1467 — copy-on-save for Discover seed recipes.
 *
 * The seed catalogue (`seedRecipesV2.ts`) uses slug ids
 * (`seed-v2-{cluster}-{slug}`), never written to the `recipes` table.
 * Every save path writes to `saves.recipe_id`, a `uuid` FK — saving a
 * seed directly threw `invalid input syntax for type uuid`. This tests
 * the shared copy-on-save core: `isUuid` detection, materialising a
 * seed into a real `recipes` row, per-user idempotency (no duplicate
 * rows on a second save of the same seed), and error surfacing (never
 * console-only — every failure returns a `{ ok: false, error }` with
 * user-facing copy).
 */

const userId = "11111111-1111-4111-8111-111111111111";
const seed: SeedRecipe = SEED_RECIPES_V2[0]!;

type SelectResult = { data: unknown; error?: { code?: string; message: string } | null };

function buildSupabaseMock(opts: {
  selectResults: SelectResult[];
  insertError?: { code?: string; message: string } | null;
  ingredientsInsertError?: { code?: string; message: string } | null;
  bulkSelectRows?: Array<{ id: string; title: string }>;
}) {
  const selectQueue = [...opts.selectResults];
  const recipesInsert = vi.fn().mockImplementation(() => ({
    select: () => ({
      single: () =>
        Promise.resolve(
          opts.insertError
            ? { data: null, error: opts.insertError }
            : { data: { id: "fresh-recipe-uuid" }, error: null },
        ),
    }),
  }));
  const ingredientsInsert = vi
    .fn()
    .mockResolvedValue({ error: opts.ingredientsInsertError ?? null });
  const recipesDelete = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });

  const supabase = {
    from: (table: string) => {
      if (table === "recipes") {
        return {
          insert: recipesInsert,
          delete: recipesDelete,
          select: (cols: string) => {
            // Bulk map query (fetchMaterialisedSeedMap) selects "id, title"
            // and resolves via `.then(...)`, never `.maybeSingle()`.
            if (cols.includes("id, title") && opts.bulkSelectRows) {
              const chain = {
                eq: () => chain,
                then: (resolve: (v: unknown) => unknown) =>
                  Promise.resolve({ data: opts.bulkSelectRows, error: null }).then(resolve),
              };
              return chain;
            }
            const filters: string[] = [];
            const chain = {
              eq: (col: string, val: string) => {
                filters.push(`${col}=${val}`);
                return chain;
              },
              limit: () => chain,
              maybeSingle: () => Promise.resolve(selectQueue.shift() ?? { data: null }),
            };
            return chain;
          },
        };
      }
      if (table === "recipe_ingredients") return { insert: ingredientsInsert };
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;

  return { supabase, recipesInsert, ingredientsInsert, recipesDelete };
}

describe("isUuid", () => {
  it("accepts real UUIDs", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUuid("AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE")).toBe(true);
  });

  it("rejects seed slug ids and other non-UUID strings", () => {
    expect(isUuid("seed-v2-mediterranean-butter-bean-shakshuka")).toBe(false);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe("SEED_RECIPES_V2 — title uniqueness precondition", () => {
  it("has no duplicate titles (idempotency keys on title)", () => {
    const titles = SEED_RECIPES_V2.map((s) => s.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe("materialiseSeedRecipe — fresh materialisation", () => {
  it("inserts a private, first-party recipe row owned by the saving user", async () => {
    const { supabase, recipesInsert } = buildSupabaseMock({
      selectResults: [{ data: null }],
    });
    const result = await materialiseSeedRecipe(supabase, userId, seed);
    expect(result).toEqual({ ok: true, recipeId: "fresh-recipe-uuid" });
    expect(recipesInsert).toHaveBeenCalledTimes(1);
    const payload = recipesInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.author_id).toBe(userId);
    expect(payload.title).toBe(seed.title);
    expect(payload.published).toBe(false);
    expect(payload.content_origin).toBe("first_party");
    expect(payload.source_name).toBe("Sloe Kitchen");
    expect(payload.sugar_g).toBe(Math.round(seed.sugarG));
    expect(payload.sodium_mg).toBe(Math.round(seed.sodiumMg));
    // RLS (`recipes_insert_own`) requires auth.uid() = author_id — never
    // null, even though the seed catalogue itself has no user owner.
    expect(payload.author_id).toBeTruthy();
  });

  it("inserts ingredient rows (name + grams) for every seed ingredient", async () => {
    const { supabase, ingredientsInsert } = buildSupabaseMock({
      selectResults: [{ data: null }],
    });
    await materialiseSeedRecipe(supabase, userId, seed);
    expect(ingredientsInsert).toHaveBeenCalledTimes(1);
    const rows = ingredientsInsert.mock.calls[0]![0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(seed.ingredients.length);
    expect(rows[0]!.recipe_id).toBe("fresh-recipe-uuid");
    expect(rows[0]!.name).toBe(seed.ingredients[0]!.name);
    expect(rows[0]!.amount).toBe(seed.ingredients[0]!.grams);
    expect(rows[0]!.unit).toBe("g");
  });

  it("is idempotent per user — a second save of the same seed reuses the existing row, no duplicate insert", async () => {
    const { supabase, recipesInsert } = buildSupabaseMock({
      selectResults: [{ data: { id: "already-materialised-uuid" } }],
    });
    const result = await materialiseSeedRecipe(supabase, userId, seed);
    expect(result).toEqual({ ok: true, recipeId: "already-materialised-uuid" });
    expect(recipesInsert).not.toHaveBeenCalled();
  });

  it("surfaces a recipe-insert failure as a user-facing error, never console-only", async () => {
    const { supabase } = buildSupabaseMock({
      selectResults: [{ data: null }],
      insertError: { code: "42501", message: "row-level security" },
    });
    const result = await materialiseSeedRecipe(supabase, userId, seed);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
      expect(result.error).not.toMatch(/42501|row-level security/i);
    }
  });

  it("rolls back the recipe row if the ingredient insert fails, and surfaces an error", async () => {
    const { supabase, recipesDelete } = buildSupabaseMock({
      selectResults: [{ data: null }],
      ingredientsInsertError: { code: "23502", message: "null value in column" },
    });
    const result = await materialiseSeedRecipe(supabase, userId, seed);
    expect(result.ok).toBe(false);
    expect(recipesDelete).toHaveBeenCalledTimes(1);
  });
});

describe("materialiseSeedRecipeById", () => {
  it("resolves a known seed id and materialises it", async () => {
    const { supabase } = buildSupabaseMock({ selectResults: [{ data: null }] });
    const result = await materialiseSeedRecipeById(supabase, userId, seed.id);
    expect(result).toEqual({ ok: true, recipeId: "fresh-recipe-uuid" });
  });

  it("returns a user-facing error for an unknown seed id (defensive — should be unreachable)", async () => {
    const { supabase } = buildSupabaseMock({ selectResults: [] });
    const result = await materialiseSeedRecipeById(supabase, userId, "seed-v2-does-not-exist");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });
});

describe("fetchMaterialisedSeedMap", () => {
  it("maps materialised recipe ids back to their original seed ids by title", async () => {
    const { supabase } = buildSupabaseMock({
      selectResults: [],
      bulkSelectRows: [{ id: "materialised-uuid-1", title: seed.title }],
    });
    const map = await fetchMaterialisedSeedMap(supabase, userId);
    expect(map[seed.id]).toBe("materialised-uuid-1");
  });

  it("returns an empty map on query error (degrade to not-yet-saved, never throw)", async () => {
    // Force a thenable that resolves with an error.
    const errored = {
      from: () => ({
        select: () => {
          const chain: Record<string, unknown> = {};
          chain.eq = () => chain;
          (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve);
          return chain;
        },
      }),
    } as unknown as SupabaseClient;
    const map = await fetchMaterialisedSeedMap(errored, userId);
    expect(map).toEqual({});
  });
});
