/**
 * `app/api/cron/entitlement-reconcile` — ENG-1463 / ENG-1437 tests.
 *
 * The reconciliation cron is the automated recovery path for a missed
 * payment webhook: it compares Stripe's canonical subscription state
 * against `profiles.user_tier` and corrects drift. Pins:
 *   1. `resolveDesiredTierFromStripeSubscriptions` mirrors the webhook's
 *      status→tier policy (entitling statuses grant; terminal statuses
 *      don't; highest tier across a customer's subs wins).
 *   2. The asymmetric correction policy — upgrade drift auto-corrected;
 *      downgrade drift alerted-only by default; downgrade applied only
 *      when opted in; `lifetime_pro` never touched.
 *   3. Per-customer error isolation (one bad Stripe call doesn't abort
 *      the batch).
 *   4. The route auth + config gates, incl. the deliberate clean-skip
 *      (200, not 503) when the Stripe rail isn't configured.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

import {
  resolveDesiredTierFromStripeSubscriptions,
  reconcileEntitlements,
  runEntitlementReconcileRoute,
  safeCompare,
  type ReconcilableSubscription,
} from "../../src/lib/server/entitlementReconcileJob";

// --- Env price ids used by tierFromStripePriceId / tierFromStripePriceIds ---
const PRICE_PRO_MONTHLY = "price_pro_monthly";
const PRICE_PRO_ANNUAL = "price_pro_annual";
const PRICE_BASE_MONTHLY = "price_base_monthly";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  Object.assign(process.env, ORIGINAL_ENV);
  process.env.STRIPE_PRICE_PRO_MONTHLY = PRICE_PRO_MONTHLY;
  process.env.STRIPE_PRICE_PRO_ANNUAL = PRICE_PRO_ANNUAL;
  process.env.STRIPE_PRICE_BASE_MONTHLY = PRICE_BASE_MONTHLY;
  delete process.env.STRIPE_PRICE_BASE_ANNUAL;
  delete process.env.RECONCILE_STRIPE_AUTO_DOWNGRADE;
});

function sub(
  status: ReconcilableSubscription["status"],
  priceId: string,
): ReconcilableSubscription {
  return { status, items: { data: [{ price: { id: priceId } }] } };
}

// ---------------------------------------------------------------------------
describe("resolveDesiredTierFromStripeSubscriptions", () => {
  it("grants pro for each entitling status (active/trialing/paused/past_due)", () => {
    for (const status of ["active", "trialing", "paused", "past_due"] as const) {
      expect(resolveDesiredTierFromStripeSubscriptions([sub(status, PRICE_PRO_MONTHLY)])).toBe(
        "pro",
      );
    }
  });

  it("does NOT grant for terminal / pending statuses", () => {
    for (const status of [
      "canceled",
      "unpaid",
      "incomplete",
      "incomplete_expired",
    ] as const) {
      expect(resolveDesiredTierFromStripeSubscriptions([sub(status, PRICE_PRO_MONTHLY)])).toBe(
        "free",
      );
    }
  });

  it("returns free when the customer has no subscriptions at all", () => {
    expect(resolveDesiredTierFromStripeSubscriptions([])).toBe("free");
  });

  it("resolves annual pro price the same as monthly", () => {
    expect(resolveDesiredTierFromStripeSubscriptions([sub("active", PRICE_PRO_ANNUAL)])).toBe(
      "pro",
    );
  });

  it("returns free for an entitling sub on an unrecognised price id", () => {
    expect(
      resolveDesiredTierFromStripeSubscriptions([sub("active", "price_unknown_xyz")]),
    ).toBe("free");
  });

  it("picks the highest tier across multiple entitling subs (pro beats base)", () => {
    expect(
      resolveDesiredTierFromStripeSubscriptions([
        sub("active", PRICE_BASE_MONTHLY),
        sub("active", PRICE_PRO_MONTHLY),
      ]),
    ).toBe("pro");
  });

  it("ignores a canceled pro sub in favour of an active base sub", () => {
    expect(
      resolveDesiredTierFromStripeSubscriptions([
        sub("canceled", PRICE_PRO_MONTHLY),
        sub("active", PRICE_BASE_MONTHLY),
      ]),
    ).toBe("base");
  });
});

// ---------------------------------------------------------------------------
/** Minimal Supabase fake: returns a fixed profile set for the reconcile query. */
function fakeSupabase(profiles: Array<{ id: string; user_tier: string | null; stripe_customer_id: string | null }>) {
  return {
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            not(_col: string, _op: string, _val: null) {
              // mirrors .not("stripe_customer_id", "is", null)
              return Promise.resolve({
                data: profiles.filter((p) => p.stripe_customer_id !== null),
                error: null,
              });
            },
          };
        },
      };
    },
  } as any;
}

const STRIPE_STUB = {} as any; // never called directly — listSubscriptions is injected

describe("reconcileEntitlements — correction policy", () => {
  it("auto-corrects upgrade drift (free but Stripe-active → pro grant)", async () => {
    const writes: Array<{ id: string; tier: string }> = [];
    const summary = await reconcileEntitlements(
      fakeSupabase([{ id: "u1", user_tier: "free", stripe_customer_id: "cus_1" }]),
      STRIPE_STUB,
      {
        listSubscriptions: async () => [sub("active", PRICE_PRO_MONTHLY)],
        writeTier: async (id, tier) => {
          writes.push({ id, tier });
          return true;
        },
      },
    );
    expect(summary.granted).toBe(1);
    expect(summary.downgradeCandidates).toBe(0);
    expect(writes).toEqual([{ id: "u1", tier: "pro" }]);
  });

  it("does NOT auto-apply downgrade drift by default — alerts only", async () => {
    const writes: string[] = [];
    const summary = await reconcileEntitlements(
      fakeSupabase([{ id: "u2", user_tier: "pro", stripe_customer_id: "cus_2" }]),
      STRIPE_STUB,
      {
        listSubscriptions: async () => [sub("canceled", PRICE_PRO_MONTHLY)],
        writeTier: async (id) => {
          writes.push(id);
          return true;
        },
      },
    );
    expect(summary.downgradeCandidates).toBe(1);
    expect(summary.downgraded).toBe(0);
    expect(writes).toEqual([]); // no write happened
  });

  it("applies downgrade drift when RECONCILE_STRIPE_AUTO_DOWNGRADE is opted in", async () => {
    const writes: Array<{ id: string; tier: string }> = [];
    const summary = await reconcileEntitlements(
      fakeSupabase([{ id: "u3", user_tier: "pro", stripe_customer_id: "cus_3" }]),
      STRIPE_STUB,
      {
        listSubscriptions: async () => [], // no subs at all → should be free
        writeTier: async (id, tier) => {
          writes.push({ id, tier });
          return true;
        },
      },
      { autoDowngrade: true },
    );
    expect(summary.downgradeCandidates).toBe(1);
    expect(summary.downgraded).toBe(1);
    expect(writes).toEqual([{ id: "u3", tier: "free" }]);
  });

  it("never touches lifetime_pro (floor-protected comp)", async () => {
    const writes: string[] = [];
    const summary = await reconcileEntitlements(
      fakeSupabase([{ id: "u4", user_tier: "lifetime_pro", stripe_customer_id: "cus_4" }]),
      STRIPE_STUB,
      {
        listSubscriptions: async () => [], // Stripe says free, but comp is durable
        writeTier: async (id) => {
          writes.push(id);
          return true;
        },
      },
      { autoDowngrade: true },
    );
    expect(summary.floorProtected).toBe(1);
    expect(summary.downgradeCandidates).toBe(0);
    expect(writes).toEqual([]);
  });

  it("counts an in-sync user without writing", async () => {
    const writes: string[] = [];
    const summary = await reconcileEntitlements(
      fakeSupabase([{ id: "u5", user_tier: "pro", stripe_customer_id: "cus_5" }]),
      STRIPE_STUB,
      {
        listSubscriptions: async () => [sub("active", PRICE_PRO_MONTHLY)],
        writeTier: async (id) => {
          writes.push(id);
          return true;
        },
      },
    );
    expect(summary.inSync).toBe(1);
    expect(summary.granted).toBe(0);
    expect(writes).toEqual([]);
  });

  it("isolates a per-customer Stripe failure — the batch continues", async () => {
    const writes: Array<{ id: string; tier: string }> = [];
    const summary = await reconcileEntitlements(
      fakeSupabase([
        { id: "bad", user_tier: "free", stripe_customer_id: "cus_bad" },
        { id: "good", user_tier: "free", stripe_customer_id: "cus_good" },
      ]),
      STRIPE_STUB,
      {
        listSubscriptions: async (_s, customerId) => {
          if (customerId === "cus_bad") throw new Error("stripe 500");
          return [sub("active", PRICE_PRO_MONTHLY)];
        },
        writeTier: async (id, tier) => {
          writes.push({ id, tier });
          return true;
        },
      },
    );
    expect(summary.scanned).toBe(2);
    expect(summary.errors).toBe(1);
    expect(summary.granted).toBe(1); // the good one still got corrected
    expect(writes).toEqual([{ id: "good", tier: "pro" }]);
  });

  it("counts a failed write as an error, not a grant", async () => {
    const summary = await reconcileEntitlements(
      fakeSupabase([{ id: "u6", user_tier: "free", stripe_customer_id: "cus_6" }]),
      STRIPE_STUB,
      {
        listSubscriptions: async () => [sub("active", PRICE_PRO_MONTHLY)],
        writeTier: async () => false, // write rejected
      },
    );
    expect(summary.granted).toBe(0);
    expect(summary.errors).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe("runEntitlementReconcileRoute — auth + config gates", () => {
  function buildReq(headers: Record<string, string> = {}): Request {
    return new Request("https://example.com/api/cron/entitlement-reconcile", {
      method: "POST",
      headers,
    });
  }

  beforeEach(() => {
    delete process.env.SUPPR_CRON_SECRET;
  });

  it("503 when SUPPR_CRON_SECRET is unset", async () => {
    const res = await runEntitlementReconcileRoute(buildReq(), () => null, () => null);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("server_misconfigured");
  });

  it("401 when the secret is wrong", async () => {
    process.env.SUPPR_CRON_SECRET = "expected";
    const res = await runEntitlementReconcileRoute(
      buildReq({ "x-cron-secret": "wrong" }),
      () => null,
      () => null,
    );
    expect(res.status).toBe(401);
  });

  it("503 when the service-role client is unavailable", async () => {
    process.env.SUPPR_CRON_SECRET = "ok";
    const res = await runEntitlementReconcileRoute(
      buildReq({ "x-cron-secret": "ok" }),
      () => null,
      () => ({}) as any,
    );
    expect(res.status).toBe(503);
    expect((await res.json()).message).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("cleanly SKIPS (200, not 503) when Stripe is not configured — no false cron alarm", async () => {
    process.env.SUPPR_CRON_SECRET = "ok";
    const res = await runEntitlementReconcileRoute(
      buildReq({ "x-cron-secret": "ok" }),
      () => ({}) as any,
      () => null, // getStripe → null (pre-launch)
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.skipped).toBe("stripe_not_configured");
  });

  it("200 with summary on the happy path", async () => {
    process.env.SUPPR_CRON_SECRET = "ok";
    const runner = vi.fn().mockResolvedValue({ ok: true, scanned: 3, granted: 1 });
    const res = await runEntitlementReconcileRoute(
      buildReq({ "x-cron-secret": "ok" }),
      () => ({}) as any,
      () => ({}) as any,
      runner as any,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).scanned).toBe(3);
  });

  it("502 when the runner throws", async () => {
    process.env.SUPPR_CRON_SECRET = "ok";
    const runner = vi.fn().mockRejectedValue(new Error("boom"));
    const res = await runEntitlementReconcileRoute(
      buildReq({ "x-cron-secret": "ok" }),
      () => ({}) as any,
      () => ({}) as any,
      runner as any,
    );
    expect(res.status).toBe(502);
    expect((await res.json()).message).toMatch(/boom/);
  });
});

describe("safeCompare", () => {
  it("returns true only for exact matches", () => {
    expect(safeCompare("abc", "abc")).toBe(true);
    expect(safeCompare("abc", "abd")).toBe(false);
    expect(safeCompare("abc", "ab")).toBe(false);
    expect(safeCompare("", "")).toBe(true);
  });
});
