import type Stripe from "stripe";
import { tierFromStripePriceIds } from "@/lib/stripe/tierFromPrice";
import { updateProfileTierServiceRole } from "@/lib/stripe/updateProfileTier";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/serverAnonClient";

/**
 * Persist the Stripe customer ID onto `profiles.stripe_customer_id` so
 * `/account/billing` can open the Stripe Customer Portal without an
 * extra Stripe API round-trip to resolve customer → subscription.
 *
 * `session.customer` is either a string customer ID (`cus_…`) or an
 * expanded `Customer` object, depending on whether the webhook
 * subscriber expanded the field. We normalise to the ID string.
 *
 * Failure is logged but non-throwing — tier update is the critical
 * write and must not regress on a cosmetic column write.
 */
async function persistStripeCustomerId(
  userId: string,
  customerRef: Stripe.Checkout.Session["customer"],
): Promise<void> {
  const customerId =
    typeof customerRef === "string" ? customerRef : customerRef?.id ?? null;
  if (!customerId) return;
  const sb = createSupabaseServiceRoleClient();
  if (!sb) return;
  const { error } = await sb
    .from("profiles")
    .update({ stripe_customer_id: customerId })
    .eq("id", userId);
  if (error) {
    console.warn(
      "[stripe_webhook] failed to persist stripe_customer_id",
      error.message,
    );
  }
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function resolveUserIdFromCheckoutSession(session: Stripe.Checkout.Session): string | null {
  const ref = session.client_reference_id?.trim();
  if (ref && isUuid(ref)) return ref;
  const meta = session.metadata?.supabase_user_id?.trim();
  if (meta && isUuid(meta)) return meta;
  return null;
}

function resolveUserIdFromSubscription(sub: Stripe.Subscription): string | null {
  const meta = sub.metadata?.supabase_user_id?.trim();
  if (meta && isUuid(meta)) return meta;
  return null;
}

function priceIdsFromSubscription(sub: TierDecidableSubscription): string[] {
  return sub.items.data.map((item) => item.price?.id).filter((x): x is string => Boolean(x));
}

/**
 * Single source of truth for "given a Stripe subscription's status, what
 * should the user's tier become?" — shared by BOTH the
 * `customer.subscription.*` path and the `checkout.session.completed`
 * path so they can't diverge.
 *
 * ENG-1490 (2026-07-10): the checkout branch previously granted tier from
 * price IDs alone, never inspecting `sub.status` — so a
 * `checkout.session.completed` whose subscription was `incomplete`
 * (initial payment not yet succeeded) would still grant Pro. Routing both
 * paths through this decision closes that gap.
 *
 *   - canceled / unpaid / incomplete_expired → downgrade to free
 *   - active / trialing / paused / past_due   → grant the priced tier
 *     (past_due is still inside Stripe's dunning grace window)
 *   - incomplete (payment pending) / any future status → do nothing
 *   - entitling status but an unrecognised price → do nothing (skip),
 *     never a spurious grant
 *
 * ENG-1463 (2026-07-15): the parameter is a minimal structural type (not
 * the full `Stripe.Subscription`) so `entitlementReconcileJob.ts` can call
 * this same decision function for its own reconciliation loop — a real
 * `Stripe.Subscription` satisfies it structurally, and it keeps the
 * two callers' entitling-status policy from re-diverging into two
 * hardcoded copies (exactly the drift this function exists to prevent).
 */
export interface TierDecidableSubscription {
  status: Stripe.Subscription.Status;
  items: { data: Array<{ price?: { id?: string | null } | null }> };
}

type TierDecision =
  | { action: "grant"; tier: NonNullable<ReturnType<typeof tierFromStripePriceIds>> }
  | { action: "free" }
  | { action: "skip" };

export function tierDecisionForSubscription(sub: TierDecidableSubscription): TierDecision {
  const status = sub.status;
  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
    return { action: "free" };
  }
  if (status === "active" || status === "trialing" || status === "paused" || status === "past_due") {
    const tier = tierFromStripePriceIds(priceIdsFromSubscription(sub));
    return tier ? { action: "grant", tier } : { action: "skip" };
  }
  // "incomplete" (initial payment still pending) and any status Stripe
  // may add later → do nothing rather than guess.
  return { action: "skip" };
}

async function applyTierDecision(userId: string, decision: TierDecision): Promise<void> {
  if (decision.action === "free") {
    await updateProfileTierServiceRole(userId, "free");
  } else if (decision.action === "grant") {
    await updateProfileTierServiceRole(userId, decision.tier);
  }
  // "skip" → intentionally no write.
}

async function applyTierForSubscription(sub: Stripe.Subscription): Promise<void> {
  const userId = resolveUserIdFromSubscription(sub);
  if (!userId) return;
  await applyTierDecision(userId, tierDecisionForSubscription(sub));
}

/**
 * T23 (2026-04-24) — persisted deduplication via `stripe_webhook_events`.
 *
 * Replaces the previous in-memory `Set<string>` which lost state on
 * every cold start / function eviction (Stripe retries up to 72h).
 *
 * Pattern: try to INSERT the event.id. Unique-key violation (23505)
 * means we've seen this event already → return true (skip handler).
 * Any other error (connection, env unset, etc.) returns false so the
 * handler still runs — fail-safe matching the previous in-memory
 * behaviour on faults. Duplicate-processing of an idempotent handler
 * is strictly better than dropping a real event.
 */
async function isAlreadyProcessed(eventId: string): Promise<boolean> {
  if (!eventId) return false;
  const sb = createSupabaseServiceRoleClient();
  if (!sb) return false; // env not configured (tests, dev) → never dedup
  const { error } = await sb
    .from("stripe_webhook_events")
    .insert({ event_id: eventId });
  if (!error) return false; // first time seeing this id
  if ((error as { code?: string }).code === "23505") return true;
  // Any other error: log + fail-safe (process the event).
  // 42P01 (undefined_table) or 42883 covers a partial deploy without
  // the migration; treat the same as a transient fault.
  console.warn(
    "[stripe_webhook] dedup INSERT failed; processing event without dedup:",
    error.message,
  );
  return false;
}

/** @internal — exposed for tests only.
 *  Retained as a no-op for backward compat with existing test setups
 *  that called this in `beforeEach`. The dedup is now DB-backed; tests
 *  without a service-role client (typical) bypass dedup entirely. */
export function _clearProcessedEventsForTesting(): void {
  /* no-op since T23 — dedup state lives in stripe_webhook_events */
}

/**
 * Core Stripe webhook business logic (testable without HTTP).
 */
export async function processStripeWebhookEvent(stripe: Stripe, event: Stripe.Event): Promise<void> {
  // Skip already-processed events (T23 persisted dedup).
  if (await isAlreadyProcessed(event.id)) return;
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;
      const userId = resolveUserIdFromCheckoutSession(session);
      if (!userId) break;
      // Persist the Stripe customer ID so `/account/billing` can open
      // the Customer Portal for this user without a secondary Stripe
      // API call. Runs before the tier update so a failure on the tier
      // update doesn't leave us without a customer id; the column
      // write is best-effort (warn-only) by design.
      await persistStripeCustomerId(userId, session.customer);
      const subRef = session.subscription;
      const subId = typeof subRef === "string" ? subRef : subRef?.id;
      if (!subId) break;
      const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data.price"] });
      // ENG-1490: gate on the subscription's status (via the shared
      // decision) rather than granting from price IDs alone — an
      // `incomplete`/`unpaid` checkout must NOT grant Pro.
      await applyTierDecision(userId, tierDecisionForSubscription(sub));
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      await applyTierForSubscription(sub);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = resolveUserIdFromSubscription(sub);
      if (userId) {
        await updateProfileTierServiceRole(userId, "free");
      }
      break;
    }
    default:
      break;
  }
}
