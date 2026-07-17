/**
 * PricingHeroCta — condensed sticky renewal disclosure (ENG-1438,
 * 2026-07-05 deep audit MP-06/LEGAL-006).
 *
 * Pre-fix, the hero CTA's caption ("7-day free trial · cancel anytime" /
 * "Charged today · cancel anytime") was legally thin — no price, no
 * auto-renewal statement — while the full disclosure sat below the fold.
 * `paywall_sticky_renewal_line_v1` swaps it for `buildStickyRenewalLine`'s
 * output; the flag is forced via `window.__SUPPR_FORCE_FLAGS__` (the same
 * client force hook Playwright seeds), matching
 * `paywallTrajectoryChart.test.tsx`.
 */
import * as React from "react";
import { describe, expect, it, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

void React;

import { PricingHeroCta } from "../../app/pricing/PricingHeroCta.tsx";
import { PRICING_TIERS } from "../../src/lib/landing/pricingTiers.ts";

const PRO_TIER = PRICING_TIERS.find((t) => t.name === "Pro")!;
const FLAG = "paywall_sticky_renewal_line_v1";

function forceFlag(value: boolean) {
  (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__ = {
    [FLAG]: value,
  };
}

afterEach(() => {
  delete (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__;
});

describe("PricingHeroCta — sticky renewal line (flag ON)", () => {
  it("renders the condensed disclosure on the default monthly view (no trial)", () => {
    forceFlag(true);
    render(<PricingHeroCta proTier={PRO_TIER} paywallFrom="settings" />);
    expect(
      screen.getByText(`${PRO_TIER.price}${PRO_TIER.period}, auto-renews until cancelled — cancel anytime in account settings.`),
    ).toBeInTheDocument();
  });

  it("switches to the trial framing on the annual selector", () => {
    forceFlag(true);
    render(<PricingHeroCta proTier={PRO_TIER} paywallFrom="settings" />);
    fireEvent.click(screen.getByRole("tab", { name: /annual/i }));
    expect(
      screen.getByText(
        `7-day free trial, then auto-renews at ${PRO_TIER.annualPrice}${PRO_TIER.annualPeriod} — cancel before day 7 to avoid charges.`,
      ),
    ).toBeInTheDocument();
    // Never implies monthly has a trial — the pre-existing honesty rule.
    expect(screen.queryByText(/Charged today/)).toBeNull();
  });
});

describe("PricingHeroCta — sticky renewal line (flag OFF, kill switch)", () => {
  it("falls back to the pre-fix caption", () => {
    forceFlag(false);
    render(<PricingHeroCta proTier={PRO_TIER} paywallFrom="settings" />);
    expect(screen.getByText("Charged today · cancel anytime")).toBeInTheDocument();
    expect(screen.queryByText(/auto-renews/)).toBeNull();
  });
});
