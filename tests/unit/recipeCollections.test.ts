import { describe, expect, it, vi } from "vitest";
import {
  addRecipeToCollection,
  createRecipeCollection,
  deleteRecipeCollection,
  fetchCollectionMembership,
  fetchRecipeCollections,
  removeRecipeFromCollection,
  renameRecipeCollection,
} from "../../src/lib/recipes/recipeCollections";

/**
 * ENG-1126 — the shared CRUD module both web (`AppDataContext.tsx` via
 * `useRecipeCollectionsState`) and mobile (`apps/mobile/lib/recipes.ts`'s
 * `useRecipeCollections`) call directly. Chain-agnostic mock: every query
 * builder method returns itself and the builder is thenable, so it resolves
 * with the configured result regardless of how deep the real call chains.
 */
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn(() => builder),
    then: (resolve: (r: typeof result) => void) => resolve(result),
  };
  return builder;
}

function makeSupabase(result: { data: unknown; error: unknown }) {
  const from = vi.fn(() => makeQueryBuilder(result));
  return { from } as any;
}

describe("fetchRecipeCollections", () => {
  it("maps snake_case rows to camelCase", async () => {
    const supabase = makeSupabase({
      data: [{ id: "c1", name: "Weeknight", sort_order: 0, created_at: "2026-07-01T00:00:00Z" }],
      error: null,
    });
    const out = await fetchRecipeCollections(supabase);
    expect(out).toEqual([{ id: "c1", name: "Weeknight", sortOrder: 0, createdAt: "2026-07-01T00:00:00Z" }]);
  });

  it("returns [] on error rather than throwing", async () => {
    const supabase = makeSupabase({ data: null, error: { message: "boom" } });
    await expect(fetchRecipeCollections(supabase)).resolves.toEqual([]);
  });
});

describe("fetchCollectionMembership", () => {
  it("groups collection ids by recipe id", async () => {
    const supabase = makeSupabase({
      data: [
        { collection_id: "c1", recipe_id: "r1" },
        { collection_id: "c2", recipe_id: "r1" },
        { collection_id: "c1", recipe_id: "r2" },
      ],
      error: null,
    });
    const out = await fetchCollectionMembership(supabase);
    expect(out).toEqual({ r1: ["c1", "c2"], r2: ["c1"] });
  });

  it("returns {} on error", async () => {
    const supabase = makeSupabase({ data: null, error: { message: "boom" } });
    await expect(fetchCollectionMembership(supabase)).resolves.toEqual({});
  });
});

describe("createRecipeCollection", () => {
  it("rejects an empty/whitespace-only name without touching the network", async () => {
    const from = vi.fn();
    const supabase = { from } as any;
    const out = await createRecipeCollection(supabase, "u1", "   ");
    expect(out).toEqual({ error: "Collection name can't be empty." });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns the created collection, trimmed", async () => {
    const supabase = makeSupabase({
      data: { id: "c1", name: "Weeknight favourites", sort_order: 0, created_at: "2026-07-01T00:00:00Z" },
      error: null,
    });
    const out = await createRecipeCollection(supabase, "u1", "  Weeknight favourites  ");
    expect(out).toEqual({
      collection: { id: "c1", name: "Weeknight favourites", sortOrder: 0, createdAt: "2026-07-01T00:00:00Z" },
    });
  });

  it("surfaces a friendly message on a duplicate name (23505)", async () => {
    const supabase = makeSupabase({ data: null, error: { code: "23505", message: "duplicate key" } });
    const out = await createRecipeCollection(supabase, "u1", "Weeknight");
    expect(out).toEqual({ error: 'You already have a collection named "Weeknight".' });
  });

  it("falls back to the raw error message for non-duplicate failures", async () => {
    const supabase = makeSupabase({ data: null, error: { message: "network down" } });
    const out = await createRecipeCollection(supabase, "u1", "Weeknight");
    expect(out).toEqual({ error: "network down" });
  });
});

describe("renameRecipeCollection", () => {
  it("rejects an empty name", async () => {
    const from = vi.fn();
    const out = await renameRecipeCollection({ from } as any, "c1", "");
    expect(out).toEqual({ error: "Collection name can't be empty." });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns ok on success", async () => {
    const supabase = makeSupabase({ data: null, error: null });
    await expect(renameRecipeCollection(supabase, "c1", "New name")).resolves.toEqual({ ok: true });
  });

  it("surfaces a friendly duplicate-name message", async () => {
    const supabase = makeSupabase({ data: null, error: { code: "23505", message: "duplicate key" } });
    const out = await renameRecipeCollection(supabase, "c1", "Taken");
    expect(out).toEqual({ error: 'You already have a collection named "Taken".' });
  });
});

describe("deleteRecipeCollection", () => {
  it("returns ok on success", async () => {
    const supabase = makeSupabase({ data: null, error: null });
    await expect(deleteRecipeCollection(supabase, "c1")).resolves.toEqual({ ok: true });
  });

  it("returns the error message on failure", async () => {
    const supabase = makeSupabase({ data: null, error: { message: "not found" } });
    await expect(deleteRecipeCollection(supabase, "c1")).resolves.toEqual({ error: "not found" });
  });
});

describe("addRecipeToCollection / removeRecipeFromCollection", () => {
  it("adds via upsert with the composite conflict target", async () => {
    const builder: any = {
      upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };
    const supabase = { from: vi.fn(() => builder) } as any;
    const out = await addRecipeToCollection(supabase, "c1", "r1");
    expect(out).toEqual({ ok: true });
    expect(builder.upsert).toHaveBeenCalledWith(
      { collection_id: "c1", recipe_id: "r1" },
      { onConflict: "collection_id,recipe_id" },
    );
  });

  it("removes via a compound delete + eq + eq", async () => {
    const supabase = makeSupabase({ data: null, error: null });
    await expect(removeRecipeFromCollection(supabase, "c1", "r1")).resolves.toEqual({ ok: true });
  });

  it("surfaces errors from either mutation", async () => {
    const supabase = makeSupabase({ data: null, error: { message: "denied" } });
    await expect(removeRecipeFromCollection(supabase, "c1", "r1")).resolves.toEqual({ error: "denied" });
  });
});
