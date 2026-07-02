import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react-native";

/**
 * ENG-1325 — out-of-window day fetch for the mobile journal (web parity
 * with ENG-1290's effect in `useNutritionJournalState`, pinned by
 * `tests/unit/webJournalBootWindow.test.tsx`).
 *
 * The Today boot load only carries the last 35 days (ENG-542), but the
 * calendar picker can jump up to 1095 days back — those days rendered
 * silently empty. Mirrors the web test suite:
 *  1. navigating to a day OLDER than the boot window triggers a targeted
 *     single-day fetch (`.eq("date_key", <day>)`) and merges the mapped
 *     rows into `byDay`;
 *  2. the same day is not refetched on revisit;
 *  3. in-window navigation triggers NO fetch;
 *  4. a failed fetch retries on the next visit (guard key deleted);
 *  5. the merge preserves optimistic local rows for the fetched day.
 */

type RecordedQuery = {
  table: string;
  filters: Array<{ op: "eq" | "gte"; col: string; val: unknown }>;
};
const selectQueries: RecordedQuery[] = [];

/** Rows returned per `date_key` eq-filter. */
let rowsByDateKey: Record<string, Array<Record<string, unknown>>> = {};
/** When set, the NEXT select resolves with this error, then clears. */
let nextSelectError: { message: string } | null = null;

function resetFakes() {
  selectQueries.length = 0;
  rowsByDateKey = {};
  nextSelectError = null;
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: (_cols?: string) => {
        const query: RecordedQuery = { table, filters: [] };
        selectQueries.push(query);
        const resolveResult = () => {
          if (nextSelectError) {
            const error = nextSelectError;
            nextSelectError = null;
            return { data: null, error };
          }
          const dateKeyEq = query.filters.find(
            (f) => f.op === "eq" && f.col === "date_key",
          );
          if (dateKeyEq) {
            return {
              data: rowsByDateKey[String(dateKeyEq.val)] ?? [],
              error: null,
            };
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
        };
        return chain;
      },
    }),
  },
}));

import { useOutOfWindowJournalDay } from "@/hooks/useOutOfWindowJournalDay";
import { dateKeyFromDate, type ByDay, type JournalMeal } from "@/lib/nutritionJournal";
import { journalBootWindowStartKey } from "@suppr/shared/nutrition/journalWindow";

/** A `nutrition_entries` row as `NUTRITION_ENTRY_SELECT_COLUMNS` returns it. */
function dbRow(dateKey: string, id: string): Record<string, unknown> {
  return {
    id,
    date_key: dateKey,
    name: "Snack", // legacy slot value — mapper must normalise to "Snacks"
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
    created_at: `${dateKey}T12:00:00.000Z`,
    eaten_at: `${dateKey}T12:00:00.000Z`,
    nutrition_micros: { sodiumMg: 120, zero: 0 },
    recipe_id: "recipe-9",
  };
}

/** A local Date `daysBack` days before today (out of window for daysBack > 35). */
function dateDaysBack(daysBack: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d;
}

const dayFetchQueries = () =>
  selectQueries.filter(
    (q) =>
      q.table === "nutrition_entries" &&
      q.filters.some((f) => f.op === "eq" && f.col === "date_key"),
  );

function useHarness(args: { selectedDate: Date; initialByDay?: ByDay }) {
  const [byDay, setByDay] = useState<ByDay>(args.initialByDay ?? {});
  useOutOfWindowJournalDay({ userId: "user-1", selectedDate: args.selectedDate, setByDay });
  return byDay;
}

describe("useOutOfWindowJournalDay (ENG-1325)", () => {
  beforeEach(() => resetFakes());
  afterEach(() => vi.clearAllMocks());

  it("fetches an out-of-window day once and merges the mapped rows", async () => {
    const oldDate = dateDaysBack(200);
    const oldKey = dateKeyFromDate(oldDate);
    expect(oldKey < journalBootWindowStartKey()).toBe(true);
    rowsByDateKey[oldKey] = [dbRow(oldKey, "hist-1"), dbRow(oldKey, "hist-2")];

    const { result, rerender } = renderHook(
      ({ selectedDate }: { selectedDate: Date }) => useHarness({ selectedDate }),
      { initialProps: { selectedDate: new Date() } },
    );
    await act(async () => {});
    expect(dayFetchQueries()).toHaveLength(0);

    rerender({ selectedDate: oldDate });
    await act(async () => {});

    const fetches = dayFetchQueries();
    expect(fetches).toHaveLength(1);
    expect(fetches[0]!.filters).toContainEqual({ op: "eq", col: "date_key", val: oldKey });
    expect(fetches[0]!.filters).toContainEqual({ op: "eq", col: "user_id", val: "user-1" });

    const meals = result.current[oldKey] ?? [];
    expect(meals.map((m: JournalMeal) => m.id)).toEqual(["hist-1", "hist-2"]);
    // Shared read-side mapper (`journalRowToMeal`) semantics hold on this
    // path exactly as on the boot load.
    expect(meals[0]!.name).toBe("Snacks");
    expect(meals[0]!.micros).toEqual({ sodiumMg: 120 });
    expect(meals[0]!.recipeId).toBe("recipe-9");
    expect(meals[0]!.calories).toBe(500);
  });

  it("does not refetch the same out-of-window day on revisit", async () => {
    const oldDate = dateDaysBack(90);
    rowsByDateKey[dateKeyFromDate(oldDate)] = [dbRow(dateKeyFromDate(oldDate), "hist-1")];

    const { rerender } = renderHook(
      ({ selectedDate }: { selectedDate: Date }) => useHarness({ selectedDate }),
      { initialProps: { selectedDate: new Date() } },
    );
    await act(async () => {});

    rerender({ selectedDate: oldDate });
    await act(async () => {});
    rerender({ selectedDate: new Date() });
    await act(async () => {});
    rerender({ selectedDate: oldDate });
    await act(async () => {});

    expect(dayFetchQueries()).toHaveLength(1);
  });

  it("in-window day navigation triggers no fetch", async () => {
    const { rerender } = renderHook(
      ({ selectedDate }: { selectedDate: Date }) => useHarness({ selectedDate }),
      { initialProps: { selectedDate: new Date() } },
    );
    await act(async () => {});
    // Yesterday is always inside a 35-day window.
    rerender({ selectedDate: dateDaysBack(1) });
    await act(async () => {});

    expect(dayFetchQueries()).toHaveLength(0);
  });

  it("retries a failed day fetch on the next visit", async () => {
    const oldDate = dateDaysBack(120);
    const oldKey = dateKeyFromDate(oldDate);
    rowsByDateKey[oldKey] = [dbRow(oldKey, "hist-1")];

    const { result, rerender } = renderHook(
      ({ selectedDate }: { selectedDate: Date }) => useHarness({ selectedDate }),
      { initialProps: { selectedDate: new Date() } },
    );
    await act(async () => {});

    nextSelectError = { message: "boom" };
    rerender({ selectedDate: oldDate });
    await act(async () => {});
    expect(result.current[oldKey]).toBeUndefined();

    // Navigate away and back — the failed key was deleted, so it retries.
    rerender({ selectedDate: new Date() });
    await act(async () => {});
    rerender({ selectedDate: oldDate });
    await act(async () => {});

    expect(dayFetchQueries()).toHaveLength(2);
    expect((result.current[oldKey] ?? []).map((m: JournalMeal) => m.id)).toEqual(["hist-1"]);
  });

  it("merge preserves optimistic local rows for the fetched day", async () => {
    const oldDate = dateDaysBack(60);
    const oldKey = dateKeyFromDate(oldDate);
    rowsByDateKey[oldKey] = [dbRow(oldKey, "hist-1")];
    const optimistic: JournalMeal = {
      id: "optimistic-1",
      name: "Just logged",
      recipeTitle: "Just logged",
      time: "Dinner",
      calories: 300,
      protein: 20,
      carbs: 30,
      fat: 10,
    };

    const { result, rerender } = renderHook(
      ({ selectedDate }: { selectedDate: Date }) =>
        useHarness({ selectedDate, initialByDay: { [oldKey]: [optimistic] } }),
      { initialProps: { selectedDate: new Date() } },
    );
    await act(async () => {});

    rerender({ selectedDate: oldDate });
    await act(async () => {});

    expect((result.current[oldKey] ?? []).map((m: JournalMeal) => m.id)).toEqual([
      "hist-1",
      "optimistic-1",
    ]);
  });
});
