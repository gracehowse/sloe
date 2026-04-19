import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { resolveBillingPortalOutcome } from "../../src/lib/stripe/billingPortalDecision";

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

  it("2. redirects to /pricing?ref=billing when the user has no Stripe customer id", async () => {
    const outcome = await resolveBillingPortalOutcome({
      userId: "user-uuid",
      stripeCustomerId: null,
      openPortal: async () => makePortalSession("https://billing.stripe.com/p/y"),
    });
    expect(outcome).toEqual({
      kind: "redirect",
      url: "/pricing?ref=billing",
    });
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
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw "weird";
      },
    });
    expect(outcome.kind).toBe("fallback");
  });
});
