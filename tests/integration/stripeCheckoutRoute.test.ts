/**
 * Route-level integration tests for POST /api/stripe/checkout — auth and
 * invalid tier short-circuit before Stripe SDK (complements
 * tests/unit/stripeCheckoutRoute.test.ts which pins session.create shape).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sessionsCreateMock = vi.fn();

vi.mock("stripe", () => ({
  default: class StripeMock {
    checkout = { sessions: { create: sessionsCreateMock } };
  },
}));

const getUserIdFromAuthHeaderMock = vi.fn();

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromAuthHeader: (h: string | null) => getUserIdFromAuthHeaderMock(h),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
}));

async function loadPost() {
  const mod = await import("../../app/api/stripe/checkout/route");
  return mod.POST;
}

function makeReq(body: unknown, authHeader?: string | null): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authHeader !== null) headers.authorization = authHeader ?? "Bearer t";
  return new Request("http://localhost/api/stripe/checkout", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/stripe/checkout (integration gates)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_xxx");
    vi.stubEnv("STRIPE_PRICE_BASE_MONTHLY", "price_base_m");
    vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_pro_m");
    getUserIdFromAuthHeaderMock.mockResolvedValue("user-1");
    sessionsCreateMock.mockResolvedValue({ url: "https://checkout.test/s" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when Authorization does not resolve to a user", async () => {
    getUserIdFromAuthHeaderMock.mockResolvedValueOnce(null);
    const POST = await loadPost();
    const res = await POST(makeReq({ tier: "base", period: "monthly" }));
    expect(res.status).toBe(401);
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid tier before Stripe", async () => {
    const POST = await loadPost();
    const res = await POST(makeReq({ tier: "enterprise" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_tier");
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });
});
