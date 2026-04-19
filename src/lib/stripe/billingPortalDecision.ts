import type Stripe from "stripe";

/**
 * Pure decision logic for `/account/billing` — kept separate from the
 * server-component shell (`app/account/billing/page.tsx`) so the four
 * error-branch priorities spec'd by monetisation-architect can be unit
 * tested without running Next.js' cookie / redirect machinery or
 * opening a network connection to Stripe.
 *
 * Priority order (verbatim from the 2026-04-19 round-3 spec):
 *   1. Unauthenticated                     → redirect `/login?redirect=/account/billing`
 *   2. No `stripe_customer_id` for user    → redirect `/pricing?ref=billing`
 *   3. `STRIPE_SECRET_KEY` missing         → static fallback
 *   4. Stripe API error / no portal URL    → static fallback
 *   5. Happy path                          → redirect to the portal URL
 */

export type BillingPortalOutcome =
  | { kind: "redirect"; url: string }
  | { kind: "fallback"; reason: string };

export type BillingPortalInputs = {
  /** Supabase user id; `null` when the request is unauthenticated. */
  userId: string | null;
  /** Stripe customer id captured by the `checkout.session.completed`
   *  webhook on `profiles.stripe_customer_id`; `null` when the user
   *  never completed a paid checkout (Free tier, or a paid user who
   *  subscribed before the webhook started persisting the column). */
  stripeCustomerId: string | null;
  /** Opener for a Stripe Customer Portal session. Returning `null`
   *  (e.g. when `STRIPE_SECRET_KEY` is unset) triggers the static
   *  fallback. Throwing triggers the same fallback with a logged reason. */
  openPortal: (() => Promise<Stripe.BillingPortal.Session | null>) | null;
};

export async function resolveBillingPortalOutcome(
  inputs: BillingPortalInputs,
): Promise<BillingPortalOutcome> {
  // 1. Unauthenticated — bounce to login with a redirect hint.
  if (!inputs.userId) {
    return { kind: "redirect", url: "/login?redirect=/account/billing" };
  }

  // 2. No customer id — bounce to pricing with an attribution hint.
  //    Free users, or paid users who subscribed before the webhook
  //    started persisting `stripe_customer_id` onto profiles.
  if (!inputs.stripeCustomerId) {
    return { kind: "redirect", url: "/pricing?ref=billing" };
  }

  // 3. Stripe secret key unset (or any caller that passed `null` as
  //    the portal opener) — static support-email fallback rather than
  //    a 404 / 5xx.
  if (!inputs.openPortal) {
    return {
      kind: "fallback",
      reason: "stripe_not_configured",
    };
  }

  // 4. Stripe API error or no portal URL — same static fallback.
  try {
    const session = await inputs.openPortal();
    const url = session?.url ?? null;
    if (!url) {
      return { kind: "fallback", reason: "stripe_no_portal_url" };
    }
    return { kind: "redirect", url };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { kind: "fallback", reason: `stripe_error: ${message}` };
  }
}
