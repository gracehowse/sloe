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

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  createSupabaseServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === "stripe_webhook_events") {
        return { insert: insertMock };
      }
      // profiles.update({...}).eq(...)
      return { update: profileUpdateMock };
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
