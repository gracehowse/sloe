/**
 * GET /api/stripe/subscription-status — payload-shape + branch tests
 * (ENG-748 #11). Pins the typed-minimal contract the route promises:
 *
 *   - never returns the raw Stripe customer object or a full PAN —
 *     only brand + last4 (legal P0);
 *   - splits managedVia by stripe_customer_id presence + tier
 *     (stripe / app_store / none);
 *   - reads current_period_end off the subscription ITEM (Stripe basil
 *     API moved it there);
 *   - surfaces STRIPE_TAX_ENABLED as `taxEnabled` (legal P0 PX-2);
 *   - never throws — Stripe / Supabase failures degrade to a typed
 *     error payload.
 *
 * Mocks Stripe + the Supabase service-role + auth-header resolvers the
 * same way `stripeCheckoutRoute.test.ts` does.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Stripe mock ------------------------------------------------------------

const customersRetrieveMock = vi.fn();

vi.mock("stripe", () => {
  return {
    default: class StripeMock {
      customers = { retrieve: customersRetrieveMock };
    },
  };
});

// --- Supabase mocks ---------------------------------------------------------

const getUserIdFromAuthHeaderMock = vi.fn();
const maybeSingleMock = vi.fn();
const serviceRoleClientMock = vi.fn();

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromAuthHeader: (h: string | null) => getUserIdFromAuthHeaderMock(h),
  createSupabaseServiceRoleClient: () => serviceRoleClientMock(),
}));

vi.mock("@/lib/observability/captureRouteError", () => ({
  captureRouteError: vi.fn(),
}));

// --- Rate limiter mock ------------------------------------------------------

const rateLimitMock = vi.fn();

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: (opts: unknown) => rateLimitMock(opts),
}));

// --- helpers ----------------------------------------------------------------

async function loadRoute() {
  const mod = await import("../../app/api/stripe/subscription-status/route");
  return mod.GET;
}

function makeReq(): Request {
  return new Request("http://localhost/api/stripe/subscription-status", {
    method: "GET",
    headers: { authorization: "Bearer test-token" },
  });
}

/** Build the chained Supabase select().eq().maybeSingle() mock. */
function stubProfile(row: Record<string, unknown> | null, error: unknown = null) {
  maybeSingleMock.mockResolvedValue({ data: row, error });
  serviceRoleClientMock.mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: maybeSingleMock }),
      }),
    }),
  });
}

const PERIOD_END = Math.floor(Date.UTC(2026, 5, 15, 12, 0, 0) / 1000);

/** A fully-expanded Stripe customer with one active subscription. */
function makeCustomer() {
  return {
    id: "cus_abc",
    deleted: false,
    subscriptions: {
      data: [
        {
          status: "active",
          cancel_at_period_end: false,
          trial_end: null,
          currency: "gbp",
          default_payment_method: {
            card: { brand: "visa", last4: "4242", number: "4242424242424242" },
          },
          items: {
            data: [
              {
                current_period_end: PERIOD_END,
                price: {
                  unit_amount: 2999,
                  currency: "gbp",
                  recurring: { interval: "month" },
                },
              },
            ],
          },
        },
      ],
    },
  };
}

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_xxx");
  vi.stubEnv("STRIPE_TAX_ENABLED", "false");

  customersRetrieveMock.mockReset();
  getUserIdFromAuthHeaderMock.mockReset();
  maybeSingleMock.mockReset();
  serviceRoleClientMock.mockReset();

  getUserIdFromAuthHeaderMock.mockResolvedValue("user-1");

  rateLimitMock.mockReset();
  rateLimitMock.mockResolvedValue({ ok: true, remaining: 9, resetAtMs: 0 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// --- auth -------------------------------------------------------------------

describe("GET /api/stripe/subscription-status — auth", () => {
  it("returns 401 when the auth header is missing / invalid", async () => {
    getUserIdFromAuthHeaderMock.mockResolvedValueOnce(null);
    const GET = await loadRoute();
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.managedVia).toBe("none");
    expect(body.subscription).toBeNull();
    expect(customersRetrieveMock).not.toHaveBeenCalled();
  });
});

// --- managedVia split -------------------------------------------------------

describe("GET /api/stripe/subscription-status — managedVia split", () => {
  it("free user (no customer id, free tier) → managedVia none", async () => {
    stubProfile({ stripe_customer_id: null, user_tier: "free" });
    const GET = await loadRoute();
    const res = await GET(makeReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.managedVia).toBe("none");
    expect(body.subscription).toBeNull();
    expect(customersRetrieveMock).not.toHaveBeenCalled();
  });

  it("pro user with no Stripe customer id → managedVia app_store (IAP)", async () => {
    stubProfile({ stripe_customer_id: null, user_tier: "pro" });
    const GET = await loadRoute();
    const res = await GET(makeReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.managedVia).toBe("app_store");
    expect(body.subscription).toBeNull();
    expect(customersRetrieveMock).not.toHaveBeenCalled();
  });

  it("user with a Stripe customer id → managedVia stripe + subscription summary", async () => {
    stubProfile({ stripe_customer_id: "cus_abc", user_tier: "pro" });
    customersRetrieveMock.mockResolvedValue(makeCustomer());
    const GET = await loadRoute();
    const res = await GET(makeReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.managedVia).toBe("stripe");
    expect(body.subscription).not.toBeNull();
    // Expansion was requested for subscriptions + default payment method.
    expect(customersRetrieveMock).toHaveBeenCalledWith("cus_abc", {
      expand: ["subscriptions", "subscriptions.data.default_payment_method"],
    });
  });
});

// --- payload shape (legal P0: typed minimal, no PAN, no raw object) ---------

describe("GET /api/stripe/subscription-status — payload shape", () => {
  it("returns ONLY the minimal typed fields — no raw Stripe object, no full PAN", async () => {
    stubProfile({ stripe_customer_id: "cus_abc", user_tier: "pro" });
    customersRetrieveMock.mockResolvedValue(makeCustomer());
    const GET = await loadRoute();
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.subscription).toEqual({
      status: "active",
      billingPeriod: "monthly",
      currentPeriodEnd: PERIOD_END,
      trialEnd: null,
      cancelAtPeriodEnd: false,
      priceAmount: 2999,
      currency: "gbp",
      paymentMethodBrand: "visa",
      paymentMethodLast4: "4242",
    });

    // Hard guard: the full card number must never appear anywhere in
    // the serialised payload.
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain("4242424242424242");
    // No raw Stripe customer fields leaked.
    expect(body.subscription).not.toHaveProperty("id");
    expect(body).not.toHaveProperty("customer");
  });

  it("reads current_period_end off the subscription ITEM (basil API)", async () => {
    stubProfile({ stripe_customer_id: "cus_abc", user_tier: "pro" });
    customersRetrieveMock.mockResolvedValue(makeCustomer());
    const GET = await loadRoute();
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.subscription.currentPeriodEnd).toBe(PERIOD_END);
  });

  it("maps annual interval to billingPeriod 'annual'", async () => {
    stubProfile({ stripe_customer_id: "cus_abc", user_tier: "pro" });
    const c = makeCustomer();
    c.subscriptions.data[0].items.data[0].price.recurring.interval = "year";
    customersRetrieveMock.mockResolvedValue(c);
    const GET = await loadRoute();
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.subscription.billingPeriod).toBe("annual");
  });

  it("returns a null subscription when the customer has none", async () => {
    stubProfile({ stripe_customer_id: "cus_abc", user_tier: "pro" });
    customersRetrieveMock.mockResolvedValue({
      id: "cus_abc",
      deleted: false,
      subscriptions: { data: [] },
    });
    const GET = await loadRoute();
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.subscription).toBeNull();
    expect(body.managedVia).toBe("stripe");
  });

  it("returns a null subscription when the Stripe customer was deleted", async () => {
    stubProfile({ stripe_customer_id: "cus_abc", user_tier: "pro" });
    customersRetrieveMock.mockResolvedValue({ id: "cus_abc", deleted: true });
    const GET = await loadRoute();
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.subscription).toBeNull();
    expect(body.managedVia).toBe("stripe");
  });
});

// --- tax flag (legal P0 PX-2) -----------------------------------------------

describe("GET /api/stripe/subscription-status — STRIPE_TAX_ENABLED surfacing", () => {
  it("surfaces taxEnabled true when STRIPE_TAX_ENABLED=true", async () => {
    vi.stubEnv("STRIPE_TAX_ENABLED", "true");
    stubProfile({ stripe_customer_id: null, user_tier: "free" });
    const GET = await loadRoute();
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.taxEnabled).toBe(true);
  });

  it("surfaces taxEnabled false for any non-'true' value", async () => {
    vi.stubEnv("STRIPE_TAX_ENABLED", "1");
    stubProfile({ stripe_customer_id: null, user_tier: "free" });
    const GET = await loadRoute();
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.taxEnabled).toBe(false);
  });
});

// --- no-store caching -------------------------------------------------------

describe("GET /api/stripe/subscription-status — caching", () => {
  it("sets Cache-Control: no-store (subscription state must never be cached)", async () => {
    stubProfile({ stripe_customer_id: null, user_tier: "free" });
    const GET = await loadRoute();
    const res = await GET(makeReq());
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});

// --- failure degradation (never throws) -------------------------------------

describe("GET /api/stripe/subscription-status — failure degradation", () => {
  it("degrades to a typed error when the service role key is unset", async () => {
    serviceRoleClientMock.mockReturnValue(null);
    const GET = await loadRoute();
    const res = await GET(makeReq());
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("service_role_unset");
    expect(body.managedVia).toBe("none");
  });

  it("degrades to a typed error when the profile read fails", async () => {
    stubProfile(null, { message: "rls denied" });
    const GET = await loadRoute();
    const res = await GET(makeReq());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("profile_read_failed");
  });

  it("degrades to a typed error (still managedVia stripe) when Stripe.retrieve throws", async () => {
    stubProfile({ stripe_customer_id: "cus_abc", user_tier: "pro" });
    customersRetrieveMock.mockRejectedValue(new Error("network-down"));
    const GET = await loadRoute();
    const res = await GET(makeReq());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.managedVia).toBe("stripe");
    expect(body.subscription).toBeNull();
  });

  it("reports stripe rail with a null sub when STRIPE_SECRET_KEY is unset but a customer id exists", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    stubProfile({ stripe_customer_id: "cus_abc", user_tier: "pro" });
    const GET = await loadRoute();
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("stripe_not_configured");
    expect(body.managedVia).toBe("stripe");
  });
});


// --- rate limiting (SEC-07, ENG-1389) ---------------------------------------

describe("GET /api/stripe/subscription-status — rate limiting", () => {
  it("scopes the bucket per authenticated user (mirrors checkout)", async () => {
    stubProfile({ stripe_customer_id: null, user_tier: "free" });
    const GET = await loadRoute();
    await GET(makeReq());
    expect(rateLimitMock).toHaveBeenCalledTimes(1);
    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        keyPrefix: "api:stripe-subscription-status",
        userId: "user-1",
        limit: 10,
        windowMs: 60_000,
      }),
    );
  });

  it("returns 429 with Retry-After and does NOT touch Supabase/Stripe when limited", async () => {
    rateLimitMock.mockResolvedValueOnce({
      ok: false,
      remaining: 0,
      resetAtMs: 0,
      retryAfterSec: 42,
      ip: null,
    });
    const GET = await loadRoute();
    const res = await GET(makeReq());
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("rate_limited");
    expect(body.subscription).toBeNull();
    // The limiter short-circuits before any billing lookup.
    expect(serviceRoleClientMock).not.toHaveBeenCalled();
    expect(customersRetrieveMock).not.toHaveBeenCalled();
  });

  it("does NOT rate-limit before authenticating (401 path skips the limiter)", async () => {
    getUserIdFromAuthHeaderMock.mockResolvedValueOnce(null);
    const GET = await loadRoute();
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    // Auth is checked first so an unauthenticated flood can't be scoped to a
    // user bucket — and we don't spend a limiter round-trip on it.
    expect(rateLimitMock).not.toHaveBeenCalled();
  });
});
