/**
 * Tests for `lib/clearUserScopedStorage` — the AsyncStorage wipe that
 * runs on signOut to prevent cross-user state leak (audit Y02,
 * 2026-05-05).
 *
 * The structural risk this guards against: User A's `cachedUserTier`
 * (Pro) being read by User B on the same device, or User A's
 * push-prompt-dismissed flag suppressing User B's prompt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resetWriterCacheMock = vi.fn();
vi.mock("@/lib/healthKitMealWriter", () => ({
  resetHealthKitMealWriterCache: resetWriterCacheMock,
}));

/**
 * Test pattern: call `freshModule()` BEFORE writing AsyncStorage keys.
 * `vi.resetModules()` blows away the AsyncStorage shim instance, so
 * any setItem before the reset would leak into a stale instance the
 * code under test never sees.
 */
async function freshModule(): Promise<{
  clearUserScopedAsyncStorage: typeof import("@/lib/clearUserScopedStorage").clearUserScopedAsyncStorage;
  AsyncStorage: typeof import("@react-native-async-storage/async-storage").default;
}> {
  vi.resetModules();
  const mod = await import("@/lib/clearUserScopedStorage");
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  return { clearUserScopedAsyncStorage: mod.clearUserScopedAsyncStorage, AsyncStorage };
}

describe("clearUserScopedAsyncStorage", () => {
  beforeEach(() => {
    resetWriterCacheMock.mockClear();
  });
  afterEach(async () => {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.clear();
  });

  it("removes the cached user tier (User B must not inherit User A's Pro)", async () => {
    const { clearUserScopedAsyncStorage, AsyncStorage } = await freshModule();
    await AsyncStorage.setItem("suppr.cached_user_tier", "pro");
    await clearUserScopedAsyncStorage();
    expect(await AsyncStorage.getItem("suppr.cached_user_tier")).toBeNull();
  });

  it("removes the push-prompt-dismissed flag (User B must be eligible for the prompt)", async () => {
    const { clearUserScopedAsyncStorage, AsyncStorage } = await freshModule();
    await AsyncStorage.setItem("notifications_prompt_dismissed_v1", "true");
    await clearUserScopedAsyncStorage();
    expect(await AsyncStorage.getItem("notifications_prompt_dismissed_v1")).toBeNull();
  });

  it("removes the meal-plan-slots prefs", async () => {
    const { clearUserScopedAsyncStorage, AsyncStorage } = await freshModule();
    await AsyncStorage.setItem("suppr-meal-plan-slots-v1", JSON.stringify([]));
    await AsyncStorage.setItem("suppr-active-meal-plan-slot-v1", "abc");
    await clearUserScopedAsyncStorage();
    expect(await AsyncStorage.getItem("suppr-meal-plan-slots-v1")).toBeNull();
    expect(await AsyncStorage.getItem("suppr-active-meal-plan-slot-v1")).toBeNull();
  });

  it("removes the Apple Health import/export toggle states", async () => {
    const { clearUserScopedAsyncStorage, AsyncStorage } = await freshModule();
    await AsyncStorage.setItem("health_export_nutrition", "true");
    await AsyncStorage.setItem("health_import_nutrition", "true");
    await AsyncStorage.setItem("health_import_generic_labels", "true");
    await clearUserScopedAsyncStorage();
    expect(await AsyncStorage.getItem("health_export_nutrition")).toBeNull();
    expect(await AsyncStorage.getItem("health_import_nutrition")).toBeNull();
    expect(await AsyncStorage.getItem("health_import_generic_labels")).toBeNull();
  });

  it("removes the onboarding draft state (fresh user starts onboarding from scratch)", async () => {
    const { clearUserScopedAsyncStorage, AsyncStorage } = await freshModule();
    await AsyncStorage.setItem("suppr.onboarding-v2.state", JSON.stringify({ goal: "lose" }));
    await clearUserScopedAsyncStorage();
    expect(await AsyncStorage.getItem("suppr.onboarding-v2.state")).toBeNull();
  });

  it("resets the in-memory HealthKit-meal-writer cache so the next sign-in starts clean", async () => {
    const { clearUserScopedAsyncStorage } = await freshModule();
    await clearUserScopedAsyncStorage();
    expect(resetWriterCacheMock).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — running twice doesn't throw", async () => {
    const { clearUserScopedAsyncStorage } = await freshModule();
    await clearUserScopedAsyncStorage();
    await clearUserScopedAsyncStorage();
    // No assertion needed — just must not throw.
  });

  it("never throws even if AsyncStorage has been preloaded with unexpected shapes", async () => {
    const { clearUserScopedAsyncStorage, AsyncStorage } = await freshModule();
    await AsyncStorage.setItem("suppr.cached_user_tier", "free");
    await AsyncStorage.setItem("suppr.tracking-extras.v1", "{not-json");
    await expect(clearUserScopedAsyncStorage()).resolves.toBeUndefined();
  });
});
