import type Stripe from "stripe";
import { tierFromStripePriceIds } from "@/lib/stripe/tierFromPrice";
import { updateProfileTierServiceRole } from "@/lib/stripe/updateProfileTier";

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

function priceIdsFromSubscription(sub: Stripe.Subscription): string[] {
  return sub.items.data.map((item) => item.price?.id).filter((x): x is string => Boolean(x));
}

async function applyTierForSubscription(sub: Stripe.Subscription): Promise<void> {
  const userId = resolveUserIdFromSubscription(sub);
  if (!userId) return;

  const status = sub.status;
  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
    await updateProfileTierServiceRole(userId, "free");
    return;
  }

  if (status === "active" || status === "trialing" || status === "paused") {
    const ids = priceIdsFromSubscription(sub);
    const tier = tierFromStripePriceIds(ids);
    if (tier) {
      await updateProfileTierServiceRole(userId, tier);
    }
    return;
  }

  if (status === "past_due") {
    const ids = priceIdsFromSubscription(sub);
    const tier = tierFromStripePriceIds(ids);
    if (tier) {
      await updateProfileTierServiceRole(userId, tier);
    }
  }
}

/**
 * In-memory deduplication cache for webhook events within a server instance lifecycle.
 * Stripe may deliver the same event multiple times for reliability.
 * All tier update operations are idempotent (set tier = X, not tier += 1),
 * so duplicates are safe but wasteful. This cache prevents redundant DB writes.
 */
const processedEventIds = new Set<string>();
const MAX_CACHED_EVENTS = 1000;

/** @internal — exposed for tests only */
export function _clearProcessedEventsForTesting(): void {
  processedEventIds.clear();
}

/**
 * Core Stripe webhook business logic (testable without HTTP).
 */
export async function processStripeWebhookEvent(stripe: Stripe, event: Stripe.Event): Promise<void> {
  // Skip already-processed events (deduplication)
  if (processedEventIds.has(event.id)) return;
  processedEventIds.add(event.id);
  // Prevent unbounded memory growth
  if (processedEventIds.size > MAX_CACHED_EVENTS) {
    const first = processedEventIds.values().next().value;
    if (first) processedEventIds.delete(first);
  }
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;
      const userId = resolveUserIdFromCheckoutSession(session);
      if (!userId) break;
      const subRef = session.subscription;
      const subId = typeof subRef === "string" ? subRef : subRef?.id;
      if (!subId) break;
      const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data.price"] });
      const ids = priceIdsFromSubscription(sub);
      const tier = tierFromStripePriceIds(ids);
      if (tier) {
        await updateProfileTierServiceRole(userId, tier);
      }
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
