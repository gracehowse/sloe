/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render } from "@testing-library/react-native";

// Capture every dependency the hook reaches into, so we can assert
// the debounce + side-effect chain.

const upsertResult = { error: null as { message: string } | null };
const upsertMock = vi.fn().mockImplementation(async () => upsertResult);
const fromMock = vi.fn().mockImplementation(() => ({
  upsert: (rows: unknown, opts: unknown) => {
    upsertMock(rows, opts);
    return { then: (cb: (r: typeof upsertResult) => void) => cb(upsertResult) };
  },
}));
const refreshAdaptiveTdeeForUserMock = vi.fn();
const snapshotDailyTargetIfMissingMock = vi.fn();
const writeMealToHealthKitIfEnabledMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (table: string) => fromMock(table) },
}));

vi.mock("@/lib/refreshAdaptiveTdee", () => ({
  refreshAdaptiveTdeeForUser: (...args: unknown[]) => refreshAdaptiveTdeeForUserMock(...args),
}));

vi.mock("@/lib/healthKitMealWriter", () => ({
  writeMealToHealthKitIfEnabled: (...args: unknown[]) => writeMealToHealthKitIfEnabledMock(...args),
}));

vi.mock("../../../../src/lib/nutrition/dailyTargetSnapshot", () => ({
  snapshotDailyTargetIfMissing: (...args: unknown[]) => snapshotDailyTargetIfMissingMock(...args),
}));

vi.mock("@/lib/nutritionJournal", () => ({
  dateKeyFromDate: (d: Date) => d.toISOString().slice(0, 10),
  newMealId: () => "generated-uuid",
}));

import { useNutritionEntriesSync } from "../../hooks/useNutritionEntriesSync";

type MealLike = {
  id: string;
  name: string;
  recipeTitle?: string;
  time?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number | null;
  waterMl?: number | null;
  portionMultiplier?: number | null;
  micros?: Record<string, number>;
  source?: string | null;
  createdAt?: string | null;
};

function Harness(props: {
  userId: string | null | undefined;
  hydrated: boolean;
  byDay: Record<string, MealLike[]>;
  selectedDate: Date;
}) {
  useNutritionEntriesSync(props as unknown as Parameters<typeof useNutritionEntriesSync>[0]);
  return null;
}

const FIXED_DATE = new Date("2026-05-16T12:00:00Z");
const VALID_UUID = "11111111-1111-1111-1111-111111111111";

describe("useNutritionEntriesSync (Today split #3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    upsertResult.error = null;
    fromMock.mockClear();
    upsertMock.mockClear();
    refreshAdaptiveTdeeForUserMock.mockClear();
    snapshotDailyTargetIfMissingMock.mockClear();
    writeMealToHealthKitIfEnabledMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("no-ops when userId is null", () => {
    render(<Harness userId={null} hydrated byDay={{ "2026-05-16": [makeMeal()] }} selectedDate={FIXED_DATE} />);
    vi.advanceTimersByTime(700);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("no-ops when not hydrated", () => {
    render(<Harness userId="u1" hydrated={false} byDay={{ "2026-05-16": [makeMeal()] }} selectedDate={FIXED_DATE} />);
    vi.advanceTimersByTime(700);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("no-ops when there are no meals for the selected day", () => {
    render(<Harness userId="u1" hydrated byDay={{}} selectedDate={FIXED_DATE} />);
    vi.advanceTimersByTime(700);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("debounces by 600ms before firing the upsert", () => {
    render(<Harness userId="u1" hydrated byDay={{ "2026-05-16": [makeMeal()] }} selectedDate={FIXED_DATE} />);
    vi.advanceTimersByTime(500);
    expect(upsertMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it("fires target-snapshot + HealthKit on success (adaptive TDEE is deferred from persistMealsImmediate)", () => {
    render(<Harness userId="u1" hydrated byDay={{ "2026-05-16": [makeMeal()] }} selectedDate={FIXED_DATE} />);
    vi.advanceTimersByTime(700);
    expect(refreshAdaptiveTdeeForUserMock).not.toHaveBeenCalled();
    expect(snapshotDailyTargetIfMissingMock).toHaveBeenCalledTimes(1);
    expect(writeMealToHealthKitIfEnabledMock).toHaveBeenCalledTimes(1);
  });

  it("skips downstream side-effects when the upsert errors", () => {
    upsertResult.error = { message: "RLS denied" };
    const consoleErrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Harness userId="u1" hydrated byDay={{ "2026-05-16": [makeMeal()] }} selectedDate={FIXED_DATE} />);
    vi.advanceTimersByTime(700);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(refreshAdaptiveTdeeForUserMock).not.toHaveBeenCalled();
    expect(snapshotDailyTargetIfMissingMock).not.toHaveBeenCalled();
    expect(writeMealToHealthKitIfEnabledMock).not.toHaveBeenCalled();
    consoleErrSpy.mockRestore();
  });

  it("regenerates non-UUID meal ids on the upsert payload (but keeps real UUIDs)", () => {
    const meals = [
      makeMeal({ id: VALID_UUID }),
      makeMeal({ id: "free-text-id" }),
    ];
    render(<Harness userId="u1" hydrated byDay={{ "2026-05-16": meals }} selectedDate={FIXED_DATE} />);
    vi.advanceTimersByTime(700);
    const rows = upsertMock.mock.calls[0][0] as Array<{ id: string }>;
    expect(rows[0].id).toBe(VALID_UUID);
    expect(rows[1].id).toBe("generated-uuid");
  });
});

function makeMeal(overrides: Partial<MealLike> = {}): MealLike {
  return {
    id: VALID_UUID,
    name: "Breakfast",
    recipeTitle: "Oatmeal",
    time: "08:00",
    calories: 350,
    protein: 12,
    carbs: 60,
    fat: 8,
    fiberG: 6,
    waterMl: null,
    portionMultiplier: 1,
    micros: {},
    source: "manual",
    createdAt: "2026-05-16T08:00:00Z",
    ...overrides,
  };
}
