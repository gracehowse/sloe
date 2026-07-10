/**
 * @vitest-environment node
 *
 * ENG-1381 (P0) — the iOS paywall's degraded `subscriptionsUnavailable` branch
 * (RC offerings fail to load) shipped price-less: no plan selector, no
 * auto-renew disclosure, just "Open App Store" — while the sub-headline still
 * promised "Price in your currency". This pins the flag-gated fallback that
 * renders the plan selector + a disclosure that states the renewal cadence and
 * defers the exact price to the App Store (legal review 2026-07-09 — never an
 * indicative FALLBACK_PRICES amount inside a CMA disclosure).
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
    // `REDESIGN_DEFAULT_ON` resolves `isFeatureEnabled` to `true`
    // unconditionally (see the Set.has check in the same file) — the flag
    // must NOT live there, or the "default-OFF" contract above is a lie and
    // every build ships unreviewed indicative pricing. Must instead be
    // registered in `KNOWN_DEFAULT_OFF_FLAGS`.
    const defaultOnStart = ANALYTICS.indexOf("const REDESIGN_DEFAULT_ON");
    const defaultOnBlock = ANALYTICS.slice(
      defaultOnStart,
      ANALYTICS.indexOf("]);", defaultOnStart),
    );
    expect(defaultOnBlock).not.toContain("paywall_fallback_when_unavailable");
    expect(ANALYTICS).toMatch(
      /KNOWN_DEFAULT_OFF_FLAGS = \[[\s\S]*?"paywall_fallback_when_unavailable"[\s\S]*?\] as const;/,
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

  it("the CMA disclosure defers the price to the App Store in fallback mode (no indicative amount)", () => {
    // ENG-1381 revision (legal review 2026-07-09): the degraded disclosure must
    // NOT print an indicative FALLBACK_PRICES amount — a misleading-price risk on
    // non-GBP storefronts that no caveat cures. It states the renewal cadence and
    // defers the exact amount to the App Store. See
    // docs/decisions/2026-07-09-mobile-degraded-paywall-disclosure.md.
    expect(PAYWALL).toMatch(/if \(fallbackWhenUnavailable\) \{/);
    expect(PAYWALL).toContain("renews automatically each");
    expect(PAYWALL).toContain("confirmed on the App Store before you subscribe");
    // The old indicative-price caveat is gone (no wrong number in a CMA disclosure).
    expect(PAYWALL).not.toContain("indicativeCaveat");
    expect(PAYWALL).not.toContain("amount shown is indicative");
  });

  it("the header subtitle defers the price to the App Store in fallback mode (no 'Price in your currency')", () => {
    // ENG-1381: the degraded subtitle must NOT promise a shown price. It takes
    // precedence over every other subtitle branch via a leading
    // `fallbackWhenUnavailable ?` guard, and reads the App-Store-deferred line —
    // consistent with the deferred-price disclosure above.
    expect(PAYWALL).toMatch(/const headerSubtitle = fallbackWhenUnavailable \?/);
    expect(PAYWALL).toContain("Your exact price confirms in the App Store.");
    // The old "Price in your currency" line must NOT be reachable in the degraded
    // state — it survives only as the non-degraded generic fallback branch, which
    // now sits AFTER the `fallbackWhenUnavailable ?` guard (never the degraded value).
    expect(PAYWALL).toMatch(
      /const headerSubtitle = fallbackWhenUnavailable \? "Cancel anytime\. Your exact price confirms in the App Store\."/,
    );
  });

  it("suppresses the computed savings badge + per-month line in fallback mode (no false-precision claim)", () => {
    // ENG-1381: a math-backed "Save N%" / per-month breakdown derived from the
    // indicative FALLBACK_PRICES is a stronger false claim than the price itself.
    // Both derived props resolve to null when `fallbackWhenUnavailable`; the plan
    // rows + fallback price themselves are kept (the disclosure clarifies the exact
    // price confirms in the App Store).
    expect(PAYWALL).toMatch(
      /const savingsBadge = fallbackWhenUnavailable \? null : \(computeSavingsBadgeFromStrings\(annualStr, monthlyStr\) \?\? fallbackBadge\)/,
    );
    expect(PAYWALL).toMatch(
      /const annualPerMonthLine = fallbackWhenUnavailable \? null : computeAnnualPerMonthLine\(annualStr\)/,
    );
    // The suppressed values are still passed as the props (as null) — the plan
    // selector renders the rows, just without the derived numbers.
    expect(PAYWALL).toMatch(/savingsBadge=\{savingsBadge\}/);
    expect(PAYWALL).toMatch(/annualPerMonthLine=\{annualPerMonthLine\}/);
  });

  it("the force-degraded repro affordance is __DEV__-only (never in a release build)", () => {
    expect(PAYWALL).toMatch(/forceDegraded\s*=\s*__DEV__\s*&&\s*params\.forceDegraded\s*===\s*"1"/);
    expect(PAYWALL).toMatch(/setPackages\(forceDegraded \? \[\] : pkgs\)/);
  });
});
