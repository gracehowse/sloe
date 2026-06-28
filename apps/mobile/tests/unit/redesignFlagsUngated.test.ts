// @vitest-environment node
/**
 * Redesign 2026 flags are UN-GATED (mobile) — default ON in every build.
 *
 * Grace 2026-06-01: "turn everything on, never flag-gate again." The 8
 * redesign flags resolve ON in `isFeatureEnabled` regardless of PostHog
 * rollout state or the (bundle-dead) env-force — see REDESIGN_DEFAULT_ON in
 * apps/mobile/lib/analytics.ts. This is the fix-by-elimination for ENG-840
 * (flags never resolved on the iOS build). Parity: src/lib/analytics/track.ts.
 *
 * Contract proven here:
 *  - redesign flags → true even when the PostHog client resolves them OFF
 *    (the SDK is never consulted for them);
 *  - an explicit dev force OFF still wins (so pre-redesign captures work);
 *  - non-redesign flags are unaffected (still follow PostHog).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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
  }
  return { default: FakePostHog };
});

import { isFeatureEnabled } from "../../lib/analytics";

const REDESIGN_FLAGS = [
  "design_system_elevation",
  "design_system_colours",
  "design_system_brandmark",
  "design_system_icons",
  "redesign_winmoment",
  "redesign_motion",
  "redesign_branded_sheets",
  "redesign_search_results",
];

const GATE_15_FLAGS = [
  "today_meals_figma_654",
  "today_tracker_tier_v1",
  "card_cohesion_white_v1",
  "log_sheet_nl_text_v1",
  "log-sheet-slot-selector",
  "ring_skia_v1",
  "recipe_detail_v3_conformance",
  "discover_creator_rail_v1",
  "coach_full_screen_v1",
] as const;

describe("redesign flags are un-gated (mobile)", () => {
  beforeEach(() => {
    isEnabledMock.mockReset();
    vi.unstubAllGlobals(); // not __DEV__ → force branch skipped
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns true for every redesign flag even when PostHog resolves OFF", () => {
    isEnabledMock.mockReturnValue(false);
    for (const flag of REDESIGN_FLAGS) {
      expect(isFeatureEnabled(flag)).toBe(true);
    }
    // The SDK is never consulted for un-gated flags.
    expect(isEnabledMock).not.toHaveBeenCalled();
  });

  it("returns true for Gate 1.5 flags even when PostHog resolves OFF", () => {
    isEnabledMock.mockReturnValue(false);
    for (const flag of GATE_15_FLAGS) {
      expect(isFeatureEnabled(flag)).toBe(true);
    }
    expect(isEnabledMock).not.toHaveBeenCalled();
  });

  it("returns true even when the flag is unloaded (undefined) or the SDK throws", () => {
    isEnabledMock.mockReturnValue(undefined);
    expect(isFeatureEnabled("design_system_elevation")).toBe(true);
    isEnabledMock.mockImplementation(() => {
      throw new Error("posthog not ready");
    });
    expect(isFeatureEnabled("redesign_motion")).toBe(true);
  });

  it("lets an explicit dev force OFF win (so pre-redesign captures still work)", () => {
    vi.stubGlobal("__DEV__", true);
    vi.stubEnv("EXPO_PUBLIC_FLAG_FORCE_DESIGN_SYSTEM_ELEVATION", "false");
    expect(isFeatureEnabled("design_system_elevation")).toBe(false);
  });

  it("does not affect non-redesign flags (they still follow PostHog)", () => {
    isEnabledMock.mockReturnValue(false);
    expect(isFeatureEnabled("some_other_flag")).toBe(false);
    isEnabledMock.mockReturnValue(true);
    expect(isFeatureEnabled("some_other_flag")).toBe(true);
  });
});
