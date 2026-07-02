/**
 * ENG-1297 — the Sloe Pro banner's visible pill label is tier-conditional
 * on BOTH platforms, matching the accessibility label + routing that were
 * already tier-aware.
 *
 * The 2026-07-01 full-sweep found a free account seeing "Sloe Pro — Manage"
 * (settings-logbox-error.png) while its accessibilityLabel said "Get Sloe
 * Pro" and the press routed to the paywall/pricing. A sighted free user was
 * promised subscription management; VoiceOver users and the router got the
 * truth. The visible label now follows the same tier branch:
 *   - pro  → "Manage"  (RevenueCat customer center / /account/billing)
 *   - free → "Upgrade" (paywall / /pricing)
 *
 * Source-level structural check — no React rendering (pattern:
 * settingsProfileHeaderCardParity.test.ts).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..", "..");
const webSettings = readFileSync(
  resolve(ROOT, "src/app/components/Settings.tsx"),
  "utf8",
);
const mobileBundle = readFileSync(
  resolve(ROOT, "apps/mobile/components/settings/SettingsBundleContent.tsx"),
  "utf8",
);

describe("ENG-1297 — Pro banner pill label matches the tier-aware a11y label", () => {
  it("web pill label branches on tier (Manage for pro, Upgrade for free)", () => {
    expect(webSettings).toContain(
      '{userTier === "pro" ? "Manage" : "Upgrade"}',
    );
  });

  it("mobile pill label branches on tier (Manage for pro, Upgrade for free)", () => {
    expect(mobileBundle).toContain(
      '{profileData.userTier === "pro" ? "Manage" : "Upgrade"}',
    );
  });

  it("neither platform ships an unconditional visible 'Manage' pill on the banner", () => {
    // The bug shape: a bare >Manage< text node in the banner while the
    // a11y label branches. A literal unconditional label would reintroduce
    // the free-user "Manage" promise.
    expect(webSettings).not.toMatch(/>\s*Manage\s*<\/span>/);
    expect(mobileBundle).not.toMatch(/>\s*Manage\s*<\/Text>/);
  });

  it("both platforms keep the tier-aware accessibility labels", () => {
    expect(webSettings).toContain(
      'aria-label={userTier === "pro" ? "Manage your Sloe Pro subscription" : "Get Sloe Pro"}',
    );
    expect(mobileBundle).toContain('"Manage your Sloe Pro subscription"');
    expect(mobileBundle).toContain('"Get Sloe Pro"');
  });
});
