import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type Stripe from "stripe";
import { resolveBillingPortalOutcome } from "../../src/lib/stripe/billingPortalDecision";
import { BillingUnavailableFallback } from "../../app/account/billing/BillingUnavailableFallback";

/**
 * `/account/billing` decision logic — guards the four error branches
 * + happy path spec'd by monetisation-architect (2026-04-19 round 3).
 *
 * The live page (`app/account/billing/page.tsx`) wires these outcomes
 * into Next.js `redirect()` / fallback-JSX side effects; the pure
 * `resolveBillingPortalOutcome` helper is what the test exercises so we
 * don't have to run the Next.js router or touch Stripe's network.
 */

function makePortalSession(url: string | null): Stripe.BillingPortal.Session {
  // Partial cast — the outcome helper only reads `.url` so the rest of
  // the Stripe BillingPortal.Session shape is irrelevant here.
  return { url } as unknown as Stripe.BillingPortal.Session;
}

describe("resolveBillingPortalOutcome", () => {
  it("1. redirects to /login when the user is unauthenticated", async () => {
    const outcome = await resolveBillingPortalOutcome({
      userId: null,
      stripeCustomerId: null,
      openPortal: null,
    });
    expect(outcome).toEqual({
      kind: "redirect",
      url: "/login?redirect=/account/billing",
    });
  });

  it("1. redirects to /login even when a customer id is somehow present (auth is first priority)", async () => {
    // Defence in depth — if the auth layer fails to set userId but a
    // stale cookie leaked a customer id through, we still bounce the
    // user to sign-in rather than opening someone else's portal.
    const outcome = await resolveBillingPortalOutcome({
      userId: null,
      stripeCustomerId: "cus_leaked",
      openPortal: async () => makePortalSession("https://billing.stripe.com/p/x"),
    });
    expect(outcome).toEqual({
      kind: "redirect",
      url: "/login?redirect=/account/billing",
    });
  });

  it("2. redirects to /pricing?ref=billing when the user has no Stripe customer id (Free / no tier)", async () => {
    const outcome = await resolveBillingPortalOutcome({
      userId: "user-uuid",
      stripeCustomerId: null,
      // userTier omitted → falsy → /pricing branch.
      openPortal: async () => makePortalSession("https://billing.stripe.com/p/y"),
    });
    expect(outcome).toEqual({
      kind: "redirect",
      url: "/pricing?ref=billing",
    });
  });

  it("2. redirects to /pricing?ref=billing when the user is explicitly Free", async () => {
    const outcome = await resolveBillingPortalOutcome({
      userId: "user-uuid",
      stripeCustomerId: null,
      userTier: "free",
      openPortal: async () => makePortalSession("https://billing.stripe.com/p/y"),
    });
    expect(outcome).toEqual({
      kind: "redirect",
      url: "/pricing?ref=billing",
    });
  });

  it("2. (P0-1, 2026-04-30) returns app_store_managed fallback when a Pro user has no Stripe customer id", async () => {
    // App Store / RevenueCat path — the user has Pro entitlement
    // (synced from RevenueCat → profiles.user_tier) but no Stripe
    // customer because they paid via IAP. Server can't open a Stripe
    // portal for them; we route to the static fallback which already
    // carries the iOS Settings → Apple ID → Subscriptions copy.
    const outcome = await resolveBillingPortalOutcome({
      userId: "user-uuid",
      stripeCustomerId: null,
      userTier: "pro",
      openPortal: null,
    });
    expect(outcome.kind).toBe("fallback");
    if (outcome.kind === "fallback") {
      expect(outcome.reason).toBe("app_store_managed");
    }
  });

  it("2. App Store path takes priority over Stripe-not-configured (Pro + no customer + no opener)", async () => {
    // Defence-in-depth: even if STRIPE_SECRET_KEY is unset (openPortal
    // null), a Pro user without a customer id still resolves to the
    // App Store reason, not stripe_not_configured. The user-facing
    // fallback JSX is the same surface, but the reason string is what
    // server logs key off of.
    const outcome = await resolveBillingPortalOutcome({
      userId: "user-uuid",
      stripeCustomerId: null,
      userTier: "pro",
      openPortal: null,
    });
    if (outcome.kind === "fallback") {
      expect(outcome.reason).toBe("app_store_managed");
    } else {
      throw new Error("expected fallback outcome");
    }
  });

  it("3. returns fallback when STRIPE_SECRET_KEY is unset (openPortal === null)", async () => {
    const outcome = await resolveBillingPortalOutcome({
      userId: "user-uuid",
      stripeCustomerId: "cus_abc",
      openPortal: null,
    });
    expect(outcome.kind).toBe("fallback");
    if (outcome.kind === "fallback") {
      expect(outcome.reason).toBe("stripe_not_configured");
    }
  });

  it("4. returns fallback when the Stripe portal call throws", async () => {
    const outcome = await resolveBillingPortalOutcome({
      userId: "user-uuid",
      stripeCustomerId: "cus_abc",
      openPortal: async () => {
        throw new Error("network-down");
      },
    });
    expect(outcome.kind).toBe("fallback");
    if (outcome.kind === "fallback") {
      // Error message is captured for server-side logging (but not
      // leaked to the user — the UI copy is static).
      expect(outcome.reason).toContain("stripe_error");
      expect(outcome.reason).toContain("network-down");
    }
  });

  it("4. returns fallback when the Stripe portal session has no URL", async () => {
    // Stripe's type allows `url: null` (e.g. an incomplete session
    // somehow surfacing). We treat that as the same fallback as a
    // throw so the user never sees a blank screen.
    const outcome = await resolveBillingPortalOutcome({
      userId: "user-uuid",
      stripeCustomerId: "cus_abc",
      openPortal: async () => makePortalSession(null),
    });
    expect(outcome.kind).toBe("fallback");
    if (outcome.kind === "fallback") {
      expect(outcome.reason).toBe("stripe_no_portal_url");
    }
  });

  it("5. redirects to the Stripe portal URL on happy path", async () => {
    const outcome = await resolveBillingPortalOutcome({
      userId: "user-uuid",
      stripeCustomerId: "cus_abc",
      openPortal: async () =>
        makePortalSession("https://billing.stripe.com/p/session_abc123"),
    });
    expect(outcome).toEqual({
      kind: "redirect",
      url: "https://billing.stripe.com/p/session_abc123",
    });
  });

  it("never throws even for unexpected non-Error exceptions", async () => {
    // Defensive: if openPortal throws a string / object (misbehaving
    // fetch polyfill, for example), the helper must still return a
    // fallback outcome rather than bubbling — the page shell must not
    // 5xx for a user.
    const outcome = await resolveBillingPortalOutcome({
      userId: "user-uuid",
      stripeCustomerId: "cus_abc",
      openPortal: async () => {
        // Non-Error rejection (defensive path in `resolveBillingPortalOutcome`).
        throw 7;
      },
    });
    expect(outcome.kind).toBe("fallback");
  });
});

/**
 * Fallback JSX — legal-reviewer round-6 copy (2026-04-19).
 *
 * The four elements below are the non-negotiable parts of the
 * fallback; drift on any one of them is a legal regression:
 *   B1. SLA is hedged ("usually") — we do not promise a hard SLA.
 *   B2. 7-day refund policy link is present and routes to /terms#refunds.
 *   B3. Cancel-pathway line tells the user replying gets them cancelled.
 *   B4. App Store disclaimer routes iOS subscribers to iOS Settings
 *       (we cannot cancel an IAP subscription from the server —
 *       Apple policy).
 */
describe("BillingUnavailableFallback — legal-reviewer round-6 copy", () => {
  it("renders the support mailto link", () => {
    const { container } = render(<BillingUnavailableFallback />);
    const mail = container.querySelector('a[href="mailto:support@getsloe.com"]');
    expect(mail).not.toBeNull();
  });

  it("softens the SLA with 'usually'", () => {
    const { container } = render(<BillingUnavailableFallback />);
    const text = container.textContent ?? "";
    expect(text).toContain("usually reply within one business day");
    // Guard: the original hard-SLA line is retired.
    expect(text).not.toMatch(/We['\u2019]ll reply within one business day\./);
  });

  it("states the cancel-anytime pathway explicitly", () => {
    const { container } = render(<BillingUnavailableFallback />);
    const text = container.textContent ?? "";
    expect(text).toContain("cancel anytime by replying to support");
    expect(text).toContain("same business day");
  });

  it("carries the App Store iOS subscribers disclaimer", () => {
    const { container } = render(<BillingUnavailableFallback />);
    const text = container.textContent ?? "";
    expect(text).toContain("If you originally subscribed through the App Store");
    expect(text).toContain("iOS Settings");
    expect(text).toContain("Apple ID");
    expect(text).toContain("Subscriptions");
  });

  it("links to the 7-day refund policy at /terms#refunds", () => {
    const { container } = render(<BillingUnavailableFallback />);
    const refundLink = container.querySelector('a[href="/terms#refunds"]');
    expect(refundLink).not.toBeNull();
    expect(refundLink?.textContent).toBe("7-day refund policy");
  });
});
