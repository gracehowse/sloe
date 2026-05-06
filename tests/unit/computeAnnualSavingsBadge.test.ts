import { describe, expect, it } from "vitest";
import { computeAnnualSavingsBadge, PRICING_TIERS } from "@/lib/landing/pricingTiers";
import type { PricingTier } from "@/lib/landing/pricingTiers";

/**
 * Audit P04 (2026-05-05) — pin that the "Save N%" badge tracks the
 * source-of-truth `price` + `annualPrice` numbers in PRICING_TIERS.
 * Was hardcoded "Save 37%" in two places (web grid toggle + mobile
 * paywall), which would silently lie on any future price change while
 * the reference-line ("save 37% vs £7.99/mo") stayed correct.
 */

const baseTier: PricingTier = {
  name: "Pro",
  tag: "tag",
  price: "£7.99",
  period: "/month",
  annualPrice: "£59.99",
  annualPeriod: "/year",
  checkoutTier: "pro",
  nutritionNote: "",
  featHead: "",
  features: [],
};

describe("computeAnnualSavingsBadge", () => {
  it("returns null for a tier without annual pricing (Free)", () => {
    const free: PricingTier = { ...baseTier, name: "Free", price: "£0", annualPrice: undefined };
    expect(computeAnnualSavingsBadge(free)).toBeNull();
  });

  it("computes the correct badge for the canonical Pro tier (37%)", () => {
    // £7.99 monthly × 12 = £95.88; £59.99 annual; 1 - 59.99/95.88 = 0.3743 → 37%
    const proTier = PRICING_TIERS.find((t) => t.name === "Pro")!;
    expect(computeAnnualSavingsBadge(proTier)).toBe("Save 37%");
  });

  it("respects a manual `annualSavings` override when set", () => {
    const overridden: PricingTier = { ...baseTier, annualSavings: "Save 50%" };
    expect(computeAnnualSavingsBadge(overridden)).toBe("Save 50%");
  });

  it("auto-updates if the price changes (no hardcode drift)", () => {
    // Hypothetical price drop: monthly stays £7.99, annual drops to £49.99
    // 1 - 49.99/95.88 = 0.4787 → 48%
    const cheaper: PricingTier = { ...baseTier, annualPrice: "£49.99" };
    expect(computeAnnualSavingsBadge(cheaper)).toBe("Save 48%");
  });

  it("returns null when annual is more expensive than monthly × 12 (degenerate)", () => {
    const upsideDown: PricingTier = { ...baseTier, annualPrice: "£100.00" };
    expect(computeAnnualSavingsBadge(upsideDown)).toBeNull();
  });

  it("returns null when prices can't be parsed", () => {
    const broken: PricingTier = { ...baseTier, price: "free", annualPrice: "free" };
    expect(computeAnnualSavingsBadge(broken)).toBeNull();
  });

  it("works with USD-style currency strings", () => {
    const usd: PricingTier = { ...baseTier, price: "$9.99", annualPrice: "$74.99" };
    // 1 - 74.99/119.88 = 0.3744 → 37%
    expect(computeAnnualSavingsBadge(usd)).toBe("Save 37%");
  });

  it("works with comma-separated currency (European format)", () => {
    const euro: PricingTier = { ...baseTier, price: "€9,99", annualPrice: "€74,99" };
    // Parses as 9.99 + 74.99 → same calc as USD case
    expect(computeAnnualSavingsBadge(euro)).toBe("Save 37%");
  });
});
