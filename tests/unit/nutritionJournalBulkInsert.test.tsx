import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
// React import above keeps the JSX runtime happy even though this file
// tests hooks, not JSX — parity with `tests/unit/emptyState.test.tsx`.
void React;

/**
 * Bulk insert tests for `useNutritionJournalState` (audit M3, 2026-04-18;
 * write-ahead-ified 2026-07-06, ENG-1466 — web port of mobile's ENG-1447).
 *
 * Verifies that `duplicateDay`, `duplicateDayToDateRange`, and
 * `copyMealToDateRange` call the write-ahead upsert primitive with an
 * **array** rather than looping row-by-row. For a 7-day × 4-meal
 * duplicate, this collapses 28 sequential single-row upserts into 7
 * batched upserts (one per target day), with exactly 1 `food_logged`
 * analytics event for the whole batch.
 *
 * ENG-1466 — every `nutrition_entries` write (single-meal + bulk) now goes
 * through `useWebJournalWriteAhead`'s `writeAhead`, which enqueues to
 * localStorage BEFORE calling `.upsert(rows, { onConflict: "id" })` (was:
 * a bare `.insert()` with no durable-before-attempt guarantee). This suite
 * asserts on the resulting `nutrition_entries` `.upsert()` calls.
 *
 * Fakes:
 *  - `supabase` browser client is mocked table-aware: `.upsert()` against
 *    `nutrition_entries` is recorded as a "write" call; `.upsert()` against
 *    `daily_targets` (the F-2 snapshot helper) is swallowed so it can't be
 *    confused with a journal write.
 *  - `journalWriteQueueStorage.web.ts` is NOT mocked — it persists to real
 *    jsdom `localStorage`, which the write-ahead hook enqueues to before
 *    every upsert attempt. Cleared before/after every test so a queued row
 *    from one case can't leak into the next.
 *  - `track()` is mocked to capture analytics events.
 *  - `refreshAdaptiveTdeeForUser` is stubbed so the test doesn't touch
 *    Supabase for the adaptive TDEE side-effect.
 *  - `toast` is stubbed.
 */

type WriteCall = { rows: unknown };
const writeCalls: WriteCall[] = [];
const analyticsCalls: Array<{ event: string; payload?: Record<string, unknown> }> = [];

function resetFakes() {
  writeCalls.length = 0;
  analyticsCalls.length = 0;
}

vi.mock("../../src/lib/supabase/browserClient.ts", () => ({
  supabase: {
    from: (table: string) => ({
      // `.select(...)` is used both in the hook's one-time probe
      // (`.select("id").limit(1)`) and in the initial load effect
      // (`.select(...).eq("user_id", …).order("created_at", …)`).
      // Also used by the F-2 daily-target snapshot helper via
      // `.select(...).eq("id", userId).maybeSingle()` — the chain must
      // resolve cleanly rather than fail with "not a function".
      // Return a chainable thenable that resolves empty either way.
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
      // ENG-1466 — the durable write path now upserts (write-ahead's
      // `onConflict: "id"` upsert), not a bare insert. Only record
      // `nutrition_entries` calls as journal writes; the F-2 snapshot
      // helper's `daily_targets` upsert is swallowed here (its own shape
      // is covered by `dailyTargetSnapshot.test.ts`).
      upsert: (rows: unknown, _opts?: unknown) => {
        if (table === "nutrition_entries") {
          writeCalls.push({ rows });
        }
        return Promise.resolve({ error: null });
      },
      insert: (rows: unknown) => {
        // No call site should reach a bare `.insert()` on nutrition_entries
        // post-ENG-1466 — if this fires it's tracked as a write too so a
        // regression back to the old bare-insert path still surfaces here
        // (the assertions below pin upsert-shaped calls specifically).
        if (table === "nutrition_entries") {
          writeCalls.push({ rows });
        }
        return Promise.resolve({ error: null });
      },
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: (event: string, payload?: Record<string, unknown>) => {
    analyticsCalls.push({ event, payload });
  },
}));

vi.mock("../../src/lib/nutrition/refreshAdaptiveTdee.ts", () => ({
  refreshAdaptiveTdeeForUser: vi.fn(() => Promise.resolve()),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

// Schema refactor Phase 3 (2026-05-11) — phase1LegacyJsonb shim
// deleted; useNutritionJournalState no longer imports it, so no mock
// is needed for the legacy fallback.

vi.mock("../../src/context/appData/useRetryEnableDbTable.ts", () => ({
  useRetryEnableDbTable: () => {},
}));

import { useNutritionJournalState } from "../../src/context/appData/useNutritionJournalState";
import type { LoggedMeal } from "../../src/types/recipe";

function meal(overrides: Partial<LoggedMeal> = {}): LoggedMeal {
  return {
    id: `meal-${Math.random().toString(36).slice(2, 8)}`,
    name: "Chicken salad",
    recipeTitle: "Chicken salad",
    time: "Lunch",
    calories: 420,
    protein: 38,
    carbs: 20,
    fat: 18,
    fiberG: 7,
    portionMultiplier: 1,
    ...overrides,
  };
}

describe("useNutritionJournalState bulk insert (audit M3)", () => {
  beforeEach(() => {
    resetFakes();
    // ENG-1466 — write-ahead persists to real jsdom localStorage; clear the
    // write-ahead queue between tests so an ack from one case can't leak
    // into (or be mistaken for state in) the next.
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("duplicateDay sends a single array insert rather than N single inserts", async () => {
    const sourceMeals: LoggedMeal[] = [
      meal({ id: "m1", name: "Breakfast", time: "Breakfast" }),
      meal({ id: "m2", name: "Lunch", time: "Lunch" }),
      meal({ id: "m3", name: "Dinner", time: "Dinner" }),
      meal({ id: "m4", name: "Snack", time: "Snacks" }),
    ];
    const { result } = renderHook(() =>
      useNutritionJournalState({
        authedUserId: "user-1",
        initialByDay: { "2026-04-17": sourceMeals },
        selectedDateKey: "2026-04-17",
      }),
    );

    await act(async () => {
      await result.current.duplicateDay("2026-04-17", "2026-04-18");
    });

    // Exactly ONE insert call, not 4.
    expect(writeCalls).toHaveLength(1);
    const rows = writeCalls[0]!.rows;
    expect(Array.isArray(rows)).toBe(true);
    expect((rows as unknown[]).length).toBe(4);

    // A single food_logged event fires for the whole batch — not 4.
    const foodLoggedEvents = analyticsCalls.filter((c) => c.event === "food_logged");
    expect(foodLoggedEvents).toHaveLength(1);
    expect(foodLoggedEvents[0]!.payload).toMatchObject({ count: 4, batched: true });

    // day_duplicated fires once with the correct batch size.
    const dayDuplicatedEvents = analyticsCalls.filter((c) => c.event === "day_duplicated");
    expect(dayDuplicatedEvents).toHaveLength(1);
    expect(dayDuplicatedEvents[0]!.payload).toMatchObject({ batchSize: 4, targetDayCount: 1 });
  });

  it("duplicateDayToDateRange over 7 days × 4 meals = 7 inserts (not 28), 1 food_logged event", async () => {
    const sourceMeals: LoggedMeal[] = [
      meal({ id: "m1", time: "Breakfast" }),
      meal({ id: "m2", time: "Lunch" }),
      meal({ id: "m3", time: "Dinner" }),
      meal({ id: "m4", time: "Snacks" }),
    ];
    const { result } = renderHook(() =>
      useNutritionJournalState({
        authedUserId: "user-1",
        initialByDay: { "2026-04-17": sourceMeals },
        selectedDateKey: "2026-04-17",
      }),
    );

    const targets = [
      "2026-04-18",
      "2026-04-19",
      "2026-04-20",
      "2026-04-21",
      "2026-04-22",
      "2026-04-23",
      "2026-04-24",
    ];
    await act(async () => {
      await result.current.duplicateDayToDateRange("2026-04-17", targets);
    });

    // One insert per target day — 7, not 28.
    expect(writeCalls).toHaveLength(7);
    for (const call of writeCalls) {
      expect(Array.isArray(call.rows)).toBe(true);
      expect((call.rows as unknown[]).length).toBe(4);
    }

    // Single food_logged with count:28 for the whole batch.
    const foodLoggedEvents = analyticsCalls.filter((c) => c.event === "food_logged");
    expect(foodLoggedEvents).toHaveLength(1);
    expect(foodLoggedEvents[0]!.payload).toMatchObject({
      count: 28,
      batched: true,
      source: "duplicate_day",
    });

    // day_duplicated fires once covering the whole batch.
    const dayDuplicatedEvents = analyticsCalls.filter((c) => c.event === "day_duplicated");
    expect(dayDuplicatedEvents).toHaveLength(1);
    expect(dayDuplicatedEvents[0]!.payload).toMatchObject({
      batchSize: 4,
      targetDayCount: 7,
    });
  });

  it("copyMealToDateRange over 7 days = 7 inserts and one food_logged event", async () => {
    const sourceMeal = meal({ id: "m1", name: "Greek yogurt bowl", time: "Breakfast" });
    const { result } = renderHook(() =>
      useNutritionJournalState({
        authedUserId: "user-1",
        initialByDay: { "2026-04-17": [sourceMeal] },
        selectedDateKey: "2026-04-17",
      }),
    );

    const targets = [
      "2026-04-18",
      "2026-04-19",
      "2026-04-20",
      "2026-04-21",
      "2026-04-22",
      "2026-04-23",
      "2026-04-24",
    ];
    await act(async () => {
      await result.current.copyMealToDateRange("2026-04-17", "m1", targets);
    });

    // One insert per target — 7 single-row inserts.
    expect(writeCalls).toHaveLength(7);
    for (const call of writeCalls) {
      expect(Array.isArray(call.rows)).toBe(true);
      expect((call.rows as unknown[]).length).toBe(1);
    }

    // One batched food_logged event for the whole copy-range batch.
    const foodLoggedEvents = analyticsCalls.filter((c) => c.event === "food_logged");
    expect(foodLoggedEvents).toHaveLength(1);
    expect(foodLoggedEvents[0]!.payload).toMatchObject({
      count: 7,
      batched: true,
      source: "copy_meal",
    });

    // meal_copied fires once covering the whole batch.
    const mealCopiedEvents = analyticsCalls.filter((c) => c.event === "meal_copied");
    expect(mealCopiedEvents).toHaveLength(1);
    expect(mealCopiedEvents[0]!.payload).toMatchObject({
      batchSize: 1,
      targetDayCount: 7,
    });
  });

  it("single-meal addLoggedMealForDate write-aheads a single-row batch and fires one food_logged event", async () => {
    const { result } = renderHook(() =>
      useNutritionJournalState({
        authedUserId: "user-1",
        initialByDay: {},
        selectedDateKey: "2026-04-17",
      }),
    );

    await act(async () => {
      result.current.addLoggedMealForDate("2026-04-17", {
        name: "Test",
        recipeTitle: "Test",
        time: "Lunch",
        calories: 100,
        protein: 10,
        carbs: 10,
        fat: 5,
      });
      // ENG-1466 — addLoggedMealForDate returns synchronously (the id),
      // firing writeAhead's enqueue -> upsert -> ack chain fire-and-forget.
      // Flush microtasks so the (mocked, immediately-resolving) upsert
      // settles before asserting on writeCalls.
      await Promise.resolve();
      await Promise.resolve();
    });

    // Write-ahead always upserts a ROW ARRAY (mirrors mobile's `writeAhead`
    // contract), even for a single manual log — one call, one-element array.
    expect(writeCalls).toHaveLength(1);
    expect(Array.isArray(writeCalls[0]!.rows)).toBe(true);
    expect((writeCalls[0]!.rows as unknown[]).length).toBe(1);

    // And a single food_logged event with the meal calories — unchanged
    // contract so we don't regress the manual-log analytics path.
    const foodLoggedEvents = analyticsCalls.filter((c) => c.event === "food_logged");
    expect(foodLoggedEvents).toHaveLength(1);
    expect(foodLoggedEvents[0]!.payload).toMatchObject({ calories: 100 });
  });

  it("no-ops (empty source day, same-day duplicate) do not insert and do not fire food_logged", async () => {
    const { result } = renderHook(() =>
      useNutritionJournalState({
        authedUserId: "user-1",
        initialByDay: { "2026-04-17": [] },
        selectedDateKey: "2026-04-17",
      }),
    );

    await act(async () => {
      await result.current.duplicateDay("2026-04-17", "2026-04-18"); // empty source
      await result.current.duplicateDay("2026-04-17", "2026-04-17"); // same day
      await result.current.duplicateDayToDateRange("2026-04-17", ["2026-04-17"]); // source only
    });

    expect(writeCalls).toHaveLength(0);
    expect(analyticsCalls.filter((c) => c.event === "food_logged")).toHaveLength(0);
  });

  it("duplicateDay re-anchors eaten_at to target date_key (ENG-1107)", async () => {
    const sourceMeal = meal({
      id: "m1",
      eatenAt: "2026-06-14T12:30:00.000Z",
    });
    const { result } = renderHook(() =>
      useNutritionJournalState({
        authedUserId: "user-1",
        initialByDay: { "2026-06-14": [sourceMeal] },
        selectedDateKey: "2026-06-14",
      }),
    );

    await act(async () => {
      await result.current.duplicateDay("2026-06-14", "2026-06-16");
    });

    expect(writeCalls).toHaveLength(1);
    const rows = writeCalls[0]!.rows as Array<Record<string, unknown>>;
    expect(rows[0]!.date_key).toBe("2026-06-16");
    expect(String(rows[0]!.eaten_at)).toMatch(/^2026-06-16T/);
  });

  it("duplicateDay preserves nutrition_micros on insert payload (ENG-1105)", async () => {
    const stimulantMicros = {
      caffeineMg: 95,
      theobromineMg: 12,
    };
    const sourceMeal = meal({
      id: "m1",
      micros: stimulantMicros,
    });
    const { result } = renderHook(() =>
      useNutritionJournalState({
        authedUserId: "user-1",
        initialByDay: { "2026-06-14": [sourceMeal] },
        selectedDateKey: "2026-06-14",
      }),
    );

    await act(async () => {
      await result.current.duplicateDay("2026-06-14", "2026-06-15");
    });

    const rows = writeCalls[0]!.rows as Array<Record<string, unknown>>;
    expect(rows[0]!.nutrition_micros).toEqual(stimulantMicros);
  });

  it("copyMealToDateRange re-anchors eaten_at and preserves micros (ENG-1105, ENG-1107)", async () => {
    const stimulantMicros = { caffeineMg: 40 };
    const sourceMeal = meal({
      id: "m1",
      eatenAt: "2026-06-10T15:00:00.000Z",
      micros: stimulantMicros,
    });
    const { result } = renderHook(() =>
      useNutritionJournalState({
        authedUserId: "user-1",
        initialByDay: { "2026-06-10": [sourceMeal] },
        selectedDateKey: "2026-06-10",
      }),
    );

    await act(async () => {
      await result.current.copyMealToDateRange("2026-06-10", "m1", ["2026-06-11"]);
    });

    const rows = writeCalls[0]!.rows as Array<Record<string, unknown>>;
    expect(rows[0]!.date_key).toBe("2026-06-11");
    expect(String(rows[0]!.eaten_at)).toMatch(/^2026-06-11T/);
    expect(rows[0]!.nutrition_micros).toEqual(stimulantMicros);
  });
});
