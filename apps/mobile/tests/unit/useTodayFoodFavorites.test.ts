/**
 * ENG-1361 (round 2) — behaviour tests for `useTodayFoodFavorites`, the
 * favourites-in-search state (list load + optimistic toggle-with-rollback)
 * extracted from `TodayScreen.tsx`.
 */
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTodayFoodFavorites } from "../../hooks/useTodayFoodFavorites";

const listFavoritesMock = vi.fn();
const addFavoriteMock = vi.fn();
const removeFavoriteMock = vi.fn();
const alertMock = vi.fn();
const showSignInAlertMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {},
}));

vi.mock("@/lib/authAlertCopy", () => ({
  showSignInAlert: (...args: unknown[]) => showSignInAlertMock(...args),
}));

vi.mock("react-native", async () => {
  const actual = await vi.importActual<typeof import("react-native")>("react-native");
  return {
    ...actual,
    Alert: { alert: (...args: unknown[]) => alertMock(...args) },
  };
});

vi.mock("@suppr/nutrition-core/favoriteFoods", () => ({
  favoriteKey: (title: string, calories: number) =>
    `${title.trim().toLowerCase()}|${Math.round(calories)}`,
  listFavorites: (...args: unknown[]) => listFavoritesMock(...args),
  addFavorite: (...args: unknown[]) => addFavoriteMock(...args),
  removeFavorite: (...args: unknown[]) => removeFavoriteMock(...args),
}));

const FOOD = {
  recipeTitle: "Greek Yoghurt",
  calories: 120,
  protein: 15,
  carbs: 8,
  fat: 2,
};

describe("useTodayFoodFavorites", () => {
  beforeEach(() => {
    listFavoritesMock.mockReset().mockResolvedValue([]);
    addFavoriteMock.mockReset();
    removeFavoriteMock.mockReset();
    alertMock.mockReset();
    showSignInAlertMock.mockReset();
  });

  it("loads the favourites list once a userId resolves", async () => {
    listFavoritesMock.mockResolvedValueOnce([
      { id: "f1", recipeTitle: "Oats", calories: 200, protein: 8, carbs: 30, fat: 4, count: 1, createdAt: "2026-01-01" },
    ]);
    const { result } = renderHook(() => useTodayFoodFavorites({ userId: "u1" }));

    await waitFor(() => expect(result.current.hostFavorites).toHaveLength(1));
    expect(listFavoritesMock).toHaveBeenCalledWith({}, "u1");
    expect(result.current.hostFavorites[0].recipeTitle).toBe("Oats");
  });

  it("clears the list when userId is absent (logged out)", async () => {
    const { result } = renderHook(() => useTodayFoodFavorites({ userId: undefined }));
    expect(result.current.hostFavorites).toEqual([]);
    expect(listFavoritesMock).not.toHaveBeenCalled();
  });

  it("shows the sign-in alert instead of toggling when userId is missing", async () => {
    const { result } = renderHook(() => useTodayFoodFavorites({ userId: undefined }));
    await act(async () => {
      await result.current.toggleFoodFavorite(FOOD);
    });
    expect(showSignInAlertMock).toHaveBeenCalledWith("save favourites");
    expect(addFavoriteMock).not.toHaveBeenCalled();
  });

  it("optimistically adds a favourite, then reconciles with the persisted row", async () => {
    addFavoriteMock.mockResolvedValueOnce({
      id: "real-1",
      recipeTitle: FOOD.recipeTitle,
      calories: FOOD.calories,
      protein: FOOD.protein,
      carbs: FOOD.carbs,
      fat: FOOD.fat,
      count: 1,
      createdAt: "2026-07-07T00:00:00Z",
    });
    const { result } = renderHook(() => useTodayFoodFavorites({ userId: "u1" }));
    await waitFor(() => expect(listFavoritesMock).toHaveBeenCalled());

    await act(async () => {
      await result.current.toggleFoodFavorite(FOOD);
    });

    expect(addFavoriteMock).toHaveBeenCalledTimes(1);
    expect(result.current.hostFavorites).toHaveLength(1);
    expect(result.current.hostFavorites[0].id).toBe("real-1");
    // Pending key cleared after settling.
    expect(result.current.favoritePendingKeys.size).toBe(0);
  });

  it("rolls back the optimistic add and alerts on persist failure", async () => {
    addFavoriteMock.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useTodayFoodFavorites({ userId: "u1" }));
    await waitFor(() => expect(listFavoritesMock).toHaveBeenCalled());

    await act(async () => {
      await result.current.toggleFoodFavorite(FOOD);
    });

    expect(result.current.hostFavorites).toEqual([]);
    expect(alertMock).toHaveBeenCalledWith(
      "Could not save favourite",
      "Please try again.",
    );
  });

  it("removes an existing favourite and rolls back on failure", async () => {
    listFavoritesMock.mockResolvedValueOnce([
      { id: "fav-1", recipeTitle: FOOD.recipeTitle, calories: FOOD.calories, protein: FOOD.protein, carbs: FOOD.carbs, fat: FOOD.fat, count: 1, createdAt: "2026-01-01" },
    ]);
    removeFavoriteMock.mockRejectedValueOnce(new Error("denied"));
    const { result } = renderHook(() => useTodayFoodFavorites({ userId: "u1" }));
    await waitFor(() => expect(result.current.hostFavorites).toHaveLength(1));

    await act(async () => {
      await result.current.toggleFoodFavorite({ ...FOOD, favoriteId: "fav-1" });
    });

    expect(removeFavoriteMock).toHaveBeenCalledWith({}, "u1", "fav-1");
    // Rolled back to the pre-toggle snapshot (still has the item).
    expect(result.current.hostFavorites).toHaveLength(1);
    expect(alertMock).toHaveBeenCalledWith(
      "Could not remove favourite",
      "Please try again.",
    );
  });

  it("guards double-submit for the same key via favoritePendingKeys", async () => {
    let resolveAdd: (v: unknown) => void = () => {};
    addFavoriteMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAdd = resolve;
        }),
    );
    const { result } = renderHook(() => useTodayFoodFavorites({ userId: "u1" }));
    await waitFor(() => expect(listFavoritesMock).toHaveBeenCalled());

    let firstCallPromise: Promise<void>;
    act(() => {
      firstCallPromise = result.current.toggleFoodFavorite(FOOD);
    });
    await act(async () => {
      // Second tap while the first is still in flight should no-op.
      await result.current.toggleFoodFavorite(FOOD);
    });
    expect(addFavoriteMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAdd({
        id: "real-1",
        recipeTitle: FOOD.recipeTitle,
        calories: FOOD.calories,
        protein: FOOD.protein,
        carbs: FOOD.carbs,
        fat: FOOD.fat,
        count: 1,
        createdAt: "2026-07-07T00:00:00Z",
      });
      await firstCallPromise!;
    });
  });
});
