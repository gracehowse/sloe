/**
 * ENG-1126 — `useRecipeCollections` (apps/mobile/lib/recipes.ts). The
 * shared CRUD query logic itself is pinned by the web-side
 * `tests/unit/recipeCollections.test.ts` (same module, both platforms call
 * it directly). This file covers the mobile-hook-specific behaviour: the
 * initial probe disabling the feature silently on a missing table, and
 * optimistic add/remove with rollback on failure.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Alert } from "react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";

let probeError: { message: string } | null = null;
let collectionsRows: Array<{ id: string; name: string; sort_order: number; created_at: string }> = [];
let membershipRows: Array<{ collection_id: string; recipe_id: string }> = [];
let upsertError: { message: string } | null = null;
let insertResult: { data: unknown; error: unknown } = {
  data: { id: "c2", name: "New collection", sort_order: 1, created_at: "2026-07-02T00:00:00Z" },
  error: null,
};

function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(insertResult)),
    upsert: vi.fn(() => Promise.resolve(upsertError ? { data: null, error: upsertError } : result)),
    then: (resolve: (r: typeof result) => void) => resolve(result),
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "recipe_collections") {
        if (probeError) return makeBuilder({ data: null, error: probeError });
        return makeBuilder({ data: collectionsRows, error: null });
      }
      if (table === "recipe_collection_items") {
        return makeBuilder({ data: membershipRows, error: null });
      }
      return makeBuilder({ data: null, error: null });
    }),
  },
}));

import { useRecipeCollections } from "@/lib/recipes";

describe("useRecipeCollections", () => {
  beforeEach(() => {
    probeError = null;
    upsertError = null;
    collectionsRows = [{ id: "c1", name: "Weeknight", sort_order: 0, created_at: "2026-07-01T00:00:00Z" }];
    membershipRows = [{ collection_id: "c1", recipe_id: "r1" }];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads collections + membership for a signed-in user", async () => {
    const { result } = renderHook(() => useRecipeCollections("u1"));
    await waitFor(() => expect(result.current.collections).toHaveLength(1));
    expect(result.current.collections[0]).toEqual({
      id: "c1",
      name: "Weeknight",
      sortOrder: 0,
      createdAt: "2026-07-01T00:00:00Z",
    });
    expect(result.current.membership).toEqual({ r1: ["c1"] });
    expect(result.current.enabled).toBe(true);
  });

  it("disables silently (no Alert) when the table doesn't exist yet", async () => {
    probeError = { message: 'Could not find the table "public.recipe_collections" in the schema cache' };
    const alertSpy = vi.spyOn(Alert, "alert").mockImplementation((() => {}) as typeof Alert.alert);
    const { result } = renderHook(() => useRecipeCollections("u1"));
    await waitFor(() => expect(result.current.enabled).toBe(false));
    expect(result.current.collections).toEqual([]);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("optimistically adds membership, then keeps it on success", async () => {
    membershipRows = [];
    const { result } = renderHook(() => useRecipeCollections("u1"));
    await waitFor(() => expect(result.current.collections).toHaveLength(1));

    await act(async () => {
      await result.current.addRecipeToCollection("c1", "r2");
    });
    expect(result.current.membership.r2).toEqual(["c1"]);
  });

  it("rolls back an optimistic add and alerts on failure", async () => {
    membershipRows = [];
    const alertSpy = vi.spyOn(Alert, "alert").mockImplementation((() => {}) as typeof Alert.alert);
    const { result } = renderHook(() => useRecipeCollections("u1"));
    await waitFor(() => expect(result.current.collections).toHaveLength(1));

    upsertError = { message: "network down" };
    await act(async () => {
      const ok = await result.current.addRecipeToCollection("c1", "r2");
      expect(ok).toBe(false);
    });
    expect(result.current.membership.r2 ?? []).toEqual([]);
    expect(alertSpy).toHaveBeenCalledWith("Couldn't add to collection", "network down");
  });

  it("creates a collection and appends it to local state", async () => {
    const { result } = renderHook(() => useRecipeCollections("u1"));
    await waitFor(() => expect(result.current.collections).toHaveLength(1));

    let ok = false;
    await act(async () => {
      ok = await result.current.createCollection("New collection");
    });
    expect(ok).toBe(true);
    expect(result.current.collections).toHaveLength(2);
    expect(result.current.collections[1]).toEqual({
      id: "c2",
      name: "New collection",
      sortOrder: 1,
      createdAt: "2026-07-02T00:00:00Z",
    });
  });
});
