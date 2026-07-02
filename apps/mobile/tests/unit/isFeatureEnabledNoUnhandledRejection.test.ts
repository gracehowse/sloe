// @vitest-environment jsdom
/**
 * ENG-841 — `isFeatureEnabled` (mobile) must never leak an unhandled
 * rejection from the PostHog client's async bootstrap.
 *
 * `new PostHog(...)` reads persisted flags/distinct-id from AsyncStorage on
 * construction. In a node/jsdom env (and on storage failure) that read
 * rejects; if the floating promise has no handler it surfaces as an
 * unhandled rejection — which failed the mobile CI job post-test even
 * though all tests passed. The fix attaches a `.catch()` to the client's
 * `ready()` bootstrap promise in `getPostHogClient`.
 *
 * This test reproduces the failure deterministically: a stubbed PostHog
 * whose bootstrap rejects at construction (mirroring the AsyncStorage read),
 * a forced posthog key so the client actually constructs, and an assertion
 * that no `unhandledRejection` escapes. Without the guard, this fails.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Force a posthog key so getPostHogClient() actually constructs the client.
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: { extra: { posthogKey: "phc_test", posthogHost: "https://example.test" } },
    manifest: null,
    manifest2: null,
    platform: { ios: { model: "simulator" } },
  },
}));

// Stub PostHog: its bootstrap (AsyncStorage read) floats + rejects from the
// constructor, exactly like the real SDK in a node env. `ready()` returns
// that same promise, so the production `.catch()` on `ready()` must mark it
// handled.
vi.mock("posthog-react-native", () => ({
  default: class StubPostHog {
    private _boot: Promise<void>;
    constructor() {
      this._boot = Promise.reject(new Error("window is not defined"));
    }
    ready() {
      return this._boot;
    }
    isFeatureEnabled() {
      return false;
    }
  },
}));

describe("ENG-841 — isFeatureEnabled bootstrap cannot leak an unhandled rejection", () => {
  let unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => {
    unhandled.push(reason);
  };

  beforeEach(() => {
    unhandled = [];
    vi.resetModules();
    process.on("unhandledRejection", onUnhandled);
  });

  afterEach(() => {
    process.off("unhandledRejection", onUnhandled);
  });

  it("constructing the client via a flag read does not emit an unhandled rejection", async () => {
    // Relative import — the `@/lib/analytics` alias points at the vitest
    // WRAPPER shim, which would make this self-test vacuous. The relative
    // path loads the real module (same tactic as isFeatureDisabled.test.ts).
    const { isFeatureEnabled } = await import("../../lib/analytics");
    // ENG-1286 — analytics is consent-gated; accept so the flag read below
    // actually constructs the client (unset consent short-circuits to null).
    const { setAnalyticsConsent } = await import("../../lib/analyticsConsent");
    await setAnalyticsConsent("accepted");
    // A non-redesign flag falls through to getPostHogClient() → constructs
    // the stub → its rejecting bootstrap must be caught by the production
    // `void client.ready().catch(...)` guard.
    expect(isFeatureEnabled("eng-841-probe-flag")).toBe(false);
    // Let the rejected bootstrap promise settle and any unhandledRejection
    // detection flush.
    await new Promise((r) => setTimeout(r, 20));
    expect(unhandled).toHaveLength(0);
  });
});
