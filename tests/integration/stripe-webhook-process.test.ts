import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type Stripe from "stripe";
import { processStripeWebhookEvent, _clearProcessedEventsForTesting } from "@/lib/stripe/webhookProcess";

const userId = "11111111-1111-4111-8111-111111111111";

vi.mock("@/lib/stripe/updateProfileTier", () => ({
  updateProfileTierServiceRole: vi.fn().mockResolvedValue(true),
}));

import { updateProfileTierServiceRole } from "@/lib/stripe/updateProfileTier";

describe("processStripeWebhookEvent", () => {
  const mockUpdate = vi.mocked(updateProfileTierServiceRole);

  beforeEach(() => {
    vi.clearAllMocks();
    _clearProcessedEventsForTesting();
    process.env.STRIPE_PRICE_BASE_MONTHLY = "price_base_monthly_test";
    process.env.STRIPE_PRICE_BASE_ANNUAL = "price_base_annual_test";
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_monthly_test";
    process.env.STRIPE_PRICE_PRO_ANNUAL = "price_pro_annual_test";
  });

  afterEach(() => {
    delete process.env.STRIPE_PRICE_BASE_MONTHLY;
    delete process.env.STRIPE_PRICE_BASE_ANNUAL;
    delete process.env.STRIPE_PRICE_PRO_MONTHLY;
    delete process.env.STRIPE_PRICE_PRO_ANNUAL;
  });

  it("checkout.session.completed sets tier from subscription price", async () => {
    const stripe = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_1",
          object: "subscription",
          status: "active",
          items: {
            data: [{ price: { id: "price_base_monthly_test" } }],
          },
          metadata: {},
        }),
      },
    } as unknown as Stripe;

    const event = {
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
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_1", { expand: ["items.data.price"] });
    expect(mockUpdate).toHaveBeenCalledWith(userId, "base");
  });

  it("customer.subscription.deleted sets free", async () => {
    const stripe = {} as Stripe;
    const event = {
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_x",
          metadata: { supabase_user_id: userId },
        },
      },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);
    expect(mockUpdate).toHaveBeenCalledWith(userId, "free");
  });

  it("customer.subscription.updated applies tier when active", async () => {
    const stripe = {} as Stripe;
    const event = {
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
  });

  // Pricing v1 (2026-04-19) — annual price IDs must resolve to the
  // same tier as their monthly counterparts so a user who buys Pro
  // annual lands on `profiles.user_tier = "pro"` exactly as the
  // monthly flow does. Regression-proof against a future env rename
  // that forgets to add the annual side.
  it("customer.subscription.updated resolves pro annual to 'pro'", async () => {
    const stripe = {} as Stripe;
    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_pro_annual",
          status: "active",
          metadata: { supabase_user_id: userId },
          items: { data: [{ price: { id: "price_pro_annual_test" } }] },
        },
      },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);
    expect(mockUpdate).toHaveBeenCalledWith(userId, "pro");
  });

  it("customer.subscription.updated resolves base annual to 'base'", async () => {
    const stripe = {} as Stripe;
    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_base_annual",
          status: "active",
          metadata: { supabase_user_id: userId },
          items: { data: [{ price: { id: "price_base_annual_test" } }] },
        },
      },
    } as Stripe.Event;

    await processStripeWebhookEvent(stripe, event);
    expect(mockUpdate).toHaveBeenCalledWith(userId, "base");
  });
});
