import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  isEurStripePricingConfigured,
  resolveProStripePriceId,
} from "../../src/lib/stripe/resolveProStripePrice";

type EnvBackup = {
  proMonthly: string | undefined;
  proAnnual: string | undefined;
  proMonthlyEur: string | undefined;
  proAnnualEur: string | undefined;
};

function snapshotEnv(): EnvBackup {
  return {
    proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    proAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL,
    proMonthlyEur: process.env.STRIPE_PRICE_PRO_MONTHLY_EUR,
    proAnnualEur: process.env.STRIPE_PRICE_PRO_ANNUAL_EUR,
  };
}

function restoreEnv(prev: EnvBackup): void {
  process.env.STRIPE_PRICE_PRO_MONTHLY = prev.proMonthly;
  process.env.STRIPE_PRICE_PRO_ANNUAL = prev.proAnnual;
  process.env.STRIPE_PRICE_PRO_MONTHLY_EUR = prev.proMonthlyEur;
  process.env.STRIPE_PRICE_PRO_ANNUAL_EUR = prev.proAnnualEur;
}

describe("resolveProStripePriceId", () => {
  let prev: EnvBackup;

  beforeEach(() => {
    prev = snapshotEnv();
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_gbp_m";
    process.env.STRIPE_PRICE_PRO_ANNUAL = "price_gbp_a";
    process.env.STRIPE_PRICE_PRO_MONTHLY_EUR = "price_eur_m";
    process.env.STRIPE_PRICE_PRO_ANNUAL_EUR = "price_eur_a";
  });

  afterEach(() => {
    restoreEnv(prev);
  });

  it("returns GBP monthly by default", () => {
    expect(resolveProStripePriceId({ period: "monthly" })).toEqual({
      priceId: "price_gbp_m",
      envVar: "STRIPE_PRICE_PRO_MONTHLY",
      currency: "GBP",
    });
  });

  it("returns EUR monthly when requested and configured", () => {
    expect(resolveProStripePriceId({ period: "monthly", currency: "EUR" })).toEqual({
      priceId: "price_eur_m",
      envVar: "STRIPE_PRICE_PRO_MONTHLY_EUR",
      currency: "EUR",
    });
  });

  it("falls back to GBP when EUR SKU is unset", () => {
    delete process.env.STRIPE_PRICE_PRO_MONTHLY_EUR;
    expect(resolveProStripePriceId({ period: "monthly", currency: "EUR" })).toEqual({
      priceId: "price_gbp_m",
      envVar: "STRIPE_PRICE_PRO_MONTHLY",
      currency: "GBP",
    });
  });

  it("isEurStripePricingConfigured reflects monthly EUR env", () => {
    expect(isEurStripePricingConfigured()).toBe(true);
    delete process.env.STRIPE_PRICE_PRO_MONTHLY_EUR;
    expect(isEurStripePricingConfigured()).toBe(false);
  });
});
