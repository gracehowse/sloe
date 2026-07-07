/**
 * computeFoodSearchHistoryAndFavorites / resolveFavoriteToggleId — shared
 * history/favourites composition (ENG-1362, round 2 of the ENG-550
 * FoodSearchPanel extraction).
 *
 * This pure module OWNS the composition that both `FoodSearchPanel` files
 * previously reimplemented byte-for-byte: matching history + favourites
 * against the typed query, de-duping favourites out of history, de-duping
 * the DB catalogue against history, and resolving a favourite id for the
 * star-toggle.
 *
 * These tests are the regression harness for the extraction — written
 * against the NEW shared module directly (both panels now call it
 * identically, wrapped in their own local `useMemo`/`useCallback`), so a
 * future change to either panel's history/favourites behaviour has to go
 * through here rather than silently drifting again.
 */
import { describe, expect, it } from "vitest";
import {
  computeFoodSearchHistoryAndFavorites,
  resolveFavoriteToggleId,
} from "../../src/lib/nutrition/foodSearchHistoryAndFavorites";

type Row = { key: string; name: string; _source: string };

const HISTORY = [
  { recipeTitle: "Sourdough", calories: 180, protein: 6, carbs: 34, fat: 1, count: 12 },
  { recipeTitle: "Greek yogurt", calories: 120, protein: 17, carbs: 7, fat: 2, count: 5 },
];

const FAVOURITES = [
  { id: "fav-1", recipeTitle: "Sourdough", calories: 180, protein: 6, carbs: 34, fat: 1 },
];

const DB_RESULTS: Row[] = [
  { key: "off-1", name: "Sourdough", _source: "OFF" },
  { key: "off-2", name: "Sourdough Crackers", _source: "OFF" },
];

describe("computeFoodSearchHistoryAndFavorites", () => {
  it("matches history + favourites against the typed query", () => {
    const out = computeFoodSearchHistoryAndFavorites({
      query: "sour",
      results: DB_RESULTS,
      recentFoods: HISTORY,
      favoriteFoods: FAVOURITES,
      isHistoryVisibleCategory: true,
    });
    expect(out.favoriteMatches).toHaveLength(1);
    expect(out.favoriteMatches[0]!.item.recipeTitle).toBe("Sourdough");
  });

  it("favourites win: a food that's both starred and in history is removed from historyMatchesDeduped", () => {
    const out = computeFoodSearchHistoryAndFavorites({
      query: "sour",
      results: DB_RESULTS,
      recentFoods: HISTORY,
      favoriteFoods: FAVOURITES,
      isHistoryVisibleCategory: true,
    });
    const titles = out.historyMatchesDeduped.map((m) => m.item.recipeTitle);
    expect(titles).not.toContain("Sourdough");
  });

  it("history wins over the DB catalogue: an exact normalized-name collision is deduped out of dedupedResults", () => {
    const out = computeFoodSearchHistoryAndFavorites({
      query: "sour",
      results: DB_RESULTS,
      recentFoods: HISTORY,
      favoriteFoods: [],
      isHistoryVisibleCategory: true,
    });
    const names = out.dedupedResults.map((r) => r.name);
    expect(names).not.toContain("Sourdough");
    // Non-exact-match row survives — conservative de-dupe.
    expect(names).toContain("Sourdough Crackers");
  });

  it("when isHistoryVisibleCategory is false (e.g. a Branded/Generic/Custom filter tab), no history/favourite groups surface and the DB catalogue passes through unfiltered", () => {
    const out = computeFoodSearchHistoryAndFavorites({
      query: "sour",
      results: DB_RESULTS,
      recentFoods: HISTORY,
      favoriteFoods: FAVOURITES,
      isHistoryVisibleCategory: false,
    });
    expect(out.favoriteMatches).toEqual([]);
    expect(out.historyMatchesDeduped).toEqual([]);
    expect(out.dedupedResults.map((r) => r.name)).toEqual([
      "Sourdough",
      "Sourdough Crackers",
    ]);
  });

  it("favoriteKeys carries every favourite's key for per-row star state", () => {
    const out = computeFoodSearchHistoryAndFavorites({
      query: "",
      results: [],
      recentFoods: HISTORY,
      favoriteFoods: FAVOURITES,
      isHistoryVisibleCategory: true,
    });
    expect(out.favoriteKeys.size).toBe(1);
  });

  it("empty query yields no history/favourite matches but leaves results untouched", () => {
    const out = computeFoodSearchHistoryAndFavorites({
      query: "",
      results: DB_RESULTS,
      recentFoods: HISTORY,
      favoriteFoods: FAVOURITES,
      isHistoryVisibleCategory: true,
    });
    expect(out.historyMatchesDeduped).toEqual([]);
    expect(out.favoriteMatches).toEqual([]);
    expect(out.dedupedResults).toHaveLength(2);
  });
});

describe("resolveFavoriteToggleId — persists the toggle via the resolved id", () => {
  it("returns undefined for an unstarred food (ADD path)", () => {
    const id = resolveFavoriteToggleId(
      { recipeTitle: "Greek yogurt", calories: 120, protein: 17, carbs: 7, fat: 2 },
      FAVOURITES,
    );
    expect(id).toBeUndefined();
  });

  it("returns the existing favourite's id for an already-starred food (REMOVE path)", () => {
    const id = resolveFavoriteToggleId(
      { recipeTitle: "Sourdough", calories: 180, protein: 6, carbs: 34, fat: 1 },
      FAVOURITES,
    );
    expect(id).toBe("fav-1");
  });

  it("handles an undefined favourites list", () => {
    const id = resolveFavoriteToggleId(
      { recipeTitle: "Sourdough", calories: 180, protein: 6, carbs: 34, fat: 1 },
      undefined,
    );
    expect(id).toBeUndefined();
  });
});
