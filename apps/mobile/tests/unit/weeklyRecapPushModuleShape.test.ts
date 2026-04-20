/**
 * Pin the post-kill surface of `apps/mobile/lib/weeklyRecapPush.ts`
 * (see docs/decisions/2026-04-20-weekly-recap-mobile-local-killed.md).
 *
 * After the 2026-04-20 kill, the module must NOT export a
 * `scheduleWeeklyRecapPush` function and must NOT call
 * `Notifications.scheduleNotificationAsync` under any code path. Both
 * are regression pins — accidentally re-introducing the local
 * scheduler would silently resurrect the generic-body Sunday push.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

// Minimal expo-notifications shim — spy on `scheduleNotificationAsync`
// to prove the module never invokes it.
const scheduleNotificationAsync = vi.fn(async () => "scheduled-id");
const cancelScheduledNotificationAsync = vi.fn(async () => undefined);
vi.mock("expo-notifications", () => ({
  scheduleNotificationAsync,
  cancelScheduledNotificationAsync,
}));

vi.mock("../../lib/errorTracking", () => ({
  captureException: vi.fn(),
}));

describe("weeklyRecapPush — post-kill module shape (2026-04-20)", () => {
  it("does NOT export scheduleWeeklyRecapPush", async () => {
    const mod: Record<string, unknown> = await import("../../lib/weeklyRecapPush");
    expect(mod.scheduleWeeklyRecapPush).toBeUndefined();
    expect(mod.nextRecapDate).toBeUndefined();
  });

  it("exports only the post-kill surface", async () => {
    const mod: Record<string, unknown> = await import("../../lib/weeklyRecapPush");
    expect(typeof mod.cancelWeeklyRecapPush).toBe("function");
    expect(typeof mod.handleWeeklyRecapNotificationResponse).toBe("function");
  });

  it("cancelWeeklyRecapPush never schedules", async () => {
    scheduleNotificationAsync.mockClear();
    const { cancelWeeklyRecapPush } = await import("../../lib/weeklyRecapPush");
    await cancelWeeklyRecapPush();
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(cancelScheduledNotificationAsync).toHaveBeenCalledWith("weekly-recap-v1");
  });

  it("cancelWeeklyRecapPush swallows native errors without crashing", async () => {
    cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error("native boom"));
    const { cancelWeeklyRecapPush } = await import("../../lib/weeklyRecapPush");
    await expect(cancelWeeklyRecapPush()).resolves.toBeUndefined();
  });
});
