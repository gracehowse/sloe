/**
 * ENG-1048 / ENG-1125 — web journal optimistic UI on persist failure.
 * Inserts queue for retry (keep visible); deletes still roll back.
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

const toastWarning = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    warning: (...args: unknown[]) => toastWarning(...args),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

const enqueueJournalUpserts = vi.fn(() => Promise.resolve());

vi.mock("../../src/lib/nutrition/journalWriteQueue.ts", () => ({
  enqueueJournalUpserts: (...args: unknown[]) => enqueueJournalUpserts(...args),
}));

vi.mock("../../src/lib/nutrition/journalWriteQueueStorage.web.ts", () => ({
  loadJournalWriteQueue: () => Promise.resolve({ entries: [] }),
  saveJournalWriteQueue: () => Promise.resolve(),
}));

vi.mock("../../src/lib/nutrition/flushJournalWriteQueue.ts", () => ({
  flushJournalWriteQueue: () =>
    Promise.resolve({ remaining: { entries: [] }, flushedIds: [], droppedPoisonIds: [], dropQueue: false }),
  reconcileQueueAfterFlush: () => ({ version: 1, entries: [] }),
}));

vi.mock("../../src/context/appData/useRetryEnableDbTable.ts", () => ({
  useRetryEnableDbTable: () => {},
}));

import { useNutritionJournalState } from "../../src/context/appData/useNutritionJournalState";

describe("ENG-1048 / ENG-1125 — web journal optimistic failure handling", () => {
  beforeEach(() => {
    insertShouldFail = false;
    deleteShouldFail = false;
    enqueueJournalUpserts.mockClear();
    toastWarning.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps optimistic insert visible and queues retry when Supabase insert fails", async () => {
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

    expect(result.current.nutritionByDay["2026-06-11"] ?? []).toHaveLength(1);
    expect(result.current.nutritionByDay["2026-06-11"]![0]!.name).toBe(
      "Breakfast",
    );
    expect(enqueueJournalUpserts).toHaveBeenCalled();
    expect(toastWarning).toHaveBeenCalledWith(
      "Saved on this device — we'll sync when you're back online.",
    );
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
