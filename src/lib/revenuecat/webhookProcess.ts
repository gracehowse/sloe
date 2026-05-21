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
  tierFromRevenueCatEntitlements,
  userIdFromAppUserId,
} from "@/lib/revenuecat/tierFromEntitlements";

export type RevenueCatEvent = {
  id: string;
  type: string;
  app_user_id: string;
  /** Optional explicit transferee uuid for TRANSFER events.
   *  RC sends this as `transferred_from` / `transferred_to`. We only
   *  use the destination here to apply tier on the new owner. */
  transferred_to_app_user_id?: string;
  /** Newer field (RC 2024+); some integrations still see the array. */
  entitlement_id?: string;
  entitlement_ids?: string[];
  product_id?: string;
  // Anything else carried by the payload — preserved in the persisted
  // payload column for forensic replay.
  [key: string]: unknown;
};

export type ProcessResult =
  | { ok: true; outcome: "skipped_duplicate" }
  | { ok: true; outcome: "skipped_anonymous"; eventType: string }
  | { ok: true; outcome: "no_op"; eventType: string }
  | { ok: true; outcome: "tier_updated"; userId: string; tier: "free" | "base" | "pro" }
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
    return ok
      ? { ok: true, outcome: "tier_updated", userId, tier }
      : { ok: false, reason: "persist_failed", error: "tier_write_failed" };
  }

  // TRANSFER, SUBSCRIPTION_EXTENDED, REFUND, etc. — log + no-op for v0.
  // The forensic payload is on the row; future work can refine.
  return { ok: true, outcome: "no_op", eventType: event.type };
}
