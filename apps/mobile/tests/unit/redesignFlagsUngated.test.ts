// @vitest-environment node
/**
 * Redesign 2026 flags are UN-GATED (mobile) — default ON in every build.
 *
 * Grace 2026-06-01: "turn everything on, never flag-gate again." The 2
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
 *
 * `design_system_elevation`, `design_system_icons`, and `redesign_winmoment`
 * collapsed out of REDESIGN_DEFAULT_ON (ENG-1651): all were removed entirely
 * and the code now ships their ON-branch styling/behaviour unconditionally,
 * so none appear in this suite's flag lists. Mobile never had a live
 * `design_system_icons` conditional in component code (web-only call sites)
 * — it only ever appeared here and in REDESIGN_DEFAULT_ON.
 *
 * `design_system_brandmark` likewise collapsed out of REDESIGN_DEFAULT_ON
 * (ENG-1651, lighter-touch slice): it already had zero live isFeatureEnabled
 * call sites (brand mark unified unconditionally 2026-06-04), so removing it
 * from the default-on set is pure vestigial-reference cleanup — no behavior
 * changes. It no longer appears in this suite's flag lists.
 *
 * `onboarding-app-choice` collapsed out of REDESIGN_DEFAULT_ON (ENG-1651):
 * the flag was removed entirely and the "Coming from another app?" step now
 * ships unconditionally on both flow shells. It was never in this suite's
 * flag lists (it's a Gate 1.5 flow-logic flag, not a redesign visual flag —
 * see redesignDefaultOnParity.test.ts's GATE_15_SHARED), so there's nothing
 * to remove there either.
 *
 * `design_system_colours` and `redesign_branded_sheets` likewise collapsed
 * out of REDESIGN_DEFAULT_ON (ENG-1651): both flags were removed entirely and
 * the code now ships their ON-branch styling unconditionally, so neither
 * appears in this suite's flag lists.
 *
 * `redesign_search_results` collapsed out of REDESIGN_DEFAULT_ON (ENG-1651)
 * on both platforms: the flag was removed entirely and its ON-branch
 * (FoodSearchFeedItem-based rendering + SearchResultConfidenceChip) now ships
 * unconditionally on web and mobile, so it no longer appears in this suite's
 * flag lists.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";

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
import { setAnalyticsConsent } from "../../lib/analyticsConsent";

// ENG-1286 — analytics is consent-gated; accept so the non-redesign
// PostHog-follow test below still reaches the FakePostHog client.
beforeAll(async () => {
  await setAnalyticsConsent("accepted");
});

const REDESIGN_FLAGS = [
  "redesign_motion",
];

const GATE_15_FLAGS = [
  "today_meals_figma_654",
  "log_sheet_nl_text_v1",
  "log-sheet-slot-selector",
  "ring_skia_v1",
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
    expect(isFeatureEnabled("today_meals_figma_654")).toBe(true);
    isEnabledMock.mockImplementation(() => {
      throw new Error("posthog not ready");
    });
    expect(isFeatureEnabled("redesign_motion")).toBe(true);
  });

  it("lets an explicit dev force OFF win (so pre-redesign captures still work)", () => {
    vi.stubGlobal("__DEV__", true);
    vi.stubEnv("EXPO_PUBLIC_FLAG_FORCE_TODAY_MEALS_FIGMA_654", "false");
    expect(isFeatureEnabled("today_meals_figma_654")).toBe(false);
  });

  it("does not affect non-redesign flags (they still follow PostHog)", () => {
    isEnabledMock.mockReturnValue(false);
    expect(isFeatureEnabled("some_other_flag")).toBe(false);
    isEnabledMock.mockReturnValue(true);
    expect(isFeatureEnabled("some_other_flag")).toBe(true);
  });
});
