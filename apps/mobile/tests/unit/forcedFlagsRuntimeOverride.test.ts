// @vitest-environment node
/**
 * ENG-840 — mobile dev/QA runtime flag-force override.
 *
 * The env-based `EXPO_PUBLIC_FLAG_FORCE_*` path is DEAD in a bundled RN
 * app (Metro never inlines a computed `process.env[key]`), so the only
 * way to preview a flag-gated screen on device/sim — without a PostHog
 * ramp — is the AsyncStorage-backed runtime map added here. This suite
 * covers `primeForcedFlags` / `setForcedFlag` / `clearForcedFlags` and
 * the override precedence inside `isFeatureEnabled` / `isFeatureDisabled`.
 *
 * The mobile vitest setup ships an in-memory `AsyncStorage` shim
 * (tests/shims/async-storage.ts), so we write through the real
 * persistence and assert without mocking it.
 *
 * `qa_neutral_test_flag` is a QA-only flag that is NOT in REDESIGN_DEFAULT_ON
 * (default-OFF, PostHog-resolved), so a forced value is unambiguously
 * distinguishable from the live client. (today_log_again — the previous example
 * — became default-ON via ENG-771, so it can no longer serve this role.)
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Captured at module load — must be set before the static import below.
vi.hoisted(() => {
  process.env.EXPO_PUBLIC_POSTHOG_KEY = "phc_mobile_test_key";
});

const isEnabledMock = vi.fn();

vi.mock("posthog-react-native", () => {
  class FakePostHog {
    isFeatureEnabled(flag: string): boolean | undefined {
      return isEnabledMock(flag) as boolean | undefined;
    }
    capture(): void {}
    identify(): void {}
    getDistinctId(): string {
      return "anon";
    }
    reset(): void {}
    reloadFeatureFlagsAsync(): Promise<void> {
      return Promise.resolve();
    }
    ready(): Promise<void> {
      return Promise.resolve();
    }
  }
  return { default: FakePostHog };
});

import {
  __resetForcedFlagsForTests,
  clearForcedFlags,
  getForcedFlags,
  isFeatureDisabled,
  isFeatureEnabled,
  primeForcedFlags,
  setForcedFlag,
} from "../../lib/analytics";

const FLAG = "qa_neutral_test_flag";
const STORAGE_KEY = "__SUPPR_FORCE_FLAGS__";

describe("mobile runtime flag-force override (ENG-840)", () => {
  beforeEach(async () => {
    isEnabledMock.mockReset();
    isEnabledMock.mockReturnValue(false);
    await AsyncStorage.clear();
    __resetForcedFlagsForTests();
    vi.stubGlobal("__DEV__", true);
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    __resetForcedFlagsForTests();
    await AsyncStorage.clear();
  });

  it("setForcedFlag(true) forces the flag ON and persists to AsyncStorage", async () => {
    await setForcedFlag(FLAG, true);
    expect(isFeatureEnabled(FLAG)).toBe(true);
    expect(isEnabledMock).not.toHaveBeenCalled();
    expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEY))!)).toEqual({
      [FLAG]: true,
    });
  });

  it("setForcedFlag(false) forces OFF even when PostHog reports ON", async () => {
    isEnabledMock.mockReturnValue(true);
    await setForcedFlag(FLAG, false);
    expect(isFeatureEnabled(FLAG)).toBe(false);
    expect(isFeatureDisabled(FLAG)).toBe(true);
    expect(isEnabledMock).not.toHaveBeenCalled();
  });

  it("setForcedFlag(null) clears the override → falls through to PostHog", async () => {
    await setForcedFlag(FLAG, true);
    expect(isFeatureEnabled(FLAG)).toBe(true);
    await setForcedFlag(FLAG, null);
    isEnabledMock.mockReturnValue(true);
    expect(isFeatureEnabled(FLAG)).toBe(true);
    expect(isEnabledMock).toHaveBeenCalledWith(FLAG);
    expect(getForcedFlags()).toEqual({});
  });

  it("primeForcedFlags hydrates the in-memory map from AsyncStorage", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ [FLAG]: true }));
    // Before priming, the in-memory map is empty → live client decides.
    expect(getForcedFlags()).toEqual({});
    await primeForcedFlags();
    expect(getForcedFlags()).toEqual({ [FLAG]: true });
    expect(isFeatureEnabled(FLAG)).toBe(true);
    expect(isEnabledMock).not.toHaveBeenCalled();
  });

  it("clearForcedFlags wipes the map and the persisted blob", async () => {
    await setForcedFlag(FLAG, true);
    await clearForcedFlags();
    expect(getForcedFlags()).toEqual({});
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("the runtime map takes precedence over the (dead) env path", async () => {
    // env says OFF, runtime map says ON → runtime wins.
    vi.stubEnv("EXPO_PUBLIC_FLAG_FORCE_QA_NEUTRAL_TEST_FLAG", "false");
    await setForcedFlag(FLAG, true);
    expect(isFeatureEnabled(FLAG)).toBe(true);
  });

  it("is inert outside __DEV__ (release builds): setter no-ops", async () => {
    vi.stubGlobal("__DEV__", false);
    await setForcedFlag(FLAG, true);
    expect(getForcedFlags()).toEqual({});
    // override branch skipped entirely → PostHog client path runs
    isEnabledMock.mockReturnValue(true);
    expect(isFeatureEnabled(FLAG)).toBe(true);
    expect(isEnabledMock).toHaveBeenCalledWith(FLAG);
  });

  it("primeForcedFlags is a no-op outside __DEV__", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ [FLAG]: true }));
    vi.stubGlobal("__DEV__", false);
    await primeForcedFlags();
    expect(getForcedFlags()).toEqual({});
  });
});
