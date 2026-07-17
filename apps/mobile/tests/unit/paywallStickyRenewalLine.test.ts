/**
 * @vitest-environment node
 *
 * ENG-1438 (2026-07-05 deep audit, MP-06/LEGAL-006) — condensed one-line
 * auto-renewal disclosure wired into the mobile sticky purchase CTA.
 *
 * Source-pin (the 1300+-line paywall route isn't mounted in unit tests,
 * matching the repo idiom — see `paywallFallbackWhenUnavailable.test.ts`).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const PAYWALL = readFileSync(
  path.resolve(__dirname, "../../app/paywall.tsx"),
  "utf8",
);
const ANALYTICS = readFileSync(
  path.resolve(__dirname, "../../lib/analytics.ts"),
  "utf8",
);

describe("ENG-1438 — mobile sticky renewal line wiring", () => {
  it("imports buildStickyRenewalLine from the shared trust-copy SSOT", () => {
    expect(PAYWALL).toMatch(/buildStickyRenewalLine/);
  });

  it("gates the line behind paywall_sticky_renewal_line_v1", () => {
    expect(PAYWALL).toMatch(
      /isFeatureEnabled\("paywall_sticky_renewal_line_v1"\)\s*&&\s*currentProPkg/,
    );
  });

  it("passes the resolved price, period, and the mobile Settings cancel surface", () => {
    expect(PAYWALL).toMatch(/price:\s*currentProPkg\.product\.priceString/);
    expect(PAYWALL).toMatch(/period:\s*periodSuffix/);
    expect(PAYWALL).toMatch(/cancelSurface:\s*"Settings"/);
  });

  it("is registered default-ON (shared web + mobile — not a silent kill switch)", () => {
    const defaultOnStart = ANALYTICS.indexOf("const REDESIGN_DEFAULT_ON");
    expect(defaultOnStart).toBeGreaterThanOrEqual(0);
    const defaultOnEnd = ANALYTICS.indexOf("]);", defaultOnStart);
    const block = ANALYTICS.slice(defaultOnStart, defaultOnEnd);
    expect(block).toContain('"paywall_sticky_renewal_line_v1"');
  });
});
