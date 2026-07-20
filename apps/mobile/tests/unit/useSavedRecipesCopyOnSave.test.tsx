// @vitest-environment jsdom
/**
 * ENG-1467 — copy-on-save for Discover seed recipes (mobile).
 *
 * Discover's static seed catalogue (`SEED_RECIPES_V2`) uses slug ids
 * (`seed-v2-{cluster}-{slug}`), never written to the `recipes` table.
 * `useSavedRecipes().toggleSave` ultimately inserts into `saves`, whose
 * `recipe_id` column is a `uuid` FK — saving a seed directly threw
 * `invalid input syntax for type uuid`, console-only, on the Discover
 * surface's primary CTA.
 *
 * Fix: `toggleSave` now materialises a seed into a real `recipes` row
 * before touching `saves`, and surfaces every failure via `Alert.alert`
 * (never console-only). This pins:
 *   1. Saving a seed (non-UUID id) materialises it, then inserts the
 *      `saves` row keyed on the MATERIALISED uuid, not the slug.
 *   2. `savedIds` (and therefore `isSaved`) tracks the ORIGINAL slug id
 *      so Discover cards (which only know that id) render correctly.
 *   3. Unsaving a previously-saved seed deletes the `saves` row keyed
 *      on the resolved uuid.
 *   4. A materialise failure rolls back the optimistic state and shows
 *      an Alert — never a silent console-only failure.
 *   5. Saving a real (already-UUID) recipe is completely unaffected —
 *      no materialise call, straight to `saves`.
 */
import * as React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Alert } from "react-native";

void React;

const seedId = "seed-v2-mediterranean-butter-bean-shakshuka";
const materialisedId = "22222222-2222-4222-8222-222222222222";
const realRecipeId = "33333333-3333-4333-8333-333333333333";
const userId = "11111111-1111-4111-8111-111111111111";

const materialiseMock = vi.fn();
const fetchMapMock = vi.fn();

vi.mock("@suppr/shared/recipes/materialiseSeedRecipe", async () => {
  const actual = await vi.importActual<typeof import("../../../../src/lib/recipes/materialiseSeedRecipe")>(
    "../../../../src/lib/recipes/materialiseSeedRecipe",
  );
  return {
    ...actual,
    materialiseSeedRecipeById: (...args: unknown[]) => materialiseMock(...args),
    fetchMaterialisedSeedMap: (...args: unknown[]) => fetchMapMock(...args),
  };
});

// Empty-query helper mirroring the shared saves/profile fetch shape.
function emptyQuery(result: unknown = { data: [], error: null, count: 0 }) {
  const q: Record<string, unknown> = {};
  const methods = ["select", "eq", "order", "limit", "in", "is", "maybeSingle", "delete", "insert"];
  for (const m of methods) q[m] = vi.fn(() => q);
  (q as { then: unknown }).then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return q;
}

// Records every .eq(...) call in the delete chain (real code does
// .delete().eq("user_id", userId).eq("recipe_id", dbRecipeId)) and
// resolves on the final link, like a real Supabase PostgrestBuilder.
const savesDeleteEqCalls: unknown[][] = [];
const savesInsert = vi.fn().mockResolvedValue({ error: null });
const savesDelete = vi.fn();
// Rows fetchAllUserSaves resolves on the initial load — set per-test to
// simulate a pre-existing `saves` row (e.g. a seed saved in a prior
// session, whose materialised copy the seed-map already resolves).
const existingSaveRows: { current: { recipe_id: string; created_at: string }[] } = { current: [] };

function makeDeleteChain(): { eq: (...args: unknown[]) => unknown } {
  const chain = {
    eq: (...args: unknown[]) => {
      savesDeleteEqCalls.push(args);
      return chain;
    },
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
  };
  return chain;
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "profiles") return emptyQuery({ data: { user_tier: "free" }, error: null });
      if (table === "saves") {
        return {
          // fetchAllUserSaves reads via select().eq().order().limit() ->
          // awaitable { data: [...], error: null }.
          select: () => emptyQuery({ data: existingSaveRows.current, error: null }),
          insert: (...args: unknown[]) => savesInsert(...args),
          delete: (...args: unknown[]) => {
            savesDelete(...args);
            return makeDeleteChain();
          },
        };
      }
      return emptyQuery();
    }),
  },
}));

vi.mock("./offlineCache", () => ({
  cacheDiscoverRecipes: vi.fn(),
  getCachedDiscoverRecipes: vi.fn(() => null),
  cacheSavedRecipes: vi.fn(),
  getCachedSavedRecipes: vi.fn(() => null),
}));

import { useSavedRecipes } from "../../lib/recipes";

beforeEach(() => {
  vi.clearAllMocks();
  materialiseMock.mockReset();
  fetchMapMock.mockReset();
  fetchMapMock.mockResolvedValue({});
  savesInsert.mockResolvedValue({ error: null });
  savesDeleteEqCalls.length = 0;
  existingSaveRows.current = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSavedRecipes — copy-on-save (ENG-1467)", () => {
  it("materialises a seed recipe, then saves using the MATERIALISED id — savedIds tracks the ORIGINAL slug id", async () => {
    materialiseMock.mockResolvedValue({ ok: true, recipeId: materialisedId });
    const { result } = renderHook(() => useSavedRecipes(userId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleSave(seedId);
    });

    expect(materialiseMock).toHaveBeenCalledWith(expect.anything(), userId, seedId);
    expect(savesInsert).toHaveBeenCalledWith({ user_id: userId, recipe_id: materialisedId });
    // Discover cards only know the slug id — isSaved must key on it.
    expect(result.current.isSaved(seedId)).toBe(true);
  });

  it("rolls back the optimistic save and alerts (never console-only) when materialise fails", async () => {
    const alertSpy = vi.spyOn(Alert, "alert").mockImplementation(() => {});
    materialiseMock.mockResolvedValue({ ok: false, error: "We couldn't save the recipe. Try again." });
    const { result } = renderHook(() => useSavedRecipes(userId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleSave(seedId);
    });

    expect(savesInsert).not.toHaveBeenCalled();
    expect(result.current.isSaved(seedId)).toBe(false);
    expect(alertSpy).toHaveBeenCalledWith(
      "Couldn't save recipe",
      "We couldn't save the recipe. Try again.",
    );
  });

  it("unsaving a previously-materialised seed deletes the saves row keyed on the resolved uuid", async () => {
    // Simulate a prior save: a real `saves` row for the materialised
    // copy, plus the seed-map entry that resolves it back to the
    // seed's original slug id.
    existingSaveRows.current = [{ recipe_id: materialisedId, created_at: new Date().toISOString() }];
    fetchMapMock.mockResolvedValue({ [seedId]: materialisedId });
    const { result } = renderHook(() => useSavedRecipes(userId));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isSaved(seedId)).toBe(true);

    await act(async () => {
      await result.current.toggleSave(seedId);
    });

    expect(materialiseMock).not.toHaveBeenCalled();
    expect(savesDelete).toHaveBeenCalled();
    expect(savesDeleteEqCalls).toContainEqual(["recipe_id", materialisedId]);
    expect(result.current.isSaved(seedId)).toBe(false);
  });

  it("a real (already-UUID) recipe id never calls materialise — straight to saves", async () => {
    const { result } = renderHook(() => useSavedRecipes(userId));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleSave(realRecipeId);
    });

    expect(materialiseMock).not.toHaveBeenCalled();
    expect(savesInsert).toHaveBeenCalledWith({ user_id: userId, recipe_id: realRecipeId });
    expect(result.current.isSaved(realRecipeId)).toBe(true);
  });
});
