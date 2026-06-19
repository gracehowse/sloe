import { act, renderHook } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTodayWidgetSnapshot } from "../../hooks/useTodayWidgetSnapshot";

const trackMock = vi.fn();
const buildWidgetSnapshotMock = vi.fn((input: unknown) => ({ kind: "snapshot", input }));
const writeWidgetSnapshotMock = vi.fn(async (_snapshot: unknown) => ({ ok: true, writtenToFile: true }));

vi.mock("@/lib/analytics", () => ({
  track: (...args: [string, Record<string, unknown>]) => trackMock(...args),
}));

vi.mock("@/lib/widgetSnapshot", () => ({
  buildWidgetSnapshot: (input: unknown) => buildWidgetSnapshotMock(input),
  writeWidgetSnapshot: (snapshot: unknown) => writeWidgetSnapshotMock(snapshot),
}));

type UseTodayWidgetSnapshotParams = Parameters<typeof useTodayWidgetSnapshot>[0];

const baseParams: UseTodayWidgetSnapshotParams = {
  hydrated: true,
  isToday: true,
  viewMode: "day" as const,
  totals: { calories: 420, protein: 31, carbs: 44, fat: 12 },
  effectiveCalorieGoal: 2100,
  effectiveMacroTargets: { protein: 150, carbs: 230, fat: 70 },
  activeFastStart: null,
  fastTargetHours: 16,
};

async function flushWidgetDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(500);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useTodayWidgetSnapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    trackMock.mockClear();
    buildWidgetSnapshotMock.mockClear();
    writeWidgetSnapshotMock.mockClear();
  });

  it("debounces a Today-only widget snapshot and tags the first write as a scheduled refresh", async () => {
    renderHook(() => useTodayWidgetSnapshot(baseParams));

    expect(writeWidgetSnapshotMock).not.toHaveBeenCalled();
    await flushWidgetDebounce();

    expect(buildWidgetSnapshotMock).toHaveBeenCalledWith({
      kcalConsumed: 420,
      kcalTarget: 2100,
      proteinTargetG: 150,
      proteinConsumedG: 31,
      carbsTargetG: 230,
      carbsConsumedG: 44,
      fatTargetG: 70,
      fatConsumedG: 12,
      fastStartsAt: null,
      fastTargetHours: 16,
    });
    expect(writeWidgetSnapshotMock).toHaveBeenCalledWith({
      kind: "snapshot",
      input: expect.objectContaining({ kcalConsumed: 420 }),
    });
    expect(trackMock).toHaveBeenCalledWith("widget_snapshot_updated", {
      trigger: "scheduled_refresh",
    });
  });

  it("does not write when Today is unhydrated, a past date, or week mode", async () => {
    type GateProps = Pick<UseTodayWidgetSnapshotParams, "hydrated" | "isToday" | "viewMode">;
    const { rerender } = renderHook(
      ({ hydrated, isToday, viewMode }: GateProps) =>
        useTodayWidgetSnapshot({ ...baseParams, hydrated, isToday, viewMode }),
      { initialProps: { hydrated: false, isToday: true, viewMode: "day" } satisfies GateProps },
    );

    await flushWidgetDebounce();
    rerender({ hydrated: true, isToday: false, viewMode: "day" });
    await flushWidgetDebounce();
    rerender({ hydrated: true, isToday: true, viewMode: "week" });
    await flushWidgetDebounce();

    expect(writeWidgetSnapshotMock).not.toHaveBeenCalled();
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("retags later writes as fast-state or totals changes", async () => {
    const { rerender } = renderHook((params: UseTodayWidgetSnapshotParams) => useTodayWidgetSnapshot(params), {
      initialProps: baseParams,
    });

    await flushWidgetDebounce();
    rerender({ ...baseParams, activeFastStart: "2026-06-19T08:00:00.000Z" });
    await flushWidgetDebounce();
    rerender({
      ...baseParams,
      activeFastStart: "2026-06-19T08:00:00.000Z",
      totals: { ...baseParams.totals, calories: 500 },
    });
    await flushWidgetDebounce();

    expect(trackMock).toHaveBeenNthCalledWith(1, "widget_snapshot_updated", {
      trigger: "scheduled_refresh",
    });
    expect(trackMock).toHaveBeenNthCalledWith(2, "widget_snapshot_updated", {
      trigger: "fast_state_changed",
    });
    expect(trackMock).toHaveBeenNthCalledWith(3, "widget_snapshot_updated", {
      trigger: "totals_changed",
    });
  });
});
