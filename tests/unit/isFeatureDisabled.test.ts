/**
 * @vitest-environment node
 */
/**
 * isFeatureDisabled (web) — executing tests for the fail-safe kill
 * switch over already-shipped, default-ON behaviour.
 * Source: src/lib/analytics/track.ts.
 *
 * The contract that matters: this is deliberately NOT
 * `!isFeatureEnabled(flag)`. `isFeatureEnabled` collapses "flag off"
 * and "flag not loaded yet" into the same `false`, so negating it would
 * SKIP the gated behaviour whenever PostHog is cold — which, during
 * onboarding completion, is the common case. `isFeatureDisabled` returns
 * `true` ONLY when the flag resolves explicitly to `false`, so a cold /
 * missing / unloaded PostHog leaves the gated behaviour (seeding) ON.
 *
 * These run the real helper against a controllable `posthog-js` mock so
 * the cold-start regression — a flag-gate that empties every new user's
 * library — can't silently come back.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const isEnabledMock = vi.fn();

vi.mock("posthog-js", () => ({
  default: {
    isFeatureEnabled: (flag: string) => isEnabledMock(flag),
    capture: vi.fn(),
    setPersonProperties: vi.fn(),
  },
}));

import { isFeatureDisabled, isFeatureEnabled } from "@/lib/analytics/track";

const FLAG = "onboarding_default_seeds";

describe("isFeatureDisabled (web)", () => {
  beforeEach(() => {
    isEnabledMock.mockReset();
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when the PostHog key is missing (cold env → not disabled)", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    expect(isFeatureDisabled(FLAG)).toBe(false);
    // The SDK is never consulted — short-circuits on the missing key.
    expect(isEnabledMock).not.toHaveBeenCalled();
  });

  it("returns false when the flag is unloaded (undefined → not disabled)", () => {
    isEnabledMock.mockReturnValue(undefined);
    expect(isFeatureDisabled(FLAG)).toBe(false);
  });

  it("returns false when the flag resolves ON (true → not disabled)", () => {
    isEnabledMock.mockReturnValue(true);
    expect(isFeatureDisabled(FLAG)).toBe(false);
  });

  it("returns true ONLY when the flag resolves explicitly OFF (false → disabled)", () => {
    isEnabledMock.mockReturnValue(false);
    expect(isFeatureDisabled(FLAG)).toBe(true);
  });

  it("returns false when the SDK throws (never wedges seeding off)", () => {
    isEnabledMock.mockImplementation(() => {
      throw new Error("posthog not ready");
    });
    expect(isFeatureDisabled(FLAG)).toBe(false);
  });

  it("is NOT the naive negation of isFeatureEnabled when the flag is cold", () => {
    // The whole reason the helper exists: a cold flag reads `false` from
    // isFeatureEnabled, so `!isFeatureEnabled` would be `true` and skip
    // seeding. isFeatureDisabled must stay `false` here.
    isEnabledMock.mockReturnValue(undefined);
    expect(isFeatureEnabled(FLAG)).toBe(false);
    expect(isFeatureDisabled(FLAG)).toBe(false);
  });
});
