/**
 * Mobile `AiPaywallSheet` structural contract (Ship M2, 2026-04-18).
 *
 * The mobile sheet is a React Native component and cannot be rendered
 * in the mobile vitest environment (node, no RNTL). This source-level
 * test pins the public contract so a regression (wrong event name,
 * lost feature-copy key, dropped dismiss reason, wrong CTA label)
 * fails CI. Mirrors the pattern used by
 * `apps/mobile/tests/unit/cookAnalyticsParity.test.ts`.
 *
 * Covered:
 *  1. Imports `track` from `@/lib/analytics` (mobile-local wrapper).
 *  2. Imports `AnalyticsEvents` from the canonical shared events
 *     registry (so mobile + web spell the event names identically —
 *     if either side renames, the build fails before ship).
 *  3. Registers the same `FEATURE_COPY` keys + titles + body prefixes
 *     as the web dialog. Exact strings are brittle across line wraps
 *     so we assert the canonical title for each feature and a
 *     disambiguating prefix of the body.
 *  4. Fires all three M2 events: viewed, dismissed, cta_tapped.
 *  5. Renders the exact primary CTA label "See Pro plans".
 *  6. Handles all three dismiss reasons: "backdrop", "close_button",
 *     "not_now".
 *  7. Host (`app/(tabs)/index.tsx`) replaces the previous
 *     `router.push("/paywall?from=voice_log|photo_log")` calls in the
 *     free-tier gate with `setAiPaywall({ open: true, feature })`, and
 *     re-exposes the `/paywall?from=...` push inside the sheet's
 *     `onSeePlans` handler so the full-route commercial surface is
 *     still reachable.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SHEET_PATH = resolve(__dirname, "../../components/AiPaywallSheet.tsx");
const SHEET_SOURCE = readFileSync(SHEET_PATH, "utf8");

const TODAY_PATH = resolve(__dirname, "../../app/(tabs)/index.tsx");
const TODAY_SOURCE = readFileSync(TODAY_PATH, "utf8");

describe("AiPaywallSheet module contract (Ship M2)", () => {
  it("imports track from the mobile analytics wrapper", () => {
    expect(SHEET_SOURCE).toMatch(
      /\bimport\b[^;]*\btrack\b[^;]*@\/lib\/analytics/,
    );
  });

  it("imports AnalyticsEvents from the shared canonical registry", () => {
    expect(SHEET_SOURCE).toMatch(
      /AnalyticsEvents[^;]*from\s+["']\.\.\/\.\.\/\.\.\/src\/lib\/analytics\/events["']/,
    );
  });

  it("exposes the same FEATURE_COPY keys + titles as the web dialog", () => {
    // Keys must match the shared union exactly.
    expect(SHEET_SOURCE).toMatch(/voice_log:\s*\{/);
    expect(SHEET_SOURCE).toMatch(/photo_log:\s*\{/);

    // Titles are the public-facing copy; drifting either from web
    // would break the convention documented in
    // docs/ux/patterns.md → "Paywall surfaces — convention".
    expect(SHEET_SOURCE).toContain(
      '"Voice logging is a Pro feature"',
    );
    expect(SHEET_SOURCE).toContain(
      '"AI photo logging is a Pro feature"',
    );

    // Body prefix assertions — enough to catch accidental rewrites
    // without being brittle to whitespace / wrapping.
    expect(SHEET_SOURCE).toContain("Describe what you ate");
    expect(SHEET_SOURCE).toContain(
      "Snap a photo of your meal and we'll identify foods",
    );
  });

  it("fires ai_paywall_sheet_viewed on mount", () => {
    expect(SHEET_SOURCE).toMatch(
      /track\(\s*AnalyticsEvents\.ai_paywall_sheet_viewed\b/,
    );
  });

  it("fires ai_paywall_sheet_dismissed with every dismiss path", () => {
    expect(SHEET_SOURCE).toMatch(
      /track\(\s*AnalyticsEvents\.ai_paywall_sheet_dismissed\b/,
    );
    // All three reason strings must be present as literal values.
    expect(SHEET_SOURCE).toContain('"backdrop"');
    expect(SHEET_SOURCE).toContain('"close_button"');
    expect(SHEET_SOURCE).toContain('"not_now"');
  });

  it("fires ai_paywall_sheet_cta_tapped with action='see_plans' on primary CTA", () => {
    expect(SHEET_SOURCE).toMatch(
      /track\(\s*AnalyticsEvents\.ai_paywall_sheet_cta_tapped\b/,
    );
    expect(SHEET_SOURCE).toMatch(/action:\s*["']see_plans["']/);
  });

  it("renders the primary CTA label 'See Pro plans' verbatim (parity with web)", () => {
    // The label string appears as the text of the primary CTA.
    expect(SHEET_SOURCE).toContain("See Pro plans");
  });

  it("uses accessibilityViewIsModal to trap screen-reader focus on the sheet body", () => {
    expect(SHEET_SOURCE).toMatch(/accessibilityViewIsModal/);
  });

  it("uses setAccessibilityFocus on the title ref so VoiceOver announces the paywall on open", () => {
    expect(SHEET_SOURCE).toMatch(/setAccessibilityFocus/);
  });

  it("honours Modal onRequestClose (Android hardware back)", () => {
    expect(SHEET_SOURCE).toMatch(/onRequestClose/);
  });

  it("respects reduce-motion by swapping Modal animationType to 'none' when enabled", () => {
    expect(SHEET_SOURCE).toMatch(/isReduceMotionEnabled/);
    expect(SHEET_SOURCE).toMatch(/animationType/);
  });

  it("uses Haptics.selectionAsync on the primary CTA", () => {
    expect(SHEET_SOURCE).toMatch(/Haptics\.selectionAsync/);
  });
});

describe("Today host adopts AiPaywallSheet (Ship M2)", () => {
  it("imports AiPaywallSheet + AiPaywallFeature from the sheet module", () => {
    expect(TODAY_SOURCE).toMatch(
      /import\s+AiPaywallSheet[^;]*from\s+["']@\/components\/AiPaywallSheet["']/,
    );
    expect(TODAY_SOURCE).toMatch(/AiPaywallFeature/);
  });

  it("mounts <AiPaywallSheet …/> in the Today screen JSX", () => {
    expect(TODAY_SOURCE).toMatch(/<AiPaywallSheet\b/);
  });

  it("no longer pushes to /paywall?from=voice_log|photo_log on the free-tier gate", () => {
    // The two regression paths that M2 fixed. Must not reappear inside
    // the gate handlers. (The sheet's `onSeePlans` handler may still
    // call router.push("/paywall?from=...") — that is the intended
    // bridge to the full-route commercial surface.)
    expect(TODAY_SOURCE).not.toMatch(
      /router\.push\(\s*["']\/paywall\?from=voice_log["']/,
    );
    expect(TODAY_SOURCE).not.toMatch(
      /router\.push\(\s*["']\/paywall\?from=photo_log["']/,
    );
  });

  it("still routes to /paywall?from={feature} via the sheet's onSeePlans handler (full-route surface still reachable)", () => {
    // Template literal form — the primary CTA must keep the full-route
    // escape hatch so users who actually want to browse plans can.
    expect(TODAY_SOURCE).toMatch(
      /router\.push\([^)]*`\/paywall\?from=\$\{feature\}/,
    );
  });

  it("keeps firing voice_log_paywalled + ai_photo_log_paywalled at the caller (pre-M2 funnel-entry events)", () => {
    // The new sheet events are additive — existing per-feature
    // funnel-entry events must still fire for pre-M2 dashboards.
    expect(TODAY_SOURCE).toMatch(
      /track\(\s*AnalyticsEvents\.voice_log_paywalled\b/,
    );
    expect(TODAY_SOURCE).toMatch(
      /track\(\s*AnalyticsEvents\.ai_photo_log_paywalled\b/,
    );
  });
});
