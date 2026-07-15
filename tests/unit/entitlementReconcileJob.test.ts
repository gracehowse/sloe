/**
 * `app/api/cron/entitlement-reconcile` — ENG-1463 / ENG-1437 tests.
 *
 * The reconciliation cron is the automated recovery path for a missed
 * payment webhook: it pages through Stripe's own subscription list ONCE
 * per run (not one call per profile — see the lib module doc comment),
 * grouped by Stripe customer id (known profiles) AND by
 * `metadata.supabase_user_id` (profiles Stripe knows about that
 * `profiles.stripe_customer_id` doesn't yet — the checkout webhook that
 * would normally persist it was missed). Pins:
 *   1. `resolveDesiredTierFromStripeSubscriptions` delegates to the
 *      webhook's shared `tierDecisionForSubscription` (entitling statuses
 *      grant; terminal statuses don't; highest tier across a customer's
 *      subs wins; an entitling status with an unrecognised price is
 *      "indeterminate", not a downgrade signal).
 *   2. The asymmetric correction policy — upgrade drift auto-corrected;
 *      downgrade drift alerted-only by default; downgrade applied only
 *      when opted in (capped by a per-run circuit breaker);
 *      `lifetime_pro` never touched.
 *   3. Metadata-discovered orphan profiles (no `stripe_customer_id` yet)
 *      are reconciled and backfilled.
 *   4. A stale webhook write between read and write aborts that one
 *      write (TOCTOU guard).
 *   5. Per-customer error isolation (one bad Stripe call doesn't abort
 *      the batch); a systemic failure (every scan errored) reports
 *      `ok: false`.
 *   6. The route auth + config gates, incl. the deliberate clean-skip
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
  type RawStripeSubscriptionRecord,
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

function rec(
  status: ReconcilableSubscription["status"],
  priceId: string,
  customerId: string,
  supabaseUserId: string | null = null,
): RawStripeSubscriptionRecord {
  return { status, items: { data: [{ price: { id: priceId } }] }, customerId, supabaseUserId };
}

function sweepOf(records: RawStripeSubscriptionRecord[], truncated = false, pages = 1) {
  return async () => ({ records, truncated, pages });
}

// ---------------------------------------------------------------------------
describe("resolveDesiredTierFromStripeSubscriptions", () => {
  it("grants pro for each entitling status (active/trialing/paused/past_due)", () => {
    for (const status of ["active", "trialing", "paused", "past_due"] as const) {
      expect(resolveDesiredTierFromStripeSubscriptions([sub(status, PRICE_PRO_MONTHLY)])).toEqual({
        tier: "pro",
        indeterminate: false,
      });
    }
  });

  it("does NOT grant for terminal statuses — a real downgrade signal (not indeterminate)", () => {
    for (const status of ["canceled", "unpaid", "incomplete_expired"] as const) {
      expect(resolveDesiredTierFromStripeSubscriptions([sub(status, PRICE_PRO_MONTHLY)])).toEqual({
        tier: "free",
        indeterminate: false,
      });
    }
  });

  it("does NOT grant for 'incomplete' (payment still pending) — indeterminate, not a downgrade signal", () => {
    // Mirrors the webhook's own policy: initial payment not yet confirmed
    // is a "skip", not a "free" — a customer mid-checkout must not be
    // flagged as a downgrade candidate.
    expect(resolveDesiredTierFromStripeSubscriptions([sub("incomplete", PRICE_PRO_MONTHLY)])).toEqual({
      tier: "free",
      indeterminate: true,
    });
  });

  it("returns free, not indeterminate, when the customer has no subscriptions at all", () => {
    expect(resolveDesiredTierFromStripeSubscriptions([])).toEqual({
      tier: "free",
      indeterminate: false,
    });
  });

  it("resolves annual pro price the same as monthly", () => {
    expect(resolveDesiredTierFromStripeSubscriptions([sub("active", PRICE_PRO_ANNUAL)])).toEqual({
      tier: "pro",
      indeterminate: false,
    });
  });

  it("is indeterminate (not a downgrade signal) for an entitling sub on an unrecognised price id", () => {
    expect(
      resolveDesiredTierFromStripeSubscriptions([sub("active", "price_unknown_xyz")]),
    ).toEqual({ tier: "free", indeterminate: true });
  });

  it("is NOT indeterminate when a real grant already applies alongside an unrecognised-price sub", () => {
    expect(
      resolveDesiredTierFromStripeSubscriptions([
        sub("active", "price_unknown_xyz"),
        sub("active", PRICE_PRO_MONTHLY),
      ]),
    ).toEqual({ tier: "pro", indeterminate: false });
  });

  it("picks the highest tier across multiple entitling subs (pro beats base)", () => {
    expect(
      resolveDesiredTierFromStripeSubscriptions([
        sub("active", PRICE_BASE_MONTHLY),
        sub("active", PRICE_PRO_MONTHLY),
      ]),
    ).toEqual({ tier: "pro", indeterminate: false });
  });

  it("ignores a canceled pro sub in favour of an active base sub", () => {
    expect(
      resolveDesiredTierFromStripeSubscriptions([
        sub("canceled", PRICE_PRO_MONTHLY),
        sub("active", PRICE_BASE_MONTHLY),
      ]),
    ).toEqual({ tier: "base", indeterminate: false });
  });
});

// ---------------------------------------------------------------------------
/** In-memory fake Supabase: supports the known-customer scan
 *  (.select().not().order().range()), the orphan scan (.select().in()),
 *  the TOCTOU re-read (.select().eq().maybeSingle()), and the backfill
 *  write (.update().eq()). */
function fakeSupabase(
  profiles: Array<{ id: string; user_tier: string | null; stripe_customer_id: string | null }>,
) {
  const store = new Map(profiles.map((p) => [p.id, { ...p }]));
  return {
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            not(_col: string, _op: string, _val: null) {
              return {
                order(_col: string, _opts: unknown) {
                  return {
                    range(from: number, to: number) {
                      const sorted = [...store.values()]
                        .filter((p) => p.stripe_customer_id !== null)
                        .sort((a, b) => a.id.localeCompare(b.id));
                      return Promise.resolve({ data: sorted.slice(from, to + 1), error: null });
                    },
                  };
                },
              };
            },
            in(_col: string, ids: string[]) {
              const idSet = new Set(ids);
              return Promise.resolve({
                data: [...store.values()].filter((p) => idSet.has(p.id)),
                error: null,
              });
            },
            eq(_col: string, id: string) {
              return {
                maybeSingle() {
                  const row = store.get(id);
                  return Promise.resolve({
                    data: row ? { user_tier: row.user_tier } : null,
                    error: null,
                  });
                },
              };
            },
          };
        },
        update(patch: Record<string, unknown>) {
          return {
            eq(_col: string, id: string) {
              const row = store.get(id);
              if (row) Object.assign(row, patch);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  } as any;
}

const STRIPE_STUB = {} as any; // never called directly — listAllSubscriptions is injected

describe("reconcileEntitlements — correction policy", () => {
  it("auto-corrects upgrade drift (free but Stripe-active → pro grant)", async () => {
    const writes: Array<{ id: string; tier: string }> = [];
    const summary = await reconcileEntitlements(
      fakeSupabase([{ id: "u1", user_tier: "free", stripe_customer_id: "cus_1" }]),
      STRIPE_STUB,
      {
        listAllSubscriptions: sweepOf([rec("active", PRICE_PRO_MONTHLY, "cus_1")]),
        writeTier: async (id, tier) => {
          writes.push({ id, tier });
          return true;
        },
      },
    );
    expect(summary.granted).toBe(1);
    expect(summary.downgradeCandidates).toBe(0);
    expect(summary.ok).toBe(true);
    expect(writes).toEqual([{ id: "u1", tier: "pro" }]);
  });

  it("does NOT auto-apply downgrade drift by default — alerts only", async () => {
    const writes: string[] = [];
    const summary = await reconcileEntitlements(
      fakeSupabase([{ id: "u2", user_tier: "pro", stripe_customer_id: "cus_2" }]),
      STRIPE_STUB,
      {
        listAllSubscriptions: sweepOf([rec("canceled", PRICE_PRO_MONTHLY, "cus_2")]),
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
        listAllSubscriptions: sweepOf([]), // no subs at all → should be free
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

  it("caps auto-downgrades per run via the circuit breaker, still alerts the rest", async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `u${i}`);
    const profiles = ids.map((id) => ({ id, user_tier: "pro", stripe_customer_id: `cus_${id}` }));
    const writes: string[] = [];
    const summary = await reconcileEntitlements(
      fakeSupabase(profiles),
      STRIPE_STUB,
      {
        listAllSubscriptions: sweepOf([]), // every customer resolves to free → downgrade candidate
        writeTier: async (id) => {
          writes.push(id);
          return true;
        },
      },
      { autoDowngrade: true },
    );
    expect(summary.downgradeCandidates).toBe(25);
    expect(summary.downgraded).toBe(20);
    expect(summary.downgradesSkippedByCircuitBreaker).toBe(5);
    expect(writes.length).toBe(20);
  });

  it("treats an entitling sub with an unrecognised price as indeterminate — no downgrade, no grant", async () => {
    const writes: string[] = [];
    const summary = await reconcileEntitlements(
      fakeSupabase([{ id: "u7", user_tier: "pro", stripe_customer_id: "cus_7" }]),
      STRIPE_STUB,
      {
        listAllSubscriptions: sweepOf([rec("active", "price_rotated_away", "cus_7")]),
        writeTier: async (id) => {
          writes.push(id);
          return true;
        },
      },
      { autoDowngrade: true }, // even with auto-downgrade on, indeterminate must not act
    );
    expect(summary.indeterminate).toBe(1);
    expect(summary.downgradeCandidates).toBe(0);
    expect(summary.downgraded).toBe(0);
    expect(writes).toEqual([]);
  });

  it("never touches lifetime_pro (floor-protected comp)", async () => {
    const writes: string[] = [];
    const summary = await reconcileEntitlements(
      fakeSupabase([{ id: "u4", user_tier: "lifetime_pro", stripe_customer_id: "cus_4" }]),
      STRIPE_STUB,
      {
        listAllSubscriptions: sweepOf([]), // Stripe says free, but comp is durable
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
        listAllSubscriptions: sweepOf([rec("active", PRICE_PRO_MONTHLY, "cus_5")]),
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

  it("isolates a per-customer failure (write throws) — the batch continues", async () => {
    const writes: Array<{ id: string; tier: string }> = [];
    const summary = await reconcileEntitlements(
      fakeSupabase([
        { id: "bad", user_tier: "free", stripe_customer_id: "cus_bad" },
        { id: "good", user_tier: "free", stripe_customer_id: "cus_good" },
      ]),
      STRIPE_STUB,
      {
        listAllSubscriptions: sweepOf([
          rec("active", PRICE_PRO_MONTHLY, "cus_bad"),
          rec("active", PRICE_PRO_MONTHLY, "cus_good"),
        ]),
        writeTier: async (id, tier) => {
          if (id === "bad") throw new Error("stripe 500");
          writes.push({ id, tier });
          return true;
        },
      },
    );
    expect(summary.scanned).toBe(2);
    expect(summary.errors).toBe(1);
    expect(summary.granted).toBe(1);
    expect(writes).toEqual([{ id: "good", tier: "pro" }]);
  });

  it("propagates a thrown sweep failure (not per-customer — there's only one sweep per run)", async () => {
    await expect(
      reconcileEntitlements(
        fakeSupabase([{ id: "u16", user_tier: "free", stripe_customer_id: "cus_16" }]),
        STRIPE_STUB,
        {
          listAllSubscriptions: async () => {
            throw new Error("stripe 500");
          },
          writeTier: async () => true,
        },
      ),
    ).rejects.toThrow("stripe 500");
  });

  it("counts a failed write as an error (with a Sentry alert) and reports it, not a silent grant", async () => {
    const summary = await reconcileEntitlements(
      fakeSupabase([{ id: "u6", user_tier: "free", stripe_customer_id: "cus_6" }]),
      STRIPE_STUB,
      {
        listAllSubscriptions: sweepOf([rec("active", PRICE_PRO_MONTHLY, "cus_6")]),
        writeTier: async () => false, // write rejected
      },
    );
    expect(summary.granted).toBe(0);
    expect(summary.errors).toBe(1);
    expect(summary.ok).toBe(false); // 1 error among 1 scanned IS systemic (100%) — see next test for the non-systemic boundary
  });

  it("reports ok:false when EVERY scanned customer errors (systemic failure)", async () => {
    const summary = await reconcileEntitlements(
      fakeSupabase([
        { id: "u8", user_tier: "free", stripe_customer_id: "cus_8" },
        { id: "u9", user_tier: "free", stripe_customer_id: "cus_9" },
      ]),
      STRIPE_STUB,
      {
        listAllSubscriptions: sweepOf([
          rec("active", PRICE_PRO_MONTHLY, "cus_8"),
          rec("active", PRICE_PRO_MONTHLY, "cus_9"),
        ]),
        writeTier: async () => false,
      },
    );
    expect(summary.errors).toBe(2);
    expect(summary.scanned).toBe(2);
    expect(summary.ok).toBe(false);
  });

  it("stays ok:true when only SOME customers error among many successes", async () => {
    const summary = await reconcileEntitlements(
      fakeSupabase([
        { id: "u10", user_tier: "free", stripe_customer_id: "cus_10" },
        { id: "u11", user_tier: "free", stripe_customer_id: "cus_11" },
        { id: "u12", user_tier: "free", stripe_customer_id: "cus_12" },
      ]),
      STRIPE_STUB,
      {
        listAllSubscriptions: sweepOf([
          rec("active", PRICE_PRO_MONTHLY, "cus_10"),
          rec("active", PRICE_PRO_MONTHLY, "cus_11"),
          rec("active", PRICE_PRO_MONTHLY, "cus_12"),
        ]),
        writeTier: async (id) => id !== "u10", // one of three fails
      },
    );
    expect(summary.errors).toBe(1);
    expect(summary.granted).toBe(2);
    expect(summary.ok).toBe(true);
  });

  it("discovers an orphan via Stripe metadata (no stripe_customer_id yet), grants, and backfills", async () => {
    const writes: Array<{ id: string; tier: string }> = [];
    const backfills: Array<{ id: string; customerId: string }> = [];
    const summary = await reconcileEntitlements(
      fakeSupabase([{ id: "orphan-1", user_tier: "free", stripe_customer_id: null }]),
      STRIPE_STUB,
      {
        listAllSubscriptions: sweepOf([
          rec("active", PRICE_PRO_MONTHLY, "cus_orphan", "orphan-1"),
        ]),
        writeTier: async (id, tier) => {
          writes.push({ id, tier });
          return true;
        },
        backfillCustomerId: async (id, customerId) => {
          backfills.push({ id, customerId });
          return true;
        },
      },
    );
    expect(summary.granted).toBe(1);
    expect(summary.customerIdBackfilled).toBe(1);
    expect(writes).toEqual([{ id: "orphan-1", tier: "pro" }]);
    expect(backfills).toEqual([{ id: "orphan-1", customerId: "cus_orphan" }]);
  });

  it("backfills an orphan's customer id even when the tier is already in sync", async () => {
    const backfills: string[] = [];
    const summary = await reconcileEntitlements(
      fakeSupabase([{ id: "orphan-2", user_tier: "pro", stripe_customer_id: null }]),
      STRIPE_STUB,
      {
        listAllSubscriptions: sweepOf([
          rec("active", PRICE_PRO_MONTHLY, "cus_orphan2", "orphan-2"),
        ]),
        writeTier: async () => true,
        backfillCustomerId: async (id) => {
          backfills.push(id);
          return true;
        },
      },
    );
    expect(summary.inSync).toBe(1);
    expect(summary.customerIdBackfilled).toBe(1);
    expect(backfills).toEqual(["orphan-2"]);
  });

  it("counts noProfile when Stripe metadata references a user id with no profile row", async () => {
    const summary = await reconcileEntitlements(
      fakeSupabase([]), // no profiles at all
      STRIPE_STUB,
      {
        listAllSubscriptions: sweepOf([
          rec("active", PRICE_PRO_MONTHLY, "cus_ghost", "00000000-0000-1000-8000-000000000000"),
        ]),
        writeTier: async () => true,
      },
    );
    expect(summary.noProfile).toBe(1);
    expect(summary.scanned).toBe(0);
  });

  it("skips a write when a webhook wrote a fresher tier between read and write (TOCTOU)", async () => {
    // The batch scan sees a stale "free" snapshot; the pre-write re-read
    // (a separate query) sees "pro" — simulating a webhook that granted
    // the tier in the gap between the scan and this job's write.
    const raceSupabase = {
      from(_table: string) {
        return {
          select(_cols: string) {
            return {
              not() {
                return {
                  order() {
                    return {
                      range() {
                        return Promise.resolve({
                          data: [{ id: "u13", user_tier: "free", stripe_customer_id: "cus_13" }],
                          error: null,
                        });
                      },
                    };
                  },
                };
              },
              in() {
                return Promise.resolve({ data: [], error: null });
              },
              eq(_col: string, _id: string) {
                return {
                  maybeSingle() {
                    return Promise.resolve({ data: { user_tier: "pro" }, error: null });
                  },
                };
              },
            };
          },
          update() {
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      },
    } as any;

    const writes: string[] = [];
    const summary = await reconcileEntitlements(
      raceSupabase,
      STRIPE_STUB,
      {
        listAllSubscriptions: sweepOf([rec("active", PRICE_PRO_MONTHLY, "cus_13")]),
        writeTier: async (id) => {
          writes.push(id);
          return true;
        },
      },
    );
    expect(summary.staleWriteSkipped).toBe(1);
    expect(summary.granted).toBe(0);
    expect(writes).toEqual([]);
  });

  it("does NOT write when the pre-write TOCTOU re-read itself fails (regression: null must abort, not fall through)", async () => {
    // A read error from the pre-write re-check must be treated the same as
    // "the tier changed" — writing blind over an unreadable row is worse
    // than skipping one cycle. `freshTier === null || freshTier !== current`
    // is the correct guard; `freshTier !== null && freshTier !== current`
    // would let this fall through and write anyway.
    const raceSupabase = {
      from(_table: string) {
        return {
          select(_cols: string) {
            return {
              not() {
                return {
                  order() {
                    return {
                      range() {
                        return Promise.resolve({
                          data: [{ id: "u17", user_tier: "free", stripe_customer_id: "cus_17" }],
                          error: null,
                        });
                      },
                    };
                  },
                };
              },
              in() {
                return Promise.resolve({ data: [], error: null });
              },
              eq(_col: string, _id: string) {
                return {
                  maybeSingle() {
                    return Promise.resolve({ data: null, error: { message: "connection reset" } });
                  },
                };
              },
            };
          },
          update() {
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      },
    } as any;

    const writes: string[] = [];
    const summary = await reconcileEntitlements(
      raceSupabase,
      STRIPE_STUB,
      {
        listAllSubscriptions: sweepOf([rec("active", PRICE_PRO_MONTHLY, "cus_17")]),
        writeTier: async (id) => {
          writes.push(id);
          return true;
        },
      },
    );
    expect(summary.staleWriteSkipped).toBe(1);
    expect(summary.granted).toBe(0);
    expect(writes).toEqual([]);
  });

  it("backfills the ENTITLING customer's id, not a stale one, when a user has churned and resubscribed under a new Stripe customer", async () => {
    // Regression: grouping must not lock in whichever customer id is
    // encountered first — an old canceled customer's id must never win
    // over a currently-active one (would break the Customer Portal link).
    const backfills: string[] = [];
    const summary = await reconcileEntitlements(
      fakeSupabase([{ id: "user-churned", user_tier: "free", stripe_customer_id: null }]),
      STRIPE_STUB,
      {
        listAllSubscriptions: sweepOf([
          rec("canceled", PRICE_PRO_MONTHLY, "cus_OLD_dead", "user-churned"),
          rec("active", PRICE_PRO_MONTHLY, "cus_NEW_active", "user-churned"),
        ]),
        writeTier: async () => true,
        backfillCustomerId: async (_id, customerId) => {
          backfills.push(customerId);
          return true;
        },
      },
    );
    expect(summary.granted).toBe(1);
    expect(backfills).toEqual(["cus_NEW_active"]);
  });

  it("surfaces sweepTruncated when the Stripe sweep hits the page cap", async () => {
    const summary = await reconcileEntitlements(
      fakeSupabase([{ id: "u14", user_tier: "free", stripe_customer_id: "cus_14" }]),
      STRIPE_STUB,
      {
        listAllSubscriptions: sweepOf([rec("active", PRICE_PRO_MONTHLY, "cus_14")], true, 500),
        writeTier: async () => true,
      },
    );
    expect(summary.sweepTruncated).toBe(true);
    expect(summary.sweepPages).toBe(500);
    expect(summary.ok).toBe(true); // truncation alone isn't a systemic failure
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

  it("200 with summary on the happy path (ok:true)", async () => {
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

  it("502 when the runner returns ok:false (systemic failure)", async () => {
    process.env.SUPPR_CRON_SECRET = "ok";
    const runner = vi.fn().mockResolvedValue({ ok: false, scanned: 5, errors: 5 });
    const res = await runEntitlementReconcileRoute(
      buildReq({ "x-cron-secret": "ok" }),
      () => ({}) as any,
      () => ({}) as any,
      runner as any,
    );
    expect(res.status).toBe(502);
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
