/**
 * T6 (full-sweep 2026-04-24) — RevenueCat webhook business logic.
 *
 * Mirror of `src/lib/stripe/webhookProcess.ts`. The HTTP route
 * (`app/api/revenuecat/webhook/route.ts`) verifies the bearer secret
 * and parses the request body, then calls `processRevenueCatEvent`
 * with the parsed event. Persistence + tier writes live here so the
 * handler is testable without HTTP.
 *
 * Pattern (matches T23 Stripe dedup):
 *   1. INSERT into `revenuecat_events`. 23505 → already processed,
 *      return early.
 *   2. Other INSERT errors → log + fail-safe-process (duplicate
 *      processing of an idempotent tier write is strictly better than
 *      dropping a real event; cancellations etc. must not be silent).
 *   3. Dispatch by event_type → service-role tier write.
 *
 * The tier write goes through `updateProfileTierServiceRole` —
 * bypasses the client-side `resolveNextTier` downgrade-blocked guard
 * because RC webhook is the authoritative path for downgrades.
 */

import { createSupabaseServiceRoleClient } from "@/lib/supabase/serverAnonClient";
import { updateProfileTierServiceRole } from "@/lib/stripe/updateProfileTier";
import {
  eventTypeIsTierGrant,
  eventTypeRequiresExpiration,
  extractEntitlements,
  firstUuidFromAppUserIds,
  tierFromRevenueCatEntitlements,
  userIdFromAppUserId,
} from "@/lib/revenuecat/tierFromEntitlements";
import { serverTrack } from "@/lib/analytics/serverTrack";
import { AnalyticsEvents } from "@/lib/analytics/events";

export type RevenueCatEvent = {
  id: string;
  type: string;
  app_user_id: string;
  /** TRANSFER payload fields (ENG-1306): RC sends both ends as arrays of
   *  app_user_ids (store-anonymous ids mixed with our uuid ids). */
  transferred_from?: string[];
  transferred_to?: string[];
  /** Optional explicit transferee uuid for TRANSFER events — tolerated
   *  alongside the arrays above for older/test payload shapes. */
  transferred_to_app_user_id?: string;
  /** Newer field (RC 2024+); some integrations still see the array. */
  entitlement_id?: string;
  entitlement_ids?: string[];
  product_id?: string;
  /** ENG-681: Unix timestamp (ms) when the event occurred. Used for
   *  freshness checks in the webhook route handler. */
  event_timestamp_ms?: number;
  // Anything else carried by the payload — preserved in the persisted
  // payload column for forensic replay.
  [key: string]: unknown;
};

export type ProcessResult =
  | { ok: true; outcome: "skipped_duplicate" }
  | { ok: true; outcome: "skipped_anonymous"; eventType: string }
  | { ok: true; outcome: "no_op"; eventType: string }
  | { ok: true; outcome: "tier_updated"; userId: string; tier: "free" | "base" | "pro" }
  | {
      ok: true;
      outcome: "transferred";
      fromUserId: string | null;
      toUserId: string;
      tier: "base" | "pro";
    }
  | { ok: false; reason: "service_role_missing" | "persist_failed"; error?: string };

/** Insert the event into `revenuecat_events`. Return values:
 *   - true  → first time we've seen this event_id, proceed
 *   - false → 23505 duplicate, skip (already processed)
 *   - throws → unexpected error; caller decides whether to fail-safe
 */
async function recordEvent(
  event: RevenueCatEvent,
  resolvedUserId: string | null,
): Promise<boolean> {
  const sb = createSupabaseServiceRoleClient();
  if (!sb) throw new Error("service_role_client_unavailable");
  const { error } = await sb.from("revenuecat_events").insert({
    event_id: event.id,
    event_type: event.type,
    app_user_id: event.app_user_id,
    user_id: resolvedUserId,
    payload: event,
  });
  if (!error) return true;
  if ((error as { code?: string }).code === "23505") return false;
  throw new Error(error.message);
}

/**
 * ENG-1306 — service-role read of a profile's current tier. Used by the
 * TRANSFER handler to discover which paid tier is being moved when the RC
 * payload carries no entitlement fields. Returns null on any failure so
 * the caller can fall back to a no-op rather than guessing.
 */
async function readProfileTierServiceRole(userId: string): Promise<string | null> {
  const sb = createSupabaseServiceRoleClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("profiles")
    .select("user_tier")
    .eq("id", userId)
    .maybeSingle();
  if (error) return null;
  return ((data as { user_tier?: string | null } | null)?.user_tier as string | null) ?? null;
}

export async function processRevenueCatEvent(event: RevenueCatEvent): Promise<ProcessResult> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return { ok: false, reason: "service_role_missing" };
  }

  const userId = userIdFromAppUserId(event.app_user_id);

  let isFirstTime: boolean;
  try {
    isFirstTime = await recordEvent(event, userId);
  } catch (e) {
    return {
      ok: false,
      reason: "persist_failed",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  if (!isFirstTime) {
    return { ok: true, outcome: "skipped_duplicate" };
  }

  // ENG-1306 — TRANSFER: the store subscription moved to a different
  // app_user_id (e.g. a new Apple ID restored the purchase). Re-point the
  // entitlement: the destination profile gains the tier, the origin loses
  // it. Handled BEFORE the anonymous skip because RC's top-level
  // `app_user_id` on TRANSFER events can be a store-anonymous id while the
  // `transferred_to` array still carries our uuid.
  if (event.type === "TRANSFER") {
    const toUserId =
      firstUuidFromAppUserIds(event.transferred_to) ??
      userIdFromAppUserId(event.transferred_to_app_user_id) ??
      userId;
    const fromUserId = firstUuidFromAppUserIds(event.transferred_from);
    if (!toUserId) {
      // Neither end maps to a Supabase profile — persisted for audit only.
      return { ok: true, outcome: "skipped_anonymous", eventType: event.type };
    }

    // Tier to re-point: prefer the entitlements on the payload; fall back
    // to the origin profile's current paid tier (the thing being moved).
    const entitlements = extractEntitlements(event);
    let tier: "free" | "base" | "pro" = entitlements
      ? tierFromRevenueCatEntitlements(entitlements)
      : "free";
    if (tier === "free" && fromUserId) {
      const originTier = await readProfileTierServiceRole(fromUserId);
      if (originTier === "pro" || originTier === "base") tier = originTier;
    }
    if (tier === "free") {
      // Nothing resolvable to move — never downgrade anyone on a partial
      // payload (mirrors the grant-path posture on missing entitlements).
      return { ok: true, outcome: "no_op", eventType: event.type };
    }

    const grantOk = await updateProfileTierServiceRole(toUserId, tier);
    if (!grantOk) {
      return { ok: false, reason: "persist_failed", error: "transfer_grant_failed" };
    }
    if (fromUserId && fromUserId !== toUserId) {
      // Origin loses the entitlement. `lifetime_pro` comps stay
      // floor-protected inside the writer.
      const revokeOk = await updateProfileTierServiceRole(fromUserId, "free");
      if (!revokeOk) {
        return { ok: false, reason: "persist_failed", error: "transfer_revoke_failed" };
      }
    }
    return { ok: true, outcome: "transferred", fromUserId, toUserId, tier };
  }

  // Skip events for anonymous RC users (we can't map to a Supabase
  // profile). The row is persisted for audit; we just don't act.
  if (!userId) {
    return { ok: true, outcome: "skipped_anonymous", eventType: event.type };
  }

  // Dispatch.
  if (event.type === "CANCELLATION" || event.type === "BILLING_ISSUE") {
    // Cancellation = auto-renew off but entitlement still active.
    // Billing issue = RC grace period. Either way, don't downgrade.
    return { ok: true, outcome: "no_op", eventType: event.type };
  }

  if (eventTypeRequiresExpiration(event.type)) {
    const ok = await updateProfileTierServiceRole(userId, "free");
    return ok
      ? { ok: true, outcome: "tier_updated", userId, tier: "free" }
      : { ok: false, reason: "persist_failed", error: "tier_write_failed" };
  }

  if (eventTypeIsTierGrant(event.type)) {
    const entitlements = extractEntitlements(event);
    if (!entitlements) {
      return { ok: true, outcome: "no_op", eventType: event.type };
    }
    const tier = tierFromRevenueCatEntitlements(entitlements);
    const ok = await updateProfileTierServiceRole(userId, tier);
    if (!ok) return { ok: false, reason: "persist_failed", error: "tier_write_failed" };

    // ENG-671: server-side revenue event so the purchase is attributed
    // correctly in PostHog without relying on the client to fire it
    // (mobile clients can background / close before the client event lands).
    const isNewPurchase =
      event.type === "INITIAL_PURCHASE" || event.type === "NON_RENEWING_PURCHASE";
    const revenueEvent = isNewPurchase
      ? AnalyticsEvents.subscription_purchased
      : AnalyticsEvents.subscription_renewed;
    void serverTrack(revenueEvent, userId, {
      user_id: userId,
      tier,
      product_id: event.product_id ?? null,
      event_type: event.type,
      platform: "mobile",
    });

    return { ok: true, outcome: "tier_updated", userId, tier };
  }

  // SUBSCRIPTION_EXTENDED and any unrecognised event types — persisted
  // for audit, no tier action needed (an extension keeps the current
  // entitlement; RENEWAL will re-assert it).
  return { ok: true, outcome: "no_op", eventType: event.type };
}
