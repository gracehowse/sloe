import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveImportedRecipe } from "../../src/lib/recipes/persistImportedRecipe";

/**
 * ENG-1306 — idempotent re-import.
 *
 * The partial unique index `recipes_import_author_source_url_unique`
 * (author_id, source_url) WHERE content_origin = 'imported_stub' makes the
 * database the arbiter for concurrent imports of the same URL. The app
 * contract: a 23505 on the recipe INSERT means "someone (usually a racing
 * request from the same user) already imported this" — return the existing
 * recipe exactly like the pre-insert check does, never an error.
 */

const userId = "11111111-1111-4111-8111-111111111111";
const existingRecipeId = "22222222-2222-4222-8222-222222222222";
const sourceUrl = "https://www.instagram.com/reel/abc123/";

type SelectResult = { data: { id: string } | null };

/**
 * Minimal mock of the supabase query surface `saveImportedRecipe` touches.
 * `selectResults` feeds the recipes lookup (pre-check first, then the
 * 23505 recovery lookup); `insertError` drives the recipes INSERT outcome.
 */
function buildSupabaseMock(opts: {
  selectResults: SelectResult[];
  insertError: { code?: string; message: string } | null;
}) {
  const selectQueue = [...opts.selectResults];
  const contentOriginFilters: string[][] = [];
  const savesInsert = vi.fn().mockResolvedValue({ error: null });
  const ingredientsInsert = vi.fn().mockResolvedValue({ error: null });
  const recipesInsert = vi.fn().mockImplementation(() => ({
    select: () => ({
      single: () =>
        Promise.resolve(
          opts.insertError
            ? { data: null, error: opts.insertError }
            : { data: { id: "fresh-recipe-id" }, error: null },
        ),
    }),
  }));

  const supabase = {
    from: (table: string) => {
      if (table === "recipes") {
        return {
          insert: recipesInsert,
          select: () => {
            const filters: string[] = [];
            contentOriginFilters.push(filters);
            const chain = {
              eq: (column: string, value: string) => {
                filters.push(`${column}=${value}`);
                return chain;
              },
              limit: () => chain,
              maybeSingle: () =>
                Promise.resolve(selectQueue.shift() ?? { data: null }),
            };
            return chain;
          },
        };
      }
      if (table === "recipe_ingredients") return { insert: ingredientsInsert };
      if (table === "saves") return { insert: savesInsert };
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;

  return { supabase, recipesInsert, savesInsert, contentOriginFilters };
}

const importedRecipe = {
  title: "Halloumi bowl",
  ingredients: [],
  sourceUrl,
  sourceName: "Instagram",
};

describe("saveImportedRecipe — ENG-1306 idempotent re-import", () => {
  it("pre-check hit returns the existing recipe without inserting", async () => {
    const { supabase, recipesInsert } = buildSupabaseMock({
      selectResults: [{ data: { id: existingRecipeId } }],
      insertError: null,
    });
    const result = await saveImportedRecipe(supabase, userId, importedRecipe);
    expect(result).toEqual({ recipeId: existingRecipeId });
    expect(recipesInsert).not.toHaveBeenCalled();
  });

  it("23505 unique violation recovers to the existing recipe (race lost, still idempotent)", async () => {
    const { supabase, recipesInsert } = buildSupabaseMock({
      // Pre-check misses (the race window), recovery lookup finds the row
      // the winning request inserted.
      selectResults: [{ data: null }, { data: { id: existingRecipeId } }],
      insertError: { code: "23505", message: "duplicate key value violates unique constraint \"recipes_import_author_source_url_unique\"" },
    });
    const result = await saveImportedRecipe(supabase, userId, importedRecipe);
    expect(result).toEqual({ recipeId: existingRecipeId });
    expect(recipesInsert).toHaveBeenCalledTimes(1);
  });

  it("non-23505 insert failures still surface the mapped error copy", async () => {
    const { supabase } = buildSupabaseMock({
      selectResults: [{ data: null }, { data: { id: existingRecipeId } }],
      insertError: { code: "42501", message: "row-level security" },
    });
    const result = await saveImportedRecipe(supabase, userId, importedRecipe);
    expect("error" in result && result.error.length > 0).toBe(true);
  });

  it("both lookups scope to imported stubs (claimed rows with the same URL are not 'already imported')", async () => {
    const { supabase, contentOriginFilters } = buildSupabaseMock({
      selectResults: [{ data: null }, { data: { id: existingRecipeId } }],
      insertError: { code: "23505", message: "duplicate key" },
    });
    await saveImportedRecipe(supabase, userId, importedRecipe);
    expect(contentOriginFilters).toHaveLength(2);
    for (const filters of contentOriginFilters) {
      expect(filters).toContain("content_origin=imported_stub");
      expect(filters).toContain(`author_id=${userId}`);
      expect(filters).toContain(`source_url=${sourceUrl}`);
    }
  });
});
