import type Stripe from "stripe";

/**
 * Pure decision logic for `/account/billing` — kept separate from the
 * server-component shell (`app/account/billing/page.tsx`) so the
 * error-branch priorities spec'd by monetisation-architect can be unit
 * tested without running Next.js' cookie / redirect machinery or
 * opening a network connection to Stripe.
 *
 * Priority order (verbatim from the 2026-04-19 round-3 spec, plus the
 * 2026-04-30 P0-1 addition for the App Store / RevenueCat case):
 *   1. Unauthenticated                                  → redirect `/login?redirect=/account/billing`
 *   2. Pro user with no Stripe customer id              → fallback `app_store_managed` (App Store route)
 *   2b. Non-Pro user with no Stripe customer id         → redirect `/pricing?ref=billing`
 *   3. `STRIPE_SECRET_KEY` missing                      → fallback `stripe_not_configured`
 *   4. Stripe API error / no portal URL                 → fallback `stripe_*`
 *   5. Happy path                                       → redirect to the portal URL
 *
 * Step 2 (App Store) was added 2026-04-30 because a user who paid
 * through RevenueCat → App Store on mobile has Pro entitlement but no
 * `stripe_customer_id`. Bouncing them to `/pricing?ref=billing` was a
 * silent no-op — they could never find the cancel path. The fallback
 * surface (`BillingUnavailableFallback`) already carries the iOS
 * Settings → Apple ID → Subscriptions copy required by Apple policy
 * (servers can't cancel an IAP), so we route there instead.
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
  /** Active entitlement tier — used to disambiguate "no customer id
   *  because the user is Free" from "no customer id because the user
   *  paid through RevenueCat / App Store". 2026-04-30 P0-1. */
  userTier?: "free" | "base" | "pro" | null;
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

  // 2 / 2b. No Stripe customer id — split by entitlement tier.
  //    A Pro user with no customer id paid via App Store / RevenueCat;
  //    we cannot resolve their portal from the server, so we degrade to
  //    the static fallback (which carries the iOS Settings → Apple ID
  //    → Subscriptions copy). A non-Pro user is just shopping for a
  //    plan — bounce them to /pricing.
  if (!inputs.stripeCustomerId) {
    if (inputs.userTier === "pro") {
      return { kind: "fallback", reason: "app_store_managed" };
    }
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
