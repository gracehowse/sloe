/**
 * ENG-1048 — web single insert/delete rolls back optimistic UI on persist failure.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
void React;

let insertShouldFail = false;
let deleteShouldFail = false;

vi.mock("../../src/lib/supabase/browserClient.ts", () => ({
  supabase: {
    from: () => ({
      select: () => {
        const result = Promise.resolve({ data: [], error: null });
        const chain: Record<string, unknown> = {
          limit: () => result,
          eq: () => chain,
          order: () => result,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        };
        return chain;
      },
      insert: () =>
        Promise.resolve(
          insertShouldFail
            ? { error: { message: "insert failed" } }
            : { error: null },
        ),
      upsert: () => Promise.resolve({ error: null }),
      delete: () => ({
        eq: () =>
          Promise.resolve(
            deleteShouldFail
              ? { error: { message: "delete failed" } }
              : { error: null },
          ),
      }),
    }),
  },
}));

vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: vi.fn(),
}));

vi.mock("../../src/lib/nutrition/refreshAdaptiveTdee.ts", () => ({
  refreshAdaptiveTdeeForUser: vi.fn(() => Promise.resolve()),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock("../../src/context/appData/useRetryEnableDbTable.ts", () => ({
  useRetryEnableDbTable: () => {},
}));

import { useNutritionJournalState } from "../../src/context/appData/useNutritionJournalState";

describe("ENG-1048 — web journal optimistic rollback", () => {
  beforeEach(() => {
    insertShouldFail = false;
    deleteShouldFail = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rolls back a single optimistic insert when Supabase insert fails", async () => {
    insertShouldFail = true;
    const { result } = renderHook(() =>
      useNutritionJournalState({
        authedUserId: "user-1",
        initialByDay: {},
        selectedDateKey: "2026-06-11",
      }),
    );

    act(() => {
      result.current.addLoggedMealForDate("2026-06-11", {
        name: "Breakfast",
        recipeTitle: "Oats",
        time: "8:00 AM",
        calories: 300,
        protein: 10,
        carbs: 50,
        fat: 8,
      });
    });

    expect(result.current.nutritionByDay["2026-06-11"]).toHaveLength(1);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.nutritionByDay["2026-06-11"] ?? []).toHaveLength(0);
  });

  it("restores a meal when optimistic delete fails", async () => {
    const { result } = renderHook(() =>
      useNutritionJournalState({
        authedUserId: "user-1",
        initialByDay: {},
        selectedDateKey: "2026-06-11",
      }),
    );

    act(() => {
      result.current.addLoggedMealForDate("2026-06-11", {
        name: "Lunch",
        recipeTitle: "Salad",
        time: "12:00 PM",
        calories: 400,
        protein: 20,
        carbs: 30,
        fat: 15,
      });
    });

    const mealId = result.current.nutritionByDay["2026-06-11"]![0]!.id;
    deleteShouldFail = true;

    act(() => {
      result.current.removeLoggedMeal(mealId);
    });

    expect(result.current.nutritionByDay["2026-06-11"] ?? []).toHaveLength(0);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.nutritionByDay["2026-06-11"]).toHaveLength(1);
    expect(result.current.nutritionByDay["2026-06-11"]![0]!.id).toBe(mealId);
  });
});
