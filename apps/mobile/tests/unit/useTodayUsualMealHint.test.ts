/**
 * ENG-1361 (round 2) — behaviour tests for `useTodayUsualMealHint`, the
 * first-run "usual meal" hint gate (dismiss state + AsyncStorage
 * persistence + shown/dismissed analytics) extracted from
 * `TodayScreen.tsx`.
 */
import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTodayUsualMealHint } from "../../hooks/useTodayUsualMealHint";
import type { ByDay, JournalMeal } from "@/lib/nutritionJournal";
import type { SavedMeal } from "@suppr/nutrition-core/savedMeals";

const trackMock = vi.fn();
vi.mock("@/lib/analytics", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

function meal(name: string, recipeTitle: string, calories: number): JournalMeal {
  return {
    id: `${name}-${recipeTitle}-${calories}`,
    name,
    recipeTitle,
    time: "12:00",
    calories,
    protein: 1,
    carbs: 1,
    fat: 1,
  } as JournalMeal;
}

function savedMeal(id: string, defaultMealSlot?: "Breakfast" | "Lunch" | "Dinner" | "Snacks"): SavedMeal {
  return {
    id,
    name: id,
    defaultMealSlot,
    items: [],
    createdAt: "2026-01-01T00:00:00Z",
    logCount: 0,
  };
}

const TODAY = new Date(2026, 6, 7); // 2026-07-07 (local)
const TODAY_KEY = "2026-07-07";

describe("useTodayUsualMealHint", () => {
  beforeEach(async () => {
    trackMock.mockClear();
    await AsyncStorage.clear();
  });

  it("derives savedMealSlots from hostSavedMeals' defaultMealSlot", () => {
    const hostSavedMeals = [savedMeal("s1", "Breakfast"), savedMeal("s2", "Dinner"), savedMeal("s3")];
    const { result } = renderHook(() =>
      useTodayUsualMealHint({ byDay: {}, selectedDate: TODAY, hostSavedMeals }),
    );
    expect(result.current.savedMealSlots).toEqual(new Set(["Breakfast", "Dinner"]));
  });

  it("shows the hint when >=2 items are logged in a slot today and fires usual_meal_hint_shown once", async () => {
    const byDay: ByDay = {
      [TODAY_KEY]: [
        meal("Lunch", "Chicken bowl", 500),
        meal("Lunch", "Chicken bowl", 500),
      ],
    };
    const { result } = renderHook(() =>
      useTodayUsualMealHint({ byDay, selectedDate: TODAY, hostSavedMeals: [] }),
    );

    await waitFor(() => expect(result.current.hintVisibleForSlot("Lunch")).toBe(true));
    expect(trackMock).toHaveBeenCalledWith("usual_meal_hint_shown", { slot: "Lunch" });
    expect(trackMock).toHaveBeenCalledTimes(1);
  });

  it("hides the hint for a slot with a matching saved meal default slot", () => {
    const byDay: ByDay = {
      [TODAY_KEY]: [meal("Lunch", "A", 100), meal("Lunch", "B", 200)],
    };
    const { result } = renderHook(() =>
      useTodayUsualMealHint({
        byDay,
        selectedDate: TODAY,
        hostSavedMeals: [savedMeal("s1", "Lunch")],
      }),
    );
    expect(result.current.hintVisibleForSlot("Lunch")).toBe(false);
  });

  it("hides the hint for an invalid slot without throwing", async () => {
    const { result } = renderHook(() =>
      useTodayUsualMealHint({ byDay: {}, selectedDate: TODAY, hostSavedMeals: [] }),
    );
    expect(result.current.hintVisibleForSlot("NotASlot")).toBe(false);
    await act(async () => {
      await Promise.resolve();
    });
  });

  it("dismissUsualMealHint persists the slot and hides the hint afterwards, firing usual_meal_hint_dismissed", async () => {
    const byDay: ByDay = {
      [TODAY_KEY]: [meal("Snacks", "A", 100), meal("Snacks", "B", 200)],
    };
    const { result } = renderHook(() =>
      useTodayUsualMealHint({ byDay, selectedDate: TODAY, hostSavedMeals: [] }),
    );
    await waitFor(() => expect(result.current.hintVisibleForSlot("Snacks")).toBe(true));

    act(() => {
      result.current.dismissUsualMealHint("Snacks");
    });

    expect(result.current.hintVisibleForSlot("Snacks")).toBe(false);
    expect(trackMock).toHaveBeenCalledWith("usual_meal_hint_dismissed", { slot: "Snacks" });

    const stored = await AsyncStorage.getItem("suppr-usual-meal-hint-dismissed-v1");
    expect(stored).toBe("Snacks");
  });

  it("dismissUsualMealHint no-ops for an invalid slot (no persist, no analytics)", async () => {
    const { result } = renderHook(() =>
      useTodayUsualMealHint({ byDay: {}, selectedDate: TODAY, hostSavedMeals: [] }),
    );
    act(() => {
      result.current.dismissUsualMealHint("NotASlot");
    });
    expect(trackMock).not.toHaveBeenCalledWith(
      "usual_meal_hint_dismissed",
      expect.anything(),
    );
    const stored = await AsyncStorage.getItem("suppr-usual-meal-hint-dismissed-v1");
    expect(stored).toBeNull();
    await act(async () => {
      await Promise.resolve();
    });
  });

  it("respects a previously-dismissed slot hydrated from AsyncStorage, once hydration settles", async () => {
    await AsyncStorage.setItem("suppr-usual-meal-hint-dismissed-v1", "Lunch");
    const byDay: ByDay = {
      [TODAY_KEY]: [meal("Lunch", "A", 100), meal("Lunch", "B", 200)],
    };
    const { result } = renderHook(() =>
      useTodayUsualMealHint({ byDay, selectedDate: TODAY, hostSavedMeals: [] }),
    );

    // Behaviour-preserving pin (unchanged from pre-extraction TodayScreen):
    // the dismissed-slots hydrate is async, so `hintVisibleForSlot` reads
    // an empty dismissed-set on the very first render/effect pass — the
    // hook settles to "hidden" only once AsyncStorage resolves.
    await waitFor(() => expect(result.current.hintVisibleForSlot("Lunch")).toBe(false));
  });
});
