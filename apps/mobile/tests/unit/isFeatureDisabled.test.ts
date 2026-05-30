// @vitest-environment node
/**
 * isFeatureDisabled (mobile) — executing tests for the fail-safe kill
 * switch, mirror of the web helper in src/lib/analytics/track.ts.
 * Source: apps/mobile/lib/analytics.ts.
 *
 * Same core contract as web: returns `true` ONLY when the flag resolves
 * explicitly to `false`; a cold / missing client or an unloaded flag
 * returns `false` ("not disabled") so the gated behaviour (onboarding
 * seeding) proceeds. A naive `!isFeatureEnabled` would skip seeding
 * whenever flags are cold — the common case during onboarding
 * completion — and empty every new user's library.
 *
 * Mobile adds a `__DEV__` + `EXPO_PUBLIC_FLAG_FORCE_<FLAG>` override the
 * Maestro E2E flows depend on (PostHog local-eval races first render in
 * dev). Both the override path and the PostHog-client path are covered.
 *
 * We set a PostHog key BEFORE importing the module (the key is captured
 * at module load) so `getPostHogClient` builds a client, and stub
 * `posthog-react-native` so the SDK's native bindings never load.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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
  }
  return { default: FakePostHog };
});

import { isFeatureDisabled, isFeatureEnabled } from "../../lib/analytics";

const FLAG = "onboarding_default_seeds";
const FORCE_ENV = "EXPO_PUBLIC_FLAG_FORCE_ONBOARDING_DEFAULT_SEEDS";

describe("isFeatureDisabled (mobile) — __DEV__ E2E override", () => {
  beforeEach(() => {
    isEnabledMock.mockReset();
    vi.stubGlobal("__DEV__", true);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("forces disabled=true when the force env is 'false' (flag OFF)", () => {
    vi.stubEnv(FORCE_ENV, "false");
    expect(isFeatureDisabled(FLAG)).toBe(true);
    // Override returns before the SDK is consulted.
    expect(isEnabledMock).not.toHaveBeenCalled();
  });

  it("forces disabled=false when the force env is 'true' (flag ON)", () => {
    vi.stubEnv(FORCE_ENV, "true");
    expect(isFeatureDisabled(FLAG)).toBe(false);
    expect(isEnabledMock).not.toHaveBeenCalled();
  });

  it("mirrors the override on isFeatureEnabled (true → on, false → off)", () => {
    vi.stubEnv(FORCE_ENV, "true");
    expect(isFeatureEnabled(FLAG)).toBe(true);
    vi.stubEnv(FORCE_ENV, "false");
    expect(isFeatureEnabled(FLAG)).toBe(false);
  });
});

describe("isFeatureDisabled (mobile) — PostHog client path", () => {
  beforeEach(() => {
    isEnabledMock.mockReset();
    // No __DEV__ → the override branch is skipped and the real client
    // path runs.
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true ONLY when the flag resolves explicitly OFF (false → disabled)", () => {
    isEnabledMock.mockReturnValue(false);
    expect(isFeatureDisabled(FLAG)).toBe(true);
  });

  it("returns false when the flag is unloaded (undefined → not disabled)", () => {
    isEnabledMock.mockReturnValue(undefined);
    expect(isFeatureDisabled(FLAG)).toBe(false);
  });

  it("returns false when the flag resolves ON (true → not disabled)", () => {
    isEnabledMock.mockReturnValue(true);
    expect(isFeatureDisabled(FLAG)).toBe(false);
  });

  it("returns false when the SDK throws (never wedges seeding off)", () => {
    isEnabledMock.mockImplementation(() => {
      throw new Error("posthog not ready");
    });
    expect(isFeatureDisabled(FLAG)).toBe(false);
  });

  it("is NOT the naive negation of isFeatureEnabled when the flag is cold", () => {
    isEnabledMock.mockReturnValue(undefined);
    expect(isFeatureEnabled(FLAG)).toBe(false);
    expect(isFeatureDisabled(FLAG)).toBe(false);
  });
});

// Regression guard for the 2026-05-30 hyphen-normalisation fix. The override
// builds the env key from the flag, but env-var names can't contain hyphens,
// so the key must normalise hyphen→underscore. Pre-fix, the hyphenated flag
// `log-sheet-slot-selector` (ENG-773) looked up the un-settable key
// `EXPO_PUBLIC_FLAG_FORCE_LOG-SHEET-SLOT-SELECTOR`, so its override was
// silently dead and the PostHog client decided instead — exactly what broke
// the Maestro E2E path for every hyphenated flag.
describe("isFeatureEnabled/Disabled (mobile) — hyphenated flag env-key normalisation", () => {
  const HYPHEN_FLAG = "log-sheet-slot-selector";
  const NORMALISED_ENV = "EXPO_PUBLIC_FLAG_FORCE_LOG_SHEET_SLOT_SELECTOR";

  beforeEach(() => {
    isEnabledMock.mockReset();
    vi.stubGlobal("__DEV__", true);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("isFeatureEnabled honours the underscored force env for a hyphenated flag", () => {
    vi.stubEnv(NORMALISED_ENV, "true");
    expect(isFeatureEnabled(HYPHEN_FLAG)).toBe(true);
    expect(isEnabledMock).not.toHaveBeenCalled();
    vi.stubEnv(NORMALISED_ENV, "false");
    expect(isFeatureEnabled(HYPHEN_FLAG)).toBe(false);
  });

  it("isFeatureDisabled honours the underscored force env for a hyphenated flag", () => {
    vi.stubEnv(NORMALISED_ENV, "false");
    expect(isFeatureDisabled(HYPHEN_FLAG)).toBe(true);
    expect(isEnabledMock).not.toHaveBeenCalled();
  });

  it("ignores a raw hyphenated env key (proves normalisation, not a literal lookup)", () => {
    // The old, un-settable key shape must have no effect post-fix.
    vi.stubEnv("EXPO_PUBLIC_FLAG_FORCE_LOG-SHEET-SLOT-SELECTOR", "true");
    isEnabledMock.mockReturnValue(undefined); // cold client
    expect(isFeatureEnabled(HYPHEN_FLAG)).toBe(false);
  });
});
