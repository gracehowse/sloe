/**
 * Unit tests for the pure response-handler that decides whether a
 * `Notifications.NotificationResponse` should fire the
 * `weekly_recap_push_opened` analytics event.
 *
 * Sunday push rewrite — T5 (2026-04-19).
 *
 * The listener registration in `apps/mobile/app/_layout.tsx` is a thin
 * wire — all branching lives in `handleWeeklyRecapNotificationResponse`
 * inside `apps/mobile/lib/weeklyRecapPush.ts`, which we exercise here
 * without touching the native bridge. We still mock the module-graph
 * boundary (Supabase, expo-constants) for the same reason as
 * `weeklyRecapPushSuppression.test.ts`: importing `weeklyRecapPush.ts`
 * pulls in `expoPushToken.ts` → `@/lib/supabase`.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

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

vi.mock("expo-notifications", () => ({
  cancelScheduledNotificationAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  SchedulableTriggerInputTypes: { WEEKLY: "weekly" },
}));

vi.mock("../../lib/errorTracking", () => ({
  captureException: vi.fn(),
}));

import { handleWeeklyRecapNotificationResponse } from "../../lib/weeklyRecapPush";

/**
 * Build a minimal `NotificationResponse`-shaped object. Only the
 * `notification.request.content.data` path matters for the handler.
 */
function makeResponse(data: unknown): unknown {
  return {
    notification: {
      request: {
        content: { data },
      },
    },
  };
}

describe("handleWeeklyRecapNotificationResponse", () => {
  it("returns shouldTrack=true with the supplied weekKey when kind matches", () => {
    const decision = handleWeeklyRecapNotificationResponse(
      makeResponse({ kind: "weekly_recap", weekKey: "2026-W15", deepLink: "/progress" }),
    );
    expect(decision).toEqual({ shouldTrack: true, weekKey: "2026-W15" });
  });

  it("returns shouldTrack=true with weekKey=null when kind matches but weekKey is missing", () => {
    // Pre-existing local pushes scheduled before the `weekKey` data
    // field was added still have to attribute SOMEWHERE — analytics
    // treats `null` as a legacy bucket rather than dropping the event.
    const decision = handleWeeklyRecapNotificationResponse(
      makeResponse({ kind: "weekly_recap", deepLink: "/progress" }),
    );
    expect(decision).toEqual({ shouldTrack: true, weekKey: null });
  });

  it("returns shouldTrack=true with weekKey=null when weekKey is the wrong type", () => {
    // Defence-in-depth: a corrupt server payload (e.g. weekKey: 123)
    // must not propagate a non-string into the analytics call.
    const decision = handleWeeklyRecapNotificationResponse(
      makeResponse({ kind: "weekly_recap", weekKey: 123 }),
    );
    expect(decision).toEqual({ shouldTrack: true, weekKey: null });
  });

  it("returns shouldTrack=true with weekKey=null when weekKey is an empty string", () => {
    const decision = handleWeeklyRecapNotificationResponse(
      makeResponse({ kind: "weekly_recap", weekKey: "" }),
    );
    expect(decision).toEqual({ shouldTrack: true, weekKey: null });
  });

  it("returns shouldTrack=false for an unrelated push kind", () => {
    const decision = handleWeeklyRecapNotificationResponse(
      makeResponse({ kind: "streak_freeze_earned", weekKey: "2026-W15" }),
    );
    expect(decision).toEqual({ shouldTrack: false, weekKey: null });
  });

  it("returns shouldTrack=false when data is missing", () => {
    const decision = handleWeeklyRecapNotificationResponse(makeResponse(undefined));
    expect(decision).toEqual({ shouldTrack: false, weekKey: null });
  });

  it("returns shouldTrack=false when data is not an object", () => {
    const decision = handleWeeklyRecapNotificationResponse(
      makeResponse("weekly_recap"),
    );
    expect(decision).toEqual({ shouldTrack: false, weekKey: null });
  });

  it("returns shouldTrack=false for malformed responses (no notification)", () => {
    expect(handleWeeklyRecapNotificationResponse(null)).toEqual({
      shouldTrack: false,
      weekKey: null,
    });
    expect(handleWeeklyRecapNotificationResponse(undefined)).toEqual({
      shouldTrack: false,
      weekKey: null,
    });
    expect(handleWeeklyRecapNotificationResponse({})).toEqual({
      shouldTrack: false,
      weekKey: null,
    });
    expect(
      handleWeeklyRecapNotificationResponse({ notification: {} }),
    ).toEqual({ shouldTrack: false, weekKey: null });
    expect(
      handleWeeklyRecapNotificationResponse({
        notification: { request: { content: null } },
      }),
    ).toEqual({ shouldTrack: false, weekKey: null });
  });
});
