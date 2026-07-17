/** @vitest-environment jsdom */
/**
 * ENG-1522 — `useCopyDuplicateMeal` reports whether each target day's write
 * actually PERSISTED, not just that it was queued locally, so
 * `TodayScreen.tsx` can show an honest success/pending message instead of a
 * premature blanket "Copied"/"Duplicated" alert fired before the write even
 * started. Also pins that a range call (copy/duplicate to multiple days)
 * suppresses `writeAhead`'s own per-day failure Alert — one consolidated
 * message covers the whole batch instead of N stacked popups.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { useRef, useState } from "react";
import { render } from "@testing-library/react-native";

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
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
}: {
  writeAheadImpl: WriteAheadImpl;
  onReady: (api: ReturnType<typeof useCopyDuplicateMeal>, setByDaySpy: ReturnType<typeof vi.fn>) => void;
}) {
  const [byDay] = useState<ByDay>(makeByDay());
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

function renderHarness(writeAheadImpl: WriteAheadImpl) {
  let api!: ReturnType<typeof useCopyDuplicateMeal>;
  let setByDaySpy!: ReturnType<typeof vi.fn>;
  render(
    <Harness
      writeAheadImpl={writeAheadImpl}
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
