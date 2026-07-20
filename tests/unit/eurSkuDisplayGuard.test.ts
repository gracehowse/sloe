import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  assertEurSkuDisplayReadiness,
  checkEurSkuDisplayReadiness,
} from "../../src/lib/stripe/eurSkuDisplayGuard";
import { PRICING_TIERS, isEurPricingDisplayReady } from "../../src/lib/landing/pricingTiers";

/**
 * ENG-1442 (MP-10/LEGAL-009) — pins the boot-time safety rail that
 * refuses EUR Stripe Price env vars while the pricing display layer
 * can't render EUR. See
 * docs/decisions/2026-07-20-eng1442-currency-display-guard.md.
 */

type EnvBackup = {
  proMonthlyEur: string | undefined;
  proAnnualEur: string | undefined;
};

function snapshotEnv(): EnvBackup {
  return {
    proMonthlyEur: process.env.STRIPE_PRICE_PRO_MONTHLY_EUR,
    proAnnualEur: process.env.STRIPE_PRICE_PRO_ANNUAL_EUR,
  };
}

function restoreEnv(prev: EnvBackup): void {
  if (prev.proMonthlyEur === undefined) delete process.env.STRIPE_PRICE_PRO_MONTHLY_EUR;
  else process.env.STRIPE_PRICE_PRO_MONTHLY_EUR = prev.proMonthlyEur;
  if (prev.proAnnualEur === undefined) delete process.env.STRIPE_PRICE_PRO_ANNUAL_EUR;
  else process.env.STRIPE_PRICE_PRO_ANNUAL_EUR = prev.proAnnualEur;
}

describe("isEurPricingDisplayReady (pricing SSOT)", () => {
  it("is false today — no tier has a real EUR display value", () => {
    // Ground truth: this must stay false until EUR pricing is
    // actually decided. If this test starts failing because someone
    // populated displayByCurrency.EUR, that's expected — but the PR
    // that does it must also wire PricingTiersGrid to render EUR
    // (see the decision doc's follow-up section) and update this test.
    expect(isEurPricingDisplayReady()).toBe(false);
  });

  it("every checkout-eligible tier is missing displayByCurrency.EUR", () => {
    const checkoutTiers = PRICING_TIERS.filter((t) => t.checkoutTier !== null);
    expect(checkoutTiers.length).toBeGreaterThan(0);
    for (const tier of checkoutTiers) {
      expect(tier.displayByCurrency?.EUR).toBeUndefined();
    }
  });

  it("every tier has a populated GBP display entry", () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.displayByCurrency?.GBP?.price).toBeTruthy();
    }
  });
});

describe("checkEurSkuDisplayReadiness / assertEurSkuDisplayReadiness", () => {
  let prev: EnvBackup;

  beforeEach(() => {
    prev = snapshotEnv();
    delete process.env.STRIPE_PRICE_PRO_MONTHLY_EUR;
    delete process.env.STRIPE_PRICE_PRO_ANNUAL_EUR;
  });

  afterEach(() => {
    restoreEnv(prev);
  });

  it("is ok when no EUR SKU env var is set (today's default state)", () => {
    expect(checkEurSkuDisplayReadiness()).toEqual({ ok: true });
    expect(() => assertEurSkuDisplayReadiness()).not.toThrow();
  });

  it("refuses (not ok) when STRIPE_PRICE_PRO_MONTHLY_EUR is set and display isn't ready", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY_EUR = "price_eur_m";
    const result = checkEurSkuDisplayReadiness();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.envVars).toEqual(["STRIPE_PRICE_PRO_MONTHLY_EUR"]);
      expect(result.message).toContain("STRIPE_PRICE_PRO_MONTHLY_EUR");
      expect(result.message).toContain("displayByCurrency.EUR");
    }
  });

  it("refuses when STRIPE_PRICE_PRO_ANNUAL_EUR is set and display isn't ready", () => {
    process.env.STRIPE_PRICE_PRO_ANNUAL_EUR = "price_eur_a";
    const result = checkEurSkuDisplayReadiness();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.envVars).toEqual(["STRIPE_PRICE_PRO_ANNUAL_EUR"]);
  });

  it("reports both env vars when both are set", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY_EUR = "price_eur_m";
    process.env.STRIPE_PRICE_PRO_ANNUAL_EUR = "price_eur_a";
    const result = checkEurSkuDisplayReadiness();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.envVars).toEqual([
        "STRIPE_PRICE_PRO_MONTHLY_EUR",
        "STRIPE_PRICE_PRO_ANNUAL_EUR",
      ]);
    }
  });

  it("ignores a blank/whitespace-only EUR env var (treated as unset)", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY_EUR = "   ";
    expect(checkEurSkuDisplayReadiness()).toEqual({ ok: true });
  });

  it("assertEurSkuDisplayReadiness throws a [ENG-1442]-tagged error when unsafe", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY_EUR = "price_eur_m";
    expect(() => assertEurSkuDisplayReadiness()).toThrow(/\[ENG-1442\]/);
  });
});
