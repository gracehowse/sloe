// @vitest-environment node
/**
 * ENG-1286 — mobile PostHog consent gate (launch blocker).
 *
 * The contract, mirroring web's `opt_out_capturing_by_default: consent
 * !== "accepted"` (src/app/components/AnalyticsProvider.tsx) but
 * stronger (no SDK construction at all pre-consent, because
 * `enableSessionReplay` is init-time on RN):
 *
 *   - consent unset (never asked / prime pending) → `getPostHogClient()`
 *     is null, `track` no-ops, the SDK is NEVER constructed;
 *   - stored "declined" → same as unset (no client, no replay);
 *   - stored "accepted" → client constructs and capture flows;
 *   - accept flip mid-session → client constructs + `optIn()` (clears
 *     any SDK-persisted opt-out from a prior decline);
 *   - decline flip mid-session → `optOut()` on the live client (the
 *     SDK stops event capture + replay per its opt-out contract).
 *
 * Same harness as `isFeatureDisabled.test.ts`: a PostHog key forced
 * before module load, `posthog-react-native` mocked so no native
 * bindings load, the in-memory AsyncStorage shim for real persistence.
 * Module state (client + consent) is per-import, so every test loads a
 * fresh module registry via `vi.resetModules()` + dynamic import.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  process.env.EXPO_PUBLIC_POSTHOG_KEY = "phc_mobile_test_key";
  return {
    constructed: [] as unknown[],
    captureMock: vi.fn(),
    optInMock: vi.fn(),
    optOutMock: vi.fn(),
  };
});

vi.mock("posthog-react-native", () => {
  class FakePostHog {
    constructor() {
      harness.constructed.push(this);
    }
    capture(...args: unknown[]): void {
      harness.captureMock(...args);
    }
    identify(): void {}
    getDistinctId(): string {
      return "anon";
    }
    reset(): void {}
    isFeatureEnabled(): boolean | undefined {
      return undefined;
    }
    reloadFeatureFlagsAsync(): Promise<void> {
      return Promise.resolve();
    }
    ready(): Promise<void> {
      return Promise.resolve();
    }
    optIn(): Promise<void> {
      harness.optInMock();
      return Promise.resolve();
    }
    optOut(): Promise<void> {
      harness.optOutMock();
      return Promise.resolve();
    }
  }
  return { default: FakePostHog };
});

async function loadFreshModules() {
  vi.resetModules();
  const analytics = await import("../../lib/analytics");
  const consent = await import("../../lib/analyticsConsent");
  return { analytics, consent };
}

beforeEach(async () => {
  harness.constructed.length = 0;
  harness.captureMock.mockReset();
  harness.optInMock.mockReset();
  harness.optOutMock.mockReset();
  const AsyncStorage = (await import("@react-native-async-storage/async-storage"))
    .default;
  await AsyncStorage.clear();
});

afterEach(async () => {
  const AsyncStorage = (await import("@react-native-async-storage/async-storage"))
    .default;
  await AsyncStorage.clear();
});

describe("ENG-1286 — consent gate on getPostHogClient", () => {
  it("consent unset → no client, no construction, track no-ops", async () => {
    const { analytics } = await loadFreshModules();
    expect(analytics.getPostHogClient()).toBeNull();
    analytics.track("posthog_health_check" as never, { platform: "ios" });
    expect(harness.constructed).toHaveLength(0);
    expect(harness.captureMock).not.toHaveBeenCalled();
  });

  it("stored 'declined' → primed gate stays closed (no client)", async () => {
    const { analytics, consent } = await loadFreshModules();
    const AsyncStorage = (
      await import("@react-native-async-storage/async-storage")
    ).default;
    await AsyncStorage.setItem(consent.ANALYTICS_CONSENT_STORAGE_KEY, "declined");
    await consent.primeAnalyticsConsent();
    expect(consent.getAnalyticsConsent()).toBe("declined");
    expect(analytics.getPostHogClient()).toBeNull();
    expect(harness.constructed).toHaveLength(0);
  });

  it("stored 'accepted' → primed gate opens, client constructs, capture flows", async () => {
    const { analytics, consent } = await loadFreshModules();
    const AsyncStorage = (
      await import("@react-native-async-storage/async-storage")
    ).default;
    await AsyncStorage.setItem(consent.ANALYTICS_CONSENT_STORAGE_KEY, "accepted");
    await consent.primeAnalyticsConsent();
    const client = analytics.getPostHogClient();
    expect(client).not.toBeNull();
    expect(harness.constructed).toHaveLength(1);
    analytics.track("posthog_health_check" as never, { platform: "ios" });
    expect(harness.captureMock).toHaveBeenCalledWith("posthog_health_check", {
      platform: "ios",
    });
  });

  it("accept flip mid-session → constructs the client + optIn (clears prior SDK opt-out)", async () => {
    const { analytics, consent } = await loadFreshModules();
    expect(analytics.getPostHogClient()).toBeNull();
    await consent.setAnalyticsConsent("accepted");
    // The module-scope consent listener constructs + opts in without a restart.
    expect(harness.constructed).toHaveLength(1);
    expect(harness.optInMock).toHaveBeenCalledTimes(1);
    expect(analytics.getPostHogClient()).not.toBeNull();
    // Persisted for the next launch's prime.
    const AsyncStorage = (
      await import("@react-native-async-storage/async-storage")
    ).default;
    expect(
      await AsyncStorage.getItem(consent.ANALYTICS_CONSENT_STORAGE_KEY),
    ).toBe("accepted");
  });

  it("decline flip mid-session → optOut on the live client; re-accept → optIn again", async () => {
    const { analytics, consent } = await loadFreshModules();
    await consent.setAnalyticsConsent("accepted");
    expect(harness.constructed).toHaveLength(1);

    await consent.setAnalyticsConsent("declined");
    // The instance is kept (web parity: posthog stays loaded, opted out)
    // and the SDK's opt-out stops event capture + session replay.
    expect(harness.optOutMock).toHaveBeenCalledTimes(1);

    await consent.setAnalyticsConsent("accepted");
    // optIn must fire again — the SDK persists its own opt-out flag, so
    // a re-accept without optIn would stay silently dark.
    expect(harness.optInMock).toHaveBeenCalledTimes(2);
    expect(harness.constructed).toHaveLength(1); // still the same client
  });

  it("declining without ever accepting never touches the SDK", async () => {
    const { analytics, consent } = await loadFreshModules();
    await consent.setAnalyticsConsent("declined");
    expect(harness.constructed).toHaveLength(0);
    expect(harness.optOutMock).not.toHaveBeenCalled();
    expect(analytics.getPostHogClient()).toBeNull();
  });

  it("isFeatureEnabled: default-ON flags resolve true pre-consent; PostHog flags stay false", async () => {
    const { analytics } = await loadFreshModules();
    // Redesign default-ON short-circuits before the client — no consent needed.
    // (`ring_skia_v1` stands in for any REDESIGN_DEFAULT_ON member; `sloe_v3_ring`
    // was collapsed out of the set in the ENG-1356 flag-collapse sweep.)
    expect(analytics.isFeatureEnabled("ring_skia_v1")).toBe(true);
    // A PostHog-resolved flag has no client to consult → safe false.
    expect(analytics.isFeatureEnabled("qa_neutral_test_flag")).toBe(false);
    // isFeatureDisabled: no client → "not disabled" (kill switches are
    // inert for un-consented users — the documented cost, same shape as
    // a cold client).
    expect(analytics.isFeatureDisabled("ring_skia_v1")).toBe(false);
    expect(harness.constructed).toHaveLength(0);
  });
});

describe("ENG-1286 — consent storage round-trip", () => {
  it("parseAnalyticsConsent coerces junk to null (never asked)", async () => {
    const { consent } = await loadFreshModules();
    expect(consent.parseAnalyticsConsent("accepted")).toBe("accepted");
    expect(consent.parseAnalyticsConsent("declined")).toBe("declined");
    expect(consent.parseAnalyticsConsent(null)).toBeNull();
    expect(consent.parseAnalyticsConsent("yes")).toBeNull();
    expect(consent.parseAnalyticsConsent("")).toBeNull();
  });

  it("readStoredAnalyticsConsent round-trips setAnalyticsConsent", async () => {
    const { consent } = await loadFreshModules();
    expect(await consent.readStoredAnalyticsConsent()).toBeNull();
    await consent.setAnalyticsConsent("accepted");
    expect(await consent.readStoredAnalyticsConsent()).toBe("accepted");
    await consent.setAnalyticsConsent("declined");
    expect(await consent.readStoredAnalyticsConsent()).toBe("declined");
  });

  it("notifies listeners on every change and stops after unsubscribe", async () => {
    const { consent } = await loadFreshModules();
    const seen: unknown[] = [];
    const unsub = consent.onAnalyticsConsentChange((c) => seen.push(c));
    await consent.setAnalyticsConsent("accepted");
    await consent.setAnalyticsConsent("declined");
    unsub();
    await consent.setAnalyticsConsent("accepted");
    expect(seen).toEqual(["accepted", "declined"]);
  });
});
