/**
 * RevenueCat SDK key resolution — unified v2 fallback (2026-04-20).
 *
 * `apps/mobile/lib/purchases.ts` must honour three config sources in
 * priority order so a freshly-issued RC test key (`test_…`) works in
 * dev builds without clobbering the production platform-split pipeline:
 *
 *   1. Platform-specific keys (`EXPO_PUBLIC_REVENUECAT_APPLE_KEY` /
 *      `…_GOOGLE_KEY`) — prod path, one RC app per store.
 *   2. Unified v2 key (`EXPO_PUBLIC_REVENUECAT_API_KEY`) — dev/sandbox
 *      path; single env var works on both platforms.
 *
 * This is a structural source-level check (same approach as
 * `paywallCopyParity.test.ts`) because the module pulls
 * `react-native-purchases` + `react-native` whose native-bridge entry
 * isn't viable under vitest. Structural assertions keep the invariant
 * visible in PRs without needing a mock module graph.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PURCHASES_PATH = resolve(__dirname, "../../lib/purchases.ts");

describe("RevenueCat SDK key resolution", () => {
  const src = readFileSync(PURCHASES_PATH, "utf8");

  it("reads the unified v2 env var", () => {
    expect(src).toContain("EXPO_PUBLIC_REVENUECAT_API_KEY");
  });

  it("platform-specific keys still take precedence over the unified key", () => {
    // Apple key line resolves EXPO_PUBLIC_REVENUECAT_APPLE_KEY first,
    // then falls back to API_KEY_V2_UNIFIED.
    const iosBlock = src.match(/const API_KEY_IOS[\s\S]*?;/);
    expect(iosBlock).not.toBeNull();
    expect(iosBlock![0]).toContain("EXPO_PUBLIC_REVENUECAT_APPLE_KEY");
    expect(iosBlock![0]).toContain("API_KEY_V2_UNIFIED");
    // Order matters: ?? chain should have the platform key first.
    const iosApplePos = iosBlock![0].indexOf("EXPO_PUBLIC_REVENUECAT_APPLE_KEY");
    const iosUnifiedPos = iosBlock![0].indexOf("API_KEY_V2_UNIFIED");
    expect(iosApplePos).toBeLessThan(iosUnifiedPos);

    const androidBlock = src.match(/const API_KEY_ANDROID[\s\S]*?;/);
    expect(androidBlock).not.toBeNull();
    expect(androidBlock![0]).toContain("EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY");
    expect(androidBlock![0]).toContain("API_KEY_V2_UNIFIED");
    const androidGooglePos = androidBlock![0].indexOf(
      "EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY",
    );
    const androidUnifiedPos = androidBlock![0].indexOf("API_KEY_V2_UNIFIED");
    expect(androidGooglePos).toBeLessThan(androidUnifiedPos);
  });

  it("exposes presentCustomerCenter with a fail-safe result shape", () => {
    // The helper must return a discriminated union so callers can fall
    // back to the platform store URL when the native UI is unavailable
    // (Expo Go, web, missing API key).
    expect(src).toContain("export async function presentCustomerCenter");
    expect(src).toContain('reason: "no_api_key"');
    expect(src).toContain('reason: "ui_unavailable"');
    expect(src).toContain('reason: "error"');
    // Dynamic import keeps the native UI module out of the main bundle.
    expect(src).toContain('import("react-native-purchases-ui")');
  });
});
