// @vitest-environment jsdom
/**
 * Favourites-in-search (teardown #1, ENG-1041) — mobile component pin.
 *
 * Behaviour: when the user types a query, foods they've STARRED that match it
 * surface in a "Favourites" group ABOVE "Past logged", each one-tap loggable
 * and each with a star toggle that calls the host's `onToggleFavorite`. A food
 * that's both a favourite and in history shows once (favourites win).
 *
 * Parity pair: tests/unit/foodSearchFavourites.test.tsx (web).
 * The shared matcher/orderer is unit-pinned in tests/unit/favoriteFoodsSearch.test.ts.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

import FoodSearchModal from "../../components/FoodSearchModal";

void React;

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Deterministic single DB row — distinct name so de-dupe doesn't suppress it.
vi.mock("@/lib/verifyRecipe", () => {
  const PER_100G = {
    calories: 250,
    protein: 9,
    carbs: 48,
    fat: 2,
    fiberG: 2,
    sugarG: 3,
    sodiumMg: 400,
  };
  return {
    splitFoodSearchResults: (_q: string, rows: any[]) => ({ best: rows ?? [], more: [] }),
    searchFoods: vi.fn(async (_query: string, onPartial?: (r: unknown[]) => void) => {
      const rows = [
        {
          key: "off-db-1",
          name: "Pumpernickel Loaf",
          calsPer100g: PER_100G.calories,
          macrosPer100g: PER_100G,
          verified: false,
          _source: "OFF" as const,
          _offCode: "0000000000000",
        },
      ];
      if (onPartial) onPartial(rows);
      return rows;
    }),
    getFoodMacros: vi.fn(async () => null),
    scaleMacrosByGrams: (per100g: typeof PER_100G, grams: number) => {
      const f = grams / 100;
      return {
        calories: Math.round(per100g.calories * f),
        protein: Math.round(per100g.protein * f),
        carbs: Math.round(per100g.carbs * f),
        fat: Math.round(per100g.fat * f),
        fiberG: Math.round(per100g.fiberG * f),
        sugarG: Math.round(per100g.sugarG * f),
        sodiumMg: Math.round(per100g.sodiumMg * f),
      };
    },
  };
});

const HISTORY = [
  { recipeTitle: "Sourdough", calories: 180, protein: 6, carbs: 34, fat: 1, count: 12 },
  { recipeTitle: "Greek yogurt", calories: 120, protein: 17, carbs: 7, fat: 2, count: 5 },
];

const FAVOURITES = [
  { id: "fav-1", recipeTitle: "Sourdough", calories: 180, protein: 6, carbs: 34, fat: 1 },
];

describe("FoodSearchPanel (mobile) — favourites-in-search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the 'Favourites' group when a query matches a starred food", async () => {
    const { findByTestId, getByText } = render(
      <FoodSearchModal
        visible
        initialQuery="sour"
        recentFoods={HISTORY}
        favoriteFoods={FAVOURITES}
        onToggleFavorite={() => undefined}
        onSelect={() => undefined}
        onClose={() => undefined}
      />,
    );
    const group = await findByTestId("food-search-favourites");
    expect(group).toBeTruthy();
    expect(getByText("Favourites")).toBeTruthy();
    expect(await findByTestId("food-search-favourites-0")).toBeTruthy();
  });

  it("does NOT also list the favourite in 'Past logged' (favourites win)", async () => {
    const { findByTestId, queryByTestId } = render(
      <FoodSearchModal
        visible
        initialQuery="sour"
        recentFoods={HISTORY}
        favoriteFoods={FAVOURITES}
        onToggleFavorite={() => undefined}
        onSelect={() => undefined}
        onClose={() => undefined}
      />,
    );
    await findByTestId("food-search-favourites");
    expect(queryByTestId("food-search-past-logged")).toBeNull();
  });

  it("tapping a favourites row logs it (per-serving macros, no per-100g basis)", async () => {
    const onSelect = vi.fn();
    const { findByTestId } = render(
      <FoodSearchModal
        visible
        initialQuery="sour"
        recentFoods={HISTORY}
        favoriteFoods={FAVOURITES}
        onToggleFavorite={() => undefined}
        onSelect={onSelect}
        onClose={() => undefined}
      />,
    );
    const row = await findByTestId("food-search-favourites-0");
    fireEvent.press(row);
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    const sel = onSelect.mock.calls[0]![0];
    expect(sel.name).toBe("Sourdough");
    expect(sel.macrosPer100g).toBeNull();
    expect(sel.macrosPerServing.calories).toBe(180);
  });

  it("the star on a Past-logged row calls onToggleFavorite to ADD (no favoriteId)", async () => {
    const onToggleFavorite = vi.fn();
    const onSelect = vi.fn();
    const { findByTestId } = render(
      <FoodSearchModal
        visible
        initialQuery="greek"
        recentFoods={HISTORY}
        favoriteFoods={FAVOURITES}
        onToggleFavorite={onToggleFavorite}
        onSelect={onSelect}
        onClose={() => undefined}
      />,
    );
    const star = await findByTestId("food-search-past-logged-0-star");
    fireEvent.press(star);
    await waitFor(() => expect(onToggleFavorite).toHaveBeenCalledTimes(1));
    const arg = onToggleFavorite.mock.calls[0]![0];
    expect(arg.recipeTitle).toBe("Greek yogurt");
    expect(arg.favoriteId).toBeUndefined();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("the star on a Favourites row calls onToggleFavorite to REMOVE (carries the favoriteId)", async () => {
    const onToggleFavorite = vi.fn();
    const { findByTestId } = render(
      <FoodSearchModal
        visible
        initialQuery="sour"
        recentFoods={HISTORY}
        favoriteFoods={FAVOURITES}
        onToggleFavorite={onToggleFavorite}
        onSelect={() => undefined}
        onClose={() => undefined}
      />,
    );
    const star = await findByTestId("food-search-favourites-0-star");
    fireEvent.press(star);
    await waitFor(() => expect(onToggleFavorite).toHaveBeenCalledTimes(1));
    const arg = onToggleFavorite.mock.calls[0]![0];
    expect(arg.recipeTitle).toBe("Sourdough");
    expect(arg.favoriteId).toBe("fav-1");
  });
});
