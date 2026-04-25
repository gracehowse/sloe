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

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  createSupabaseServiceRoleClient: () => ({
    from: () => ({ insert: insertMock }),
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
});
