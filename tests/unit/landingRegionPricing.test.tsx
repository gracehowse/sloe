// @vitest-environment jsdom
/**
 * ENG-1441 (2026-07-21) — landing page (`/`) region/VAT wiring.
 *
 * Before this change every consumer-facing price on the landing page
 * was a hardcoded GBP literal with zero region or VAT awareness — the
 * `Pricing` section rendered `PRICING_TIERS` prices with no note of
 * any kind, unlike `/pricing` (which has carried this since H7,
 * 2026-04-21 / ENG-1442, 2026-07-20).
 *
 * Region is resolved client-side via `detectRegionFromNavigatorLanguage`
 * (not server-side `detectRegion(headers())`) because `/` is kept fully
 * static for viral-traffic TTFB (2026-05-15 decision in `app/page.tsx`)
 * — see that function's doc comment in `src/lib/region/detectRegion.ts`.
 * `stripeTaxEnabled` / `eurPricingReady` are passed as explicit props
 * here (mirroring how `app/page.tsx` supplies them server-side) rather
 * than resolved from the env, since this file renders `<LandingPage>`
 * directly, not through the route.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("../../src/lib/analytics/track.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/analytics/track.ts")>();
  return { ...actual, isFeatureEnabled: () => false };
});

import { LandingPage } from "../../app/(landing)/LandingPage";

function stubNavigatorLanguage(lang: string) {
  Object.defineProperty(window.navigator, "language", {
    value: lang,
    configurable: true,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("landing page — region + VAT wiring (ENG-1441)", () => {
  it("UK visitor + STRIPE_TAX_ENABLED=true: 'Prices include VAT' renders under the Pro price", () => {
    stubNavigatorLanguage("en-GB");
    const { getByTestId, queryByTestId } = render(
      <LandingPage stripeTaxEnabled={true} eurPricingReady={false} />,
    );
    expect(getByTestId("landing-pricing-vat-note").textContent).toBe("Prices include VAT");
    // UK is a real, priced region — no "coming soon" banner.
    expect(queryByTestId("landing-pricing-region-note")).toBeNull();
  });

  it("UK visitor + STRIPE_TAX_ENABLED=false: no VAT note (the claim would be untrue)", () => {
    stubNavigatorLanguage("en-GB");
    const { queryByTestId } = render(
      <LandingPage stripeTaxEnabled={false} eurPricingReady={false} />,
    );
    expect(queryByTestId("landing-pricing-vat-note")).toBeNull();
  });

  it("EU visitor (de-DE) + EUR not priced yet: 'EU pricing coming soon — current prices in GBP'", () => {
    stubNavigatorLanguage("de-DE");
    const { getByTestId } = render(
      <LandingPage stripeTaxEnabled={true} eurPricingReady={false} />,
    );
    expect(getByTestId("landing-pricing-region-note").textContent).toBe(
      "EU pricing coming soon — current prices in GBP",
    );
    // Still gets the VAT note — EU/VAT posture and EUR-SKU readiness
    // are orthogonal (same split /pricing already makes).
    expect(getByTestId("landing-pricing-vat-note").textContent).toBe("Prices include VAT");
  });

  it("EU visitor + EUR pricing ready: the 'coming soon' banner drops", () => {
    stubNavigatorLanguage("de-DE");
    const { queryByTestId } = render(
      <LandingPage stripeTaxEnabled={true} eurPricingReady={true} />,
    );
    expect(queryByTestId("landing-pricing-region-note")).toBeNull();
  });

  it("default (en-US, the largest cohort per ENG-1441) visitor: 'US pricing coming soon — current prices in GBP', no VAT note", () => {
    stubNavigatorLanguage("en-US");
    const { getByTestId, queryByTestId } = render(
      <LandingPage stripeTaxEnabled={true} eurPricingReady={true} />,
    );
    expect(getByTestId("landing-pricing-region-note").textContent).toBe(
      "US pricing coming soon — current prices in GBP",
    );
    // Default region never gets the UK/EU-specific VAT-inclusive claim.
    expect(queryByTestId("landing-pricing-vat-note")).toBeNull();
  });

  it("renders sensible defaults when the route props are omitted (parity/pin-test callers)", () => {
    stubNavigatorLanguage("en-GB");
    // No stripeTaxEnabled/eurPricingReady passed — must not throw, and
    // must default to the honest no-claim state.
    const { queryByTestId } = render(<LandingPage />);
    expect(queryByTestId("landing-pricing-vat-note")).toBeNull();
  });

  it("price digits stay the flat GBP PRICING_TIERS values regardless of detected region — no fabricated currency conversion", () => {
    for (const lang of ["en-GB", "de-DE", "en-US"]) {
      stubNavigatorLanguage(lang);
      const { container, unmount } = render(
        <LandingPage stripeTaxEnabled={true} eurPricingReady={true} />,
      );
      const priceEls = container.querySelectorAll(".lp-price");
      expect(priceEls.length).toBeGreaterThan(0);
      for (const el of Array.from(priceEls)) {
        expect(el.textContent ?? "").not.toContain("$");
      }
      unmount();
    }
  });
});
