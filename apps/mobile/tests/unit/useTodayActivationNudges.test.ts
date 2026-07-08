/**
 * ENG-1361 (round 2) — behaviour tests for `useTodayActivationNudges`,
 * the one-shot activation-nudge cluster (AI-first-log tooltip,
 * activity-budget-discover banner, first-log toast + haptic, first-meal
 * tip, post-onboarding push explainer) extracted from `TodayScreen.tsx`.
 */
import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTodayActivationNudges } from "../../hooks/useTodayActivationNudges";
import type { JournalMeal } from "@/lib/nutritionJournal";

const hapticsSuccessMock = vi.fn();
const registerExpoPushTokenForUserMock = vi.fn(async (_userId: string | null | undefined) => {});
const maybeSingleMock = vi.fn(async () => ({ data: { onboarding_completed: true } }));

vi.mock("@/hooks/useHaptics", () => ({
  useHaptics: () => ({
    tap: vi.fn(),
    select: vi.fn(),
    success: hapticsSuccessMock,
    warn: vi.fn(),
    confirm: vi.fn(),
    heavy: vi.fn(),
  }),
}));

vi.mock("@/lib/expoPushToken", () => ({
  registerExpoPushTokenForUser: (id: string | null) => registerExpoPushTokenForUserMock(id),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => maybeSingleMock(),
        }),
      }),
    }),
  },
}));

type NotifPermStatus = "granted" | "denied" | "undetermined";
const notifGetSpy = vi.fn(async (): Promise<{ status: NotifPermStatus }> => ({ status: "undetermined" }));
const notifRequestSpy = vi.fn(async (): Promise<{ status: NotifPermStatus }> => ({ status: "granted" }));
vi.mock("expo-notifications", () => ({
  getPermissionsAsync: notifGetSpy,
  requestPermissionsAsync: notifRequestSpy,
}));

function meal(id: string, source: string | null = null): JournalMeal {
  return {
    id,
    name: "Test meal",
    time: "12:00",
    calories: 100,
    protein: 5,
    carbs: 10,
    fat: 3,
    ...(source ? { source } : {}),
  } as JournalMeal;
}

const TODAY_KEY = "2026-07-07";

/** The hook mounts five independent AsyncStorage-hydrating effects (plus,
 *  when a userId is present, a sixth Supabase + expo-notifications check).
 *  A test that only `waitFor`s the one flag it cares about can otherwise
 *  leave the others still in flight when the test body returns, which
 *  updates the hook's state outside of `act()` on the next tick. Flush
 *  every microtask queue drain the mocked async calls above resolve on. */
async function flushAllPendingHydration() {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) {
      await Promise.resolve();
    }
  });
}

describe("useTodayActivationNudges", () => {
  beforeEach(async () => {
    hapticsSuccessMock.mockClear();
    registerExpoPushTokenForUserMock.mockClear();
    maybeSingleMock.mockClear();
    notifGetSpy.mockClear();
    notifRequestSpy.mockClear();
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    // Flush any hydration effects still in flight from the just-finished
    // test's hook tree so the next test's `beforeEach` never races a
    // leftover state update from the prior render.
    await flushAllPendingHydration();
  });

  it("hides the AI-first-log tooltip until the storage flag hydrates as unshown, then anchors to the first AI-sourced meal", async () => {
    const mealsToday = [meal("m1"), meal("m2", "ai_photo")];
    const { result } = renderHook(() =>
      useTodayActivationNudges({ userId: "u1", dayKey: TODAY_KEY, mealsToday }),
    );

    await waitFor(() => expect(result.current.aiFirstLogTooltipMealId).toBe("m2"));
    await waitFor(() => expect(result.current.postOnbPushVisible).toBe(true));
    await flushAllPendingHydration();
  });

  it("never anchors the AI tooltip once dismissed (persists across remounts)", async () => {
    const mealsToday = [meal("m1", "ai_photo")];
    const { result, unmount } = renderHook(() =>
      useTodayActivationNudges({ userId: "u1", dayKey: TODAY_KEY, mealsToday }),
    );
    await waitFor(() => expect(result.current.aiFirstLogTooltipMealId).toBe("m1"));
    await waitFor(() => expect(result.current.postOnbPushVisible).toBe(true));
    await flushAllPendingHydration();

    act(() => {
      result.current.dismissAiFirstLogTooltip();
    });
    unmount();

    const { result: result2 } = renderHook(() =>
      useTodayActivationNudges({ userId: "u1", dayKey: TODAY_KEY, mealsToday }),
    );
    // Flag hydrates as "already shown" → tooltip id stays null even with
    // an AI-sourced meal present.
    await waitFor(() => expect(result2.current.aiFirstLogTooltipMealId).toBeNull());
    await waitFor(() => expect(result2.current.postOnbPushVisible).toBe(true));
    await flushAllPendingHydration();
  });

  it("dismisses the activity-budget-discover banner and persists it", async () => {
    const { result } = renderHook(() =>
      useTodayActivationNudges({ userId: "u1", dayKey: TODAY_KEY, mealsToday: [] }),
    );
    await waitFor(() => expect(result.current.activityBudgetDiscoverDismissed).toBe(false));

    act(() => {
      result.current.dismissActivityBudgetDiscover();
    });
    expect(result.current.activityBudgetDiscoverDismissed).toBe(true);
    await waitFor(() => expect(result.current.postOnbPushVisible).toBe(true));
    await flushAllPendingHydration();
  });

  it("fires the first-log toast + success haptic on a 0->1 transition for today, not on rehydrate", async () => {
    const { result, rerender } = renderHook(
      ({ mealsToday }: { mealsToday: JournalMeal[] }) =>
        useTodayActivationNudges({ userId: "u1", dayKey: TODAY_KEY, mealsToday }),
      { initialProps: { mealsToday: [] as JournalMeal[] } },
    );

    // Wait for the AsyncStorage flag to hydrate (firstLogAckShown === false).
    await waitFor(() => expect(result.current.firstLogToastVisible).toBe(false));

    // Cold-start rehydrate: 0 -> 2 in one jump should NOT toast (prev seeds to 2).
    act(() => {
      rerender({ mealsToday: [meal("a"), meal("b")] });
    });
    await waitFor(() => expect(result.current.firstLogToastVisible).toBe(false));
    expect(hapticsSuccessMock).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.postOnbPushVisible).toBe(true));
    await flushAllPendingHydration();
  });

  it("dismissFirstLogToast hides the toast and persists the ack flag", async () => {
    const { result } = renderHook(() =>
      useTodayActivationNudges({ userId: "u1", dayKey: TODAY_KEY, mealsToday: [] }),
    );
    await waitFor(() => expect(result.current.firstLogToastVisible).toBe(false));

    act(() => {
      result.current.dismissFirstLogToast();
    });
    expect(result.current.firstLogToastVisible).toBe(false);
    const stored = await AsyncStorage.getItem("suppr.first-log-acknowledged.v1");
    expect(stored).not.toBeNull();
    await waitFor(() => expect(result.current.postOnbPushVisible).toBe(true));
    await flushAllPendingHydration();
  });

  it("exposes postLogNudgeLine state + setter for the TodayScreen commit path to drive", async () => {
    const { result } = renderHook(() =>
      useTodayActivationNudges({ userId: "u1", dayKey: TODAY_KEY, mealsToday: [] }),
    );
    expect(result.current.postLogNudgeLine).toBeNull();
    act(() => {
      result.current.setPostLogNudgeLine("Try adding some greens");
    });
    expect(result.current.postLogNudgeLine).toBe("Try adding some greens");
    await waitFor(() => expect(result.current.postOnbPushVisible).toBe(true));
    await flushAllPendingHydration();
  });

  it("dismisses the first-meal tip and persists it", async () => {
    const { result } = renderHook(() =>
      useTodayActivationNudges({ userId: "u1", dayKey: TODAY_KEY, mealsToday: [] }),
    );
    expect(result.current.firstMealTipDismissed).toBe(false);
    act(() => {
      result.current.dismissFirstMealTip();
    });
    expect(result.current.firstMealTipDismissed).toBe(true);
    const stored = await AsyncStorage.getItem("suppr.first-meal-tip-dismissed.v1");
    expect(stored).not.toBeNull();
    // Let the unrelated post-onboarding-push effect (also mounted by this
    // hook) settle before the test ends, so its state update lands inside
    // this test's `act` scope rather than bleeding into the next test.
    await waitFor(() => expect(result.current.postOnbPushVisible).toBe(true));
    await flushAllPendingHydration();
  });

  it("shows the post-onboarding push explainer when permission is undetermined and onboarding is complete", async () => {
    const { result } = renderHook(() =>
      useTodayActivationNudges({ userId: "u1", dayKey: TODAY_KEY, mealsToday: [] }),
    );
    await waitFor(() => expect(result.current.postOnbPushVisible).toBe(true));
    expect(maybeSingleMock).toHaveBeenCalled();
    await flushAllPendingHydration();
  });

  it("onPostOnbPushEnable requests permission and registers the push token on grant", async () => {
    const { result } = renderHook(() =>
      useTodayActivationNudges({ userId: "u1", dayKey: TODAY_KEY, mealsToday: [] }),
    );
    await waitFor(() => expect(result.current.postOnbPushVisible).toBe(true));

    act(() => {
      result.current.onPostOnbPushEnable();
    });
    await waitFor(() => expect(result.current.postOnbPushVisible).toBe(false));

    expect(notifRequestSpy).toHaveBeenCalled();
    expect(registerExpoPushTokenForUserMock).toHaveBeenCalledWith("u1");
    await flushAllPendingHydration();
  });

  it("onPostOnbPushSkip dismisses without registering a push token", async () => {
    const { result } = renderHook(() =>
      useTodayActivationNudges({ userId: "u1", dayKey: TODAY_KEY, mealsToday: [] }),
    );
    await waitFor(() => expect(result.current.postOnbPushVisible).toBe(true));

    act(() => {
      result.current.onPostOnbPushSkip();
    });
    await waitFor(() => expect(result.current.postOnbPushVisible).toBe(false));
    expect(registerExpoPushTokenForUserMock).not.toHaveBeenCalled();
    await flushAllPendingHydration();
  });

  it("never surfaces the post-onboarding push explainer without a userId", async () => {
    const { result } = renderHook(() =>
      useTodayActivationNudges({ userId: undefined, dayKey: TODAY_KEY, mealsToday: [] }),
    );
    // No userId → the check effect returns early; give pending microtasks
    // a chance to flush, then assert it never fired.
    await flushAllPendingHydration();
    expect(result.current.postOnbPushVisible).toBe(false);
    expect(maybeSingleMock).not.toHaveBeenCalled();
  });
});
