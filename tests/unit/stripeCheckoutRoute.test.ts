/**
 * Stripe Checkout route — session-creation shape tests.
 *
 * Pins the fields passed to `stripe.checkout.sessions.create` so that
 * once Stripe Tax is activated in the dashboard (and `tax_behavior` is
 * set on each Price), the "Price includes any applicable VAT"
 * disclosure on /pricing is truthful end-to-end.
 *
 * Round-6 (2026-04-19) made the tax wiring flag-gated behind
 * `STRIPE_TAX_ENABLED`. Specifically guards:
 *   1. Flag OFF → `automatic_tax` + `billing_address_collection` are
 *      NOT passed (pre-round-4 behaviour — prevents a 400 while Tax
 *      is inactive in the dashboard).
 *   2. Flag ON  → `automatic_tax: { enabled: true }` and
 *      `billing_address_collection: "auto"` are passed.
 *   3. `customer_update` is NEVER passed — the route mints a fresh
 *      Customer via `client_reference_id` and Stripe errors if
 *      `customer_update` is sent without an existing `customer` id.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Stripe mock ------------------------------------------------------------

const sessionsCreateMock = vi.fn();

vi.mock("stripe", () => {
  return {
    default: class StripeMock {
      checkout = {
        sessions: {
          create: sessionsCreateMock,
        },
      };
    },
  };
});

// --- Supabase auth-header resolver mock -------------------------------------

const getUserIdFromAuthHeaderMock = vi.fn();

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromAuthHeader: (h: string | null) => getUserIdFromAuthHeaderMock(h),
}));

// --- Rate limiter mock (always allow) ---------------------------------------

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true })),
}));

// --- helpers ----------------------------------------------------------------

async function loadRoute() {
  // Fresh import so each test picks up its own vi.stubEnv values at the
  // module top of `getStripe` / `appOrigin`.
  const mod = await import("../../app/api/stripe/checkout/route");
  return mod.POST;
}

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/stripe/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-token",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_xxx");
  vi.stubEnv("STRIPE_PRICE_BASE_MONTHLY", "price_base_m_test");
  vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_pro_m_test");
  vi.stubEnv("STRIPE_PRICE_BASE_ANNUAL", "price_base_a_test");
  vi.stubEnv("STRIPE_PRICE_PRO_ANNUAL", "price_pro_a_test");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.test");
  // Stripe Tax is flag-gated as of round-6 (2026-04-19). Default each
  // test to ON so the existing shape assertions stay authoritative;
  // the flag-OFF behaviour has its own describe block below.
  vi.stubEnv("STRIPE_TAX_ENABLED", "true");

  sessionsCreateMock.mockReset();
  sessionsCreateMock.mockResolvedValue({ url: "https://checkout.stripe.test/s/abc" });
  getUserIdFromAuthHeaderMock.mockReset();
  getUserIdFromAuthHeaderMock.mockResolvedValue("user-1");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// --- Stripe Tax fields ------------------------------------------------------

describe("POST /api/stripe/checkout — Stripe Tax wiring", () => {
  // PR-01 (audit 2026-04-28): Base tier was excised post-collapse;
  // these cases now exercise the Pro path. The Pro pricing covers
  // both monthly and annual SKUs.
  it("passes automatic_tax + billing_address_collection for pro monthly", async () => {
    const POST = await loadRoute();
    const res = await POST(makeReq({ tier: "pro", period: "monthly" }));
    expect(res.status).toBe(200);

    expect(sessionsCreateMock).toHaveBeenCalledTimes(1);
    const payload = sessionsCreateMock.mock.calls[0][0];
    expect(payload.automatic_tax).toEqual({ enabled: true });
    expect(payload.billing_address_collection).toBe("auto");
  });

  it("passes automatic_tax + billing_address_collection for pro annual", async () => {
    const POST = await loadRoute();
    const res = await POST(makeReq({ tier: "pro", period: "annual" }));
    expect(res.status).toBe(200);

    const payload = sessionsCreateMock.mock.calls[0][0];
    expect(payload.automatic_tax).toEqual({ enabled: true });
    expect(payload.billing_address_collection).toBe("auto");
    expect(payload.line_items).toEqual([
      { price: "price_pro_a_test", quantity: 1 },
    ]);
  });

  it("does NOT pass customer_update (no existing Customer id on this path)", async () => {
    // Stripe errors with "You must provide a customer ID when ... customer_update"
    // if customer_update is passed alongside a fresh-Customer checkout.
    // This route uses `client_reference_id` — Stripe mints a new Customer.
    const POST = await loadRoute();
    await POST(makeReq({ tier: "pro", period: "monthly" }));
    const payload = sessionsCreateMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty("customer_update");
    expect(payload).not.toHaveProperty("customer");
    expect(payload).not.toHaveProperty("customer_email");
  });

  it("preserves pre-existing fields (mode, metadata, success/cancel urls, promo codes)", async () => {
    const POST = await loadRoute();
    await POST(makeReq({ tier: "pro", period: "monthly" }));
    const payload = sessionsCreateMock.mock.calls[0][0];
    expect(payload.mode).toBe("subscription");
    expect(payload.client_reference_id).toBe("user-1");
    // ENG-667 (EUR checkout): the resolved checkout currency is now stamped into
    // metadata so the webhook can record it. Defaults to GBP (no EUR SKU / no geo
    // header in this test). Exact-equality still guards against unexpected fields.
    expect(payload.metadata).toEqual({
      supabase_user_id: "user-1",
      tier: "pro",
      period: "monthly",
      currency: "GBP",
    });
    expect(payload.subscription_data).toEqual({
      metadata: {
        supabase_user_id: "user-1",
        tier: "pro",
        period: "monthly",
        currency: "GBP",
      },
    });
    // Audit 2026-04-30 (user-sentiment pain #1): success URL now
    // points to the dedicated `/checkout/success` route which surfaces
    // the trust-explicit receipt copy (cancel path, trial-end, refund
    // window, support email). Pre-audit this redirected silently to
    // `/?checkout=success` and `App.tsx` swallowed the query param —
    // users got zero confirmation, which mirrors the dark-pattern
    // every competitor on the 14-app sentiment list got dinged for.
    expect(payload.success_url).toBe(
      "https://example.test/checkout/success?session_id={CHECKOUT_SESSION_ID}&period=monthly&tier=pro",
    );
    expect(payload.cancel_url).toBe("https://example.test/?checkout=cancel");
    expect(payload.allow_promotion_codes).toBe(true);
  });

  it("includes the Stripe session_id placeholder so the success page can retrieve subscription data", async () => {
    const POST = await loadRoute();
    await POST(makeReq({ tier: "pro", period: "annual" }));
    const payload = sessionsCreateMock.mock.calls[0][0];
    // Stripe substitutes `{CHECKOUT_SESSION_ID}` at redirect time. The
    // /checkout/success page can use this to look up the real
    // subscription details (trial_end timestamp, customer email)
    // when we wire up server-side receipt rendering.
    expect(payload.success_url).toContain("session_id={CHECKOUT_SESSION_ID}");
    // `period` and `tier` are echoed into the URL so the success
    // page can render the right "trial ends in 7 days" vs
    // "billed monthly" copy without a Stripe round-trip.
    expect(payload.success_url).toContain("period=annual");
    expect(payload.success_url).toContain("tier=pro");
  });
});

// --- Negative paths still short-circuit before sessions.create --------------

describe("POST /api/stripe/checkout — negative paths", () => {
  it("returns 401 when auth header is missing / invalid", async () => {
    getUserIdFromAuthHeaderMock.mockResolvedValueOnce(null);
    const POST = await loadRoute();
    const res = await POST(makeReq({ tier: "pro", period: "monthly" }));
    expect(res.status).toBe(401);
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown tier", async () => {
    const POST = await loadRoute();
    const res = await POST(makeReq({ tier: "enterprise" }));
    expect(res.status).toBe(400);
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  it("returns 503 when the price env var for the chosen tier/period is unset", async () => {
    vi.stubEnv("STRIPE_PRICE_PRO_ANNUAL", "");
    const POST = await loadRoute();
    const res = await POST(makeReq({ tier: "pro", period: "annual" }));
    expect(res.status).toBe(503);
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });
});

// --- STRIPE_TAX_ENABLED flag branching (round-6, 2026-04-19) ----------------

describe("POST /api/stripe/checkout — STRIPE_TAX_ENABLED flag", () => {
  it("flag OFF: does NOT pass automatic_tax or billing_address_collection", async () => {
    // With Stripe Tax inactive in the dashboard, passing
    // `automatic_tax: { enabled: true }` makes Stripe respond 400.
    // The flag lets the code ship ahead of the dashboard flip.
    vi.stubEnv("STRIPE_TAX_ENABLED", "false");
    const POST = await loadRoute();
    const res = await POST(makeReq({ tier: "pro", period: "monthly" }));
    expect(res.status).toBe(200);

    const payload = sessionsCreateMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty("automatic_tax");
    expect(payload).not.toHaveProperty("billing_address_collection");
  });

  it("flag unset: defaults to OFF (safest for an unconfigured env)", async () => {
    // Treating an unset env var as OFF matches the `.env.example`
    // default — a fresh clone / CI job with no Tax flag must not
    // accidentally send Stripe Tax fields.
    vi.stubEnv("STRIPE_TAX_ENABLED", "");
    const POST = await loadRoute();
    await POST(makeReq({ tier: "pro", period: "monthly" }));

    const payload = sessionsCreateMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty("automatic_tax");
    expect(payload).not.toHaveProperty("billing_address_collection");
  });

  it("flag ON: passes automatic_tax + billing_address_collection", async () => {
    vi.stubEnv("STRIPE_TAX_ENABLED", "true");
    const POST = await loadRoute();
    await POST(makeReq({ tier: "pro", period: "annual" }));

    const payload = sessionsCreateMock.mock.calls[0][0];
    expect(payload.automatic_tax).toEqual({ enabled: true });
    expect(payload.billing_address_collection).toBe("auto");
  });

  it("flag values other than the literal string 'true' count as OFF", async () => {
    // Guard: `STRIPE_TAX_ENABLED=1` or `=TRUE` should not accidentally
    // activate Tax — the route checks the literal string "true".
    for (const v of ["1", "TRUE", "yes", "on"]) {
      sessionsCreateMock.mockClear();
      vi.stubEnv("STRIPE_TAX_ENABLED", v);
      const POST = await loadRoute();
      await POST(makeReq({ tier: "pro", period: "monthly" }));
      const payload = sessionsCreateMock.mock.calls[0][0];
      expect(payload, `value=${v}`).not.toHaveProperty("automatic_tax");
    }
  });
});
