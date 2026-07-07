/**
 * computeFoodSearchHistoryAndFavorites / resolveFavoriteToggleId — mobile
 * cross-platform wiring pin (ENG-1362, round 2 of the ENG-550
 * FoodSearchPanel extraction).
 *
 * Proves the shared module resolves correctly from mobile via
 * `@suppr/nutrition-core/foodSearchHistoryAndFavorites` (the same import
 * boundary `foodHistorySearch` / `favoriteFoodsSearch` already use) and
 * that mobile's extra "Recents" category (which web does not have,
 * ENG-748 #8) is honoured via the caller-supplied
 * `isHistoryVisibleCategory` gate rather than collapsed into web's gate.
 *
 * This module is deliberately pure (no React import) — see the docstring
 * on `foodSearchHistoryAndFavorites.ts` for why a stateful hook doesn't
 * safely cross the web(React 18)/mobile(React 19) boundary in this repo
 * today. Each panel wraps the call in its own local `useMemo`.
 *
 * Full behavioural coverage of the composition itself lives in the
 * web-side parity pin: tests/unit/foodSearchHistoryAndFavorites.test.ts.
 */
import { describe, expect, it } from "vitest";
import {
  computeFoodSearchHistoryAndFavorites,
  resolveFavoriteToggleId,
} from "@suppr/nutrition-core/foodSearchHistoryAndFavorites";

const HISTORY = [
  { recipeTitle: "Sourdough", calories: 180, protein: 6, carbs: 34, fat: 1, count: 12 },
];

const FAVOURITES = [
  { id: "fav-1", recipeTitle: "Sourdough", calories: 180, protein: 6, carbs: 34, fat: 1 },
];

type MobileFoodCategory = "All" | "Recents" | "Custom" | "Branded" | "Generic";

/** Mirrors the mobile panel's own gate exactly — see FoodSearchPanel.tsx. */
function isHistoryVisibleForMobileCategory(category: MobileFoodCategory): boolean {
  return category === "All" || category === "Recents";
}

describe("computeFoodSearchHistoryAndFavorites — mobile import boundary", () => {
  it("resolves via @suppr/nutrition-core and matches favourites against the query", () => {
    const out = computeFoodSearchHistoryAndFavorites({
      query: "sour",
      results: [],
      recentFoods: HISTORY,
      favoriteFoods: FAVOURITES,
      isHistoryVisibleCategory: true,
    });
    expect(out.favoriteMatches).toHaveLength(1);
  });

  it("mobile's 'Recents' category (which web doesn't have) surfaces history/favourites via the caller's own gate", () => {
    // The shared function itself doesn't know about "Recents", it just
    // trusts the boolean each platform computes from its own category state.
    const out = computeFoodSearchHistoryAndFavorites({
      query: "sour",
      results: [],
      recentFoods: HISTORY,
      favoriteFoods: FAVOURITES,
      isHistoryVisibleCategory: isHistoryVisibleForMobileCategory("Recents"),
    });
    expect(out.favoriteMatches).toHaveLength(1);
  });

  it("a Branded/Generic/Custom category tab suppresses history/favourites on mobile too", () => {
    const out = computeFoodSearchHistoryAndFavorites({
      query: "sour",
      results: [],
      recentFoods: HISTORY,
      favoriteFoods: FAVOURITES,
      isHistoryVisibleCategory: isHistoryVisibleForMobileCategory("Branded"),
    });
    expect(out.favoriteMatches).toEqual([]);
  });
});

describe("resolveFavoriteToggleId — mobile import boundary", () => {
  it("resolves the existing favourite id so the star-toggle can unstar", () => {
    const id = resolveFavoriteToggleId(
      { recipeTitle: "Sourdough", calories: 180, protein: 6, carbs: 34, fat: 1 },
      FAVOURITES,
    );
    expect(id).toBe("fav-1");
  });
});
