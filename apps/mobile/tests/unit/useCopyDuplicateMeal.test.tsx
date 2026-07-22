/** @vitest-environment jsdom */
/**
 * ENG-1522 — `useCopyDuplicateMeal` reports whether each target day's write
 * actually PERSISTED, not just that it was queued locally, so
 * `TodayScreen.tsx` can show an honest success/pending message instead of a
 * premature blanket "Copied"/"Duplicated" alert fired before the write even
 * started. Also pins that a range call (copy/duplicate to multiple days)
 * suppresses `writeAhead`'s own per-day failure Alert — one consolidated
 * message covers the whole batch instead of N stacked popups.
 *
 * ENG-786 rebuild (2026-07-21) — coverage added for `copySlotToDateRange`
 * (whole-slot copy — the new "Copy to another day" primitive replacing the
 * deleted instant "Log again") and its paired `undoCopyToSlot`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { useRef, useState } from "react";
import { render } from "@testing-library/react-native";

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));
// ENG-786 rebuild — `undoCopyToSlot` hits `supabase.from(...).delete().in(...)`
// directly (unlike the writeAhead-mediated copy/duplicate paths above), so
// the mock needs a chainable stub resolving `{ error: null }` rather than the
// bare `{}` the pre-existing tests got away with. `vi.hoisted` because
// `vi.mock` factories are hoisted above top-level `const`s in this file.
const { supabaseFrom, supabaseDeleteIn } = vi.hoisted(() => {
  const supabaseDeleteIn = vi.fn(() => Promise.resolve({ error: null }));
  const supabaseDelete = vi.fn(() => ({ in: supabaseDeleteIn }));
  const supabaseFrom = vi.fn(() => ({ delete: supabaseDelete }));
  return { supabaseFrom, supabaseDeleteIn };
});
vi.mock("@/lib/supabase", () => ({ supabase: { from: supabaseFrom } }));
vi.mock("@/lib/refreshAdaptiveTdee", () => ({ refreshAdaptiveTdeeForUser: vi.fn() }));
vi.mock("@suppr/nutrition-core/dailyTargetSnapshot", () => ({ snapshotDailyTargetIfMissing: vi.fn() }));
vi.mock("@/lib/healthKitMealWriter", () => ({ writeMealToHealthKitIfEnabled: vi.fn() }));

import { useCopyDuplicateMeal } from "../../hooks/useCopyDuplicateMeal";
import type { ByDay, JournalMeal } from "../../lib/nutritionJournal";

const MEAL: JournalMeal = {
  id: "meal-1",
  name: "Lunch",
  recipeTitle: "Chicken salad",
  time: "12:30",
  calories: 420,
  protein: 35,
  carbs: 18,
  fat: 22,
};

function makeByDay(): ByDay {
  return { "2026-07-10": [MEAL] };
}

type WriteAheadImpl = (
  dayKey: string,
  rows: ReadonlyArray<Record<string, unknown>>,
  opts?: { suppressFailureAlert?: boolean },
) => Promise<{ persisted: boolean; timedOut: boolean }>;

/**
 * Render-prop harness (matches useJournalWriteAhead.test.tsx). `setByDay` is
 * a spy over the updater function itself rather than real React state, so
 * assertions don't depend on a commit/re-render landing before the test
 * reads the result (no `act()` gymnastics needed for a plain data check).
 */
function Harness({
  writeAheadImpl,
  onReady,
  initialByDay,
}: {
  writeAheadImpl: WriteAheadImpl;
  onReady: (api: ReturnType<typeof useCopyDuplicateMeal>, setByDaySpy: ReturnType<typeof vi.fn>) => void;
  initialByDay?: ByDay;
}) {
  const [byDay] = useState<ByDay>(initialByDay ?? makeByDay());
  const setByDaySpy = useRef(vi.fn()).current;
  const confirmLogHapticRef = useRef(() => {});
  const api = useCopyDuplicateMeal({
    byDay,
    setByDay: setByDaySpy,
    userId: "user-1",
    profileTimeZone: "UTC",
    writeAhead: writeAheadImpl,
    confirmLogHapticRef,
  });
  onReady(api, setByDaySpy);
  return null;
}

function renderHarness(writeAheadImpl: WriteAheadImpl, initialByDay?: ByDay) {
  let api!: ReturnType<typeof useCopyDuplicateMeal>;
  let setByDaySpy!: ReturnType<typeof vi.fn>;
  render(
    <Harness
      writeAheadImpl={writeAheadImpl}
      initialByDay={initialByDay}
      onReady={(a, s) => {
        api = a;
        setByDaySpy = s;
      }}
    />,
  );
  return { api: () => api, setByDaySpy: () => setByDaySpy };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useCopyDuplicateMeal — single-target persisted signal", () => {
  it("copyMealToDate returns true when writeAhead confirms", async () => {
    const writeAheadImpl = vi.fn(async () => ({ persisted: true, timedOut: false }));
    const { api } = renderHarness(writeAheadImpl);
    const persisted = await api().copyMealToDate("2026-07-10", "meal-1", "2026-07-11");
    expect(persisted).toBe(true);
  });

  it("copyMealToDate returns false when writeAhead does not confirm (no suppressFailureAlert — single day keeps its own alert)", async () => {
    const writeAheadImpl: WriteAheadImpl = vi.fn(async () => ({ persisted: false, timedOut: false }));
    const { api } = renderHarness(writeAheadImpl);
    const persisted = await api().copyMealToDate("2026-07-10", "meal-1", "2026-07-11");
    expect(persisted).toBe(false);
    expect(vi.mocked(writeAheadImpl).mock.calls[0]![2]?.suppressFailureAlert).toBeUndefined();
  });

  it("duplicateDay mirrors the same persisted contract", async () => {
    const writeAheadImpl = vi.fn(async () => ({ persisted: false, timedOut: true }));
    const { api } = renderHarness(writeAheadImpl);
    const persisted = await api().duplicateDay("2026-07-10", "2026-07-11");
    expect(persisted).toBe(false);
  });

  it("the row is added optimistically even when the write did not persist (no revert — ENG-1447)", async () => {
    const writeAheadImpl = vi.fn(async () => ({ persisted: false, timedOut: false }));
    const { api, setByDaySpy } = renderHarness(writeAheadImpl);
    await api().copyMealToDate("2026-07-10", "meal-1", "2026-07-11");
    expect(setByDaySpy()).toHaveBeenCalledTimes(1);
    const updater = setByDaySpy().mock.calls[0]![0] as (prev: ByDay) => ByDay;
    const result = updater(makeByDay());
    expect(result["2026-07-11"]).toHaveLength(1);
  });
});

describe("useCopyDuplicateMeal — range partial-failure reporting", () => {
  it("copyMealToDateRange partitions succeeded/failed per day and suppresses the per-day alert", async () => {
    const outcomes: Record<string, boolean> = {
      "2026-07-11": true,
      "2026-07-12": false,
      "2026-07-13": true,
    };
    const writeAheadImpl: WriteAheadImpl = vi.fn(async (dayKey) => ({
      persisted: outcomes[dayKey],
      timedOut: false,
    }));
    const { api } = renderHarness(writeAheadImpl);
    const { succeeded, failed } = await api().copyMealToDateRange(
      "2026-07-10",
      "meal-1",
      ["2026-07-11", "2026-07-12", "2026-07-13"],
    );
    expect(succeeded.sort()).toEqual(["2026-07-11", "2026-07-13"]);
    expect(failed).toEqual(["2026-07-12"]);
    // Every call in a range suppresses writeAhead's own per-day Alert — the
    // caller (TodayScreen) shows ONE consolidated message instead.
    for (const call of vi.mocked(writeAheadImpl).mock.calls) {
      expect(call[2]?.suppressFailureAlert).toBe(true);
    }
  });

  it("duplicateDayToDateRange mirrors the same partition contract", async () => {
    const outcomes: Record<string, boolean> = { "2026-07-11": false, "2026-07-12": false };
    const writeAheadImpl = vi.fn(async (dayKey: string) => ({
      persisted: outcomes[dayKey],
      timedOut: false,
    }));
    const { api } = renderHarness(writeAheadImpl);
    const { succeeded, failed } = await api().duplicateDayToDateRange("2026-07-10", [
      "2026-07-11",
      "2026-07-12",
    ]);
    expect(succeeded).toEqual([]);
    expect(failed.sort()).toEqual(["2026-07-11", "2026-07-12"]);
  });

  it("all-succeeded range reports an empty failed list", async () => {
    const writeAheadImpl = vi.fn(async () => ({ persisted: true, timedOut: false }));
    const { api } = renderHarness(writeAheadImpl);
    const { succeeded, failed } = await api().copyMealToDateRange("2026-07-10", "meal-1", [
      "2026-07-11",
      "2026-07-12",
    ]);
    expect(failed).toEqual([]);
    expect(succeeded).toHaveLength(2);
  });
});

/**
 * Two Lunch entries + one Dinner entry on the source day, so tests can
 * confirm `copySlotToDateRange` only ever touches the SOURCE SLOT's rows
 * (never leaks into a same-day different-slot entry).
 */
function makeSlotByDay(): ByDay {
  return {
    "2026-07-10": [
      { ...MEAL, id: "meal-1", name: "Lunch" },
      { ...MEAL, id: "meal-2", name: "Lunch", recipeTitle: "Rice bowl" },
      { ...MEAL, id: "meal-3", name: "Dinner", recipeTitle: "Steak" },
    ],
  };
}

describe("useCopyDuplicateMeal — copySlotToDateRange (ENG-786 rebuild)", () => {
  it("happy path: copies every item in the source slot to each target day, createdIdsByDay keyed per target day with the right count", async () => {
    const writeAheadImpl: WriteAheadImpl = vi.fn(async () => ({ persisted: true, timedOut: false }));
    const { api } = renderHarness(writeAheadImpl, makeSlotByDay());
    const result = await api().copySlotToDateRange("2026-07-10", "Lunch", "Lunch", [
      "2026-07-11",
      "2026-07-12",
    ]);
    // Only the 2 Lunch items — the Dinner entry never enters the count.
    expect(result.itemCount).toBe(2);
    expect(result.succeeded.sort()).toEqual(["2026-07-11", "2026-07-12"]);
    expect(result.failed).toEqual([]);
    expect(Object.keys(result.createdIdsByDay).sort()).toEqual(["2026-07-11", "2026-07-12"]);
    expect(result.createdIdsByDay["2026-07-11"]).toHaveLength(2);
    expect(result.createdIdsByDay["2026-07-12"]).toHaveLength(2);
    // Fresh minted ids — never reuses the source rows' own ids.
    expect(result.createdIdsByDay["2026-07-11"]).not.toContain("meal-1");
    expect(result.createdIdsByDay["2026-07-11"]).not.toContain("meal-2");
    expect(result.createdIdsByDay["2026-07-12"]).not.toContain("meal-1");
    expect(result.createdIdsByDay["2026-07-12"]).not.toContain("meal-2");
  });

  it("same-day-different-slot target is NOT excluded — copying Lunch onto the source day's Dinner is a legal target", async () => {
    const writeAheadImpl: WriteAheadImpl = vi.fn(async () => ({ persisted: true, timedOut: false }));
    const { api } = renderHarness(writeAheadImpl, makeSlotByDay());
    const result = await api().copySlotToDateRange("2026-07-10", "Lunch", "Dinner", ["2026-07-10"]);
    expect(result.itemCount).toBe(2);
    expect(result.succeeded).toEqual(["2026-07-10"]);
    expect(result.failed).toEqual([]);
    expect(result.createdIdsByDay["2026-07-10"]).toHaveLength(2);
  });

  it("same-day-same-slot target IS excluded (true no-op) — no writeAhead call, empty result shape", async () => {
    const writeAheadImpl: WriteAheadImpl = vi.fn(async () => ({ persisted: true, timedOut: false }));
    const { api } = renderHarness(writeAheadImpl, makeSlotByDay());
    const result = await api().copySlotToDateRange("2026-07-10", "Lunch", "Lunch", ["2026-07-10"]);
    expect(result).toEqual({ succeeded: [], failed: [], itemCount: 0, createdIdsByDay: {} });
    expect(writeAheadImpl).not.toHaveBeenCalled();
  });

  it("an empty source slot short-circuits to the empty result without calling writeAhead", async () => {
    const writeAheadImpl: WriteAheadImpl = vi.fn(async () => ({ persisted: true, timedOut: false }));
    const { api } = renderHarness(writeAheadImpl, makeSlotByDay());
    const result = await api().copySlotToDateRange("2026-07-10", "Breakfast", "Breakfast", [
      "2026-07-11",
    ]);
    expect(result).toEqual({ succeeded: [], failed: [], itemCount: 0, createdIdsByDay: {} });
    expect(writeAheadImpl).not.toHaveBeenCalled();
  });

  it("partial failure: a target day whose write doesn't persist lands in `failed`, not `succeeded`, but its ids still land in createdIdsByDay (optimistic — ENG-1447)", async () => {
    const outcomes: Record<string, boolean> = { "2026-07-11": true, "2026-07-12": false };
    const writeAheadImpl: WriteAheadImpl = vi.fn(async (dayKey) => ({
      persisted: outcomes[dayKey],
      timedOut: false,
    }));
    const { api } = renderHarness(writeAheadImpl, makeSlotByDay());
    const result = await api().copySlotToDateRange("2026-07-10", "Lunch", "Lunch", [
      "2026-07-11",
      "2026-07-12",
    ]);
    expect(result.succeeded).toEqual(["2026-07-11"]);
    expect(result.failed).toEqual(["2026-07-12"]);
    expect(result.createdIdsByDay["2026-07-11"]).toHaveLength(2);
    expect(result.createdIdsByDay["2026-07-12"]).toHaveLength(2);
  });
});

describe("useCopyDuplicateMeal — undoCopyToSlot (ENG-786 rebuild)", () => {
  it("removes exactly the ids passed from local state, across multiple days", () => {
    const writeAheadImpl: WriteAheadImpl = vi.fn(async () => ({ persisted: true, timedOut: false }));
    const { api, setByDaySpy } = renderHarness(writeAheadImpl, makeSlotByDay());
    api().undoCopyToSlot({
      "2026-07-11": ["new-1", "new-2"],
      "2026-07-12": ["new-3"],
    });
    expect(setByDaySpy()).toHaveBeenCalledTimes(1);
    const updater = setByDaySpy().mock.calls[0]![0] as (prev: ByDay) => ByDay;
    const prev: ByDay = {
      "2026-07-11": [
        { ...MEAL, id: "new-1" },
        { ...MEAL, id: "new-2" },
        { ...MEAL, id: "keep-1" },
      ],
      "2026-07-12": [{ ...MEAL, id: "new-3" }],
      "2026-07-13": [{ ...MEAL, id: "untouched" }],
    };
    const next = updater(prev);
    // Exactly the passed ids are removed from each day; other rows on the
    // same day (and days not mentioned at all) are untouched.
    expect(next["2026-07-11"]!.map((m) => m.id)).toEqual(["keep-1"]);
    expect(next["2026-07-12"]).toEqual([]);
    expect(next["2026-07-13"]!.map((m) => m.id)).toEqual(["untouched"]);
  });

  it("issues one Supabase delete `.in(id, allIds)` across every id from every day", () => {
    const writeAheadImpl: WriteAheadImpl = vi.fn(async () => ({ persisted: true, timedOut: false }));
    const { api } = renderHarness(writeAheadImpl, makeSlotByDay());
    api().undoCopyToSlot({
      "2026-07-11": ["new-1", "new-2"],
      "2026-07-12": ["new-3"],
    });
    expect(supabaseFrom).toHaveBeenCalledWith("nutrition_entries");
    expect(supabaseDeleteIn).toHaveBeenCalledWith("id", ["new-1", "new-2", "new-3"]);
  });

  it("no-ops on empty input — no setByDay call, no Supabase delete", () => {
    const writeAheadImpl: WriteAheadImpl = vi.fn(async () => ({ persisted: true, timedOut: false }));
    const { api, setByDaySpy } = renderHarness(writeAheadImpl, makeSlotByDay());
    api().undoCopyToSlot({});
    expect(setByDaySpy()).not.toHaveBeenCalled();
    expect(supabaseFrom).not.toHaveBeenCalled();
  });

  it("no-ops when every day's id list is empty (no ids anywhere to delete)", () => {
    const writeAheadImpl: WriteAheadImpl = vi.fn(async () => ({ persisted: true, timedOut: false }));
    const { api, setByDaySpy } = renderHarness(writeAheadImpl, makeSlotByDay());
    api().undoCopyToSlot({ "2026-07-11": [], "2026-07-12": [] });
    expect(setByDaySpy()).not.toHaveBeenCalled();
    expect(supabaseFrom).not.toHaveBeenCalled();
  });
});
