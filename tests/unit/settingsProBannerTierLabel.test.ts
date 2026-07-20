/**
 * ENG-1297 / ENG-1615 — the Sloe Pro banner's visible affordance is
 * tier-conditional on BOTH platforms:
 *   - pro  → plain "Active" status (no manage pill — manage lives in Membership)
 *   - free → "Upgrade" ghost pill (paywall / /pricing)
 *
 * ENG-1297 fixed free users seeing "Manage" while routing to paywall.
 * ENG-1615 removed the pro-tier Manage pill from the banner so it doesn't
 * compete with the Membership "Manage subscription" row.
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

describe("ENG-1297 / ENG-1615 — Pro banner affordance matches tier", () => {
  it("web free users see an Upgrade pill linking to /pricing", () => {
    expect(webSettings).toContain('href="/pricing"');
    expect(webSettings).toMatch(/userTier === "pro" \? \(/);
    expect(webSettings).toMatch(/>\s*Upgrade\s*</);
    expect(webSettings).not.toMatch(
      /userTier === "pro" \? "\/account\/billing" : "\/pricing"/,
    );
  });

  it("mobile free users see an Upgrade pill routing to the paywall", () => {
    expect(mobileBundle).toMatch(/>\s*Upgrade\s*</);
    expect(mobileBundle).toContain('accessibilityLabel="Get Sloe Pro"');
    expect(mobileBundle).not.toMatch(
      /profileData\.userTier === "pro" \? "Manage" : "Upgrade"/,
    );
  });

  it("pro users see Active status, not a Manage pill, on either platform", () => {
    expect(webSettings).toMatch(/>\s*Active\s*</);
    expect(webSettings).toContain('aria-label="Sloe Pro — active subscription"');
    expect(webSettings).not.toMatch(
      /data-testid="settings-sloe-pro-banner"[\s\S]{0,1400}>\s*Manage\s*</,
    );
    expect(mobileBundle).toMatch(/>\s*Active\s*</);
    expect(mobileBundle).toContain('"Sloe Pro — active subscription"');
    expect(mobileBundle).not.toMatch(
      /testID="settings-sloe-pro-banner"[\s\S]{0,1400}>\s*Manage\s*</,
    );
  });

  it("neither platform ships an unconditional visible 'Manage' pill on the banner", () => {
    expect(webSettings).not.toMatch(/>\s*Manage\s*<\/span>/);
    expect(mobileBundle).not.toMatch(/>\s*Manage\s*<\/Text>/);
  });
});
