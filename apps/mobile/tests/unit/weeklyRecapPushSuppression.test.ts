/**
 * Mobile-side suppression of the local weekly-recap push (TestFlight
 * build 10 fix C — `AOjQg5DGBZqS5qNJ1Rqu960`,
 * `APdpODtJDL8q2JhtGup6DK0` follow-up).
 *
 * Background: `apps/mobile/lib/weeklyRecapPush.ts` used to schedule a
 * local `WEEKLY` notification on every call. Once the server starts
 * fanning out (see `/api/push/weekly-recap`) users with a synced Expo
 * push token would receive two pings per week on the same device.
 *
 * Contract this test pins:
 *   1. When a non-empty token is cached at `LAST_PUSH_TOKEN_CACHE_KEY`
 *      (`expo_push_token_last_synced_v1`) the helper cancels any
 *      existing local schedule and returns `null` — server owns it.
 *   2. When no token is cached (permission denied, simulator, or
 *      pre-upgrade install that never ran the token registration path)
 *      the helper falls through to the existing local-schedule
 *      behaviour so we do not regress a working nudge.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import AsyncStorage from "@react-native-async-storage/async-storage";

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

// `lib/weeklyRecapPush.ts` imports `LAST_PUSH_TOKEN_CACHE_KEY` from
// `lib/expoPushToken.ts`, which in turn imports `@/lib/supabase`. Stub
// the Supabase + expo-constants surface so the module graph resolves
// without a native bridge.
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: "https://example.supabase.co",
        supabaseAnonKey: "anon",
        eas: { projectId: "test-project-id" },
      },
    },
  },
}));
vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn(() => ({ update: vi.fn() })) },
}));

const cancelScheduledNotificationAsync = vi.fn(async () => undefined);
const scheduleNotificationAsync = vi.fn(async () => "scheduled-id");
const getPermissionsAsync = vi.fn(async () => ({
  status: "granted",
  granted: true,
  canAskAgain: true,
}));
const requestPermissionsAsync = vi.fn(async () => ({
  status: "granted",
  granted: true,
  canAskAgain: true,
}));
vi.mock("expo-notifications", () => ({
  cancelScheduledNotificationAsync,
  scheduleNotificationAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  SchedulableTriggerInputTypes: { WEEKLY: "weekly" },
}));

vi.mock("../../lib/errorTracking", () => ({
  captureException: vi.fn(),
}));

vi.mock("../../lib/weeklyRecap", () => ({
  nextRecapFireDate: vi.fn(() => new Date("2026-04-26T18:00:00.000Z")),
  // Sunday push rewrite — T5 (2026-04-19): scheduler now stamps the
  // recap's `weekKey` into the notification data payload so the
  // tap-listener in `_layout.tsx` can attribute opens. Mocked here
  // because importing the real helper would pull in
  // `progressWeekReport` and friends just to satisfy the module graph.
  weekKeyFor: vi.fn(() => "2026-W15"),
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  cancelScheduledNotificationAsync.mockClear();
  scheduleNotificationAsync.mockClear();
  getPermissionsAsync.mockClear();
  getPermissionsAsync.mockImplementation(async () => ({
    status: "granted",
    granted: true,
    canAskAgain: true,
  }));
  requestPermissionsAsync.mockClear();
});

describe("scheduleWeeklyRecapPush — server-delivery suppression", () => {
  it("cancels the local schedule and returns null when a synced token is cached", async () => {
    const tokenMod = await import("../../lib/expoPushToken");
    await AsyncStorage.setItem(
      tokenMod.LAST_PUSH_TOKEN_CACHE_KEY,
      "ExponentPushToken[abc]",
    );

    const { scheduleWeeklyRecapPush } = await import("../../lib/weeklyRecapPush");
    const result = await scheduleWeeklyRecapPush({
      enabled: true,
      weekStartDay: "monday",
    });

    expect(result).toBeNull();
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("schedules the local push when no token is cached (fallback path)", async () => {
    // No AsyncStorage seed — token cache is empty.
    const { scheduleWeeklyRecapPush } = await import("../../lib/weeklyRecapPush");
    const result = await scheduleWeeklyRecapPush({
      enabled: true,
      weekStartDay: "monday",
    });

    expect(result).toBeInstanceOf(Date);
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it("treats an empty-string cache value as no token and keeps the local fallback", async () => {
    const tokenMod = await import("../../lib/expoPushToken");
    await AsyncStorage.setItem(tokenMod.LAST_PUSH_TOKEN_CACHE_KEY, "");

    const { scheduleWeeklyRecapPush } = await import("../../lib/weeklyRecapPush");
    const result = await scheduleWeeklyRecapPush({
      enabled: true,
      weekStartDay: "sunday",
    });

    expect(result).toBeInstanceOf(Date);
    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it("returns null without scheduling when the user has opted out (enabled=false)", async () => {
    const { scheduleWeeklyRecapPush } = await import("../../lib/weeklyRecapPush");
    const result = await scheduleWeeklyRecapPush({
      enabled: false,
      weekStartDay: "monday",
    });

    expect(result).toBeNull();
    // Still cancels any existing schedule as before.
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
