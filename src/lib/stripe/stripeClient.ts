import Stripe from "stripe";

/**
 * Shared server-side Stripe client factory.
 *
 * Returns a configured `Stripe` instance, or `null` when
 * `STRIPE_SECRET_KEY` is unset (local/dev/pre-launch — the Stripe rail
 * is dark until Grace runs the go-live bundle, ENG-1433). Callers decide
 * how to surface the missing key: the checkout/webhook routes 503, the
 * reconciliation cron cleanly skips (a not-yet-configured rail is not a
 * cron failure worth paging on).
 *
 * No `apiVersion` is pinned — this matches the pre-existing checkout /
 * webhook client construction, so the account's default API version is
 * used consistently across every Stripe call site.
 */
export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}
