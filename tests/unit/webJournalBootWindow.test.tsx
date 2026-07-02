import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
// React import above keeps the JSX runtime happy even though this file
// tests hooks, not JSX — parity with `nutritionJournalBulkInsert.test.tsx`.
void React;

/**
 * ENG-1290 — 35-day boot window on the web nutrition journal load
 * (mobile parity with ENG-542).
 *
 * Pins three behaviours of `useNutritionJournalState`:
 *  1. the boot query carries `.gte("date_key", <35-day window start>)`
 *     so the whole history is never loaded on boot;
 *  2. navigating to a day OLDER than the window triggers a targeted
 *     single-day fetch (`.eq("date_key", <day>)`) and merges the rows,
 *     so historical browsing (calendar jumps up to 1095 days back) is
 *     not regressed — and the same day is not refetched on revisit;
 *  3. navigating within the window triggers NO extra fetch.
 *
 * Fakes mirror `nutritionJournalBulkInsert.test.tsx`: the Supabase
 * browser client records every select-chain filter; side-effect libs
 * are stubbed.
 */

type RecordedQuery = {
  table: string;
  filters: Array<{ op: "eq" | "gte"; col: string; val: unknown }>;
};
const selectQueries: RecordedQuery[] = [];

/** Rows returned per `date_key` eq-filter; boot query returns `bootRows`. */
let bootRows: Array<Record<string, unknown>> = [];
let rowsByDateKey: Record<string, Array<Record<string, unknown>>> = {};

function resetFakes() {
  selectQueries.length = 0;
  bootRows = [];
  rowsByDateKey = {};
}

vi.mock("../../src/lib/supabase/browserClient.ts", () => ({
  supabase: {
    from: (table: string) => ({
      select: (_cols?: string) => {
        const query: RecordedQuery = { table, filters: [] };
        selectQueries.push(query);
        const resolveRows = () => {
          const dateKeyEq = query.filters.find(
            (f) => f.op === "eq" && f.col === "date_key",
          );
          if (dateKeyEq) {
            return rowsByDateKey[String(dateKeyEq.val)] ?? [];
          }
          return bootRows;
        };
        const chain: any = {
          eq: (col: string, val: unknown) => {
            query.filters.push({ op: "eq", col, val });
            return chain;
          },
          gte: (col: string, val: unknown) => {
            query.filters.push({ op: "gte", col, val });
            return chain;
          },
          order: () => Promise.resolve({ data: resolveRows(), error: null }),
          limit: () => Promise.resolve({ data: [], error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        };
        return chain;
      },
      insert: () => Promise.resolve({ error: null }),
      upsert: () => Promise.resolve({ error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

vi.mock("../../src/lib/analytics/track.ts", () => ({ track: vi.fn() }));

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
import {
  JOURNAL_BOOT_WINDOW_DAYS,
  journalBootWindowStartKey,
} from "../../src/lib/nutrition/journalWindow";

/** A `nutrition_entries` row as the select column list returns it. */
function dbRow(dateKey: string, id: string): Record<string, unknown> {
  return {
    id,
    date_key: dateKey,
    name: "Historic meal",
    recipe_title: "Historic meal",
    time_label: "Lunch",
    calories: 500,
    protein: 30,
    carbs: 45,
    fat: 20,
    fiber_g: 6,
    water_ml: null,
    portion_multiplier: 1,
    source: "manual",
    nutrition_micros: null,
    recipe_id: null,
    eaten_at: `${dateKey}T12:00:00.000Z`,
    created_at: `${dateKey}T12:00:00.000Z`,
  };
}

/** Date key `daysBack` days before the boot window start (out of window). */
function keyBeforeWindow(daysBack: number): string {
  const start = new Date(`${journalBootWindowStartKey()}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - daysBack);
  return start.toISOString().slice(0, 10);
}

const entriesQueries = () =>
  selectQueries.filter((q) => q.table === "nutrition_entries");
const bootQueries = () =>
  entriesQueries().filter(
    (q) =>
      q.filters.some((f) => f.op === "eq" && f.col === "user_id") &&
      !q.filters.some((f) => f.op === "eq" && f.col === "date_key"),
  );
const dayFetchQueries = () =>
  entriesQueries().filter((q) =>
    q.filters.some((f) => f.op === "eq" && f.col === "date_key"),
  );

describe("useNutritionJournalState boot window (ENG-1290)", () => {
  beforeEach(() => resetFakes());
  afterEach(() => vi.clearAllMocks());

  it("journalBootWindowStartKey mirrors the mobile ENG-542 computation (UTC, 35 days)", () => {
    expect(JOURNAL_BOOT_WINDOW_DAYS).toBe(35);
    // 2026-07-01 minus 35 days = 2026-05-27, regardless of time of day.
    expect(journalBootWindowStartKey(new Date("2026-07-01T10:30:00.000Z"))).toBe(
      "2026-05-27",
    );
    expect(journalBootWindowStartKey(new Date("2026-07-01T23:59:59.000Z"))).toBe(
      "2026-05-27",
    );
  });

  it("boot load carries the 35-day date_key window (no full-history query)", async () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    renderHook(() =>
      useNutritionJournalState({
        authedUserId: "user-1",
        initialByDay: {},
        selectedDateKey: todayKey,
      }),
    );
    await act(async () => {});

    const boots = bootQueries().filter((q) =>
      q.filters.some((f) => f.op === "gte" && f.col === "date_key"),
    );
    expect(boots.length).toBeGreaterThanOrEqual(1);
    const gte = boots[0]!.filters.find(
      (f) => f.op === "gte" && f.col === "date_key",
    )!;
    expect(gte.val).toBe(journalBootWindowStartKey());
    // No unwindowed user-scoped read of nutrition_entries remains.
    const unwindowed = bootQueries().filter(
      (q) => !q.filters.some((f) => f.op === "gte" && f.col === "date_key"),
    );
    expect(unwindowed).toHaveLength(0);
  });

  it("navigating to an out-of-window day fetches that single day and merges it", async () => {
    const oldKey = keyBeforeWindow(200);
    rowsByDateKey[oldKey] = [dbRow(oldKey, "hist-1"), dbRow(oldKey, "hist-2")];
    const todayKey = new Date().toISOString().slice(0, 10);

    const { result, rerender } = renderHook(
      ({ selectedDateKey }: { selectedDateKey: string }) =>
        useNutritionJournalState({
          authedUserId: "user-1",
          initialByDay: {},
          selectedDateKey,
        }),
      { initialProps: { selectedDateKey: todayKey } },
    );
    await act(async () => {});
    expect(dayFetchQueries()).toHaveLength(0);

    rerender({ selectedDateKey: oldKey });
    await act(async () => {});

    const dayFetches = dayFetchQueries();
    expect(dayFetches).toHaveLength(1);
    expect(dayFetches[0]!.filters).toContainEqual({
      op: "eq",
      col: "date_key",
      val: oldKey,
    });
    expect(dayFetches[0]!.filters).toContainEqual({
      op: "eq",
      col: "user_id",
      val: "user-1",
    });
    // The fetched rows land in the in-memory journal for that day.
    expect(result.current.nutritionByDay[oldKey]?.map((m) => m.id)).toEqual([
      "hist-1",
      "hist-2",
    ]);
  });

  it("does not refetch the same out-of-window day on revisit", async () => {
    const oldKey = keyBeforeWindow(90);
    rowsByDateKey[oldKey] = [dbRow(oldKey, "hist-1")];
    const todayKey = new Date().toISOString().slice(0, 10);

    const { rerender } = renderHook(
      ({ selectedDateKey }: { selectedDateKey: string }) =>
        useNutritionJournalState({
          authedUserId: "user-1",
          initialByDay: {},
          selectedDateKey,
        }),
      { initialProps: { selectedDateKey: todayKey } },
    );
    await act(async () => {});

    rerender({ selectedDateKey: oldKey });
    await act(async () => {});
    rerender({ selectedDateKey: todayKey });
    await act(async () => {});
    rerender({ selectedDateKey: oldKey });
    await act(async () => {});

    expect(dayFetchQueries()).toHaveLength(1);
  });

  it("in-window day navigation triggers no targeted fetch", async () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    // Yesterday is always inside a 35-day window.
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);

    const { rerender } = renderHook(
      ({ selectedDateKey }: { selectedDateKey: string }) =>
        useNutritionJournalState({
          authedUserId: "user-1",
          initialByDay: {},
          selectedDateKey,
        }),
      { initialProps: { selectedDateKey: todayKey } },
    );
    await act(async () => {});
    rerender({ selectedDateKey: yesterdayKey });
    await act(async () => {});

    expect(dayFetchQueries()).toHaveLength(0);
  });

  it("boot rows still merge into the journal with the window applied", async () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    bootRows = [dbRow(todayKey, "boot-1")];
    const { result } = renderHook(() =>
      useNutritionJournalState({
        authedUserId: "user-1",
        initialByDay: {},
        selectedDateKey: todayKey,
      }),
    );
    await act(async () => {});
    expect(result.current.nutritionByDay[todayKey]?.map((m) => m.id)).toEqual([
      "boot-1",
    ]);
  });
});
