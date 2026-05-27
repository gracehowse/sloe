// @vitest-environment jsdom
/**
 * Render-behaviour test for `<SubscriptionCard>` (web, ENG-748 #11).
 *
 * The render decisioning is exhaustively covered by the pure
 * `subscriptionCardView.test.ts`; this file pins the user-observable
 * wiring the component adds on top:
 *   1. Free user (userTier "free") → the status route is NOT called.
 *   2. IAP subscriber (managedVia app_store) → the Apple copy renders
 *      and there is NO manage/cancel control (legal P0 MV-1/MV-2).
 *   3. Active Stripe sub → a "Manage or cancel subscription" CTA
 *      renders and firing it calls `onManageSubscription` (which the
 *      host wires to the cancel-export prompt → portal flow).
 *   4. Loading state renders a skeleton, not a broken/empty card.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

void React;

const getSessionMock = vi.fn();
vi.mock("@/lib/supabase/browserClient", () => ({
  supabase: {
    auth: {
      getSession: () => getSessionMock(),
    },
  },
}));

import { SubscriptionCard } from "../../src/app/components/settings/SubscriptionCard";

const fetchMock = vi.fn();

beforeEach(() => {
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({
    data: { session: { access_token: "test-token" } },
  });
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  // Deterministic region — navigator.language drives detectRegionClient.
  Object.defineProperty(window.navigator, "language", {
    value: "en-US",
    configurable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockRoute(body: Record<string, unknown>, ok = true) {
  fetchMock.mockResolvedValue({
    ok,
    json: async () => body,
  });
}

const PERIOD_END = Math.floor(Date.UTC(2026, 5, 15, 12, 0, 0) / 1000);

describe("<SubscriptionCard>", () => {
  it("does NOT call the status route for a Free user", async () => {
    render(<SubscriptionCard userTier="free" onManageSubscription={vi.fn()} />);
    // Give any (incorrect) async fetch a tick to fire.
    await waitFor(() => {
      expect(screen.getByTestId("subscription-card")).toBeTruthy();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders the Apple-billing copy and NO cancel control for an IAP subscriber", async () => {
    mockRoute({ ok: true, subscription: null, managedVia: "app_store", taxEnabled: false });
    render(<SubscriptionCard userTier="pro" onManageSubscription={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("subscription-card-iap")).toBeTruthy();
    });
    const text = screen.getByTestId("subscription-card-iap").textContent ?? "";
    expect(text).toContain("through the App Store");
    expect(text).toContain("Settings → Apple ID → Subscriptions");
    // Legal P0: NO web cancel/manage button for IAP subscribers.
    expect(screen.queryByTestId("subscription-card-manage-button")).toBeNull();
  });

  it("renders an active sub with a manage CTA that fires onManageSubscription", async () => {
    mockRoute({
      ok: true,
      managedVia: "stripe",
      taxEnabled: false,
      subscription: {
        status: "active",
        billingPeriod: "monthly",
        currentPeriodEnd: PERIOD_END,
        trialEnd: null,
        cancelAtPeriodEnd: false,
        priceAmount: 2999,
        currency: "gbp",
        paymentMethodBrand: "visa",
        paymentMethodLast4: "4242",
      },
    });
    const onManage = vi.fn();
    render(<SubscriptionCard userTier="pro" onManageSubscription={onManage} />);

    await waitFor(() => {
      expect(screen.getByTestId("subscription-card-active")).toBeTruthy();
    });
    const cta = screen.getByTestId("subscription-card-manage-button");
    expect(cta.textContent).toContain("Manage or cancel subscription");
    fireEvent.click(cta);
    expect(onManage).toHaveBeenCalledTimes(1);
    // Payment method is brand + last4 only.
    expect(screen.getByTestId("subscription-card-payment-method").textContent).toBe(
      "Visa ending 4242",
    );
  });

  it("renders a cancelled-but-active sub with the 'will not renew' copy", async () => {
    mockRoute({
      ok: true,
      managedVia: "stripe",
      taxEnabled: false,
      subscription: {
        status: "active",
        billingPeriod: "monthly",
        currentPeriodEnd: PERIOD_END,
        trialEnd: null,
        cancelAtPeriodEnd: true,
        priceAmount: 2999,
        currency: "gbp",
        paymentMethodBrand: null,
        paymentMethodLast4: null,
      },
    });
    render(<SubscriptionCard userTier="pro" onManageSubscription={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId("subscription-card-canceled")).toBeTruthy();
    });
    const text = screen.getByTestId("subscription-card-canceled").textContent ?? "";
    expect(text).toContain("cancelled");
    expect(text).toContain("will not renew");
    expect(text).not.toContain("Renews automatically");
  });

  it("renders the amber past-due banner linking straight to /account/billing", async () => {
    mockRoute({
      ok: true,
      managedVia: "stripe",
      taxEnabled: false,
      subscription: {
        status: "past_due",
        billingPeriod: "monthly",
        currentPeriodEnd: PERIOD_END,
        trialEnd: null,
        cancelAtPeriodEnd: false,
        priceAmount: 2999,
        currency: "gbp",
        paymentMethodBrand: "visa",
        paymentMethodLast4: "4242",
      },
    });
    render(<SubscriptionCard userTier="pro" onManageSubscription={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId("subscription-card-past-due-banner")).toBeTruthy();
    });
    const banner = screen.getByTestId("subscription-card-past-due-banner");
    expect(banner.getAttribute("href")).toBe("/account/billing");
    expect(banner.textContent).toContain(
      "Payment failed — update your card to keep Pro access.",
    );
  });

  it("shows a loading skeleton before the route resolves", async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    render(<SubscriptionCard userTier="pro" onManageSubscription={vi.fn()} />);
    expect(screen.getByTestId("subscription-card-loading")).toBeTruthy();
    // Resolve so the test doesn't leak a pending promise.
    resolveFetch({
      ok: true,
      json: async () => ({ ok: true, subscription: null, managedVia: "stripe", taxEnabled: false }),
    });
    await waitFor(() => {
      expect(screen.queryByTestId("subscription-card-loading")).toBeNull();
    });
  });
});
