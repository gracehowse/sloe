/**
 * ENG-1355 — additional branch coverage for `processStripeWebhookEvent`
 * that `tests/integration/stripe-webhook-process.test.ts` doesn't reach:
 *
 *   - persisted dedup via `stripe_webhook_events` (T23): a duplicate
 *     event.id is skipped entirely (no tier write, no customer-id
 *     persist) — this is the Stripe-side replay-protection analogue to
 *     the RevenueCat `revenuecat_events` dedup.
 *   - `checkout.session.completed` in non-subscription mode is ignored.
 *   - `checkout.session.completed` with no resolvable user id is ignored
 *     (no crash, no tier write).
 *   - `customer.subscription.updated/created` status branches:
 *     canceled/unpaid/incomplete_expired → free; past_due → tier from
 *     price (dunning still has access); a subscription with no
 *     resolvable metadata user id is a no-op.
 *   - `customer.subscription.deleted` with no resolvable user id is a
 *     no-op (must not throw).
 *   - unrecognised event types are ignored.
 *   - the Stripe customer id persisted onto `profiles.stripe_customer_id`
 *     is best-effort: a failed persist does not block the tier write.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { processStripeWebhookEvent, _clearProcessedEventsForTesting } from "@/lib/stripe/webhookProcess";

const userId = "11111111-1111-4111-8111-111111111111";

vi.mock("@/lib/stripe/updateProfileTier", () => ({
  updateProfileTierServiceRole: vi.fn().mockResolvedValue(true),
}));

// Controllable service-role client so dedup INSERT + profile UPDATE can be
// scripted per test, mirroring the RC webhook process test's approach.
let insertResult: { error: { code?: string; message: string } | null } = { error: null };
const insertMock = vi.fn(() => Promise.resolve(insertResult));
const profileUpdateEqMock = vi.fn(() => Promise.resolve({ error: null }));
const profileUpdateMock = vi.fn(() => ({ eq: profileUpdateEqMock }));
// ENG-1490 #3: persistTrialStartedAtIfTrialing does
// .update({trial_started_at}).eq("id", userId).is("trial_started_at", null)
// — a 3-link chain distinct from profileUpdateMock's 2-link
// (.update().eq()) chain used by persistStripeCustomerId /
// updateProfileTierServiceRoleDetailed. Tracked separately so tests can
// assert on trial-timestamp writes without disturbing the existing
// stripe_customer_id / tier-write assertions above.
const trialUpdateIsMock = vi.fn(() => Promise.resolve({ error: null }));
const trialUpdateEqMock = vi.fn(() => ({ is: trialUpdateIsMock }));
const trialUpdateMock = vi.fn(() => ({ eq: trialUpdateEqMock }));

// ENG-1490 #2: `stripe_subscription_event_versions` — the stale/out-of-order
// guard's read (select().eq().maybeSingle()) and write (upsert()). Kept
// distinct from the T23 `stripe_webhook_events` insert mock above: that
// table dedupes on event.id (exact redelivery), this one tracks a
// per-subscription high-water mark (stale-but-distinct events).
let subVersionSelectResult: {
  data: { last_event_created: string } | null;
  error: { message: string } | null;
} = { data: null, error: null };
const subVersionMaybeSingleMock = vi.fn(() => Promise.resolve(subVersionSelectResult));
const subVersionEqMock = vi.fn(() => ({ maybeSingle: subVersionMaybeSingleMock }));
const subVersionSelectMock = vi.fn(() => ({ eq: subVersionEqMock }));
let subVersionUpsertResult: { error: { message: string } | null } = { error: null };
const subVersionUpsertMock = vi.fn(() => Promise.resolve(subVersionUpsertResult));

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  createSupabaseServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === "stripe_webhook_events") {
        return { insert: insertMock };
      }
      if (table === "stripe_subscription_event_versions") {
        return { select: subVersionSelectMock, upsert: subVersionUpsertMock };
      }
      // profiles: two distinct call shapes land here —
      //   .update({user_tier|stripe_customer_id}).eq("id", userId)              (2-link)
      //   .update({trial_started_at}).eq("id", userId).is("trial_started_at", null) (3-link)
      // Route by inspecting the update payload's keys.
      return {
        update: (payload: Record<string, unknown>) => {
          if ("trial_started_at" in payload) return trialUpdateMock();
          return profileUpdateMock(payload);
        },
      };
    },
  }),
  supabasePublicUrl: () => "https://example.supabase.co",
}));

import { updateProfileTierServiceRole } from "@/lib/stripe/updateProfileTier";

describe("processStripeWebhookEvent — persisted dedup (T23)", () => {
  const mockUpdate = vi.mocked(updateProfileTierServiceRole);

  beforeEach(() => {
    vi.clearAllMocks();
    _clearProcessedEventsForTesting();
    insertResult = { error: null };
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test_service_role";
    process.env.STRIPE_PRICE_BASE_MONTHLY = "price_base_monthly_test";
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_monthly_test";
  });

  afterEach(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.STRIPE_PRICE_BASE_MONTHLY;
    delete process.env.STRIPE_PRICE_PRO_MONTHLY;
  });

  it("processes a first-time event normally (dedup INSERT succeeds)", async () => {
    const stripe = {} as Stripe;
    const event = {
      id: "evt_first",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_x", metadata: { supabase_user_id: userId } } },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);
    expect(insertMock).toHaveBeenCalledWith({ event_id: "evt_first" });
    expect(mockUpdate).toHaveBeenCalledWith(userId, "free");
  });

  it("skips a duplicate event_id (23505) entirely — no tier write", async () => {
    insertResult = { error: { code: "23505", message: "duplicate key" } };
    const stripe = {} as Stripe;
    const event = {
      id: "evt_dup",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_x", metadata: { supabase_user_id: userId } } },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("fail-safe processes the event when the dedup INSERT errors for a non-duplicate reason", async () => {
    insertResult = { error: { message: "connection reset" } };
    const stripe = {} as Stripe;
    const event = {
      id: "evt_transient",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_x", metadata: { supabase_user_id: userId } } },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);
    // Fail-safe: still processes rather than silently dropping a real event.
    expect(mockUpdate).toHaveBeenCalledWith(userId, "free");
  });
});

describe("processStripeWebhookEvent — checkout.session.completed edge cases", () => {
  const mockUpdate = vi.mocked(updateProfileTierServiceRole);

  beforeEach(() => {
    vi.clearAllMocks();
    _clearProcessedEventsForTesting();
    insertResult = { error: null };
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test_service_role";
    process.env.STRIPE_PRICE_BASE_MONTHLY = "price_base_monthly_test";
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_monthly_test";
  });

  afterEach(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.STRIPE_PRICE_BASE_MONTHLY;
    delete process.env.STRIPE_PRICE_PRO_MONTHLY;
  });

  it("ignores a non-subscription-mode checkout session (e.g. a one-off payment)", async () => {
    const stripe = { subscriptions: { retrieve: vi.fn() } } as unknown as Stripe;
    const event = {
      id: "evt_payment_mode",
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "payment",
          client_reference_id: userId,
          subscription: "sub_1",
        },
      },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("is a no-op when neither client_reference_id nor metadata.supabase_user_id resolve to a uuid", async () => {
    const stripe = { subscriptions: { retrieve: vi.fn() } } as unknown as Stripe;
    const event = {
      id: "evt_no_user",
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          client_reference_id: "not-a-uuid",
          subscription: "sub_1",
        },
      },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("falls back to metadata.supabase_user_id when client_reference_id is absent", async () => {
    const stripe = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_1",
          status: "active",
          items: { data: [{ price: { id: "price_base_monthly_test" } }] },
        }),
      },
    } as unknown as Stripe;
    const event = {
      id: "evt_meta_user",
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          metadata: { supabase_user_id: userId },
          subscription: "sub_1",
        },
      },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);
    expect(mockUpdate).toHaveBeenCalledWith(userId, "base");
  });

  it("is a no-op when the session has no subscription id to retrieve", async () => {
    const stripe = { subscriptions: { retrieve: vi.fn() } } as unknown as Stripe;
    const event = {
      id: "evt_no_sub_id",
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          client_reference_id: userId,
        },
      },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("best-effort persists stripe_customer_id but does not block the tier write when that persist fails", async () => {
    profileUpdateEqMock.mockResolvedValueOnce({ error: { message: "rls denied" } });
    const stripe = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_1",
          status: "active",
          items: { data: [{ price: { id: "price_pro_monthly_test" } }] },
        }),
      },
    } as unknown as Stripe;
    const event = {
      id: "evt_customer_persist_fails",
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          client_reference_id: userId,
          customer: "cus_123",
          subscription: "sub_1",
        },
      },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);
    expect(profileUpdateMock).toHaveBeenCalledWith({ stripe_customer_id: "cus_123" });
    // Tier write still happens even though the customer-id persist failed.
    expect(mockUpdate).toHaveBeenCalledWith(userId, "pro");
  });

  it("does NOT grant Pro when the checkout subscription is still incomplete (ENG-1490)", async () => {
    // A `checkout.session.completed` can fire with the subscription in
    // `incomplete` status (initial payment not yet succeeded). Granting
    // from price IDs alone would hand out Pro before payment clears; the
    // status gate (shared with the customer.subscription.* path) must
    // suppress the grant.
    const stripe = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_1",
          status: "incomplete",
          items: { data: [{ price: { id: "price_pro_monthly_test" } }] },
        }),
      },
    } as unknown as Stripe;
    const event = {
      id: "evt_incomplete_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          client_reference_id: userId,
          customer: "cus_incomplete",
          subscription: "sub_1",
        },
      },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);
    // Customer id is still persisted (best-effort), but NO tier grant.
    expect(profileUpdateMock).toHaveBeenCalledWith({ stripe_customer_id: "cus_incomplete" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("grants Pro when the checkout subscription is trialing (ENG-1490 — trial still entitles)", async () => {
    const stripe = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_1",
          status: "trialing",
          items: { data: [{ price: { id: "price_pro_monthly_test" } }] },
        }),
      },
    } as unknown as Stripe;
    const event = {
      id: "evt_trialing_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          client_reference_id: userId,
          subscription: "sub_1",
        },
      },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);
    expect(mockUpdate).toHaveBeenCalledWith(userId, "pro");
  });
});

describe("processStripeWebhookEvent — subscription status branches", () => {
  const mockUpdate = vi.mocked(updateProfileTierServiceRole);

  beforeEach(() => {
    vi.clearAllMocks();
    _clearProcessedEventsForTesting();
    insertResult = { error: null };
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test_service_role";
    process.env.STRIPE_PRICE_BASE_MONTHLY = "price_base_monthly_test";
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_monthly_test";
  });

  afterEach(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.STRIPE_PRICE_BASE_MONTHLY;
    delete process.env.STRIPE_PRICE_PRO_MONTHLY;
  });

  it.each(["canceled", "unpaid", "incomplete_expired"])(
    "status=%s downgrades to free",
    async (status) => {
      const stripe = {} as Stripe;
      const event = {
        id: `evt_${status}`,
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_x",
            status,
            metadata: { supabase_user_id: userId },
            items: { data: [{ price: { id: "price_pro_monthly_test" } }] },
          },
        },
      } as Stripe.Event;

      await processStripeWebhookEvent(stripe, event);
      expect(mockUpdate).toHaveBeenCalledWith(userId, "free");
    },
  );

  it("status=past_due keeps the paid tier (dunning grace — access stays live)", async () => {
    const stripe = {} as Stripe;
    const event = {
      id: "evt_past_due",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_x",
          status: "past_due",
          metadata: { supabase_user_id: userId },
          items: { data: [{ price: { id: "price_pro_monthly_test" } }] },
        },
      },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);
    expect(mockUpdate).toHaveBeenCalledWith(userId, "pro");
  });

  it("status=trialing applies the tier from the price (trial grants access immediately)", async () => {
    const stripe = {} as Stripe;
    const event = {
      id: "evt_trialing",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_x",
          status: "trialing",
          metadata: { supabase_user_id: userId },
          items: { data: [{ price: { id: "price_pro_monthly_test" } }] },
        },
      },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);
    expect(mockUpdate).toHaveBeenCalledWith(userId, "pro");
  });

  it("is a no-op when the subscription has no resolvable supabase_user_id metadata", async () => {
    const stripe = {} as Stripe;
    const event = {
      id: "evt_no_meta",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_x",
          status: "active",
          metadata: {},
          items: { data: [{ price: { id: "price_pro_monthly_test" } }] },
        },
      },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("customer.subscription.deleted with no resolvable user id is a no-op (never throws)", async () => {
    const stripe = {} as Stripe;
    const event = {
      id: "evt_deleted_no_user",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_x", metadata: {} } },
    } as Stripe.Event;

    await expect(processStripeWebhookEvent(stripe, event)).resolves.toBeUndefined();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("ignores an unrecognised event type", async () => {
    const stripe = {} as Stripe;
    const event = {
      id: "evt_unknown",
      type: "invoice.payment_failed",
      data: { object: {} },
    } as Stripe.Event;

    await expect(processStripeWebhookEvent(stripe, event)).resolves.toBeUndefined();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("processStripeWebhookEvent — trial_started_at persistence (ENG-1490 #3)", () => {
  const mockUpdate = vi.mocked(updateProfileTierServiceRole);

  beforeEach(() => {
    vi.clearAllMocks();
    _clearProcessedEventsForTesting();
    insertResult = { error: null };
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test_service_role";
    process.env.STRIPE_PRICE_BASE_MONTHLY = "price_base_monthly_test";
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_monthly_test";
  });

  afterEach(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.STRIPE_PRICE_BASE_MONTHLY;
    delete process.env.STRIPE_PRICE_PRO_MONTHLY;
  });

  it("customer.subscription.created with status=trialing persists trial_started_at (once-only WHERE guard)", async () => {
    const stripe = {} as Stripe;
    const event = {
      id: "evt_trial_persist",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_x",
          status: "trialing",
          metadata: { supabase_user_id: userId },
          items: { data: [{ price: { id: "price_pro_monthly_test" } }] },
        },
      },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);
    expect(trialUpdateMock).toHaveBeenCalledOnce();
    expect(trialUpdateEqMock).toHaveBeenCalledWith("id", userId);
    // The once-only guard — WHERE trial_started_at IS NULL — so a second
    // trialing event (webhook retry) never overwrites the original.
    expect(trialUpdateIsMock).toHaveBeenCalledWith("trial_started_at", null);
  });

  it("checkout.session.completed with status=trialing persists trial_started_at", async () => {
    const stripe = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_1",
          status: "trialing",
          items: { data: [{ price: { id: "price_pro_monthly_test" } }] },
        }),
      },
    } as unknown as Stripe;
    const event = {
      id: "evt_checkout_trialing",
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          client_reference_id: userId,
          subscription: "sub_1",
        },
      },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);
    expect(trialUpdateMock).toHaveBeenCalledOnce();
  });

  it("status=active does NOT persist trial_started_at (never entered a trial)", async () => {
    const stripe = {} as Stripe;
    const event = {
      id: "evt_active_no_trial",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_x",
          status: "active",
          metadata: { supabase_user_id: userId },
          items: { data: [{ price: { id: "price_pro_monthly_test" } }] },
        },
      },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);
    expect(mockUpdate).toHaveBeenCalledWith(userId, "pro");
    expect(trialUpdateMock).not.toHaveBeenCalled();
  });

  it("a failed trial_started_at write is best-effort — does not block or throw past the tier grant", async () => {
    trialUpdateIsMock.mockResolvedValueOnce({ error: { message: "rls denied" } });
    const stripe = {} as Stripe;
    const event = {
      id: "evt_trial_persist_fails",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_x",
          status: "trialing",
          metadata: { supabase_user_id: userId },
          items: { data: [{ price: { id: "price_pro_monthly_test" } }] },
        },
      },
    } as Stripe.Event;

    await expect(processStripeWebhookEvent(stripe, event)).resolves.toBeUndefined();
    expect(mockUpdate).toHaveBeenCalledWith(userId, "pro");
  });

  it("no resolvable user id → no trial_started_at write (never throws)", async () => {
    const stripe = {} as Stripe;
    const event = {
      id: "evt_trial_no_user",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_x",
          status: "trialing",
          metadata: {},
          items: { data: [{ price: { id: "price_pro_monthly_test" } }] },
        },
      },
    } as Stripe.Event;

    await expect(processStripeWebhookEvent(stripe, event)).resolves.toBeUndefined();
    expect(trialUpdateMock).not.toHaveBeenCalled();
  });
});

describe("processStripeWebhookEvent — stale out-of-order event guard (ENG-1490 #2)", () => {
  const mockUpdate = vi.mocked(updateProfileTierServiceRole);

  beforeEach(() => {
    vi.clearAllMocks();
    _clearProcessedEventsForTesting();
    insertResult = { error: null };
    subVersionSelectResult = { data: null, error: null };
    subVersionUpsertResult = { error: null };
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test_service_role";
    process.env.STRIPE_PRICE_BASE_MONTHLY = "price_base_monthly_test";
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_monthly_test";
  });

  afterEach(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.STRIPE_PRICE_BASE_MONTHLY;
    delete process.env.STRIPE_PRICE_PRO_MONTHLY;
  });

  function subEvent(overrides: {
    id: string;
    created: number;
    type?: string;
    status: string;
  }): Stripe.Event {
    return {
      id: overrides.id,
      created: overrides.created,
      type: overrides.type ?? "customer.subscription.updated",
      data: {
        object: {
          id: "sub_x",
          status: overrides.status,
          metadata: { supabase_user_id: userId },
          items: { data: [{ price: { id: "price_pro_monthly_test" } }] },
        },
      },
    } as unknown as Stripe.Event;
  }

  it("the normal in-order case is completely unaffected — first event applies and records its version", async () => {
    const stripe = {} as Stripe;
    const event = subEvent({ id: "evt_v1", created: 1000, status: "active" });

    await processStripeWebhookEvent(stripe, event);

    expect(mockUpdate).toHaveBeenCalledWith(userId, "pro");
    // No prior version row (data: null) → not stale, proceeds straight to apply.
    expect(subVersionMaybeSingleMock).toHaveBeenCalledOnce();
    expect(subVersionUpsertMock).toHaveBeenCalledWith(
      {
        subscription_id: "sub_x",
        last_event_created: new Date(1000 * 1000).toISOString(),
        last_event_id: "evt_v1",
      },
      { onConflict: "subscription_id" },
    );
  });

  it("a subsequent newer in-order event also applies normally and advances the recorded version", async () => {
    subVersionSelectResult = { data: { last_event_created: new Date(1000 * 1000).toISOString() }, error: null };
    const stripe = {} as Stripe;
    const event = subEvent({ id: "evt_v2", created: 2000, status: "canceled" });

    await processStripeWebhookEvent(stripe, event);

    expect(mockUpdate).toHaveBeenCalledWith(userId, "free");
    expect(subVersionUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ last_event_created: new Date(2000 * 1000).toISOString() }),
      { onConflict: "subscription_id" },
    );
  });

  it("a stale out-of-order 'active' event does NOT re-grant tier after a newer downgrade already applied", async () => {
    // Newer 'canceled' event (created=2000) already applied and recorded.
    subVersionSelectResult = { data: { last_event_created: new Date(2000 * 1000).toISOString() }, error: null };
    const stripe = {} as Stripe;
    // A stale redelivered 'active' snapshot from BEFORE the cancellation.
    const event = subEvent({ id: "evt_stale_active", created: 1000, status: "active" });

    await processStripeWebhookEvent(stripe, event);

    expect(mockUpdate).not.toHaveBeenCalled();
    // Must not overwrite the newer high-water mark with the stale one.
    expect(subVersionUpsertMock).not.toHaveBeenCalled();
  });

  it("a stale out-of-order 'canceled' event does NOT downgrade tier after a newer grant already applied", async () => {
    // Newer 'active' event (created=2000) already applied and recorded.
    subVersionSelectResult = { data: { last_event_created: new Date(2000 * 1000).toISOString() }, error: null };
    const stripe = {} as Stripe;
    // A stale redelivered 'canceled' snapshot from BEFORE the resubscribe.
    const event = subEvent({ id: "evt_stale_canceled", created: 1000, status: "canceled" });

    await processStripeWebhookEvent(stripe, event);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(subVersionUpsertMock).not.toHaveBeenCalled();
  });

  it("customer.subscription.deleted is guarded too — a stale delete does not clobber a newer resubscribe", async () => {
    subVersionSelectResult = { data: { last_event_created: new Date(2000 * 1000).toISOString() }, error: null };
    const stripe = {} as Stripe;
    const event = subEvent({
      id: "evt_stale_delete",
      created: 1000,
      type: "customer.subscription.deleted",
      status: "canceled",
    });

    await processStripeWebhookEvent(stripe, event);

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("customer.subscription.deleted applies normally and records its version when not stale", async () => {
    const stripe = {} as Stripe;
    const event = subEvent({
      id: "evt_delete_in_order",
      created: 1000,
      type: "customer.subscription.deleted",
      status: "canceled",
    });

    await processStripeWebhookEvent(stripe, event);

    expect(mockUpdate).toHaveBeenCalledWith(userId, "free");
    expect(subVersionUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_id: "sub_x", last_event_id: "evt_delete_in_order" }),
      { onConflict: "subscription_id" },
    );
  });

  it("exact-duplicate redelivery (same event.id) is still a no-op via the existing T23 dedup, independent of the new guard", async () => {
    insertResult = { error: { code: "23505", message: "duplicate key" } };
    const stripe = {} as Stripe;
    const event = subEvent({ id: "evt_dup_ordering", created: 1000, status: "active" });

    await processStripeWebhookEvent(stripe, event);

    expect(mockUpdate).not.toHaveBeenCalled();
    // T23 dedup short-circuits before the switch statement even runs, so
    // the new ordering guard's table is never touched.
    expect(subVersionMaybeSingleMock).not.toHaveBeenCalled();
    expect(subVersionUpsertMock).not.toHaveBeenCalled();
  });

  it("fails open (applies the event) when the version-lookup read errors", async () => {
    subVersionSelectResult = { data: null, error: { message: "connection reset" } };
    const stripe = {} as Stripe;
    const event = subEvent({ id: "evt_read_error", created: 1000, status: "active" });

    await processStripeWebhookEvent(stripe, event);

    // Fail-open: can't determine staleness → apply rather than drop a
    // legitimate tier change, mirroring isAlreadyProcessed's own philosophy.
    expect(mockUpdate).toHaveBeenCalledWith(userId, "pro");
  });

  it("a failed version-write after applying is best-effort — does not block or throw past the tier grant", async () => {
    subVersionUpsertResult = { error: { message: "rls denied" } };
    const stripe = {} as Stripe;
    const event = subEvent({ id: "evt_write_fails", created: 1000, status: "active" });

    await expect(processStripeWebhookEvent(stripe, event)).resolves.toBeUndefined();
    expect(mockUpdate).toHaveBeenCalledWith(userId, "pro");
  });

  it("checkout.session.completed is NOT guarded by subscription-version staleness (it re-fetches the subscription live)", async () => {
    // Even with a newer version already recorded for this subscription, a
    // checkout.session.completed handler re-fetches the subscription live
    // from Stripe rather than trusting an embedded snapshot, so it must
    // never consult (or be blocked by) the ordering guard.
    subVersionSelectResult = { data: { last_event_created: new Date(5000 * 1000).toISOString() }, error: null };
    const stripe = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_x",
          status: "active",
          items: { data: [{ price: { id: "price_pro_monthly_test" } }] },
        }),
      },
    } as unknown as Stripe;
    const event = {
      id: "evt_checkout_not_guarded",
      created: 1000,
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          client_reference_id: userId,
          subscription: "sub_x",
        },
      },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);

    expect(mockUpdate).toHaveBeenCalledWith(userId, "pro");
    expect(subVersionMaybeSingleMock).not.toHaveBeenCalled();
  });
});
