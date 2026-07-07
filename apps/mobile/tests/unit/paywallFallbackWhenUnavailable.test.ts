/**
 * @vitest-environment node
 *
 * ENG-1381 (P0) — the iOS paywall's degraded `subscriptionsUnavailable` branch
 * (RC offerings fail to load) shipped price-less: no plan selector, no
 * auto-renew disclosure, just "Open App Store to subscribe" — while the
 * sub-headline still promised "Price in your currency". This pins the
 * flag-gated fallback that renders the plan selector + disclosure with
 * FALLBACK_PRICES + an indicative-price caveat instead.
 *
 * Source-pin (the 1300-line paywall route isn't mounted in unit tests, matching
 * the repo idiom, e.g. `paywallGate15Honesty.test.ts`). If any pin breaks the
 * degraded-state contract regressed.
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

describe("ENG-1381 — paywall fallback when RC unavailable", () => {
  it("the fallback is behind a default-OFF flag (safe until legal/design review)", () => {
    expect(ANALYTICS).toContain('"paywall_fallback_when_unavailable"');
    expect(PAYWALL).toMatch(
      /fallbackWhenUnavailable\s*=\s*\n?\s*subscriptionsUnavailable\s*&&\s*isFeatureEnabled\("paywall_fallback_when_unavailable"\)/,
    );
  });

  it("priced blocks render when NOT degraded OR when the fallback flag is on — never blindly", () => {
    expect(PAYWALL).toMatch(
      /showPricedBlocks\s*=\s*offeringsReady\s*&&\s*\(!subscriptionsUnavailable\s*\|\|\s*fallbackWhenUnavailable\)/,
    );
    // The plan-selector, nutrition note, and auto-renew disclosure all gate on
    // `showPricedBlocks` — not the old `!subscriptionsUnavailable`.
    expect(PAYWALL).toMatch(/\{showPricedBlocks && \(effHasAnnual \|\| effHasMonthly\) \?/);
    // Two more `{showPricedBlocks ?` gates (nutrition note + auto-renew disclosure),
    // and the old direct `!subscriptionsUnavailable` render gate is gone.
    expect((PAYWALL.match(/\{showPricedBlocks \?/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(PAYWALL).toContain('testID="paywall-autorenew-disclosure"');
    expect(PAYWALL).not.toMatch(/offeringsReady && !subscriptionsUnavailable \?/);
  });

  it("forces both plan rows on in fallback mode (no live packages resolved)", () => {
    expect(PAYWALL).toMatch(/effHasAnnual\s*=\s*hasAnyAnnual\s*\|\|\s*fallbackWhenUnavailable/);
    expect(PAYWALL).toMatch(/effHasMonthly\s*=\s*hasAnyMonthly\s*\|\|\s*fallbackWhenUnavailable/);
  });

  it("the CMA disclosure carries an indicative-price caveat in fallback mode", () => {
    expect(PAYWALL).toMatch(/indicativeCaveat\s*=\s*fallbackWhenUnavailable/);
    expect(PAYWALL).toContain("indicative");
    expect(PAYWALL).toContain("confirmed at checkout");
    // and it's appended to both disclosure strings.
    expect(PAYWALL).toMatch(/refund policy: support@getsloe\.com\.\$\{indicativeCaveat\}/);
  });

  it("the force-degraded repro affordance is __DEV__-only (never in a release build)", () => {
    expect(PAYWALL).toMatch(/forceDegraded\s*=\s*__DEV__\s*&&\s*params\.forceDegraded\s*===\s*"1"/);
    expect(PAYWALL).toMatch(/setPackages\(forceDegraded \? \[\] : pkgs\)/);
  });
});
