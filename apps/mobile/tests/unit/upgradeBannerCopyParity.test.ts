/**
 * Mobile upgrade-banner copy parity (sync-enforcer BLOCK finding,
 * 2026-04-19).
 *
 * The "More" tab upgrade banner previously promised "Multi-day plans,
 * adaptive TDEE, and AI logging" to every non-Pro user. Two issues:
 *   - Multi-day plans are a Base feature (not Pro).
 *   - Adaptive TDEE is ungated (see `docs/product/landing-maintenance.md`).
 *
 * Fix: banner copy now branches by tier.
 *   - Free: "Unlimited recipes, multi-day plans, and AI logging".
 *   - Base: "Unlock AI photo and voice logging with Pro".
 *
 * This is a structural source-level check; the two test cases pin the
 * tier-branching copy so a future edit can't silently drift back to
 * the single pre-fix string or invent tier claims that the feature map
 * doesn't support.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MORE_PATH = resolve(__dirname, "../../app/(tabs)/more.tsx");

describe("mobile upgrade-banner tier-branching copy", () => {
  const src = readFileSync(MORE_PATH, "utf8");

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

  it('routes the More-tab upgrade banner to "/paywall?from=settings"', () => {
    // 2026-04-19 round-2 (analytics-engineer C2): the More tab is a
    // Settings-family surface, so `paywall_viewed.from` must attribute
    // to "settings". A bare `/paywall` push would silently land on the
    // default `"deep_link"` branch of `normalisePaywallFrom` and
    // collapse the F2 funnel slice.
    expect(src).toContain('router.push("/paywall?from=settings"');
    expect(src).toMatch(/from=settings/);
    // Regression guard: no bare `/paywall` pushes left in this file.
    expect(src).not.toMatch(/router\.push\(\s*["'`]\/paywall["'`]/);
  });
});
