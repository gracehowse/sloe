/**
 * Canonical tier ordering for server-side merge / floor logic.
 *
 * Mirrors `tierRank` in `apps/mobile/lib/purchases.ts` — keep ranks in
 * sync when adding tiers. Used by webhook tier writes (ENG-49) so a
 * founding `lifetime_pro` comp is never downgraded by Stripe / RC expiry.
 */
export type DbUserTier = "free" | "base" | "pro" | "lifetime_pro";

export function tierRank(t: string): number {
  if (t === "lifetime_pro") return 3;
  if (t === "pro") return 2;
  if (t === "base") return 1;
  return 0;
}
