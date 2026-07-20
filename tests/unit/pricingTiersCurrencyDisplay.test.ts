import { describe, expect, it } from "vitest";
import {
  PRICING_TIERS,
  resolveTierDisplay,
  isEurPricingDisplayReady,
} from "@/lib/landing/pricingTiers";
import type { PricingTier } from "@/lib/landing/pricingTiers";

/**
 * ENG-1442 (MP-10/LEGAL-009) — pins the per-currency display SSOT
 * shape and its GBP-fallback resolver. Companion to
 * `tests/unit/eurSkuDisplayGuard.test.ts` (the boot-time assertion)
 * and `tests/unit/resolveProStripePrice.test.ts` (the Stripe Price id
 * resolver these fields must stay reconciled against once EUR ships).
 */

describe("PricingTier.displayByCurrency", () => {
  it("GBP display strings match the legacy flat fields for every tier", () => {
    for (const tier of PRICING_TIERS) {
      const gbp = tier.displayByCurrency?.GBP;
      expect(gbp).toBeDefined();
      expect(gbp?.price).toBe(tier.price);
      expect(gbp?.period).toBe(tier.period);
      expect(gbp?.annualPrice).toBe(tier.annualPrice);
      expect(gbp?.annualPeriod).toBe(tier.annualPeriod);
    }
  });

  it("Pro tier's GBP display is the canonical £7.99/£59.99", () => {
    const pro = PRICING_TIERS.find((t) => t.name === "Pro")!;
    expect(pro.displayByCurrency?.GBP).toEqual({
      price: "£7.99",
      period: "/month",
      annualPrice: "£59.99",
      annualPeriod: "/year",
    });
  });
});

describe("resolveTierDisplay", () => {
  const proTier = PRICING_TIERS.find((t) => t.name === "Pro")!;

  it("returns the GBP display when currency is GBP", () => {
    expect(resolveTierDisplay(proTier, "GBP")).toEqual(proTier.displayByCurrency!.GBP);
  });

  it("falls back to GBP when EUR is requested but not populated (today's state)", () => {
    expect(resolveTierDisplay(proTier, "EUR")).toEqual(proTier.displayByCurrency!.GBP);
  });

  it("prefers a populated EUR entry over the GBP fallback, once one exists", () => {
    const withEur: PricingTier = {
      ...proTier,
      displayByCurrency: {
        ...proTier.displayByCurrency,
        EUR: { price: "€8.99", period: "/month", annualPrice: "€69.99", annualPeriod: "/year" },
      },
    };
    expect(resolveTierDisplay(withEur, "EUR")).toEqual({
      price: "€8.99",
      period: "/month",
      annualPrice: "€69.99",
      annualPeriod: "/year",
    });
    // GBP resolution is unaffected by an EUR entry being present.
    expect(resolveTierDisplay(withEur, "GBP")).toEqual(proTier.displayByCurrency!.GBP);
  });

  it("falls back to the legacy flat fields for a tier constructed without displayByCurrency", () => {
    const legacyShapeTier: PricingTier = {
      name: "Pro",
      tag: "tag",
      price: "£1.00",
      period: "/month",
      checkoutTier: "pro",
      nutritionNote: "",
      features: [],
      highlighted: false,
      // displayByCurrency intentionally omitted.
    };
    expect(resolveTierDisplay(legacyShapeTier, "GBP")).toEqual({
      price: "£1.00",
      period: "/month",
      annualPrice: undefined,
      annualPeriod: undefined,
    });
    expect(resolveTierDisplay(legacyShapeTier, "EUR")).toEqual({
      price: "£1.00",
      period: "/month",
      annualPrice: undefined,
      annualPeriod: undefined,
    });
  });
});

describe("isEurPricingDisplayReady", () => {
  it("is false while the real PRICING_TIERS SSOT has no EUR data", () => {
    expect(isEurPricingDisplayReady()).toBe(false);
  });
});
