/**
 * ENG-1594 (Today extract, slice 1) — behaviour tests for
 * `useTodayWeeklyCheckin`, the weekly TDEE check-in ritual (state +
 * once-per-session gating effect + accept/dismiss handlers) extracted
 * verbatim from `TodayScreen.tsx`.
 *
 * The underlying gate math (`shouldShowWeeklyCheckin`) and content
 * builder (`buildWeeklyCheckinContent`) are already pinned at the shared
 * lib level (`tests/unit/weeklyCheckin.test.ts`, root tests dir) — these
 * tests instead cover the hook's OWN responsibility: React state wiring,
 * the once-per-session `weeklyCheckinHandledRef` gate, the edit-meal
 * suppression, and the accept/dismiss side effects (Supabase persistence
 * + the optimistic `setProfileTargets` bump). The build-45/47 edit-meal
 * guard is additionally pinned by source-scan in
 * `weeklyCheckinEditMealGuard.test.ts` — this file exercises the same
 * guard behaviourally end-to-end.
 */
import { act, renderHook } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

const trackMock = vi.fn();
const isFeatureEnabledMock = vi.fn((_flag: string) => false);
const eqMock = vi.fn(async (_col: string, _val: string) => ({ error: null }));
const updateMock = vi.fn((_payload: Record<string, unknown>) => ({ eq: eqMock }));
const fromMock = vi.fn((_table: string) => ({ update: updateMock }));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (...args: [string]) => fromMock(...args) },
}));

vi.mock("@/lib/analytics", () => ({
  track: (...args: [string, Record<string, unknown>]) => trackMock(...args),
  isFeatureEnabled: (flag: string) => isFeatureEnabledMock(flag),
}));

import { useTodayWeeklyCheckin } from "../../hooks/useTodayWeeklyCheckin";

type WeekData = {
  days: { totals: { calories: number } }[];
  weekAvg: { calories: number };
};

function fiveLoggedDaysWeek(avgCalories = 1800): WeekData {
  return {
    days: Array.from({ length: 5 }, () => ({ totals: { calories: 1800 } })),
    weekAvg: { calories: avgCalories },
  };
}

function baseParams(overrides: Partial<Parameters<typeof useTodayWeeklyCheckin>[0]> = {}) {
  return {
    userId: "user-1",
    isToday: true,
    editingMeal: null,
    params: {} as { editMealId?: string },
    profileMaintenanceTdeeKcal: 2200,
    profileMaintenanceConfidence: "high" as const,
    weekData: fiveLoggedDaysWeek(),
    targetCalories: 1800,
    resolvedMaintenance: { formulaKcal: 2000 },
    profileSex: "female" as const,
    setProfileTargets: vi.fn(),
    ...overrides,
  };
}

describe("useTodayWeeklyCheckin", () => {
  beforeEach(() => {
    trackMock.mockClear();
    isFeatureEnabledMock.mockClear();
    isFeatureEnabledMock.mockReturnValue(false);
    eqMock.mockClear();
    updateMock.mockClear();
    fromMock.mockClear();
  });

  it("checkinAsCard reflects the redesign_winmoment flag", () => {
    isFeatureEnabledMock.mockReturnValue(true);
    const { result } = renderHook(() => useTodayWeeklyCheckin(baseParams()));
    expect(result.current.checkinAsCard).toBe(true);
    expect(isFeatureEnabledMock).toHaveBeenCalledWith("redesign_winmoment");
  });

  it("never fires the gate when isToday is false", () => {
    const { result } = renderHook(() =>
      useTodayWeeklyCheckin(baseParams({ isToday: false })),
    );
    expect(result.current.weeklyCheckinContent).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("never fires the gate without a userId", () => {
    const { result } = renderHook(() =>
      useTodayWeeklyCheckin(baseParams({ userId: undefined })),
    );
    expect(result.current.weeklyCheckinContent).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("build-45/47: suppresses via editingMeal and marks the session handled — never fires even after editingMeal clears", () => {
    const meal = { id: "m1", name: "Snacks" } as never;
    const { result, rerender } = renderHook(
      (props: { editingMeal: unknown }) =>
        useTodayWeeklyCheckin(baseParams({ editingMeal: props.editingMeal as never })),
      { initialProps: { editingMeal: meal } },
    );
    expect(result.current.weeklyCheckinContent).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();

    // build-47: clearing editingMeal must NOT let the gate fire — the
    // edit-flow guard marks the session handled, not just this render.
    rerender({ editingMeal: null });
    expect(result.current.weeklyCheckinContent).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("build-45/47: suppresses via params.editMealId the same as editingMeal", () => {
    const { result, rerender } = renderHook(
      (props: { editMealId?: string }) =>
        useTodayWeeklyCheckin(baseParams({ params: { editMealId: props.editMealId } })),
      { initialProps: { editMealId: "meal-9" } },
    );
    expect(result.current.weeklyCheckinContent).toBeNull();

    rerender({ editMealId: undefined });
    // Session already marked handled by the first render's guard hit.
    expect(result.current.weeklyCheckinContent).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("fires when eligible: builds content, stamps last_weekly_checkin_shown_at, tracks weekly_checkin_shown", () => {
    const { result } = renderHook(() => useTodayWeeklyCheckin(baseParams()));

    expect(result.current.weeklyCheckinContent).not.toBeNull();
    expect(result.current.weeklyCheckinContent?.suggestedTargetKcal).toBeGreaterThan(0);

    expect(fromMock).toHaveBeenCalledWith("profiles");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ last_weekly_checkin_shown_at: expect.any(String) }),
    );
    expect(eqMock).toHaveBeenCalledWith("id", "user-1");
    expect(trackMock).toHaveBeenCalledWith(
      "weekly_checkin_shown",
      expect.objectContaining({ confidence: "high", daysLoggedThisWeek: 5 }),
    );
  });

  it("does not fire when adaptive confidence is low (gate math, exercised through the hook)", () => {
    const { result } = renderHook(() =>
      useTodayWeeklyCheckin(baseParams({ profileMaintenanceConfidence: "low" })),
    );
    expect(result.current.weeklyCheckinContent).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("cooldown: setWeeklyCheckinShownAt (the loadProfileTargets hydration path) suppresses a too-recent re-show, and a stale one allows it", () => {
    // Start ineligible on isToday so the first effect run doesn't fire
    // before we get a chance to seed a shown-at, matching how
    // `loadProfileTargets` hydrates this ahead of the gate ever running.
    const { result, rerender } = renderHook(
      (props: { isToday: boolean }) =>
        useTodayWeeklyCheckin(baseParams({ isToday: props.isToday })),
      { initialProps: { isToday: false } },
    );

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    act(() => {
      result.current.setWeeklyCheckinShownAt(twoDaysAgo);
    });

    // Within the 6-day cooldown — gate must not fire.
    rerender({ isToday: true });
    expect(result.current.weeklyCheckinContent).toBeNull();

    // Outside the cooldown — gate fires.
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    act(() => {
      result.current.setWeeklyCheckinShownAt(eightDaysAgo);
    });
    rerender({ isToday: true });
    expect(result.current.weeklyCheckinContent).not.toBeNull();
  });

  it("handleWeeklyCheckinAccept bumps profileTargets optimistically and persists the digest_recalibration decision", () => {
    const setProfileTargets = vi.fn();
    const { result } = renderHook(() =>
      useTodayWeeklyCheckin(baseParams({ setProfileTargets })),
    );
    const content = result.current.weeklyCheckinContent;
    expect(content).not.toBeNull();
    const suggested = content!.suggestedTargetKcal;

    fromMock.mockClear();
    updateMock.mockClear();
    eqMock.mockClear();
    trackMock.mockClear();

    act(() => {
      result.current.handleWeeklyCheckinAccept();
    });

    const updater = setProfileTargets.mock.calls[0][0] as (prev: {
      calories: number;
      protein: number;
    }) => { calories: number; protein: number };
    expect(updater({ calories: 1234, protein: 99 })).toEqual({
      calories: suggested,
      protein: 99,
    });

    expect(fromMock).toHaveBeenCalledWith("profiles");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        target_calories: suggested,
        target_calories_source: "digest_recalibration",
        last_weekly_checkin_decision: "accepted",
      }),
    );
    expect(eqMock).toHaveBeenCalledWith("id", "user-1");
    expect(trackMock).toHaveBeenCalledWith(
      "weekly_checkin_accepted",
      expect.objectContaining({ suggestedTargetKcal: suggested }),
    );
  });

  it("handleWeeklyCheckinAccept no-ops (besides closing) when there is no content yet", () => {
    const setProfileTargets = vi.fn();
    const { result } = renderHook(() =>
      useTodayWeeklyCheckin(baseParams({ isToday: false, setProfileTargets })),
    );
    expect(result.current.weeklyCheckinContent).toBeNull();

    act(() => {
      result.current.handleWeeklyCheckinAccept();
    });
    expect(setProfileTargets).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("handleWeeklyCheckinDismiss persists kept_current and tracks the dismissal", () => {
    const { result } = renderHook(() => useTodayWeeklyCheckin(baseParams()));
    fromMock.mockClear();
    updateMock.mockClear();
    eqMock.mockClear();
    trackMock.mockClear();

    act(() => {
      result.current.handleWeeklyCheckinDismiss();
    });

    expect(fromMock).toHaveBeenCalledWith("profiles");
    expect(updateMock).toHaveBeenCalledWith({ last_weekly_checkin_decision: "kept_current" });
    expect(eqMock).toHaveBeenCalledWith("id", "user-1");
    expect(trackMock).toHaveBeenCalledWith(
      "weekly_checkin_dismissed",
      expect.objectContaining({ reason: "kept_current" }),
    );
  });
});
