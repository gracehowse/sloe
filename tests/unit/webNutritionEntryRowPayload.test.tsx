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
 * single-meal write row shape so the web builder can't silently drift from
 * the columns `nutrition_entries` expects — or from the mobile builder.
 *
 * NOTE (ENG-1124): the web builder deliberately uses `id: meal.id` (no
 * re-mint) and a different arg order than mobile's. Do NOT consolidate the
 * two builders — a blind merge would change web behaviour. This test guards
 * the *shape*, not a shared implementation.
 *
 * ENG-1466 (2026-07-06) — the durable write now goes through
 * `useWebJournalWriteAhead`'s write-ahead `.upsert(rows, {onConflict: "id"})`
 * (table-aware: only `nutrition_entries` calls are recorded, mirroring
 * `nutritionJournalBulkInsert.test.tsx`'s updated harness) instead of a bare
 * `.insert()`. `addLoggedMealForDate` fires the write fire-and-forget, so
 * each `act` flushes a couple of microtask turns before asserting.
 */

const writeCalls: Array<{ rows: unknown }> = [];

function resetFakes() {
  writeCalls.length = 0;
}

vi.mock("../../src/lib/supabase/browserClient.ts", () => ({
  supabase: {
    from: (table: string) => ({
      select: (_cols?: string) => {
        const result = Promise.resolve({ data: [], error: null });
        const chain: any = {
          limit: () => result,
          eq: () => chain,
          // ENG-1290 — the boot load windows on `.gte("date_key", …)`.
          gte: () => chain,
          order: () => result,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        };
        return chain;
      },
      upsert: (rows: unknown, _opts?: unknown) => {
        if (table === "nutrition_entries") writeCalls.push({ rows });
        return Promise.resolve({ error: null });
      },
      insert: (rows: unknown) => {
        if (table === "nutrition_entries") writeCalls.push({ rows });
        return Promise.resolve({ error: null });
      },
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: () => {},
  isFeatureEnabled: () => false,
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

/** `addLoggedMealForDate` fires its write-ahead write fire-and-forget (the
 *  call itself returns the new id synchronously) — flush a couple of
 *  microtask turns so the mocked (immediately-resolving) upsert settles
 *  before assertions read `writeCalls`. */
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("ENG-1124 — web buildNutritionEntryRow single-meal payload", () => {
  beforeEach(() => {
    resetFakes();
    // ENG-1466 — write-ahead persists to real jsdom localStorage.
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("write-aheads a single-row-array batch carrying the full nutrition_entries column set", async () => {
    const { result } = setup();
    let returnedId = "";
    await act(async () => {
      returnedId = result.current.addLoggedMealForDate("2026-06-16", {
        ...baseMeal,
        fiberG: 7,
      });
      await flushMicrotasks();
    });

    expect(writeCalls).toHaveLength(1);
    // ENG-1466 — write-ahead always upserts a ROW ARRAY (mirrors mobile's
    // `writeAhead` contract), even for a single manual log.
    const rows = writeCalls[0]!.rows as Array<Record<string, unknown>>;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
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
      await flushMicrotasks();
    });

    const row = (writeCalls[0]!.rows as Array<Record<string, unknown>>)[0]!;
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
      await flushMicrotasks();
    });

    const row = (writeCalls[0]!.rows as Array<Record<string, unknown>>)[0]!;
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
      await flushMicrotasks();
    });

    const row = (writeCalls[0]!.rows as Array<Record<string, unknown>>)[0]!;
    // date_key follows eaten_at's day, NOT the selected anchor (2026-06-16).
    expect(row.date_key).not.toBe("2026-06-16");
    expect(row.date_key).toBe("2026-06-14");
    expect(String(row.eaten_at)).toContain("2026-06-14");
  });
});
