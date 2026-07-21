/**
 * ENG-1626 (Today extract, slice 2) — behaviour tests for
 * `useTodayFasting`, the fasting-pill state cluster (4 pieces of state +
 * a minute-cadence ticking effect + the Siri/Shortcuts fast-starter)
 * extracted verbatim from `TodayScreen.tsx`.
 *
 * Mirrors `useTodayWeeklyCheckin.test.ts` (slice 1): covers the hook's
 * OWN responsibility — React state wiring, the raw setters `loadProfileTargets`
 * hydrates through, the ticking effect's active-fast gate, and
 * `startFastFromShortcut`'s no-stack guard + Supabase persistence + the
 * optimistic `activeFastStart` bump.
 */
import { act, renderHook } from "@testing-library/react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const trackMock = vi.fn();

const maybeSingleMock = vi.fn(async () => ({ data: { fasting_sessions: [] as unknown } }));
const selectEqMock = vi.fn((_col: string, _val: string) => ({ maybeSingle: maybeSingleMock }));
const selectMock = vi.fn((_cols: string) => ({ eq: selectEqMock }));

const updateEqMock = vi.fn(async (_col: string, _val: string) => ({ error: null }));
const updateMock = vi.fn((_payload: Record<string, unknown>) => ({ eq: updateEqMock }));

const fromMock = vi.fn((_table: string) => ({ select: selectMock, update: updateMock }));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (...args: [string]) => fromMock(...args) },
}));

vi.mock("@/lib/analytics", () => ({
  track: (...args: [string, Record<string, unknown>]) => trackMock(...args),
}));

import { useTodayFasting } from "../../hooks/useTodayFasting";

describe("useTodayFasting", () => {
  beforeEach(() => {
    trackMock.mockClear();
    maybeSingleMock.mockClear();
    maybeSingleMock.mockResolvedValue({ data: { fasting_sessions: [] } });
    selectEqMock.mockClear();
    selectMock.mockClear();
    updateEqMock.mockClear();
    updateMock.mockClear();
    fromMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts idle: no active fast, 16h default target", () => {
    const { result } = renderHook(() => useTodayFasting({ userId: "user-1" }));
    expect(result.current.activeFastStart).toBeNull();
    expect(result.current.fastTargetHours).toBe(16);
    expect(result.current.fastingOptedIn).toBe(false);
    expect(typeof result.current.fastingTick).toBe("number");
  });

  it("exposes raw setters — the loadProfileTargets hydration path", () => {
    const { result } = renderHook(() => useTodayFasting({ userId: "user-1" }));
    act(() => {
      result.current.setActiveFastStart("2026-07-20T08:00:00.000Z");
      result.current.setFastTargetHours(18);
      result.current.setFastingOptedIn(true);
    });
    expect(result.current.activeFastStart).toBe("2026-07-20T08:00:00.000Z");
    expect(result.current.fastTargetHours).toBe(18);
    expect(result.current.fastingOptedIn).toBe(true);
  });

  it("ticks fastingTick once a minute only while a fast is active", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTodayFasting({ userId: "user-1" }));
    const initialTick = result.current.fastingTick;

    // No active fast — the interval never starts, so advancing time
    // (even well past the 60s cadence) leaves fastingTick untouched.
    act(() => {
      vi.advanceTimersByTime(180_000);
    });
    expect(result.current.fastingTick).toBe(initialTick);

    act(() => {
      result.current.setActiveFastStart("2026-07-20T08:00:00.000Z");
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.fastingTick).toBeGreaterThan(initialTick);
  });

  it("stops ticking once the active fast clears", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTodayFasting({ userId: "user-1" }));
    act(() => {
      result.current.setActiveFastStart("2026-07-20T08:00:00.000Z");
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    const tickWhileActive = result.current.fastingTick;

    act(() => {
      result.current.setActiveFastStart(null);
    });
    act(() => {
      vi.advanceTimersByTime(180_000);
    });
    expect(result.current.fastingTick).toBe(tickWhileActive);
  });

  it("startFastFromShortcut no-ops without a userId", async () => {
    const { result } = renderHook(() => useTodayFasting({ userId: undefined }));
    await act(async () => {
      await result.current.startFastFromShortcut(16);
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(result.current.activeFastStart).toBeNull();
  });

  it("startFastFromShortcut does not stack a second session when one is already active", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { fasting_sessions: [{ start: "2026-07-19T08:00:00.000Z", end: null }] },
    });
    const { result } = renderHook(() => useTodayFasting({ userId: "user-1" }));
    await act(async () => {
      await result.current.startFastFromShortcut(16);
    });
    expect(updateMock).not.toHaveBeenCalled();
    expect(result.current.activeFastStart).toBeNull();
  });

  it("startFastFromShortcut starts a fast: persists the session, sets activeFastStart, tracks siri_action_invoked", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { fasting_sessions: [{ start: "2026-07-01T08:00:00.000Z", end: "2026-07-01T20:00:00.000Z" }] },
    });
    const { result } = renderHook(() => useTodayFasting({ userId: "user-1" }));

    await act(async () => {
      await result.current.startFastFromShortcut(18);
    });

    expect(fromMock).toHaveBeenCalledWith("profiles");
    expect(selectMock).toHaveBeenCalledWith("fasting_sessions");
    expect(selectEqMock).toHaveBeenCalledWith("id", "user-1");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fasting_sessions: expect.arrayContaining([
          { start: "2026-07-01T08:00:00.000Z", end: "2026-07-01T20:00:00.000Z" },
          expect.objectContaining({ end: null }),
        ]),
      }),
    );
    expect(updateEqMock).toHaveBeenCalledWith("id", "user-1");
    expect(result.current.activeFastStart).not.toBeNull();
    expect(trackMock).toHaveBeenCalledWith(
      "siri_action_invoked",
      expect.objectContaining({ kind: "start_fast", hours: 18 }),
    );
  });

  it("startFastFromShortcut caps persisted session history at 90 entries", async () => {
    const existing = Array.from({ length: 95 }, (_, i) => ({
      start: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T08:00:00.000Z`,
      end: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T20:00:00.000Z`,
    }));
    maybeSingleMock.mockResolvedValueOnce({ data: { fasting_sessions: existing } });
    const { result } = renderHook(() => useTodayFasting({ userId: "user-1" }));

    await act(async () => {
      await result.current.startFastFromShortcut(16);
    });

    const payload = updateMock.mock.calls[0]?.[0] as { fasting_sessions: unknown[] };
    expect(payload.fasting_sessions.length).toBe(90);
  });
});
