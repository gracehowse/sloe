/**
 * ENG-667 — resolve the Stripe Price id for Pro checkout by billing
 * period and visitor currency. EUR SKUs are optional; when unset we
 * fall back to GBP so checkout keeps working during rollout.
 */

export type CheckoutCurrency = "GBP" | "EUR";

export type ResolvedProStripePrice = {
  priceId: string | null;
  /** Env var that supplied `priceId` (for error messages). */
  envVar: string;
  /** Currency actually used after EUR fallback. */
  currency: CheckoutCurrency;
};

function proPriceEnvVar(period: "monthly" | "annual", currency: CheckoutCurrency): string {
  if (currency === "EUR") {
    return period === "annual" ? "STRIPE_PRICE_PRO_ANNUAL_EUR" : "STRIPE_PRICE_PRO_MONTHLY_EUR";
  }
  return period === "annual" ? "STRIPE_PRICE_PRO_ANNUAL" : "STRIPE_PRICE_PRO_MONTHLY";
}

/** True when at least the Pro monthly EUR price id is configured. */
export function isEurStripePricingConfigured(): boolean {
  return Boolean(process.env.STRIPE_PRICE_PRO_MONTHLY_EUR?.trim());
}

export function resolveProStripePriceId(args: {
  period: "monthly" | "annual";
  currency?: CheckoutCurrency | string | null;
}): ResolvedProStripePrice {
  const requested: CheckoutCurrency = args.currency === "EUR" ? "EUR" : "GBP";

  if (requested === "EUR") {
    const eurEnvVar = proPriceEnvVar(args.period, "EUR");
    const eurPriceId = process.env[eurEnvVar]?.trim();
    if (eurPriceId) {
      return { priceId: eurPriceId, envVar: eurEnvVar, currency: "EUR" };
    }
    const gbpEnvVar = proPriceEnvVar(args.period, "GBP");
    return {
      priceId: process.env[gbpEnvVar]?.trim() ?? null,
      envVar: gbpEnvVar,
      currency: "GBP",
    };
  }

  const gbpEnvVar = proPriceEnvVar(args.period, "GBP");
  return {
    priceId: process.env[gbpEnvVar]?.trim() ?? null,
    envVar: gbpEnvVar,
    currency: "GBP",
  };
}
