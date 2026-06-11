// @vitest-environment jsdom
/**
 * History-first food search (ENG-1031, MFP grammar) — mobile component pin.
 *
 * Behaviour: when the user types a query, matching items from their OWN
 * logging history surface FIRST as a visually-distinct "Past logged" group
 * above the database results, each one-tap loggable. The group is absent when
 * no history matches.
 *
 * Parity pair: tests/unit/foodSearchPastLogged.test.tsx (web).
 * The shared matcher/ranker is unit-pinned in tests/unit/foodHistorySearch.test.ts.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

import FoodSearchModal from "../../components/FoodSearchModal";

void React;

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Deterministic single DB row — distinct name from the history items so the
// de-dupe doesn't suppress it. The mock keeps the search network-free.
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
          name: "Sourdough Boule Loaf",
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
  { recipeTitle: "Smartfood popcorn", calories: 160, protein: 2, carbs: 14, fat: 10, count: 3 },
  { recipeTitle: "Greek yogurt", calories: 120, protein: 17, carbs: 7, fat: 2, count: 5 },
];

describe("FoodSearchPanel (mobile) — history-first 'Past logged' group", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the 'Past logged' group with matching history when a query is typed", async () => {
    const { findByTestId, getByText } = render(
      <FoodSearchModal
        visible
        initialQuery="sour"
        recentFoods={HISTORY}
        onSelect={() => undefined}
        onClose={() => undefined}
      />,
    );
    const group = await findByTestId("food-search-past-logged");
    expect(group).toBeTruthy();
    expect(getByText("Past logged")).toBeTruthy();
    const firstRow = await findByTestId("food-search-past-logged-0");
    expect(firstRow).toBeTruthy();
  });

  it("does NOT render the group when no history matches the query", async () => {
    const { findByText, queryByTestId } = render(
      <FoodSearchModal
        visible
        initialQuery="quinoa"
        recentFoods={HISTORY}
        onSelect={() => undefined}
        onClose={() => undefined}
      />,
    );
    // Wait for the search to settle (the DB row populates regardless).
    await findByText("Sourdough Boule Loaf");
    expect(queryByTestId("food-search-past-logged")).toBeNull();
  });

  it("one-tap logs a history row with per-serving macros (no per-100g basis)", async () => {
    const onSelect = vi.fn();
    const { findByTestId } = render(
      <FoodSearchModal
        visible
        initialQuery="sour"
        recentFoods={HISTORY}
        onSelect={onSelect}
        onClose={() => undefined}
      />,
    );
    const row = await findByTestId("food-search-past-logged-0");
    fireEvent.press(row);
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    const sel = onSelect.mock.calls[0]![0];
    expect(sel.name).toBe("Sourdough");
    expect(sel.macrosPer100g).toBeNull();
    expect(sel.macrosPerServing.calories).toBe(180);
    expect(sel.quantity).toBe(1);
  });
});
