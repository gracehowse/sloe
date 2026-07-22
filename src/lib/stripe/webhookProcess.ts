import type Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";
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

/**
 * ENG-1490 finding #3 (2026-07-10): the annual-Pro 7-day trial was farmable
 * — Checkout mints a fresh Stripe Customer on every session (no `customer`
 * param passed), so a user could cancel a trialing subscription, re-checkout,
 * and get another free trial indefinitely, unboundedly.
 *
 * Fix: persist `profiles.trial_started_at` the first time we observe a
 * subscription go `trialing` for a user, and have the checkout route
 * (`app/api/stripe/checkout/route.ts`) refuse to set `trial_period_days`
 * once that column is non-null — regardless of how many Stripe Customers
 * the user has since minted.
 *
 * `trial_started_at` is already forward-compat-protected as client-non-
 * writable by the `profiles_tier_column_lockdown` / `_insert_lockdown`
 * trigger functions' `forward_banned` array (see
 * supabase/migrations/20260503102000_profiles_lockdown_forward_compat.sql)
 * — service-role writes here bypass that trigger via `auth.role() =
 * 'service_role'`, same as every other webhook write in this file.
 *
 * WHERE trial_started_at IS NULL makes this idempotent and first-trial-only:
 * a second `trialing` event (e.g. a webhook retry, or the rare subsequent
 * trial Stripe itself might allow) never overwrites the original timestamp.
 * Best-effort (warn-only) — never let a cosmetic column write block or
 * throw out of the tier grant, mirroring `persistStripeCustomerId` below.
 */
async function persistTrialStartedAtIfTrialing(
  userId: string,
  status: Stripe.Subscription.Status,
): Promise<void> {
  if (status !== "trialing") return;
  const sb = createSupabaseServiceRoleClient();
  if (!sb) return;
  const { error } = await sb
    .from("profiles")
    .update({ trial_started_at: new Date().toISOString() })
    .eq("id", userId)
    .is("trial_started_at", null);
  if (error) {
    console.warn("[stripe_webhook] failed to persist trial_started_at", error.message);
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

/**
 * ENG-1490 finding #2 (2026-07-21): Stripe does not guarantee webhook
 * delivery order (https://stripe.com/docs/webhooks#event-ordering) — a
 * `customer.subscription.*` event embeds a point-in-time snapshot of the
 * subscription as of when Stripe generated it, not one re-fetched at
 * delivery time. A chronologically OLDER-but-distinct event (retry
 * backoff, network jitter, concurrent dispatch) can arrive AFTER a newer
 * one for the SAME subscription already applied its tier decision — e.g.
 * a late `active` snapshot re-granting Pro after a subsequent
 * cancellation already correctly downgraded the user.
 * `updateProfileTierServiceRole` only floor-protects `lifetime_pro`, so a
 * plain pro→free downgrade has no protection against this.
 *
 * This is SEPARATE from `isAlreadyProcessed` (T23): that guards against
 * exact redelivery of the SAME event.id. This guards against a
 * DIFFERENT, older event for the same subscription landing after a newer
 * one already applied. Both run — dedup first (cheaper, catches the
 * common case), then this, only on the `customer.subscription.*` path
 * (see `stripe_subscription_event_versions`'s migration comment for why
 * `checkout.session.completed` doesn't need it: it re-fetches the
 * subscription live rather than trusting the webhook payload).
 *
 * Fail-open on read error — mirrors `isAlreadyProcessed`'s own philosophy
 * elsewhere in this file: if we can't determine the last-applied
 * timestamp, apply the event rather than silently dropping a legitimate
 * tier change.
 */
async function isStaleSubscriptionEvent(
  subscriptionId: string | undefined,
  eventCreated: number | null | undefined,
): Promise<boolean> {
  if (!subscriptionId || !eventCreated) return false;
  const sb = createSupabaseServiceRoleClient();
  if (!sb) return false; // env not configured (tests, dev) → never treat as stale
  const { data, error } = await sb
    .from("stripe_subscription_event_versions")
    .select("last_event_created")
    .eq("subscription_id", subscriptionId)
    .maybeSingle();
  if (error) {
    console.warn(
      "[stripe_webhook] failed to read last-applied subscription event version; fail-open (applying):",
      error.message,
    );
    return false;
  }
  const lastEventCreated = (data as { last_event_created?: string } | null)?.last_event_created;
  if (!lastEventCreated) return false; // no prior record → not stale
  const lastAppliedSeconds = Math.floor(new Date(lastEventCreated).getTime() / 1000);
  return eventCreated < lastAppliedSeconds;
}

/**
 * ENG-1490 #2 / ENG-1440 — a staleness-skip is otherwise invisible: it
 * only ever shows up as a `console.warn` line in a Vercel function log
 * nobody is tailing. ENG-1440's own prior investigation (2026-07-18,
 * still `needs/decision` — this guard is a narrower, Stripe-only
 * implementation of that ticket's broader ask, not a replacement for
 * it) named this exact gap as a precondition for shipping any version
 * of this guard: the documented forensic-replay runbook
 * (`docs/operations/stripe-webhook-replay-runbook.md`) deliberately
 * deletes `stripe_webhook_events` rows and replays historical events
 * with no ordering guarantee, so a wrongly-dropped legitimate event
 * must be visible to an operator, not silently swallowed. Mirrors the
 * `reportDrift`/`reportWriteFailed` pattern in
 * `src/lib/server/entitlementReconcileJob.ts`. */
function reportStaleSubscriptionEventSkipped(
  eventType: "customer.subscription.updated_or_created" | "customer.subscription.deleted",
  subscriptionId: string,
  eventId: string,
): void {
  Sentry.captureMessage(
    `[stripe_webhook] skipped stale out-of-order event for subscription ${subscriptionId}`,
    {
      level: "warning",
      fingerprint: ["stripe_webhook", "stale_event_skipped", eventType],
      tags: { type: "stripe_webhook", event_type: eventType, rail: "stripe" },
      extra: {
        subscriptionId,
        eventId,
        note:
          "A newer event was already applied for this subscription when this one arrived. " +
          "Usually correct (genuine out-of-order delivery). If this fires during a forensic " +
          "replay (see docs/operations/stripe-webhook-replay-runbook.md), verify the skipped " +
          "event's tier decision wasn't actually the one that should have won.",
      },
    },
  );
}

/** Persist the high-water mark after a `customer.subscription.*` tier
 * decision is applied (or explicitly skipped as a no-grant status like
 * `incomplete` — see call sites). Best-effort/warn-only, matching every
 * other bookkeeping write in this file; a failed write here just means
 * the next event's staleness check fails open, not a lost tier update. */
async function recordAppliedSubscriptionEvent(
  subscriptionId: string | undefined,
  eventCreated: number | null | undefined,
  eventId: string,
): Promise<void> {
  if (!subscriptionId || !eventCreated) return;
  const sb = createSupabaseServiceRoleClient();
  if (!sb) return;
  const { error } = await sb.from("stripe_subscription_event_versions").upsert(
    {
      subscription_id: subscriptionId,
      last_event_created: new Date(eventCreated * 1000).toISOString(),
      last_event_id: eventId,
    },
    { onConflict: "subscription_id" },
  );
  if (error) {
    console.warn(
      "[stripe_webhook] failed to persist last-applied subscription event version",
      error.message,
    );
  }
}

async function applyTierForSubscription(
  sub: Stripe.Subscription,
  eventCreated: number | null | undefined,
  eventId: string,
): Promise<void> {
  const userId = resolveUserIdFromSubscription(sub);
  if (!userId) return;
  if (await isStaleSubscriptionEvent(sub.id, eventCreated)) {
    console.warn(
      `[stripe_webhook] skipping stale out-of-order event ${eventId} for subscription ${sub.id}`,
    );
    reportStaleSubscriptionEventSkipped(
      "customer.subscription.updated_or_created",
      sub.id,
      eventId,
    );
    return;
  }
  await applyTierDecision(userId, tierDecisionForSubscription(sub));
  await persistTrialStartedAtIfTrialing(userId, sub.status);
  await recordAppliedSubscriptionEvent(sub.id, eventCreated, eventId);
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
      await persistTrialStartedAtIfTrialing(userId, sub.status);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      await applyTierForSubscription(sub, event.created, event.id);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = resolveUserIdFromSubscription(sub);
      if (userId) {
        // ENG-1490 #2: same stale-out-of-order guard as the updated/created
        // path — a late `deleted` for a subscription the user has since
        // resubscribed under (or a late-arriving delete racing a newer
        // `updated`) must not clobber a newer tier state.
        if (await isStaleSubscriptionEvent(sub.id, event.created)) {
          console.warn(
            `[stripe_webhook] skipping stale out-of-order deleted event ${event.id} for subscription ${sub.id}`,
          );
          reportStaleSubscriptionEventSkipped(
            "customer.subscription.deleted",
            sub.id,
            event.id,
          );
          break;
        }
        await updateProfileTierServiceRole(userId, "free");
        await recordAppliedSubscriptionEvent(sub.id, event.created, event.id);
      }
      break;
    }
    default:
      break;
  }
}
