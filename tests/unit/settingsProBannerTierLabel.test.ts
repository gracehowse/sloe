/**
 * ENG-1297 / ENG-1615 — the Sloe Pro banner's visible affordance is
 * tier-conditional on BOTH platforms:
 *   - pro  → plain "Active" status (no manage pill — manage lives in Membership)
 *   - free → "Upgrade" ghost pill (paywall / /pricing)
 *
 * ENG-1297 fixed free users seeing "Manage" while routing to paywall.
 * ENG-1615 removed the pro-tier Manage pill from the banner so it doesn't
 * compete with the Membership "Manage subscription" row.
 *
 * Banner markup lives in extracted components (screen-budget shrink).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..", "..");
const webBanner = readFileSync(
  resolve(ROOT, "src/app/components/settings/settings-sloe-pro-banner.tsx"),
  "utf8",
);
const mobileBanner = readFileSync(
  resolve(ROOT, "apps/mobile/components/settings/SettingsSloeProBanner.tsx"),
  "utf8",
);
const webSettings = readFileSync(
  resolve(ROOT, "src/app/components/Settings.tsx"),
  "utf8",
);
const mobileBundle = readFileSync(
  resolve(ROOT, "apps/mobile/components/settings/SettingsBundleContent.tsx"),
  "utf8",
);

describe("ENG-1297 / ENG-1615 — Pro banner affordance matches tier", () => {
  it("wires the extracted banner components from Settings surfaces", () => {
    expect(webSettings).toContain("SettingsSloeProBanner");
    expect(mobileBundle).toContain("SettingsSloeProBanner");
  });

  it("web free users see an Upgrade pill linking to /pricing", () => {
    expect(webBanner).toContain('href="/pricing"');
    expect(webBanner).toMatch(/isPro/);
    expect(webBanner).toMatch(/>\s*Upgrade\s*</);
    expect(webBanner).not.toContain("/account/billing");
  });

  it("mobile free users see an Upgrade pill routing to the paywall", () => {
    expect(mobileBanner).toMatch(/>\s*Upgrade\s*</);
    expect(mobileBanner).toContain('accessibilityLabel="Get Sloe Pro"');
    expect(mobileBanner).not.toMatch(
      /isPro\s*\?\s*"Manage"\s*:\s*"Upgrade"/,
    );
  });

  it("pro users see Active status, not a Manage pill, on either platform", () => {
    expect(webBanner).toMatch(/>\s*Active\s*</);
    expect(webBanner).toContain('aria-label="Sloe Pro — active subscription"');
    expect(webBanner).not.toMatch(
      /data-testid="settings-sloe-pro-banner"[\s\S]{0,1400}>\s*Manage\s*</,
    );
    expect(mobileBanner).toMatch(/>\s*Active\s*</);
    expect(mobileBanner).toContain('"Sloe Pro — active subscription"');
    expect(mobileBanner).not.toMatch(
      /testID="settings-sloe-pro-banner"[\s\S]{0,1400}>\s*Manage\s*</,
    );
  });

  it("neither platform ships an unconditional visible 'Manage' pill on the banner", () => {
    expect(webBanner).not.toMatch(/>\s*Manage\s*<\/span>/);
    expect(mobileBanner).not.toMatch(/>\s*Manage\s*<\/Text>/);
  });
});
