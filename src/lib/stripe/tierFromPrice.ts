import type { UserTier } from "../../types/recipe.ts";

/** Map Stripe Price id → Suppr tier using env-configured monthly prices. */
export function tierFromStripePriceId(priceId: string | undefined | null): UserTier | null {
  if (!priceId) return null;
  const base = process.env.STRIPE_PRICE_BASE_MONTHLY?.trim();
  const pro = process.env.STRIPE_PRICE_PRO_MONTHLY?.trim();
  if (pro && priceId === pro) return "pro";
  if (base && priceId === base) return "base";
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
