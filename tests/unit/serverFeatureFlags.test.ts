import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  isServerFeatureEnabled,
  __setFeatureFlagsClientForTesting,
  __clearFeatureFlagsCacheForTesting,
} from "../../src/lib/server/featureFlags";

/**
 * 2026-05-16 (ENG-519) — pin the server-side PostHog flag wrapper.
 *
 * Locks in:
 *   - `true` only when PostHog returns literal `true` (defensive against
 *     PostHog returning a variant string or `undefined` while flags load)
 *   - `false` fail-safe on any error
 *   - The system distinct_id default (so kill switches are global, not
 *     per-percentile rollouts)
 */
describe("isServerFeatureEnabled (ENG-519)", () => {
  beforeEach(() => {
    __clearFeatureFlagsCacheForTesting();
  });

  afterEach(() => {
    __clearFeatureFlagsCacheForTesting();
  });

  it("returns true when PostHog returns literal true", async () => {
    const stub = {
      isFeatureEnabled: vi.fn().mockResolvedValue(true),
      shutdown: vi.fn(),
    };
    __setFeatureFlagsClientForTesting(stub);

    await expect(isServerFeatureEnabled("kill_recipe_import")).resolves.toBe(true);
    expect(stub.isFeatureEnabled).toHaveBeenCalledWith("kill_recipe_import", "system:killswitch");
  });

  it("returns false when PostHog returns literal false", async () => {
    const stub = {
      isFeatureEnabled: vi.fn().mockResolvedValue(false),
      shutdown: vi.fn(),
    };
    __setFeatureFlagsClientForTesting(stub);

    await expect(isServerFeatureEnabled("kill_recipe_import")).resolves.toBe(false);
  });

  it("returns false when PostHog returns undefined (flags loading or unknown flag)", async () => {
    const stub = {
      isFeatureEnabled: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn(),
    };
    __setFeatureFlagsClientForTesting(stub);

    await expect(isServerFeatureEnabled("kill_recipe_import")).resolves.toBe(false);
  });

  it("returns false when PostHog returns a variant string (multi-variant flag misuse)", async () => {
    const stub = {
      isFeatureEnabled: vi.fn().mockResolvedValue("control" as unknown as boolean),
      shutdown: vi.fn(),
    };
    __setFeatureFlagsClientForTesting(stub);

    await expect(isServerFeatureEnabled("kill_recipe_import")).resolves.toBe(false);
  });

  it("returns false when isFeatureEnabled throws (network failure)", async () => {
    const stub = {
      isFeatureEnabled: vi.fn().mockRejectedValue(new Error("network")),
      shutdown: vi.fn(),
    };
    __setFeatureFlagsClientForTesting(stub);

    await expect(isServerFeatureEnabled("kill_recipe_import")).resolves.toBe(false);
  });

  it("accepts a custom distinct_id for per-user evaluations", async () => {
    const stub = {
      isFeatureEnabled: vi.fn().mockResolvedValue(true),
      shutdown: vi.fn(),
    };
    __setFeatureFlagsClientForTesting(stub);

    await isServerFeatureEnabled("some_per_user_flag", "user-uuid-123");
    expect(stub.isFeatureEnabled).toHaveBeenCalledWith("some_per_user_flag", "user-uuid-123");
  });

  it("returns false when no client is initialised (missing env, etc.)", async () => {
    __setFeatureFlagsClientForTesting(null);
    // The lazy `getClient` will try to initialise with env; in tests
    // `NEXT_PUBLIC_POSTHOG_KEY` is usually unset, so this exercises the
    // env-missing fail-safe.
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    await expect(isServerFeatureEnabled("kill_recipe_import")).resolves.toBe(false);
  });
});
