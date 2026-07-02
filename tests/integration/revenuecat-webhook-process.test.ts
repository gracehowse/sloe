import { describe, it, expect, vi, beforeEach } from "vitest";
import { processRevenueCatEvent } from "@/lib/revenuecat/webhookProcess";

const userId = "11111111-1111-4111-8111-111111111111";

// Mock the service-role tier writer so we can assert it was called
// with the expected (userId, tier) without a live Supabase. The
// dedup INSERT path is mocked separately — see the supabase-js mock
// further down.
vi.mock("@/lib/stripe/updateProfileTier", () => ({
  updateProfileTierServiceRole: vi.fn().mockResolvedValue(true),
}));

import { updateProfileTierServiceRole } from "@/lib/stripe/updateProfileTier";

// Mock the service-role client. INSERT into revenuecat_events
// returns "ok" (no error) for first-time events; tests that want to
// simulate a duplicate event override this mock.
let lastInsertResult: { error: { code?: string; message: string } | null } = {
  error: null,
};
function setNextInsertResult(
  result: { error: { code?: string; message: string } | null },
): void {
  lastInsertResult = result;
}
const insertMock = vi.fn().mockImplementation(() => Promise.resolve(lastInsertResult));

// ENG-1306 — the TRANSFER handler reads the ORIGIN profile's tier when the
// payload carries no entitlements. Tests set this per-case.
let profileTierReadResult: { user_tier: string } | null = null;
function setProfileTierReadResult(tier: string | null): void {
  profileTierReadResult = tier ? { user_tier: tier } : null;
}
const maybeSingleMock = vi
  .fn()
  .mockImplementation(() => Promise.resolve({ data: profileTierReadResult, error: null }));

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  createSupabaseServiceRoleClient: () => ({
    from: () => ({
      insert: insertMock,
      select: () => ({
        eq: () => ({ maybeSingle: maybeSingleMock }),
      }),
    }),
  }),
  supabasePublicUrl: () => "https://example.supabase.co",
}));

describe("processRevenueCatEvent", () => {
  const mockTierWrite = vi.mocked(updateProfileTierServiceRole);

  beforeEach(() => {
    vi.clearAllMocks();
    setNextInsertResult({ error: null });
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test_service_role";
  });

  it("INITIAL_PURCHASE with entitlement_ids:['pro'] writes tier=pro for the user", async () => {
    const result = await processRevenueCatEvent({
      id: "evt_initial_pro",
      type: "INITIAL_PURCHASE",
      app_user_id: userId,
      entitlement_ids: ["pro"],
    });
    expect(result).toEqual({
      ok: true,
      outcome: "tier_updated",
      userId,
      tier: "pro",
    });
    expect(mockTierWrite).toHaveBeenCalledWith(userId, "pro");
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("RENEWAL with entitlement_id scalar still resolves correctly", async () => {
    const result = await processRevenueCatEvent({
      id: "evt_renewal_base",
      type: "RENEWAL",
      app_user_id: userId,
      entitlement_id: "base",
    });
    expect(result).toEqual({
      ok: true,
      outcome: "tier_updated",
      userId,
      tier: "base",
    });
    expect(mockTierWrite).toHaveBeenCalledWith(userId, "base");
  });

  it("grant events without entitlement fields do not overwrite the current tier", async () => {
    const result = await processRevenueCatEvent({
      id: "evt_initial_missing_entitlement",
      type: "INITIAL_PURCHASE",
      app_user_id: userId,
    });
    expect(result).toEqual({
      ok: true,
      outcome: "no_op",
      eventType: "INITIAL_PURCHASE",
    });
    expect(mockTierWrite).not.toHaveBeenCalled();
  });

  it("grant events with empty entitlement arrays do not downgrade the user", async () => {
    const result = await processRevenueCatEvent({
      id: "evt_renewal_empty_entitlement",
      type: "RENEWAL",
      app_user_id: userId,
      entitlement_ids: [],
    });
    expect(result).toEqual({
      ok: true,
      outcome: "no_op",
      eventType: "RENEWAL",
    });
    expect(mockTierWrite).not.toHaveBeenCalled();
  });

  it("EXPIRATION downgrades to free regardless of entitlement payload", async () => {
    const result = await processRevenueCatEvent({
      id: "evt_expiration",
      type: "EXPIRATION",
      app_user_id: userId,
    });
    expect(result).toEqual({
      ok: true,
      outcome: "tier_updated",
      userId,
      tier: "free",
    });
    expect(mockTierWrite).toHaveBeenCalledWith(userId, "free");
  });

  it("SUBSCRIPTION_PAUSED also downgrades to free", async () => {
    const result = await processRevenueCatEvent({
      id: "evt_paused",
      type: "SUBSCRIPTION_PAUSED",
      app_user_id: userId,
    });
    expect(result).toEqual({
      ok: true,
      outcome: "tier_updated",
      userId,
      tier: "free",
    });
  });

  it("CANCELLATION is a no-op (auto-renew off; entitlement still active)", async () => {
    const result = await processRevenueCatEvent({
      id: "evt_cancel",
      type: "CANCELLATION",
      app_user_id: userId,
      entitlement_ids: ["pro"],
    });
    expect(result).toEqual({
      ok: true,
      outcome: "no_op",
      eventType: "CANCELLATION",
    });
    expect(mockTierWrite).not.toHaveBeenCalled();
  });

  it("BILLING_ISSUE is a no-op (RC grace period; never downgrade)", async () => {
    const result = await processRevenueCatEvent({
      id: "evt_billing_issue",
      type: "BILLING_ISSUE",
      app_user_id: userId,
      entitlement_ids: ["pro"],
    });
    expect(result).toEqual({
      ok: true,
      outcome: "no_op",
      eventType: "BILLING_ISSUE",
    });
    expect(mockTierWrite).not.toHaveBeenCalled();
  });

  it("duplicate event_id (23505) returns skipped_duplicate, never writes tier", async () => {
    setNextInsertResult({ error: { code: "23505", message: "duplicate key" } });
    const result = await processRevenueCatEvent({
      id: "evt_dup",
      type: "INITIAL_PURCHASE",
      app_user_id: userId,
      entitlement_ids: ["pro"],
    });
    expect(result).toEqual({ ok: true, outcome: "skipped_duplicate" });
    expect(mockTierWrite).not.toHaveBeenCalled();
  });

  it("anonymous RC id (non-uuid) is persisted but skipped for tier writes", async () => {
    const result = await processRevenueCatEvent({
      id: "evt_anon",
      type: "INITIAL_PURCHASE",
      app_user_id: "$RCAnonymousID:abc",
      entitlement_ids: ["pro"],
    });
    expect(result).toEqual({
      ok: true,
      outcome: "skipped_anonymous",
      eventType: "INITIAL_PURCHASE",
    });
    expect(mockTierWrite).not.toHaveBeenCalled();
  });

  it("returns service_role_missing when env is unset", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const result = await processRevenueCatEvent({
      id: "evt_x",
      type: "RENEWAL",
      app_user_id: userId,
    });
    expect(result).toEqual({ ok: false, reason: "service_role_missing" });
    expect(mockTierWrite).not.toHaveBeenCalled();
  });

  it("PRODUCT_CHANGE Pro→Base writes tier=base", async () => {
    const result = await processRevenueCatEvent({
      id: "evt_change",
      type: "PRODUCT_CHANGE",
      app_user_id: userId,
      entitlement_ids: ["base"],
    });
    expect(result).toEqual({
      ok: true,
      outcome: "tier_updated",
      userId,
      tier: "base",
    });
  });

  it("UNCANCELLATION Pro restores tier=pro", async () => {
    const result = await processRevenueCatEvent({
      id: "evt_uncancel",
      type: "UNCANCELLATION",
      app_user_id: userId,
      entitlement_ids: ["pro"],
    });
    expect(result).toEqual({
      ok: true,
      outcome: "tier_updated",
      userId,
      tier: "pro",
    });
  });

  // ENG-1306 — REFUND revokes immediately (unlike CANCELLATION there is no
  // paid-through window left): tier → free.
  it("REFUND downgrades to free (entitlement revoked with the money)", async () => {
    const result = await processRevenueCatEvent({
      id: "evt_refund",
      type: "REFUND",
      app_user_id: userId,
      entitlement_ids: ["pro"],
    });
    expect(result).toEqual({
      ok: true,
      outcome: "tier_updated",
      userId,
      tier: "free",
    });
    expect(mockTierWrite).toHaveBeenCalledWith(userId, "free");
  });

  it("duplicate REFUND (23505) stays idempotent — no second tier write", async () => {
    setNextInsertResult({ error: { code: "23505", message: "duplicate key" } });
    const result = await processRevenueCatEvent({
      id: "evt_refund_dup",
      type: "REFUND",
      app_user_id: userId,
    });
    expect(result).toEqual({ ok: true, outcome: "skipped_duplicate" });
    expect(mockTierWrite).not.toHaveBeenCalled();
  });
});

// ENG-1306 — TRANSFER re-points the entitlement: destination gains the
// moved tier, origin drops to free.
describe("processRevenueCatEvent — TRANSFER", () => {
  const mockTierWrite = vi.mocked(updateProfileTierServiceRole);
  const fromUser = "22222222-2222-4222-8222-222222222222";
  const toUser = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    vi.clearAllMocks();
    setNextInsertResult({ error: null });
    setProfileTierReadResult(null);
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test_service_role";
  });

  it("re-points the entitlement using payload entitlements: grant destination, revoke origin", async () => {
    const result = await processRevenueCatEvent({
      id: "evt_transfer_pro",
      type: "TRANSFER",
      app_user_id: "$RCAnonymousID:store-account",
      transferred_from: ["$RCAnonymousID:old-store", fromUser],
      transferred_to: [toUser],
      entitlement_ids: ["pro"],
    });
    expect(result).toEqual({
      ok: true,
      outcome: "transferred",
      fromUserId: fromUser,
      toUserId: toUser,
      tier: "pro",
    });
    expect(mockTierWrite).toHaveBeenCalledWith(toUser, "pro");
    expect(mockTierWrite).toHaveBeenCalledWith(fromUser, "free");
  });

  it("falls back to the origin profile's paid tier when the payload has no entitlements", async () => {
    setProfileTierReadResult("base");
    const result = await processRevenueCatEvent({
      id: "evt_transfer_no_ent",
      type: "TRANSFER",
      app_user_id: "$RCAnonymousID:store-account",
      transferred_from: [fromUser],
      transferred_to: [toUser],
    });
    expect(result).toEqual({
      ok: true,
      outcome: "transferred",
      fromUserId: fromUser,
      toUserId: toUser,
      tier: "base",
    });
    expect(mockTierWrite).toHaveBeenCalledWith(toUser, "base");
    expect(mockTierWrite).toHaveBeenCalledWith(fromUser, "free");
  });

  it("no-ops (never downgrades anyone) when neither entitlements nor an origin paid tier resolve", async () => {
    setProfileTierReadResult("free");
    const result = await processRevenueCatEvent({
      id: "evt_transfer_unresolvable",
      type: "TRANSFER",
      app_user_id: "$RCAnonymousID:store-account",
      transferred_from: [fromUser],
      transferred_to: [toUser],
    });
    expect(result).toEqual({ ok: true, outcome: "no_op", eventType: "TRANSFER" });
    expect(mockTierWrite).not.toHaveBeenCalled();
  });

  it("skips as anonymous when no end of the transfer maps to a Supabase uuid", async () => {
    const result = await processRevenueCatEvent({
      id: "evt_transfer_anon",
      type: "TRANSFER",
      app_user_id: "$RCAnonymousID:store-account",
      transferred_from: ["$RCAnonymousID:a"],
      transferred_to: ["$RCAnonymousID:b"],
      entitlement_ids: ["pro"],
    });
    expect(result).toEqual({
      ok: true,
      outcome: "skipped_anonymous",
      eventType: "TRANSFER",
    });
    expect(mockTierWrite).not.toHaveBeenCalled();
  });

  it("same-account transfer grants the destination without a revoke write", async () => {
    const result = await processRevenueCatEvent({
      id: "evt_transfer_same",
      type: "TRANSFER",
      app_user_id: toUser,
      transferred_from: [toUser],
      transferred_to: [toUser],
      entitlement_ids: ["pro"],
    });
    expect(result).toEqual({
      ok: true,
      outcome: "transferred",
      fromUserId: toUser,
      toUserId: toUser,
      tier: "pro",
    });
    expect(mockTierWrite).toHaveBeenCalledTimes(1);
    expect(mockTierWrite).toHaveBeenCalledWith(toUser, "pro");
  });

  it("duplicate TRANSFER (23505) stays idempotent — no tier writes", async () => {
    setNextInsertResult({ error: { code: "23505", message: "duplicate key" } });
    const result = await processRevenueCatEvent({
      id: "evt_transfer_dup",
      type: "TRANSFER",
      app_user_id: toUser,
      transferred_from: [fromUser],
      transferred_to: [toUser],
      entitlement_ids: ["pro"],
    });
    expect(result).toEqual({ ok: true, outcome: "skipped_duplicate" });
    expect(mockTierWrite).not.toHaveBeenCalled();
  });
});
