/**
 * @vitest-environment node
 */
/**
 * Web dev/test flag-force override (ENG P5 parity, gap #13) — mirrors the
 * mobile `EXPO_PUBLIC_FLAG_FORCE_*` hook at apps/mobile/lib/analytics.ts.
 * Source: src/lib/analytics/track.ts (`isFeatureEnabled` / `isFeatureDisabled`).
 *
 * Contract:
 *  - When NODE_ENV !== "production", read `NEXT_PUBLIC_FLAG_FORCE_<FLAG_KEY>`
 *    (uppercase, hyphen→underscore) and honour "1"/"true" (ON) and
 *    "0"/"false" (OFF), short-circuiting the PostHog client.
 *  - In production the env is never read, so behaviour is PostHog-only.
 *  - `isFeatureDisabled` treats a forced-OFF flag as disabled, forced-ON as
 *    not-disabled.
 *
 * This lets Playwright capture flag-ON goldens (the committed auth fixture
 * seeds an empty PostHog flag set, so without the force layer only the
 * flag-OFF path ever renders). The guard keeps production untouched.
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

import { isFeatureEnabled, isFeatureDisabled } from "@/lib/analytics/track";

// NON-redesign flags. ENG-771 moved `today_log_again` and `log-sheet-slot-selector`
// into `REDESIGN_DEFAULT_ON` (default-ON), so `isFeatureEnabled` short-circuits them
// to `true` BEFORE the override / PostHog layer this file exercises — which would
// mask the mechanism under test. Use QA-only flags that are NOT in any default-ON
// set so the override precedence + fallthrough stay observable. Redesign flags'
// default-ON behaviour is covered by `redesignFlagsUngated.test.ts`. The hyphenated
// `HYPHEN_FLAG` still proves the hyphen→underscore env mapping.
const SNAKE_FLAG = "qa_test_flag_snake";
const SNAKE_ENV = "NEXT_PUBLIC_FLAG_FORCE_QA_TEST_FLAG_SNAKE";
const HYPHEN_FLAG = "qa-test-flag-hyphen";
const HYPHEN_ENV = "NEXT_PUBLIC_FLAG_FORCE_QA_TEST_FLAG_HYPHEN";

describe("web flag-force override (NEXT_PUBLIC_FLAG_FORCE_*)", () => {
  beforeEach(() => {
    isEnabledMock.mockReset();
    // PostHog present + flag explicitly OFF, so any override that fires is
    // unambiguously distinguishable from the live client's answer.
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
    vi.stubEnv("NODE_ENV", "test");
    isEnabledMock.mockReturnValue(false);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('forces a flag ON with "true" (isFeatureEnabled → true, PostHog not consulted)', () => {
    vi.stubEnv(SNAKE_ENV, "true");
    expect(isFeatureEnabled(SNAKE_FLAG)).toBe(true);
    expect(isEnabledMock).not.toHaveBeenCalled();
  });

  it('forces a flag ON with "1"', () => {
    vi.stubEnv(SNAKE_ENV, "1");
    expect(isFeatureEnabled(SNAKE_FLAG)).toBe(true);
    expect(isEnabledMock).not.toHaveBeenCalled();
  });

  it('forces a flag OFF with "false" even when PostHog reports ON', () => {
    isEnabledMock.mockReturnValue(true);
    vi.stubEnv(SNAKE_ENV, "false");
    expect(isFeatureEnabled(SNAKE_FLAG)).toBe(false);
    expect(isEnabledMock).not.toHaveBeenCalled();
  });

  it('forces a flag OFF with "0"', () => {
    isEnabledMock.mockReturnValue(true);
    vi.stubEnv(SNAKE_ENV, "0");
    expect(isFeatureEnabled(SNAKE_FLAG)).toBe(false);
    expect(isEnabledMock).not.toHaveBeenCalled();
  });

  it("maps hyphenated flag keys to underscore env vars", () => {
    vi.stubEnv(HYPHEN_ENV, "true");
    expect(isFeatureEnabled(HYPHEN_FLAG)).toBe(true);
  });

  it("falls through to PostHog when the override value is unrecognised", () => {
    isEnabledMock.mockReturnValue(true);
    vi.stubEnv(SNAKE_ENV, "yes");
    expect(isFeatureEnabled(SNAKE_FLAG)).toBe(true);
    expect(isEnabledMock).toHaveBeenCalledWith(SNAKE_FLAG);
  });

  it("falls through to PostHog when no override env is set", () => {
    isEnabledMock.mockReturnValue(true);
    expect(isFeatureEnabled(SNAKE_FLAG)).toBe(true);
    expect(isEnabledMock).toHaveBeenCalledWith(SNAKE_FLAG);
  });

  it("ignores the override entirely in production (PostHog-only)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(SNAKE_ENV, "true"); // would force ON in dev — must be inert here
    isEnabledMock.mockReturnValue(false);
    expect(isFeatureEnabled(SNAKE_FLAG)).toBe(false);
    expect(isEnabledMock).toHaveBeenCalledWith(SNAKE_FLAG);
  });

  describe("isFeatureDisabled honours the same override", () => {
    it('forced OFF → disabled (true)', () => {
      vi.stubEnv(SNAKE_ENV, "false");
      expect(isFeatureDisabled(SNAKE_FLAG)).toBe(true);
      expect(isEnabledMock).not.toHaveBeenCalled();
    });

    it('forced ON → not disabled (false)', () => {
      vi.stubEnv(SNAKE_ENV, "true");
      expect(isFeatureDisabled(SNAKE_FLAG)).toBe(false);
      expect(isEnabledMock).not.toHaveBeenCalled();
    });

    it("is inert in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv(SNAKE_ENV, "false");
      isEnabledMock.mockReturnValue(true); // PostHog says ON → not disabled
      expect(isFeatureDisabled(SNAKE_FLAG)).toBe(false);
      expect(isEnabledMock).toHaveBeenCalledWith(SNAKE_FLAG);
    });
  });

  describe("a non-redesign flag defaults OFF", () => {
    it("reads false with no PostHog flag and no override (default-OFF registration)", () => {
      // No override env, PostHog returns undefined (flag not provisioned/unloaded).
      // Non-redesign flags are NOT in REDESIGN_DEFAULT_ON, so they fall through to
      // the (cold) PostHog client and resolve false. (Redesign flags default ON —
      // see `redesignFlagsUngated.test.ts`.)
      isEnabledMock.mockReturnValue(undefined);
      expect(isFeatureEnabled(SNAKE_FLAG)).toBe(false);
    });
  });
});

/**
 * CLIENT-side override via `window.__SUPPR_FORCE_FLAGS__` (Playwright seeds it
 * with `forceFlagsOn`, tests/e2e/utils/visual.ts). This is the browser force
 * path — Next can't inline the computed NEXT_PUBLIC_FLAG_FORCE_* key into the
 * client bundle, so the env branch is SSR-only. This file is `@vitest-environment
 * node`, so we simulate the browser by assigning `globalThis.window`.
 */
describe("web flag-force override — client window hook (__SUPPR_FORCE_FLAGS__)", () => {
  const g = globalThis as { window?: unknown };
  beforeEach(() => {
    isEnabledMock.mockReset();
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
    vi.stubEnv("NODE_ENV", "test");
    isEnabledMock.mockReturnValue(false);
  });
  afterEach(() => {
    delete g.window;
    vi.unstubAllEnvs();
  });

  it("forces a flag ON from the window hook (PostHog not consulted)", () => {
    g.window = { __SUPPR_FORCE_FLAGS__: { [SNAKE_FLAG]: true } };
    expect(isFeatureEnabled(SNAKE_FLAG)).toBe(true);
    expect(isEnabledMock).not.toHaveBeenCalled();
  });

  it("forces a flag OFF from the window hook even when PostHog reports ON", () => {
    isEnabledMock.mockReturnValue(true);
    g.window = { __SUPPR_FORCE_FLAGS__: { [SNAKE_FLAG]: false } };
    expect(isFeatureEnabled(SNAKE_FLAG)).toBe(false);
    expect(isFeatureDisabled(SNAKE_FLAG)).toBe(true);
    expect(isEnabledMock).not.toHaveBeenCalled();
  });

  it("is inert in production (window hook ignored, PostHog-only)", () => {
    vi.stubEnv("NODE_ENV", "production");
    g.window = { __SUPPR_FORCE_FLAGS__: { [SNAKE_FLAG]: true } };
    isEnabledMock.mockReturnValue(false);
    expect(isFeatureEnabled(SNAKE_FLAG)).toBe(false);
    expect(isEnabledMock).toHaveBeenCalledWith(SNAKE_FLAG);
  });

  it("falls through to PostHog when the flag is absent from the window hook", () => {
    isEnabledMock.mockReturnValue(true);
    g.window = { __SUPPR_FORCE_FLAGS__: { some_other_flag: true } };
    expect(isFeatureEnabled(SNAKE_FLAG)).toBe(true);
    expect(isEnabledMock).toHaveBeenCalledWith(SNAKE_FLAG);
  });
});
