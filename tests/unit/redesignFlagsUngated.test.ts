// @vitest-environment jsdom
/**
 * Redesign 2026 flags are UN-GATED (web) — default ON in every build.
 *
 * Grace 2026-06-01: "turn everything on, never flag-gate again." Parity with
 * apps/mobile/lib/analytics.ts: `isFeatureEnabled` returns ON for the 7
 * redesign flags regardless of PostHog rollout, via REDESIGN_DEFAULT_ON in
 * src/lib/analytics/track.ts. An explicit dev/test force still wins so the
 * pre-redesign visual captures keep working.
 *
 * `design_system_elevation` collapsed out of REDESIGN_DEFAULT_ON (ENG-1651):
 * the flag was removed entirely and the code now ships its ON-branch styling
 * unconditionally, so it no longer appears in this suite's flag lists.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const isEnabledMock = vi.fn();

vi.mock("posthog-js", () => ({
  default: {
    isFeatureEnabled: (flag: string) => isEnabledMock(flag),
    capture() {},
  },
}));

import { isFeatureEnabled } from "@/lib/analytics/track";

const REDESIGN_FLAGS = [
  "design_system_colours",
  "design_system_brandmark",
  "design_system_icons",
  "redesign_winmoment",
  "redesign_motion",
  "redesign_branded_sheets",
  "redesign_search_results",
];

/** Gate 1.5 surfaces — must resolve ON without PostHog (see redesignDefaultOnParity.test.ts). */
const GATE_15_FLAGS = [
  "today_meals_figma_654",
  "log_sheet_nl_text_v1",
  "log-sheet-slot-selector",
] as const;

describe("redesign flags are un-gated (web)", () => {
  beforeEach(() => {
    isEnabledMock.mockReset();
    delete (window as { __SUPPR_FORCE_FLAGS__?: unknown }).__SUPPR_FORCE_FLAGS__;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as { __SUPPR_FORCE_FLAGS__?: unknown }).__SUPPR_FORCE_FLAGS__;
  });

  it("returns true for every redesign flag, even with no PostHog key", () => {
    // No NEXT_PUBLIC_POSTHOG_KEY → the un-gate returns before the key check.
    for (const flag of REDESIGN_FLAGS) {
      expect(isFeatureEnabled(flag)).toBe(true);
    }
    expect(isEnabledMock).not.toHaveBeenCalled();
  });

  it("returns true for Gate 1.5 shared flags without consulting PostHog", () => {
    for (const flag of GATE_15_FLAGS) {
      expect(isFeatureEnabled(flag)).toBe(true);
    }
    expect(isEnabledMock).not.toHaveBeenCalled();
  });

  it("lets an explicit force OFF win (pre-redesign captures still work)", () => {
    (window as { __SUPPR_FORCE_FLAGS__?: Record<string, unknown> }).__SUPPR_FORCE_FLAGS__ =
      { design_system_colours: false };
    expect(isFeatureEnabled("design_system_colours")).toBe(false);
  });

  it("does not affect non-redesign flags", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_web_test_key");
    isEnabledMock.mockReturnValue(true);
    expect(isFeatureEnabled("some_other_flag")).toBe(true);
    isEnabledMock.mockReturnValue(false);
    expect(isFeatureEnabled("some_other_flag")).toBe(false);
  });
});
