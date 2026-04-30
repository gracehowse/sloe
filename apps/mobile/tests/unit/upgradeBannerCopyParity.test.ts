/**
 * Mobile upgrade-banner copy parity (sync-enforcer BLOCK finding,
 * 2026-04-19).
 *
 * The upgrade banner previously promised "Multi-day plans,
 * adaptive TDEE, and AI logging" to every non-Pro user. Two issues:
 *   - Multi-day plans are a Base feature (not Pro).
 *   - Adaptive TDEE is ungated (see `docs/product/landing-maintenance.md`).
 *
 * Fix: banner copy now branches by tier.
 *   - Free: "Unlimited recipes, multi-day plans, and AI logging".
 *   - Base: "Unlock AI photo and voice logging with Pro".
 *
 * Source moved (2026-04-29, Group G IA Batch B): the banner is now
 * rendered by `SettingsBundleContent`, which mounts on both
 * `/(tabs)/more` and `/(tabs)/settings`. This test reads the bundle
 * directly so the copy guarantee survives the upcoming Batch D
 * deletion of the More screen.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const BUNDLE_PATH = resolve(
  __dirname,
  "../../components/settings/SettingsBundleContent.tsx",
);

describe("mobile upgrade-banner tier-branching copy", () => {
  const src = readFileSync(BUNDLE_PATH, "utf8");

  it("free-tier banner pitches Base + Pro cross-tier features honestly", () => {
    expect(src).toContain('"Unlimited recipes, multi-day plans, and AI logging"');
  });

  it("base-tier banner pitches Pro-only AI logging", () => {
    expect(src).toContain('"Unlock AI photo and voice logging with Pro"');
  });

  it("does not repeat the retired 'adaptive TDEE' tier claim", () => {
    // Adaptive TDEE is ungated today — advertising it as a Pro perk
    // was the copy bug that triggered the sync-enforcer finding.
    expect(src).not.toContain("adaptive TDEE, and AI logging");
    expect(src).not.toContain("Multi-day plans, adaptive TDEE, and AI logging");
  });

  it('routes the upgrade banner to "/paywall?from=settings"', () => {
    // The bundle is rendered on Settings-family surfaces (More +
    // Settings), so `paywall_viewed.from` must attribute to "settings".
    // A bare `/paywall` push would silently land on the default
    // `"deep_link"` branch of `normalisePaywallFrom` and collapse the
    // F2 funnel slice.
    expect(src).toContain('router.push("/paywall?from=settings"');
    expect(src).toMatch(/from=settings/);
    // Regression guard: no bare `/paywall` pushes left in this file.
    expect(src).not.toMatch(/router\.push\(\s*["'`]\/paywall["'`]/);
  });
});
