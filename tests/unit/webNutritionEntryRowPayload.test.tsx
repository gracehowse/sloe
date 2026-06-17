import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
// React import keeps the JSX runtime happy even though this file tests a
// hook, not JSX — parity with `nutritionJournalBulkInsert.test.tsx`.
void React;

/**
 * ENG-1124 — web `nutrition_entries` write-payload coverage.
 *
 * The web `buildNutritionEntryRow` (src/context/appData/useNutritionJournalState.ts)
 * had NO direct payload test, while mobile is covered by
 * `apps/mobile/tests/unit/nutritionEntryRowPersistence.test.ts`. This pins the
 * single-meal insert row shape so the web builder can't silently drift from
 * the columns `nutrition_entries` expects — or from the mobile builder.
 *
 * NOTE (ENG-1124): the web builder deliberately uses `id: meal.id` (no
 * re-mint) and a different arg order than mobile's. Do NOT consolidate the
 * two builders — a blind merge would change web behaviour. This test guards
 * the *shape*, not a shared implementation.
 *
 * Mock harness mirrors `nutritionJournalBulkInsert.test.tsx`.
 */

const insertCalls: Array<{ rows: unknown }> = [];

function resetFakes() {
  insertCalls.length = 0;
}

vi.mock("../../src/lib/supabase/browserClient.ts", () => ({
  supabase: {
    from: (_table: string) => ({
      select: (_cols?: string) => {
        const result = Promise.resolve({ data: [], error: null });
        const chain: any = {
          limit: () => result,
          eq: () => chain,
          order: () => result,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        };
        return chain;
      },
      insert: (rows: unknown) => {
        insertCalls.push({ rows });
        return Promise.resolve({ error: null });
      },
      upsert: () => Promise.resolve({ error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: () => {},
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
import type { LoggedMeal } from "../../src/types/recipe";

function setup() {
  return renderHook(() =>
    useNutritionJournalState({
      authedUserId: "user-1",
      initialByDay: {},
      selectedDateKey: "2026-06-16",
    }),
  );
}

const baseMeal: Omit<LoggedMeal, "id"> = {
  name: "Chicken salad",
  recipeTitle: "Chicken salad",
  time: "Lunch",
  calories: 420,
  protein: 38,
  carbs: 20,
  fat: 18,
  source: "manual",
};

const NUTRITION_ENTRY_COLUMNS = [
  "id",
  "user_id",
  "date_key",
  "name",
  "recipe_title",
  "time_label",
  "calories",
  "protein",
  "carbs",
  "fat",
  "fiber_g",
  "water_ml",
  "portion_multiplier",
  "nutrition_micros",
  "source",
  "recipe_id",
  "eaten_at",
] as const;

describe("ENG-1124 — web buildNutritionEntryRow single-meal payload", () => {
  beforeEach(resetFakes);
  afterEach(() => vi.clearAllMocks());

  it("writes a single-row object carrying the full nutrition_entries column set", async () => {
    const { result } = setup();
    let returnedId = "";
    await act(async () => {
      returnedId = result.current.addLoggedMealForDate("2026-06-16", {
        ...baseMeal,
        fiberG: 7,
      });
    });

    expect(insertCalls).toHaveLength(1);
    const row = insertCalls[0]!.rows as Record<string, unknown>;

    // Single-meal path is an object insert, never the bulk array.
    expect(Array.isArray(row)).toBe(false);
    // id is the id the call returned — NOT re-minted (deliberate web behaviour).
    expect(row.id).toBe(returnedId);

    expect(row).toMatchObject({
      user_id: "user-1",
      date_key: "2026-06-16",
      name: "Chicken salad",
      recipe_title: "Chicken salad",
      time_label: "Lunch",
      calories: 420,
      protein: 38,
      carbs: 20,
      fat: 18,
      fiber_g: 7,
      portion_multiplier: 1,
    });

    // Every column the table expects is present — drift guard vs the mobile builder.
    for (const col of NUTRITION_ENTRY_COLUMNS) {
      expect(row).toHaveProperty(col);
    }
    expect(row.date_key).toBe("2026-06-16");
    // A fresh manual log anchors on date_key; eaten_at (the optional precise
    // timestamp) is null until explicitly set — column presence is asserted
    // by the NUTRITION_ENTRY_COLUMNS loop above, value is path-dependent.
    expect(row.source).toBe("manual");
  });

  it("defaults optional fields safely (no micros → {}, no recipe → null, no fiber/water → null)", async () => {
    const { result } = setup();
    await act(async () => {
      result.current.addLoggedMealForDate("2026-06-16", baseMeal);
    });

    const row = insertCalls[0]!.rows as Record<string, unknown>;
    expect(row.nutrition_micros).toEqual({});
    expect(row.recipe_id).toBeNull();
    expect(row.fiber_g).toBeNull();
    expect(row.water_ml).toBeNull();
    expect(row.portion_multiplier).toBe(1);
  });

  it("persists recipe_id and non-empty nutrition_micros when present", async () => {
    const micros = { caffeineMg: 95 };
    const { result } = setup();
    await act(async () => {
      result.current.addLoggedMealForDate("2026-06-16", {
        ...baseMeal,
        recipeId: "rec-123",
        micros,
      });
    });

    const row = insertCalls[0]!.rows as Record<string, unknown>;
    expect(row.recipe_id).toBe("rec-123");
    expect(row.nutrition_micros).toEqual(micros);
  });

  it("derives date_key from eaten_at, not the selected anchor day (data-loss guard)", async () => {
    // The ~25-day journal-data-loss class this ticket guards is a write path
    // that hard-codes date_key to the selected day and ignores eaten_at. Log
    // onto the 2026-06-16 anchor a meal eaten at noon UTC on 2026-06-14.
    const { result } = setup();
    await act(async () => {
      result.current.addLoggedMealForDate("2026-06-16", {
        ...baseMeal,
        eatenAt: "2026-06-14T12:00:00.000Z",
      });
    });

    const row = insertCalls[0]!.rows as Record<string, unknown>;
    // date_key follows eaten_at's day, NOT the selected anchor (2026-06-16).
    expect(row.date_key).not.toBe("2026-06-16");
    expect(row.date_key).toBe("2026-06-14");
    expect(String(row.eaten_at)).toContain("2026-06-14");
  });
});
