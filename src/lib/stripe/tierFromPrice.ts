import type { UserTier } from "../../types/recipe.ts";

/**
 * Map a Stripe Price id to a Suppr tier by matching it against the
 * four env-configured price IDs (Base/Pro × monthly/annual).
 *
 * Webhook events carry the price id that the user actually bought,
 * so either billing frequency must resolve to the same tier. The
 * tier is what we persist on `profiles.user_tier`; the billing
 * frequency lives on Stripe and is not mirrored to our DB.
 */
export function tierFromStripePriceId(priceId: string | undefined | null): UserTier | null {
  if (!priceId) return null;
  const baseMonthly = process.env.STRIPE_PRICE_BASE_MONTHLY?.trim();
  const baseAnnual = process.env.STRIPE_PRICE_BASE_ANNUAL?.trim();
  const proMonthly = process.env.STRIPE_PRICE_PRO_MONTHLY?.trim();
  const proAnnual = process.env.STRIPE_PRICE_PRO_ANNUAL?.trim();
  if ((proMonthly && priceId === proMonthly) || (proAnnual && priceId === proAnnual)) return "pro";
  if ((baseMonthly && priceId === baseMonthly) || (baseAnnual && priceId === baseAnnual)) return "base";
  return null;
}

/**
 * Pick the highest tier from subscription line items (pro beats base).
 */
export function tierFromStripePriceIds(priceIds: string[]): UserTier | null {
  let best: UserTier | null = null;
  for (const id of priceIds) {
    const t = tierFromStripePriceId(id);
    if (t === "pro") return "pro";
    if (t === "base") best = "base";
  }
  return best;
}
