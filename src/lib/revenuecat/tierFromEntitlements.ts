/**
 * T6 (full-sweep 2026-04-24) — translate a RevenueCat webhook event's
 * `entitlement_ids` (or `entitlement_id`) into a Suppr `user_tier`.
 *
 * RC's webhook payload includes one of:
 *   * `entitlement_id`  — the active entitlement (newer events)
 *   * `entitlement_ids` — array of currently active entitlements
 * We accept either. `extractEntitlements` returns null when both are
 * absent or empty so the webhook handler can no-op grant-style events
 * instead of downgrading a paying user on a partial/misconfigured RC
 * payload. Expiration-like event types are the authoritative downgrade
 * path.
 *
 * Highest-tier-wins ordering: pro > base > free.
 *
 * Suppr's RC entitlements (configured in the RC dashboard, mirrored
 * by client-side `entitlements.active["pro"]` / `["base"]` checks in
 * `apps/mobile/lib/purchases.ts`):
 *   * `pro`  — enables Pro-only features (AI photo + voice).
 *   * `base` — enables Base features (planning loop).
 */

import type { UserTier } from "../../types/recipe.ts";

export function tierFromRevenueCatEntitlements(
  entitlements: readonly string[] | null | undefined,
): UserTier {
  if (!entitlements || entitlements.length === 0) return "free";
  const set = new Set(entitlements.map((e) => e.toLowerCase()));
  if (set.has("pro")) return "pro";
  if (set.has("base")) return "base";
  return "free";
}

/**
 * Pull the entitlement list off an RC webhook event body. Tolerates
 * both the legacy `entitlement_ids` array and the newer
 * `entitlement_id` scalar. Returns `null` (not `[]`) when neither is
 * present so callers can distinguish "no entitlements" (downgrade
 * candidate) from "field absent" (don't touch tier).
 */
export function extractEntitlements(eventBody: unknown): string[] | null {
  if (!eventBody || typeof eventBody !== "object") return null;
  const e = (eventBody as { entitlement_ids?: unknown; entitlement_id?: unknown });
  if (Array.isArray(e.entitlement_ids)) {
    const filtered = e.entitlement_ids.filter((x): x is string => typeof x === "string");
    return filtered.length > 0 ? filtered : null;
  }
  if (typeof e.entitlement_id === "string" && e.entitlement_id.length > 0) {
    return [e.entitlement_id];
  }
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Parse an `app_user_id` to a Supabase uuid. Returns `null` for any
 * non-uuid value (RC's own anonymous identifiers, malformed inputs).
 * Anonymous RC events still get persisted but skip the tier update.
 */
export function userIdFromAppUserId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!UUID_RE.test(trimmed)) return null;
  return trimmed;
}

/**
 * Decide whether a given RC event_type implies a tier reset to free.
 *
 * RC event types:
 *   * INITIAL_PURCHASE / RENEWAL / PRODUCT_CHANGE / UNCANCELLATION /
 *     NON_RENEWING_PURCHASE / TEMPORARY_ENTITLEMENT_GRANT — entitlement
 *     present in the payload; tier resolved from it.
 *   * CANCELLATION — auto-renew off, but entitlement still active until
 *     period end. We DO NOT downgrade on CANCELLATION. We wait for
 *     EXPIRATION.
 *   * EXPIRATION — entitlement is gone; tier → free.
 *   * BILLING_ISSUE — RC's grace period; entitlement still active.
 *     Don't downgrade.
 *   * SUBSCRIPTION_PAUSED — entitlement is gone for the pause window.
 *     Treat as expiration (will get an UNCANCELLATION when resumed).
 *   * TRANSFER — entitlement moved to a different app_user_id. The
 *     OLD user_id loses the entitlement; the NEW user_id gains it.
 *     The route handler resolves both ends explicitly.
 */
export function eventTypeRequiresExpiration(eventType: string): boolean {
  return eventType === "EXPIRATION" || eventType === "SUBSCRIPTION_PAUSED";
}

export function eventTypeIsTierGrant(eventType: string): boolean {
  return (
    eventType === "INITIAL_PURCHASE" ||
    eventType === "RENEWAL" ||
    eventType === "PRODUCT_CHANGE" ||
    eventType === "UNCANCELLATION" ||
    eventType === "NON_RENEWING_PURCHASE" ||
    eventType === "TEMPORARY_ENTITLEMENT_GRANT"
  );
}
