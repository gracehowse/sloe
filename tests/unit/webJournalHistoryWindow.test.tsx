import * as React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
// React import above keeps the JSX runtime happy even though this file
// tests hooks, not JSX — parity with `webJournalBootWindow.test.tsx`.
void React;

/**
 * ENG-1324 — 90-day history window for the web Progress / Profile surfaces.
 *
 * The boot load carries only 35 days (ENG-1290); Progress, Profile, and the
 * streak metric detail compute streaks / period stats / milestones from the
 * shared context `nutritionByDay`, so on a fresh device they silently
 * under-counted anything older. Mobile Progress fetches its own 90-day
 * `nutrition_entries` slice on focus; web now mirrors that via
 * `ensureJournalHistory` + the `useNutritionHistoryWindow` mount hook.
 *
 * Pins:
 *  1. the helper computes a 90-day UTC window start (the mobile Progress cap
 *     — 90d is the hard fetch cap there regardless of the M/6M/Y selector);
 *  2. `ensureJournalHistory` issues ONE widened `.gte("date_key", …)` fetch
 *     and merges the rows into the journal;
 *  3. repeat requests for a covered window do not refetch;
 *  4. a failed fetch leaves the guard unset so the next request retries;
 *  5. requests already covered by the boot window are no-ops;
 *  6. a plain mount (Today boot) is unchanged — only the 35-day boot query;
 *  7. `useNutritionHistoryWindow` asks the context for exactly the 90-day key;
 *  8. Progress / Profile / streak-detail all mount the hook (source-level pin,
 *     same pattern as `foodLoggedSourceParity`).
 */

type RecordedQuery = {
  table: string;
  filters: Array<{ op: "eq" | "gte"; col: string; val: unknown }>;
};
const selectQueries: RecordedQuery[] = [];

/** Rows returned per `.gte("date_key", <val>)` window start. */
let rowsByGteStart: Record<string, Array<Record<string, unknown>>> = {};
/** When set, the NEXT windowed select resolves with this error, then clears. */
let nextGteError: { message: string } | null = null;

function resetFakes() {
  selectQueries.length = 0;
  rowsByGteStart = {};
  nextGteError = null;
}

vi.mock("../../src/lib/supabase/browserClient.ts", () => ({
  supabase: {
    from: (table: string) => ({
      select: (_cols?: string) => {
        const query: RecordedQuery = { table, filters: [] };
        selectQueries.push(query);
        const resolveResult = () => {
          const gte = query.filters.find(
            (f) => f.op === "gte" && f.col === "date_key",
          );
          if (gte && nextGteError) {
            const error = nextGteError;
            nextGteError = null;
            return { data: null, error };
          }
          if (gte) {
            return { data: rowsByGteStart[String(gte.val)] ?? [], error: null };
          }
          return { data: [], error: null };
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
          order: () => Promise.resolve(resolveResult()),
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
  JOURNAL_HISTORY_WINDOW_DAYS,
  journalBootWindowStartKey,
  journalHistoryWindowStartKey,
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
function keyBeforeBootWindow(daysBack: number): string {
  const start = new Date(`${journalBootWindowStartKey()}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - daysBack);
  return start.toISOString().slice(0, 10);
}

const entriesQueries = () =>
  selectQueries.filter((q) => q.table === "nutrition_entries");
const windowedQueries = () =>
  entriesQueries().filter((q) =>
    q.filters.some((f) => f.op === "gte" && f.col === "date_key"),
  );
const historyQueries = () =>
  windowedQueries().filter((q) =>
    q.filters.some(
      (f) =>
        f.op === "gte" &&
        f.col === "date_key" &&
        String(f.val) < journalBootWindowStartKey(),
    ),
  );

function mountJournal() {
  const todayKey = new Date().toISOString().slice(0, 10);
  return renderHook(() =>
    useNutritionJournalState({
      authedUserId: "user-1",
      initialByDay: {},
      selectedDateKey: todayKey,
    }),
  );
}

describe("journalHistoryWindowStartKey (ENG-1324)", () => {
  it("computes a 90-day UTC window mirroring the mobile Progress fetch cap", () => {
    expect(JOURNAL_HISTORY_WINDOW_DAYS).toBe(90);
    expect(JOURNAL_HISTORY_WINDOW_DAYS).toBeGreaterThan(JOURNAL_BOOT_WINDOW_DAYS);
    // 2026-07-01 minus 90 days = 2026-04-02, regardless of time of day.
    expect(
      journalHistoryWindowStartKey(new Date("2026-07-01T10:30:00.000Z")),
    ).toBe("2026-04-02");
    expect(
      journalHistoryWindowStartKey(new Date("2026-07-01T23:59:59.000Z")),
    ).toBe("2026-04-02");
  });
});

describe("useNutritionJournalState ensureJournalHistory (ENG-1324)", () => {
  beforeEach(() => resetFakes());
  afterEach(() => vi.clearAllMocks());

  it("plain mount (Today boot) fetches only the 35-day boot window — no history query", async () => {
    mountJournal();
    await act(async () => {});

    expect(windowedQueries()).toHaveLength(1);
    const gte = windowedQueries()[0]!.filters.find(
      (f) => f.op === "gte" && f.col === "date_key",
    )!;
    expect(gte.val).toBe(journalBootWindowStartKey());
    expect(historyQueries()).toHaveLength(0);
  });

  it("widens the journal with one 90-day fetch and merges out-of-window rows", async () => {
    const historyKey = journalHistoryWindowStartKey();
    const oldDay = keyBeforeBootWindow(10);
    rowsByGteStart[historyKey] = [dbRow(oldDay, "hist-1"), dbRow(oldDay, "hist-2")];

    const { result } = mountJournal();
    await act(async () => {});

    await act(async () => {
      void result.current.ensureJournalHistory(historyKey);
    });

    const history = historyQueries();
    expect(history).toHaveLength(1);
    expect(history[0]!.filters).toContainEqual({
      op: "gte",
      col: "date_key",
      val: historyKey,
    });
    expect(history[0]!.filters).toContainEqual({
      op: "eq",
      col: "user_id",
      val: "user-1",
    });
    expect(result.current.nutritionByDay[oldDay]?.map((m) => m.id)).toEqual([
      "hist-1",
      "hist-2",
    ]);
  });

  it("does not refetch a window that has already been fetched", async () => {
    const historyKey = journalHistoryWindowStartKey();
    const { result } = mountJournal();
    await act(async () => {});

    await act(async () => {
      void result.current.ensureJournalHistory(historyKey);
    });
    await act(async () => {
      void result.current.ensureJournalHistory(historyKey);
    });

    expect(historyQueries()).toHaveLength(1);
  });

  it("retries after a failed history fetch (guard stays unset on error)", async () => {
    const historyKey = journalHistoryWindowStartKey();
    const oldDay = keyBeforeBootWindow(5);
    rowsByGteStart[historyKey] = [dbRow(oldDay, "hist-1")];

    const { result } = mountJournal();
    await act(async () => {});

    nextGteError = { message: "boom" };
    await act(async () => {
      void result.current.ensureJournalHistory(historyKey);
    });
    expect(result.current.nutritionByDay[oldDay]).toBeUndefined();

    await act(async () => {
      void result.current.ensureJournalHistory(historyKey);
    });
    expect(historyQueries()).toHaveLength(2);
    expect(result.current.nutritionByDay[oldDay]?.map((m) => m.id)).toEqual([
      "hist-1",
    ]);
  });

  it("is a no-op when the requested start is already inside the boot window", async () => {
    const { result } = mountJournal();
    await act(async () => {});

    await act(async () => {
      void result.current.ensureJournalHistory(journalBootWindowStartKey());
    });

    // Only the boot query — no second windowed fetch of any kind.
    expect(windowedQueries()).toHaveLength(1);
  });

  it("history merge preserves rows already in the journal (optimistic + boot rows)", async () => {
    const historyKey = journalHistoryWindowStartKey();
    const todayKey = new Date().toISOString().slice(0, 10);
    const oldDay = keyBeforeBootWindow(3);
    rowsByGteStart[journalBootWindowStartKey()] = [dbRow(todayKey, "boot-1")];
    rowsByGteStart[historyKey] = [dbRow(oldDay, "hist-1")];

    const { result } = mountJournal();
    await act(async () => {});
    expect(result.current.nutritionByDay[todayKey]?.map((m) => m.id)).toEqual([
      "boot-1",
    ]);

    await act(async () => {
      void result.current.ensureJournalHistory(historyKey);
    });

    // Boot-loaded rows survive the widened merge; history rows land.
    expect(result.current.nutritionByDay[todayKey]?.map((m) => m.id)).toEqual([
      "boot-1",
    ]);
    expect(result.current.nutritionByDay[oldDay]?.map((m) => m.id)).toEqual([
      "hist-1",
    ]);
  });
});

describe("useNutritionHistoryWindow (ENG-1324)", () => {
  it("asks the context for exactly the 90-day history key on mount", async () => {
    const ensureNutritionHistory = vi.fn();
    vi.doMock("../../src/context/AppDataContext.tsx", () => ({
      useAppData: () => ({ ensureNutritionHistory }),
    }));
    const { useNutritionHistoryWindow } = await import(
      "../../src/hooks/useNutritionHistoryWindow.ts"
    );

    renderHook(() => useNutritionHistoryWindow());

    expect(ensureNutritionHistory).toHaveBeenCalledTimes(1);
    expect(ensureNutritionHistory).toHaveBeenCalledWith(
      journalHistoryWindowStartKey(),
    );
    vi.doUnmock("../../src/context/AppDataContext.tsx");
  });
});

describe("history-window mount coverage (ENG-1324, source-level pin)", () => {
  // Same grep-level pattern as `foodLoggedSourceParity.test.ts`: every web
  // surface whose stats look past the boot window must mount the hook.
  const surfaces = [
    "src/app/components/ProgressDashboard.tsx",
    "src/app/components/Profile.tsx",
    "src/app/components/ProgressMetricDetail.tsx",
  ];

  it.each(surfaces)("%s mounts useNutritionHistoryWindow()", (rel) => {
    const source = readFileSync(resolve(__dirname, "../..", rel), "utf8");
    expect(source).toMatch(/useNutritionHistoryWindow\(\)/);
  });
});
