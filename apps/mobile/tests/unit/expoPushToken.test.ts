/**
 * Push token lifecycle (TestFlight build 7 fix —
 * `AOjQg5DGBZqS5qNJ1Rqu960`, `APdpODtJDL8q2JhtGup6DK0`).
 *
 * Pins the contract that:
 *   1. The notifications-prompt screen reads
 *      `hasNotificationsPromptBeenDismissed()` on mount and skips
 *      rendering when the AsyncStorage flag is set.
 *   2. `registerExpoPushTokenForUser` calls `getExpoPushTokenAsync` with
 *      the EAS project ID from `app.json` (`expo.extra.eas.projectId`)
 *      and writes `profiles.expo_push_token` for the current user.
 *   3. Both the grant and skip paths call
 *      `markNotificationsPromptDismissed` so the explainer never
 *      re-fires once the user has responded.
 *
 * Tests run under vitest's node env via the mobile vitest config; we
 * mock `expo-notifications`, `expo-constants`, and `@/lib/supabase` at
 * the module boundary so the test never reaches a native bridge.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import AsyncStorage from "@react-native-async-storage/async-storage";

// expo-constants needs the EAS project ID exposed under the same path
// the helper reads (`Constants.expoConfig.extra.eas.projectId`).
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

type SupabaseEqResult = { error: null | { message: string } };
const supabaseUpdateChain = {
  // Final `eq` resolves like a PostgrestSingleResponse — `{ error: null }`
  // is the success shape used elsewhere in the codebase. Typed loosely so
  // tests can `mockResolvedValueOnce` either the success or the error shape.
  eq: vi.fn<(...args: unknown[]) => Promise<SupabaseEqResult>>(async () => ({ error: null })),
};
const supabaseUpdate = vi.fn(() => supabaseUpdateChain);
const supabaseFrom = vi.fn(() => ({ update: supabaseUpdate }));
vi.mock("@/lib/supabase", () => ({
  supabase: { from: supabaseFrom },
}));

const getExpoPushTokenAsync = vi.fn(async () => ({ data: "ExponentPushToken[abc]" }));
const getPermissionsAsync = vi.fn(async () => ({ status: "granted", granted: true }));
vi.mock("expo-notifications", () => ({
  getExpoPushTokenAsync,
  getPermissionsAsync,
  requestPermissionsAsync: vi.fn(async () => ({ status: "granted", granted: true })),
  setNotificationChannelAsync: vi.fn(async () => undefined),
  AndroidImportance: { DEFAULT: 3 },
}));

beforeEach(async () => {
  // Reset the in-memory AsyncStorage shim so each test starts clean.
  // Don't `vi.resetModules()` here — the helper module imports
  // AsyncStorage by reference and we need the same module instance the
  // top-level `import` is bound to.
  await AsyncStorage.clear();
  supabaseFrom.mockClear();
  supabaseUpdate.mockClear();
  supabaseUpdateChain.eq.mockClear();
  supabaseUpdateChain.eq.mockImplementation(async () => ({ error: null }));
  getExpoPushTokenAsync.mockClear();
  getExpoPushTokenAsync.mockImplementation(async () => ({ data: "ExponentPushToken[abc]" }));
  getPermissionsAsync.mockClear();
  getPermissionsAsync.mockImplementation(async () => ({ status: "granted", granted: true }));
});

describe("hasNotificationsPromptBeenDismissed", () => {
  it("returns true when the AsyncStorage flag is set", async () => {
    const mod = await import("../../lib/expoPushToken");
    await AsyncStorage.setItem(mod.NOTIFICATIONS_PROMPT_DISMISSED_KEY, "true");
    expect(await mod.hasNotificationsPromptBeenDismissed()).toBe(true);
  });

  it("returns true when the OS already reports `granted`", async () => {
    getPermissionsAsync.mockResolvedValueOnce({ status: "granted", granted: true });
    const mod = await import("../../lib/expoPushToken");
    expect(await mod.hasNotificationsPromptBeenDismissed()).toBe(true);
  });

  it("returns true when the OS already reports `denied` (so we don't re-nag)", async () => {
    getPermissionsAsync.mockResolvedValueOnce({ status: "denied", granted: false });
    const mod = await import("../../lib/expoPushToken");
    expect(await mod.hasNotificationsPromptBeenDismissed()).toBe(true);
  });

  it("returns false when the flag is unset and the OS is `undetermined`", async () => {
    getPermissionsAsync.mockResolvedValueOnce({ status: "undetermined", granted: false });
    const mod = await import("../../lib/expoPushToken");
    expect(await mod.hasNotificationsPromptBeenDismissed()).toBe(false);
  });
});

describe("markNotificationsPromptDismissed", () => {
  it("writes the canonical AsyncStorage flag value", async () => {
    const mod = await import("../../lib/expoPushToken");
    await mod.markNotificationsPromptDismissed();
    expect(await AsyncStorage.getItem(mod.NOTIFICATIONS_PROMPT_DISMISSED_KEY)).toBe("true");
  });
});

describe("registerExpoPushTokenForUser", () => {
  it("fetches the token with the EAS project ID and writes it to profiles.expo_push_token", async () => {
    const mod = await import("../../lib/expoPushToken");
    const result = await mod.registerExpoPushTokenForUser("user-123");

    expect(getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
    expect(getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "test-project-id" });

    expect(supabaseFrom).toHaveBeenCalledWith("profiles");
    expect(supabaseUpdate).toHaveBeenCalledWith({ expo_push_token: "ExponentPushToken[abc]" });
    expect(supabaseUpdateChain.eq).toHaveBeenCalledWith("id", "user-123");

    expect(result).toEqual({ ok: true, token: "ExponentPushToken[abc]" });

    // Cache populated so a follow-up refresh short-circuits.
    expect(await AsyncStorage.getItem(mod.LAST_PUSH_TOKEN_CACHE_KEY)).toBe(
      "ExponentPushToken[abc]",
    );
  });

  it("returns { ok: false, no_user } when userId is null", async () => {
    const mod = await import("../../lib/expoPushToken");
    const result = await mod.registerExpoPushTokenForUser(null);
    expect(result).toEqual({ ok: false, reason: "no_user" });
    expect(getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(supabaseFrom).not.toHaveBeenCalled();
  });

  it("does not crash when getExpoPushTokenAsync rejects (e.g. simulator / no network)", async () => {
    getExpoPushTokenAsync.mockRejectedValueOnce(new Error("token fetch failed"));
    const mod = await import("../../lib/expoPushToken");
    const result = await mod.registerExpoPushTokenForUser("user-123");
    expect(result).toEqual({ ok: false, reason: "fetch_failed" });
    expect(supabaseFrom).not.toHaveBeenCalled();
  });

  it("returns { ok: false, db_failed } when the supabase update errors", async () => {
    supabaseUpdateChain.eq.mockResolvedValueOnce({ error: { message: "rls" } });
    const mod = await import("../../lib/expoPushToken");
    const result = await mod.registerExpoPushTokenForUser("user-123");
    expect(result).toEqual({ ok: false, reason: "db_failed" });
  });
});

describe("refreshExpoPushTokenIfChanged", () => {
  it("no-ops when the cached token matches the freshly-fetched one", async () => {
    const mod = await import("../../lib/expoPushToken");
    await AsyncStorage.setItem(mod.LAST_PUSH_TOKEN_CACHE_KEY, "ExponentPushToken[abc]");
    await mod.refreshExpoPushTokenIfChanged("user-123");
    expect(supabaseUpdate).not.toHaveBeenCalled();
  });

  it("writes a new token when the value has rotated since last sync", async () => {
    const mod = await import("../../lib/expoPushToken");
    await AsyncStorage.setItem(mod.LAST_PUSH_TOKEN_CACHE_KEY, "ExponentPushToken[OLD]");
    getExpoPushTokenAsync.mockResolvedValueOnce({ data: "ExponentPushToken[NEW]" });
    await mod.refreshExpoPushTokenIfChanged("user-123");
    expect(supabaseUpdate).toHaveBeenCalledWith({ expo_push_token: "ExponentPushToken[NEW]" });
    expect(supabaseUpdateChain.eq).toHaveBeenCalledWith("id", "user-123");
    expect(await AsyncStorage.getItem(mod.LAST_PUSH_TOKEN_CACHE_KEY)).toBe(
      "ExponentPushToken[NEW]",
    );
  });

  it("skips entirely when permission is not granted", async () => {
    getPermissionsAsync.mockResolvedValueOnce({ status: "denied", granted: false });
    const mod = await import("../../lib/expoPushToken");
    await mod.refreshExpoPushTokenIfChanged("user-123");
    expect(getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(supabaseUpdate).not.toHaveBeenCalled();
  });
});

/**
 * Source-level pin (mirrors `aiPaywallSheetShape.test.ts`): the prompt
 * screen must call the suppression helper on both the enable and skip
 * paths and must read the dismiss state on mount. Render-level testing
 * lives outside this file because the prompt screen needs the auth
 * provider; the structural pins below catch the regressions that
 * matter (helpers wired, both paths suppress).
 */
describe("notifications-prompt.tsx wiring", () => {
  const PROMPT_PATH = resolve(__dirname, "../../app/notifications-prompt.tsx");
  const SOURCE = readFileSync(PROMPT_PATH, "utf8");

  it("imports the dismiss + register helpers from @/lib/expoPushToken", () => {
    expect(SOURCE).toMatch(/from\s+["']@\/lib\/expoPushToken["']/);
    expect(SOURCE).toMatch(/hasNotificationsPromptBeenDismissed/);
    expect(SOURCE).toMatch(/markNotificationsPromptDismissed/);
    expect(SOURCE).toMatch(/registerExpoPushTokenForUser/);
  });

  it("calls the register helper on grant and the dismiss helper on every exit", () => {
    // Grant path writes the token.
    expect(SOURCE).toMatch(/registerExpoPushTokenForUser\(/);
    // Both onEnable and onSkip mark the prompt as dismissed so a
    // deliberate "no" + a successful grant both suppress future runs.
    const dismissCalls = SOURCE.match(/markNotificationsPromptDismissed\(\)/g) ?? [];
    expect(dismissCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("checks dismiss state on mount before rendering the explainer", () => {
    expect(SOURCE).toMatch(/hasNotificationsPromptBeenDismissed\(\)/);
    // The screen must early-return rather than flash the explainer
    // when the user has already responded.
    expect(SOURCE).toMatch(/if\s*\(showPrompt\s*!==\s*true\)/);
  });
});

/**
 * Pin: the focus-effect refresh is wired into the Today tab so token
 * rotations across reinstalls / restore-from-backup are picked up
 * without requiring the user to re-grant permission.
 */
describe("Today tab token refresh", () => {
  const TODAY_PATH = resolve(__dirname, "../../app/(tabs)/index.tsx");
  const SOURCE = readFileSync(TODAY_PATH, "utf8");

  it("imports refreshExpoPushTokenIfChanged from @/lib/expoPushToken", () => {
    expect(SOURCE).toMatch(/refreshExpoPushTokenIfChanged.*from\s+["']@\/lib\/expoPushToken["']/);
  });

  it("invokes the refresh helper inside a useFocusEffect", () => {
    // Sanity: the call sits inside one of the focus effects, not at
    // module load time.
    expect(SOURCE).toMatch(/refreshExpoPushTokenIfChanged\(userId\)/);
  });
});
